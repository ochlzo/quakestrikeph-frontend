import assert from "node:assert/strict"
import test from "node:test"

import type { EarthquakeForecast } from "../data/earthquakes.ts"
import { getMostLikelyDistance } from "./earthquake-forecast.ts"

const forecast = {
  within10Km: 0.18,
  between10And25Km: 0.44,
  between25And50Km: 0.27,
  beyond50Km: 0.11,
} as EarthquakeForecast

test("summarizes the highest-probability distance band", () => {
  assert.equal(getMostLikelyDistance(forecast), "10–25 km")
})
