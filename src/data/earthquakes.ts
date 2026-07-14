import { supabase } from "../db/supabase"
import {
  createDefaultMapFilters,
  getPaginationState,
  MAP_PAGE_SIZE,
  MAX_MAP_EVENTS,
  type EarthquakeMapFilters,
} from "../lib/earthquake-map-filters"

type EarthquakeEvent = {
  id: string
  "Date-Time": string
  Latitude: number
  Longitude: number
  Depth: number | string
  Magnitude: number
  Location: string | null
  event_time: string | null
  has_forecast: boolean
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

function toEarthquakeMarkers(events: EarthquakeEvent[]) {
  return events.map((event) => {
    return {
      id: event.id,
      date: event["Date-Time"],
      latitude: event.Latitude,
      longitude: event.Longitude,
      depth: event.Depth,
      magnitude: event.Magnitude,
      location: event.Location,
      eventTime: event.event_time?.slice(0, 19),
      hasForecast: event.has_forecast,
      aftershock24hLikelihoodLevel: event.aftershock_24h_likelihood_level,
      m5PlusLikelihoodLevel: event.m5_plus_likelihood_level,
      estimatedStrongestAftershock: event.est_max_aftershock,
    } satisfies EarthquakeMarker
  })
}

async function getEarthquakeMarkerPage(
  filters: EarthquakeMapFilters,
  offset: number,
  query: string | null
): Promise<EarthquakeMarkerPage> {
  if (offset >= MAX_MAP_EVENTS) {
    return { events: [], nextOffset: MAX_MAP_EVENTS, hasMore: false, atLimit: true }
  }

  const pageSize = Math.min(MAP_PAGE_SIZE, MAX_MAP_EVENTS - offset)
  const { data, error } = await supabase.rpc("filter_earthquake_events", {
    query_text: query,
    magnitude_ranges: filters.events.magnitude,
    depth_from: filters.events.depth ? Number(filters.events.depth.from) : null,
    depth_to: filters.events.depth ? Number(filters.events.depth.to) : null,
    date_from: filters.events.date?.from ?? null,
    date_to: filters.events.date?.to ?? null,
    aftershock_24h_likelihoods: filters.forecasts.aftershock24hLikelihoods,
    m5_plus_likelihoods: filters.forecasts.m5PlusLikelihoods,
    minimum_estimated_strongest_aftershock: filters.forecasts.minimumEstimatedStrongestAftershock,
    include_no_forecast: filters.forecasts.includeNoForecast,
    result_limit: pageSize + 1,
    result_offset: offset,
  })
  if (error) throw error
  const rows = (data ?? []) as EarthquakeEvent[]
  const pageRows = rows.slice(0, pageSize)

  return {
    events: toEarthquakeMarkers(pageRows),
    ...getPaginationState(offset, pageRows.length, rows.length > pageRows.length),
  }
}

export async function searchEarthquakeMarkers(
  query: string,
  filters: EarthquakeMapFilters = createDefaultMapFilters(),
  offset = 0
): Promise<EarthquakeMarkerPage> {
  return getEarthquakeMarkerPage(filters, offset, query)
}

export async function getRecentEarthquakeMarkerPage(
  filters: EarthquakeMapFilters = createDefaultMapFilters(),
  offset = 0
): Promise<EarthquakeMarkerPage> {
  return getEarthquakeMarkerPage(filters, offset, null)
}
