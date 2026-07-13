import type { MagnitudeRange } from "./magnitude-ranges"

export const FORECAST_LIKELIHOODS = ["low", "medium", "high"] as const
export const FILTERS_COMPLETE_EVENT = "quakestrike:filters-complete"
export const FILTERS_REJECTED_EVENT = "quakestrike:filters-rejected"
export const EARTHQUAKE_EVENTS_UPDATED_EVENT = "quakestrike:earthquake-events-updated"
export const EARTHQUAKE_SELECTED_EVENT = "quakestrike:earthquake-selected"
export const MAX_MAP_EVENTS = 2000
export const MAP_PAGE_SIZE = 500
const EVENT_TIME_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})
export type FilterRange = { from: string; to: string }
export type ForecastFilters = {
  aftershock24hLikelihoods: string[]
  m5PlusLikelihoods: string[]
  minimumEstimatedStrongestAftershock: number | null
  includeNoForecast: boolean
}
export type EarthquakeMapFilters = {
  events: {
    magnitude: MagnitudeRange[] | null
    depth: FilterRange | null
    date: FilterRange | null
  }
  forecasts: ForecastFilters
}

type ForecastMarker = {
  hasForecast: boolean
  aftershock24hLikelihoodLevel?: string | null
  m5PlusLikelihoodLevel?: string | null
  estimatedStrongestAftershock?: number | null
}

export function createDefaultMapFilters(): EarthquakeMapFilters {
  return {
    events: { magnitude: null, depth: null, date: null },
    forecasts: {
      aftershock24hLikelihoods: [...FORECAST_LIKELIHOODS],
      m5PlusLikelihoods: [...FORECAST_LIKELIHOODS],
      minimumEstimatedStrongestAftershock: null,
      includeNoForecast: true,
    },
  }
}

export function endOfDay(date?: Date) {
  if (!date) return undefined
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

export function toEventTime(date: Date) {
  return EVENT_TIME_FORMATTER.format(date).replace(" ", "T")
}

export function magnitudeMarkerBand(magnitude: number) {
  if (magnitude >= 5) return "5-plus"
  if (magnitude >= 4) return "4"
  if (magnitude >= 3) return "3"
  return "below-3"
}

export async function collectPaginatedRows<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = MAP_PAGE_SIZE
) {
  const rows: T[] = []

  while (rows.length < MAX_MAP_EVENTS) {
    const from = rows.length
    const to = Math.min(from + pageSize - 1, MAX_MAP_EVENTS - 1)
    const page = await fetchPage(from, to)
    rows.push(...page)
    if (page.length < to - from + 1) break
  }

  return rows
}

function matchesSelection(value: string | null | undefined, selected: string[], all: readonly string[]) {
  if (all.every((option) => selected.includes(option))) return true
  return Boolean(value && selected.includes(value.toLowerCase()))
}

export function filterMarkersByForecast<T extends ForecastMarker>(markers: T[], filters: ForecastFilters) {
  return markers.filter((marker) => {
    if (!marker.hasForecast) return filters.includeNoForecast

    return matchesSelection(marker.aftershock24hLikelihoodLevel, filters.aftershock24hLikelihoods, FORECAST_LIKELIHOODS)
      && matchesSelection(marker.m5PlusLikelihoodLevel, filters.m5PlusLikelihoods, FORECAST_LIKELIHOODS)
      && (filters.minimumEstimatedStrongestAftershock === null
        || (marker.estimatedStrongestAftershock ?? -Infinity) >= filters.minimumEstimatedStrongestAftershock)
  })
}
