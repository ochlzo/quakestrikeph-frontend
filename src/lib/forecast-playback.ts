import type {
  ForecastObservationStatus,
  ForecastPlaybackEvent,
} from "../data/earthquakes"

export const FORECAST_WINDOW_MS = 24 * 60 * 60 * 1000
export const VIRTUAL_HOUR_PER_SECOND = 60 * 60

export function advancePlaybackTime(
  currentTime: number,
  elapsedRealMs: number,
  speed: number,
  observedThrough: number
) {
  return Math.min(
    currentTime + elapsedRealMs * VIRTUAL_HOUR_PER_SECOND * speed,
    observedThrough
  )
}

export function tickPlaybackTime(
  currentTime: number,
  elapsedRealMs: number,
  speed: number,
  observedThrough: number,
  playing: boolean
) {
  return playing
    ? advancePlaybackTime(currentTime, elapsedRealMs, speed, observedThrough)
    : currentTime
}

export function scrubPlaybackTime(
  requestedTime: number,
  forecastStartedAt: number,
  observedThrough: number
) {
  const upperBound = Math.max(forecastStartedAt, observedThrough)
  return Math.min(Math.max(requestedTime, forecastStartedAt), upperBound)
}

export function getPlaybackHorizon(
  forecastStartedAt: number,
  currentTime: number,
  observedThrough: number
) {
  const elapsed = Math.max(0, currentTime - forecastStartedAt)
  const windows = Math.max(1, Math.ceil(elapsed / FORECAST_WINDOW_MS))
  return Math.min(forecastStartedAt + windows * FORECAST_WINDOW_MS, observedThrough)
}

export function eventsWithinForecastWindow(
  events: ForecastPlaybackEvent[],
  forecastWindowEndsAt: string
) {
  const end = Date.parse(forecastWindowEndsAt)
  return events.filter((event) => Date.parse(event.eventTime) <= end)
}

export function probabilityDiscussion(probability: number | null) {
  if (probability === null) return "The model did not provide an aftershock probability for this event."
  const percent = new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(probability)
  if (probability > 0.5) {
    return `The model estimates a ${percent} chance of at least one aftershock, making an aftershock more likely than not during the 24-hour forecast window.`
  }
  if (probability === 0.5) {
    return `The model estimates a ${percent} chance of at least one aftershock, so occurrence and non-occurrence are equally likely.`
  }
  return `The model estimates a ${percent} chance of at least one aftershock. An aftershock is possible, but it is not the most likely outcome.`
}

export function observationDiscussion(
  status: ForecastObservationStatus,
  count: number
) {
  if (status === "pending") {
    return "This forecast is fresh and no later successful catalog update is available yet. Observed results are still pending."
  }
  if (status === "delayed") {
    return "The latest catalog update was delayed. Available observations may be incomplete and should not be treated as a final result."
  }
  if (count === 0) {
    return status === "complete"
      ? "No nearby earthquakes were recorded during the completed 24-hour forecast window."
      : "No nearby earthquakes have been recorded so far. The 24-hour forecast window is still in progress."
  }
  const events = count === 1 ? "One nearby earthquake was" : `${count} nearby earthquakes were`
  const ending = status === "complete"
    ? "during the completed 24-hour forecast window."
    : "so far. The 24-hour forecast window is still in progress."
  return `${events} recorded ${ending}`
}

export function formatElapsedTime(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  return [days ? `${days}d` : "", `${hours}h`, `${minutes}m`].filter(Boolean).join(" ")
}
