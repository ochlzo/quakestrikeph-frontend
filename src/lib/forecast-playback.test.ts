import assert from "node:assert/strict"
import test from "node:test"

import type { ForecastPlaybackEvent } from "../data/earthquakes.ts"
import {
  FORECAST_WINDOW_MS,
  advancePlaybackTime,
  eventsWithinForecastWindow,
  gardnerKnopoffObservations,
  getPlaybackHorizon,
  observationDiscussion,
  probabilityDiscussion,
  scrubPlaybackTime,
  tickPlaybackTime,
} from "./forecast-playback.ts"

test("advances one forecast hour per real second and stops at the watermark", () => {
  const start = Date.parse("2026-07-15T00:00:00Z")
  const end = start + 3 * 60 * 60 * 1000
  assert.equal(advancePlaybackTime(start, 1000, 1, end), start + 60 * 60 * 1000)
  assert.equal(advancePlaybackTime(start, 1000, 4, end), end)
  assert.equal(advancePlaybackTime(start, 1000, 2, end), start + 2 * 60 * 60 * 1000)
  assert.equal(tickPlaybackTime(start, 1000, 4, end, false), start)
  assert.equal(tickPlaybackTime(start, 1000, 1, end, true), start + 60 * 60 * 1000)
})

test("starts with 24 hours and expands in 24-hour increments", () => {
  const start = Date.parse("2026-07-15T00:00:00Z")
  const watermark = start + 72 * 60 * 60 * 1000
  assert.equal(getPlaybackHorizon(start, start, watermark), start + FORECAST_WINDOW_MS)
  assert.equal(getPlaybackHorizon(start, start + FORECAST_WINDOW_MS, watermark), start + FORECAST_WINDOW_MS)
  assert.equal(getPlaybackHorizon(start, start + FORECAST_WINDOW_MS + 1, watermark), start + 2 * FORECAST_WINDOW_MS)
})

test("restarts and scrubs within the available observation range", () => {
  const start = Date.parse("2026-07-15T00:00:00Z")
  const watermark = start + 48 * 60 * 60 * 1000
  assert.equal(scrubPlaybackTime(start, start, watermark), start)
  assert.equal(scrubPlaybackTime(start + FORECAST_WINDOW_MS, start, watermark), start + FORECAST_WINDOW_MS)
  assert.equal(scrubPlaybackTime(start - 1, start, watermark), start)
  assert.equal(scrubPlaybackTime(watermark + 1, start, watermark), watermark)
})

test("keeps first-day comparisons separate from later observations", () => {
  const windowEnd = "2026-07-16T00:00:00Z"
  const events: ForecastPlaybackEvent[] = [
    { id: "inside", dateTime: "", eventTime: windowEnd, latitude: 0, longitude: 0, depth: 1, magnitude: 2, distanceKm: 3, withinGardnerKnopoffRadius: true },
    { id: "later", dateTime: "", eventTime: "2026-07-16T00:00:01Z", latitude: 0, longitude: 0, depth: 1, magnitude: 2, distanceKm: 3, withinGardnerKnopoffRadius: true },
  ]
  assert.deepEqual(
    eventsWithinForecastWindow(events, windowEnd).map((event) => event.id),
    ["inside"]
  )
})

test("keeps only events marked inside the Gardner–Knopoff radius", () => {
  const events: ForecastPlaybackEvent[] = [
    { id: "inside", dateTime: "", eventTime: "2026-07-15T01:00:00Z", latitude: 0, longitude: 0, depth: 1, magnitude: 2, distanceKm: 34.6, withinGardnerKnopoffRadius: true },
    { id: "outside", dateTime: "", eventTime: "2026-07-15T02:00:00Z", latitude: 0, longitude: 0, depth: 1, magnitude: 2, distanceKm: 34.8, withinGardnerKnopoffRadius: false },
  ]
  assert.deepEqual(gardnerKnopoffObservations(events).map((event) => event.id), ["inside"])
})

test("uses complete sentences for observation states and grammar", () => {
  assert.match(observationDiscussion("pending", 0), /still pending/)
  assert.match(observationDiscussion("delayed", 0), /may be incomplete/)
  assert.match(observationDiscussion("complete", 0), /No earthquakes were recorded within the Gardner–Knopoff/)
  assert.match(observationDiscussion("complete", 1), /^One screened earthquake was/)
  assert.match(observationDiscussion("current", 3), /^3 screened earthquakes were/)
})

test("explains probabilities without a correctness verdict", () => {
  assert.match(probabilityDiscussion(0.16), /not the most likely outcome/)
  assert.match(probabilityDiscussion(0.75), /more likely than not/)
  assert.doesNotMatch(probabilityDiscussion(0.75), /correct|incorrect/i)
})
