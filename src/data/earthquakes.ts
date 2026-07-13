import { supabase } from "../db/supabase"

type EarthquakeEvent = {
  id: string
  Latitude: number
  Longitude: number
  Magnitude: number
  Location: string | null
}

type Prediction = {
  event_id: string
  aftershock_24h_likelihood_level: string
}

export type EarthquakeMarker = {
  latitude: number
  longitude: number
  magnitude: number
  location: string | null
  aftershock24hLikelihoodLevel?: string
}

export async function getRecentEarthquakeMarkers(limit = 500): Promise<EarthquakeMarker[]> {
  const { data, error } = await supabase
    .from("RawEarthquakeEvents")
    .select("id,Latitude,Longitude,Magnitude,Location")
    .order("event_time", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw error

  const events = (data ?? []) as EarthquakeEvent[]
  const eventIds = events.map((event) => event.id)
  const { data: predictions, error: predictionsError } = eventIds.length
    ? await supabase
        .from("SeisPredictions_v1")
        .select("event_id,aftershock_24h_likelihood_level")
        .in("event_id", eventIds)
    : { data: [], error: null }

  if (predictionsError) {
    console.error("Unable to load earthquake predictions", predictionsError)
  }

  const predictionByEventId = new Map(
    ((predictions ?? []) as Prediction[]).map((prediction) => [prediction.event_id, prediction])
  )

  return events.map((event) => ({
    latitude: event.Latitude,
    longitude: event.Longitude,
    magnitude: event.Magnitude,
    location: event.Location,
    aftershock24hLikelihoodLevel: predictionByEventId.get(event.id)?.aftershock_24h_likelihood_level,
  }))
}
