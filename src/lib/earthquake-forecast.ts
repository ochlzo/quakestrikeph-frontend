import type { EarthquakeForecast } from "../data/earthquakes"

export const FORECAST_DISTANCE_BANDS = [
  { key: "within10Km", label: "Within 10 km" },
  { key: "between10And25Km", label: "10–25 km" },
  { key: "between25And50Km", label: "25–50 km" },
  { key: "beyond50Km", label: "Beyond 50 km" },
] as const

export function getMostLikelyDistance(forecast: EarthquakeForecast) {
  let mostLikely: { label: string; probability: number } | null = null

  for (const band of FORECAST_DISTANCE_BANDS) {
    const probability = forecast[band.key]
    if (probability !== null && (!mostLikely || probability > mostLikely.probability)) {
      mostLikely = { label: band.label, probability }
    }
  }

  return mostLikely?.label ?? "Unavailable"
}
