import assert from "node:assert/strict"
import test from "node:test"

import { getMostLikelyDistance, getMostLikelyDistanceBand } from "../earthquake-forecast.ts"

const forecast = {
  within10Km: 0.18,
  between10And25Km: 0.44,
  between25And50Km: 0.27,
  beyond50Km: 0.11,
}

test("summarizes the highest-probability distance band", () => {
  assert.equal(getMostLikelyDistance(forecast), "10–25 km")
  assert.deepEqual(getMostLikelyDistanceBand(forecast)?.boundariesKm, [10, 25])
})

test("selects boundaries for every distance outcome", () => {
  const outcomes = [
    ["within10Km", [10]],
    ["between10And25Km", [10, 25]],
    ["between25And50Km", [25, 50]],
    ["beyond50Km", [50]],
  ] as const

  for (const [key, boundaries] of outcomes) {
    const probabilities = {
      within10Km: 0.1,
      between10And25Km: 0.1,
      between25And50Km: 0.1,
      beyond50Km: 0.1,
      [key]: 0.7,
    }
    assert.deepEqual(getMostLikelyDistanceBand(probabilities)?.boundariesKm, boundaries)
  }
})
