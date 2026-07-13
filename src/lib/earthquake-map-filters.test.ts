import assert from "node:assert/strict"
import test from "node:test"

import { validateDateRange } from "./filter-validation.ts"
import { locationSearchScore } from "./location-search.ts"
import {
  magnitudeRangeFilter,
  magnitudeSelectionsToRanges,
  parseCustomMagnitudeRanges,
} from "./magnitude-ranges.ts"
import {
  collectPaginatedRows,
  createDefaultMapFilters,
  filterMarkersByForecast,
  hasActiveMapFilters,
  magnitudeMarkerBand,
  toEventTime,
} from "./earthquake-map-filters.ts"

test("filters forecast likelihoods", () => {
  const markers = [
    {
      id: "matching",
      hasForecast: true,
      aftershock24hLikelihoodLevel: "HIGH",
      m5PlusLikelihoodLevel: "low",
      estimatedStrongestAftershock: 4.5,
    },
    {
      id: "below-threshold",
      hasForecast: true,
      aftershock24hLikelihoodLevel: "HIGH",
      m5PlusLikelihoodLevel: "low",
      estimatedStrongestAftershock: 3.8,
    },
    { id: "missing-prediction", hasForecast: false },
  ]

  assert.equal(filterMarkersByForecast(markers, createDefaultMapFilters().forecasts).length, 3)
  assert.deepEqual(filterMarkersByForecast(markers, {
    aftershock24hLikelihoods: ["high"],
    m5PlusLikelihoods: ["low"],
    minimumEstimatedStrongestAftershock: 4,
    includeNoForecast: false,
  }).map((marker) => marker.id), ["matching"])
  assert.deepEqual(filterMarkersByForecast(markers, {
    aftershock24hLikelihoods: ["high"],
    m5PlusLikelihoods: ["low"],
    minimumEstimatedStrongestAftershock: 4,
    includeNoForecast: true,
  }).map((marker) => marker.id), ["matching", "missing-prediction"])
})

test("collects inclusive pages until the final short page", async () => {
  const source = Array.from({ length: 1201 }, (_, index) => index)
  const calls: Array<[number, number]> = []
  const rows = await collectPaginatedRows(async (from, to) => {
    calls.push([from, to])
    return source.slice(from, to + 1)
  })

  assert.equal(rows.length, 1201)
  assert.deepEqual(calls, [[0, 499], [500, 999], [1000, 1499]])
})

test("allows long date ranges but rejects reversed dates", () => {
  const from = new Date("2026-07-01T00:00:00.000Z")
  const now = new Date("2026-09-01T00:00:00.000Z")
  assert.equal(validateDateRange({ from, to: new Date("2026-08-01T00:00:00.000Z") }, now), undefined)
  assert.equal(
    validateDateRange({ from, to: new Date("2026-06-30T23:59:59.999Z") }, now),
    "From date must be on or before To date."
  )
})

test("rejects From or To dates after today", () => {
  const now = new Date("2026-07-13T12:00:00.000Z")
  assert.equal(
    validateDateRange({
      from: new Date("2026-07-14T00:00:00.000Z"),
      to: new Date("2026-07-15T00:00:00.000Z"),
    }, now),
    "From date cannot be after today."
  )
  assert.equal(
    validateDateRange({
      from: new Date("2026-07-13T00:00:00.000Z"),
      to: new Date("2026-07-15T00:00:00.000Z"),
    }, now),
    "To date cannot be after today."
  )
})

test("formats event times as Philippine wall-clock timestamps", () => {
  assert.equal(toEventTime(new Date("2026-07-12T16:00:00.000Z")), "2026-07-13T00:00:00")
})

test("assigns marker colors at magnitude boundaries", () => {
  assert.deepEqual(
    [2.9, 3, 3.9, 4, 4.9, 5].map(magnitudeMarkerBand),
    ["below-3", "3", "3", "4", "4", "5-plus"]
  )
})

test("parses preset and custom magnitude selections into a safe OR filter", () => {
  assert.deepEqual(parseCustomMagnitudeRanges("1-2, 3.5-4.5"), {
    values: ["1-2", "3.5-4.5"],
  })
  assert.match(parseCustomMagnitudeRanges("4-3").error ?? "", /lower value/)

  const ranges = magnitudeSelectionsToRanges(["magnitude-below-3", "4.2-5.1"])
  assert.equal(
    magnitudeRangeFilter(ranges),
    "and(Magnitude.gte.0,Magnitude.lt.3),and(Magnitude.gte.4.2,Magnitude.lte.5.1)"
  )
})

test("finds locations despite common misspellings", () => {
  assert.notEqual(locationSearchScore("Manila, Metro Manila", "manla"), null)
  assert.notEqual(locationSearchScore("Quezon City", "quezon cty"), null)
  assert.equal(locationSearchScore("Davao City", "cebu"), null)
  assert.ok(locationSearchScore("Cebu City", "cebu")! < locationSearchScore("Cebu Province", "cebu provnce")!)
})

test("detects filters applied to the current map query", () => {
  assert.equal(hasActiveMapFilters(createDefaultMapFilters()), false)

  const filtered = createDefaultMapFilters()
  filtered.forecasts.aftershock24hLikelihoods = ["high"]
  assert.equal(hasActiveMapFilters(filtered), true)
})
