import { supabase } from "../db/supabase"
import {
  collectPaginatedRows,
  createDefaultMapFilters,
  filterMarkersByForecast,
  mostLikelyDistanceBand,
  type DistanceBand,
  type EarthquakeMapFilters,
} from "../lib/earthquake-map-filters"

const PREDICTION_BATCH_SIZE = 200

type EarthquakeEvent = {
  id: string
  Latitude: number
  Longitude: number
  Magnitude: number
  Location: string | null
}

type Prediction = {
  event_id: string
  aftershock_24h_likelihood_level: string | null
  m5_plus_likelihood_level: string | null
  within_10km: number | null
  between_10_25km: number | null
  between_25_50km: number | null
  beyond_50km: number | null
}

export type EarthquakeMarker = {
  latitude: number
  longitude: number
  magnitude: number
  location: string | null
  aftershock24hLikelihoodLevel?: string | null
  m5PlusLikelihoodLevel?: string | null
  distanceBand?: DistanceBand
}

function buildEventQuery(filters: EarthquakeMapFilters, countOnly = false) {
  const now = new Date()
  const dateFrom = filters.events.date?.from
    ?? new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const dateTo = filters.events.date?.to ?? now.toISOString()
  let query = supabase
    .from("RawEarthquakeEvents")
    .select(
      countOnly ? "id" : "id,Latitude,Longitude,Magnitude,Location",
      countOnly ? { count: "exact", head: true } : undefined
    )
    .gte("event_time", dateFrom)
    .lte("event_time", dateTo)

  if (filters.events.magnitude) {
    query = query
      .gte("Magnitude", Number(filters.events.magnitude.from))
      .lte("Magnitude", Number(filters.events.magnitude.to))
  }
  if (filters.events.depth) {
    query = query
      .gte("Depth", Number(filters.events.depth.from))
      .lte("Depth", Number(filters.events.depth.to))
  }

  return query
}

export async function countEarthquakeEvents(filters: EarthquakeMapFilters) {
  const { count, error } = await buildEventQuery(filters, true)
  if (error) throw error
  return count ?? 0
}

export async function getRecentEarthquakeMarkers(
  filters: EarthquakeMapFilters = createDefaultMapFilters()
): Promise<EarthquakeMarker[]> {
  const events = await collectPaginatedRows<EarthquakeEvent>(async (from, to) => {
    const { data, error } = await buildEventQuery(filters)
      .order("event_time", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .range(from, to)
    if (error) throw error
    return (data ?? []) as EarthquakeEvent[]
  })
  const eventIds = events.map((event) => event.id)
  const predictionPages = await Promise.all(
    Array.from({ length: Math.ceil(eventIds.length / PREDICTION_BATCH_SIZE) }, async (_, index) => {
      const ids = eventIds.slice(index * PREDICTION_BATCH_SIZE, (index + 1) * PREDICTION_BATCH_SIZE)
      const { data, error } = await supabase
          .from("SeisPredictions_v1")
          .select("event_id,aftershock_24h_likelihood_level,m5_plus_likelihood_level,within_10km,between_10_25km,between_25_50km,beyond_50km")
          .in("event_id", ids)
      if (error) throw error
      return (data ?? []) as Prediction[]
    })
  )
  const predictions = predictionPages.flat()

  const predictionByEventId = new Map(
    predictions.map((prediction) => [prediction.event_id, prediction])
  )

  return filterMarkersByForecast(events.map((event) => {
    const prediction = predictionByEventId.get(event.id)
    return {
      latitude: event.Latitude,
      longitude: event.Longitude,
      magnitude: event.Magnitude,
      location: event.Location,
      aftershock24hLikelihoodLevel: prediction?.aftershock_24h_likelihood_level,
      m5PlusLikelihoodLevel: prediction?.m5_plus_likelihood_level,
      distanceBand: prediction ? mostLikelyDistanceBand(prediction) : undefined,
    }
  }), filters.forecasts)
}
