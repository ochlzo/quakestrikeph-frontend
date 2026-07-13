import assert from "node:assert/strict"
import test from "node:test"

import { validateDateRange } from "./filter-validation.ts"
import {
  collectPaginatedRows,
  createDefaultMapFilters,
  filterMarkersByForecast,
  mostLikelyDistanceBand,
} from "./earthquake-map-filters.ts"

test("derives and filters forecast fields", () => {
  assert.equal(mostLikelyDistanceBand({
    within_10km: 0.1,
    between_10_25km: 0.5,
    between_25_50km: 0.3,
    beyond_50km: 0.1,
  }), "between_10_25km")

  const markers = [
    {
      id: "matching",
      aftershock24hLikelihoodLevel: "HIGH",
      m5PlusLikelihoodLevel: "low",
      distanceBand: "within_10km" as const,
    },
    { id: "missing-prediction" },
  ]

  assert.equal(filterMarkersByForecast(markers, createDefaultMapFilters().forecasts).length, 2)
  assert.deepEqual(filterMarkersByForecast(markers, {
    aftershock24hLikelihoods: ["high"],
    m5PlusLikelihoods: ["low"],
    distanceBands: ["within_10km"],
  }).map((marker) => marker.id), ["matching"])
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
  assert.equal(validateDateRange({ from, to: new Date("2026-08-01T00:00:00.000Z") }), undefined)
  assert.equal(
    validateDateRange({ from, to: new Date("2026-06-30T23:59:59.999Z") }),
    "From date must be on or before To date."
  )
})
