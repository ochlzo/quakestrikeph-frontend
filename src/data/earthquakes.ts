import { supabase } from "../db/supabase"
import {
  createDefaultMapFilters,
  filterMarkersByEvent,
  filterMarkersByForecast,
  getPaginationState,
  MAP_PAGE_SIZE,
  MAX_MAP_EVENTS,
  type EarthquakeMapFilters,
} from "../lib/earthquake-map-filters"
import { magnitudeRangeFilter } from "../lib/magnitude-ranges"

const PREDICTION_BATCH_SIZE = 200

type EarthquakeEvent = {
  id: string
  "Date-Time": string
  Latitude: number
  Longitude: number
  Depth: number | string
  Magnitude: number
  Location: string | null
  event_time: string | null
}

type Prediction = {
  event_id: string
  aftershock_24h_likelihood_level: string | null
  m5_plus_likelihood_level: string | null
  est_max_aftershock: number | null
}

export type EarthquakeMarker = {
  id: string
  date: string
  latitude: number
  longitude: number
  depth: number | string
  magnitude: number
  location: string | null
  eventTime?: string | null
  hasForecast: boolean
  aftershock24hLikelihoodLevel?: string | null
  m5PlusLikelihoodLevel?: string | null
  estimatedStrongestAftershock?: number | null
}

export type EarthquakeMarkerPage = {
  events: EarthquakeMarker[]
  nextOffset: number
  hasMore: boolean
  atLimit: boolean
}

function buildEventQuery(filters: EarthquakeMapFilters) {
  let query = supabase
    .from("RawEarthquakeEvents")
    .select('id,"Date-Time",Latitude,Longitude,Depth,Magnitude,Location,event_time')

  if (filters.events.date) {
    query = query
      .gte("event_time", filters.events.date.from)
      .lte("event_time", filters.events.date.to)
  }

  if (filters.events.magnitude?.length) {
    query = query.or(magnitudeRangeFilter(filters.events.magnitude))
  }
  if (filters.events.depth) {
    query = query
      .gte("Depth", Number(filters.events.depth.from))
      .lte("Depth", Number(filters.events.depth.to))
  }

  return query
}

async function toEarthquakeMarkers(events: EarthquakeEvent[]) {
  const eventIds = events.map((event) => event.id)
  if (!eventIds.length) return []

  const predictionPages = await Promise.all(
    Array.from({ length: Math.ceil(eventIds.length / PREDICTION_BATCH_SIZE) }, async (_, index) => {
      const ids = eventIds.slice(index * PREDICTION_BATCH_SIZE, (index + 1) * PREDICTION_BATCH_SIZE)
      const { data, error } = await supabase
        .from("SeisPredictions_v1")
        .select("event_id,aftershock_24h_likelihood_level,m5_plus_likelihood_level,est_max_aftershock")
        .in("event_id", ids)
      if (error) throw error
      return (data ?? []) as Prediction[]
    })
  )
  const predictionByEventId = new Map(
    predictionPages.flat().map((prediction) => [prediction.event_id, prediction])
  )

  return events.map((event) => {
    const prediction = predictionByEventId.get(event.id)
    return {
      id: event.id,
      date: event["Date-Time"],
      latitude: event.Latitude,
      longitude: event.Longitude,
      depth: event.Depth,
      magnitude: event.Magnitude,
      location: event.Location,
      eventTime: event.event_time?.slice(0, 19),
      hasForecast: Boolean(prediction),
      aftershock24hLikelihoodLevel: prediction?.aftershock_24h_likelihood_level,
      m5PlusLikelihoodLevel: prediction?.m5_plus_likelihood_level,
      estimatedStrongestAftershock: prediction?.est_max_aftershock,
    } satisfies EarthquakeMarker
  })
}

export async function searchEarthquakeMarkers(
  query: string,
  filters: EarthquakeMapFilters = createDefaultMapFilters(),
  offset = 0
): Promise<EarthquakeMarkerPage> {
  if (offset >= MAX_MAP_EVENTS) {
    return { events: [], nextOffset: MAX_MAP_EVENTS, hasMore: false, atLimit: true }
  }

  const { data, error } = await supabase.rpc("search_earthquake_events", {
    query_text: query,
    result_limit: MAP_PAGE_SIZE + 1,
    result_offset: offset,
  })
  if (error) throw error
  const rows = (data ?? []) as EarthquakeEvent[]
  const pageRows = rows.slice(0, Math.min(MAP_PAGE_SIZE, MAX_MAP_EVENTS - offset))
  const markers = filterMarkersByEvent(await toEarthquakeMarkers(pageRows), filters.events)

  return {
    events: filterMarkersByForecast(markers, filters.forecasts),
    ...getPaginationState(offset, pageRows.length, rows.length > pageRows.length),
  }
}

export async function getRecentEarthquakeMarkerPage(
  filters: EarthquakeMapFilters = createDefaultMapFilters(),
  offset = 0
): Promise<EarthquakeMarkerPage> {
  if (offset >= MAX_MAP_EVENTS) {
    return { events: [], nextOffset: MAX_MAP_EVENTS, hasMore: false, atLimit: true }
  }

  const to = Math.min(offset + MAP_PAGE_SIZE - 1, MAX_MAP_EVENTS - 1)
  const { data, error } = await buildEventQuery(filters)
    .order("event_time", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(offset, to)
  if (error) throw error
  const rows = (data ?? []) as EarthquakeEvent[]

  return {
    events: filterMarkersByForecast(await toEarthquakeMarkers(rows), filters.forecasts),
    ...getPaginationState(offset, rows.length, rows.length === to - offset + 1),
  }
}
