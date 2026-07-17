import type { EarthquakeForecast } from "../data/earthquakes"

export const FORECAST_DISTANCE_BANDS = [
  { key: "within10Km", label: "Within 10 km", boundariesKm: [10] },
  { key: "between10And25Km", label: "10–25 km", boundariesKm: [10, 25] },
  { key: "between25And50Km", label: "25–50 km", boundariesKm: [25, 50] },
  { key: "beyond50Km", label: "Beyond 50 km", boundariesKm: [50] },
] as const

type DistanceForecast = Pick<
  EarthquakeForecast,
  (typeof FORECAST_DISTANCE_BANDS)[number]["key"]
>

export function getMostLikelyDistanceBand(forecast: DistanceForecast) {
  let mostLikely: (typeof FORECAST_DISTANCE_BANDS)[number] | null = null
  let highestProbability = -1

  for (const band of FORECAST_DISTANCE_BANDS) {
    const probability = forecast[band.key]
    if (probability !== null && probability > highestProbability) {
      mostLikely = band
      highestProbability = probability
    }
  }

  return mostLikely
}

export function getMostLikelyDistance(forecast: DistanceForecast) {
  return getMostLikelyDistanceBand(forecast)?.label ?? "Unavailable"
}
