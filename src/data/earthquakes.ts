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

export type EarthquakeEventDetail = Omit<EarthquakeMarker, "hasForecast"> & {
  eventTime: string | null
}

export type ForecastObservationStatus = "pending" | "current" | "complete" | "delayed"
export type ForecastPlaybackScope = "gk" | "100km" | "all"

export type ForecastPlaybackEvent = {
  id: string
  dateTime: string
  eventTime: string
  latitude: number
  longitude: number
  depth: number | string
  magnitude: number
  distanceKm: number
  withinGardnerKnopoffRadius: boolean
}

export type ForecastPlaybackCursor = {
  eventTime: string
  eventId: string
}

export type ForecastPlaybackPage = {
  status: ForecastObservationStatus
  playbackScope: ForecastPlaybackScope
  gardnerKnopoffRadiusKm: number
  forecastStartedAt: string
  forecastWindowEndsAt: string
  observedThrough: string | null
  events: ForecastPlaybackEvent[]
  nextCursor: ForecastPlaybackCursor | null
  hasMore: boolean
}

export type EarthquakeMarkerPage = {
  events: EarthquakeMarker[]
  nextOffset: number
  hasMore: boolean
  atLimit: boolean
}

type EarthquakeForecastRow = {
  event_id: string
  created_at: string
  aftershock_24h: number | null
  m5_plus_aftershock: number | null
  within_10km: number | null
  between_10_25km: number | null
  between_25_50km: number | null
  beyond_50km: number | null
  est_max_aftershock: number | null
  aftershock_24h_likelihood_level: string | null
  m5_plus_likelihood_level: string | null
  aftershock_msg: string | null
  m5_plus_msg: string | null
  distance_msg: string | null
  max_magnitude_msg: string | null
}

type ForecastPlaybackRpcResponse = {
  status: ForecastObservationStatus
  playback_scope: ForecastPlaybackScope
  gk_radius_km: number
  forecast_started_at: string
  forecast_window_ends_at: string
  observed_through: string | null
  events: Array<{
    id: string
    date_time: string
    event_time: string
    latitude: number
    longitude: number
    depth: number | string
    magnitude: number
    distance_km: number
    within_gk_radius: boolean
  }>
  next_cursor: { event_time: string; event_id: string } | null
  has_more: boolean
}

type ForecastReviewRpcResponse = {
  review_text: string
  reviewed_at: string
  display_name: string
}

export type EarthquakeForecast = {
  eventId: string
  createdAt: string
  aftershock24h: number | null
  m5PlusAftershock: number | null
  within10Km: number | null
  between10And25Km: number | null
  between25And50Km: number | null
  beyond50Km: number | null
  estimatedStrongestAftershock: number | null
  aftershock24hLikelihoodLevel: string | null
  m5PlusLikelihoodLevel: string | null
  aftershockMessage: string | null
  m5PlusMessage: string | null
  distanceMessage: string | null
  maxMagnitudeMessage: string | null
}

export type ForecastReview = {
  reviewText: string
  reviewedAt: string
  displayName: string
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

export async function getEarthquakeEvent(eventId: string): Promise<EarthquakeEventDetail | null> {
  const { data, error } = await supabase
    .from("RawEarthquakeEvents")
    .select('id, "Date-Time", "Latitude", "Longitude", "Depth", "Magnitude", "Location", event_time')
    .eq("id", eventId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    date: data["Date-Time"],
    latitude: data.Latitude,
    longitude: data.Longitude,
    depth: data.Depth,
    magnitude: data.Magnitude,
    location: data.Location,
    eventTime: data.event_time,
  }
}

export async function getEarthquakeForecast(eventId: string): Promise<EarthquakeForecast | null> {
  const { data, error } = await supabase
    .from("SeisPredictions_v1")
    .select(`
      event_id, created_at, aftershock_24h, m5_plus_aftershock,
      within_10km, between_10_25km, between_25_50km, beyond_50km,
      est_max_aftershock, aftershock_24h_likelihood_level, m5_plus_likelihood_level,
      aftershock_msg, m5_plus_msg, distance_msg, max_magnitude_msg
    `)
    .eq("event_id", eventId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const forecast = data as EarthquakeForecastRow
  return {
    eventId: forecast.event_id,
    createdAt: forecast.created_at,
    aftershock24h: forecast.aftershock_24h,
    m5PlusAftershock: forecast.m5_plus_aftershock,
    within10Km: forecast.within_10km,
    between10And25Km: forecast.between_10_25km,
    between25And50Km: forecast.between_25_50km,
    beyond50Km: forecast.beyond_50km,
    estimatedStrongestAftershock: forecast.est_max_aftershock,
    aftershock24hLikelihoodLevel: forecast.aftershock_24h_likelihood_level,
    m5PlusLikelihoodLevel: forecast.m5_plus_likelihood_level,
    aftershockMessage: forecast.aftershock_msg,
    m5PlusMessage: forecast.m5_plus_msg,
    distanceMessage: forecast.distance_msg,
    maxMagnitudeMessage: forecast.max_magnitude_msg,
  }
}

export async function getForecastReview(eventId: string): Promise<ForecastReview | null> {
  const { data, error } = await supabase.rpc("get_forecast_review", {
    review_event_id: eventId,
  })
  if (error) throw error
  if (!data) return null

  const review = data as ForecastReviewRpcResponse
  return {
    reviewText: review.review_text,
    reviewedAt: review.reviewed_at,
    displayName: review.display_name,
  }
}

export async function getForecastPlaybackPage(
  eventId: string,
  cursor: ForecastPlaybackCursor | null = null,
  limit = 100,
  scope: ForecastPlaybackScope = "gk"
): Promise<ForecastPlaybackPage | null> {
  const { data, error } = await supabase.rpc("get_forecast_playback_page", {
    trigger_event_id: eventId,
    cursor_event_time: cursor?.eventTime ?? null,
    cursor_event_id: cursor?.eventId ?? null,
    result_limit: limit,
    playback_scope: scope,
  })
  if (error) throw error
  if (!data) return null

  const result = data as ForecastPlaybackRpcResponse
  return {
    status: result.status,
    playbackScope: result.playback_scope,
    gardnerKnopoffRadiusKm: result.gk_radius_km,
    forecastStartedAt: result.forecast_started_at,
    forecastWindowEndsAt: result.forecast_window_ends_at,
    observedThrough: result.observed_through,
    events: result.events.map((event) => ({
      id: event.id,
      dateTime: event.date_time,
      eventTime: event.event_time,
      latitude: event.latitude,
      longitude: event.longitude,
      depth: event.depth,
      magnitude: event.magnitude,
      distanceKm: event.distance_km,
      withinGardnerKnopoffRadius: event.within_gk_radius,
    })),
    nextCursor: result.next_cursor
      ? { eventTime: result.next_cursor.event_time, eventId: result.next_cursor.event_id }
      : null,
    hasMore: result.has_more,
  }
}
