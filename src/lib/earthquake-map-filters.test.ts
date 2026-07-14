import assert from "node:assert/strict"
import test from "node:test"

import { validateDateRange } from "./filter-validation.ts"
import {
  magnitudeSelectionsToRanges,
  parseCustomMagnitudeRanges,
} from "./magnitude-ranges.ts"
import {
  countActiveMapFilters,
  createDefaultMapFilters,
  getPaginationState,
  hasActiveMapFilters,
  magnitudeMarkerBand,
  toEventTime,
} from "./earthquake-map-filters.ts"

test("stops pagination at the map event limit", () => {
  assert.deepEqual(getPaginationState(0, 6, false), {
    nextOffset: 6,
    hasMore: false,
    atLimit: false,
  })
  assert.deepEqual(getPaginationState(50, 50, true), {
    nextOffset: 100,
    hasMore: true,
    atLimit: false,
  })
  assert.deepEqual(getPaginationState(1950, 50, true), {
    nextOffset: 2000,
    hasMore: false,
    atLimit: true,
  })
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

test("parses preset and custom magnitude selections", () => {
  assert.deepEqual(parseCustomMagnitudeRanges("1-2, 3.5-4.5"), {
    values: ["1-2", "3.5-4.5"],
  })
  assert.match(parseCustomMagnitudeRanges("4-3").error ?? "", /lower value/)

  const ranges = magnitudeSelectionsToRanges(["magnitude-below-3", "4.2-5.1"])
  assert.deepEqual(ranges, [
    { from: 0, to: 3, upperExclusive: true },
    { from: 4.2, to: 5.1 },
  ])
})

test("detects filters applied to the current map query", () => {
  assert.equal(hasActiveMapFilters(createDefaultMapFilters()), false)
  assert.equal(countActiveMapFilters(createDefaultMapFilters()), 0)

  const filtered = createDefaultMapFilters()
  filtered.forecasts.aftershock24hLikelihoods = ["high"]
  filtered.events.depth = { from: "0", to: "50" }
  assert.equal(hasActiveMapFilters(filtered), true)
  assert.equal(countActiveMapFilters(filtered), 2)
})
