import type { MagnitudeRange } from "./magnitude-ranges"

export const FORECAST_LIKELIHOODS = ["low", "medium", "high"] as const
export const FILTERS_COMPLETE_EVENT = "quakestrike:filters-complete"
export const EARTHQUAKE_EVENTS_UPDATED_EVENT = "quakestrike:earthquake-events-updated"
export const EARTHQUAKE_EVENTS_REQUEST_EVENT = "quakestrike:earthquake-events-request"
export const EARTHQUAKE_SELECTED_EVENT = "quakestrike:earthquake-selected"
export const EARTHQUAKE_FOCUS_EVENT = "quakestrike:earthquake-focus"
export const EARTHQUAKE_RENDER_EVENTS_EVENT = "quakestrike:earthquake-render-events"
export const EARTHQUAKE_LOAD_MORE_EVENT = "quakestrike:earthquake-load-more"
export const FILTERS_ACTIVE_EVENT = "quakestrike:filters-active"
export const MAX_MAP_EVENTS = 2000
export const MAP_PAGE_SIZE = 50
const EVENT_TIME_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})
export type FilterRange = { from: string; to: string }
export type ForecastFilters = {
  aftershock24hLikelihoods: string[]
  m5PlusLikelihoods: string[]
  minimumEstimatedStrongestAftershock: number | null
  includeNoForecast: boolean
}
export type EarthquakeMapFilters = {
  events: {
    magnitude: MagnitudeRange[] | null
    depth: FilterRange | null
    date: FilterRange | null
  }
  forecasts: ForecastFilters
}

export function createDefaultMapFilters(): EarthquakeMapFilters {
  return {
    events: { magnitude: null, depth: null, date: null },
    forecasts: {
      aftershock24hLikelihoods: [...FORECAST_LIKELIHOODS],
      m5PlusLikelihoods: [...FORECAST_LIKELIHOODS],
      minimumEstimatedStrongestAftershock: null,
      includeNoForecast: true,
    },
  }
}

export function countActiveMapFilters(filters?: EarthquakeMapFilters) {
  if (!filters) return 0

  return [
    filters.events.magnitude,
    filters.events.depth,
    filters.events.date,
    filters.forecasts.minimumEstimatedStrongestAftershock !== null,
    !filters.forecasts.includeNoForecast,
    !FORECAST_LIKELIHOODS.every((value) => filters.forecasts.aftershock24hLikelihoods.includes(value)),
    !FORECAST_LIKELIHOODS.every((value) => filters.forecasts.m5PlusLikelihoods.includes(value)),
  ].filter(Boolean).length
}

export function hasActiveMapFilters(filters?: EarthquakeMapFilters) {
  return countActiveMapFilters(filters) > 0
}

export function endOfDay(date?: Date) {
  if (!date) return undefined
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

export function toEventTime(date: Date) {
  return EVENT_TIME_FORMATTER.format(date).replace(" ", "T")
}

export function magnitudeMarkerBand(magnitude: number) {
  if (magnitude >= 5) return "5-plus"
  if (magnitude >= 4) return "4"
  if (magnitude >= 3) return "3"
  return "below-3"
}

export function getPaginationState(offset: number, consumed: number, hasExtra: boolean) {
  const nextOffset = Math.min(offset + consumed, MAX_MAP_EVENTS)
  return {
    nextOffset,
    hasMore: hasExtra && nextOffset < MAX_MAP_EVENTS,
    atLimit: nextOffset >= MAX_MAP_EVENTS,
  }
}
