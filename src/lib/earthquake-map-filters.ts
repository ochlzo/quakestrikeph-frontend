export const FORECAST_LIKELIHOODS = ["low", "medium", "high"] as const
export const FILTERS_COMPLETE_EVENT = "quakestrike:filters-complete"
export const FILTERS_REJECTED_EVENT = "quakestrike:filters-rejected"
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
export const DISTANCE_BANDS = [
  "within_10km",
  "between_10_25km",
  "between_25_50km",
  "beyond_50km",
] as const

export type DistanceBand = (typeof DISTANCE_BANDS)[number]
export type FilterRange = { from: string; to: string }
export type ForecastFilters = {
  aftershock24hLikelihoods: string[]
  m5PlusLikelihoods: string[]
  distanceBands: string[]
}
export type EarthquakeMapFilters = {
  events: {
    magnitude: FilterRange | null
    depth: FilterRange | null
    date: FilterRange | null
  }
  forecasts: ForecastFilters
}

type ForecastMarker = {
  aftershock24hLikelihoodLevel?: string | null
  m5PlusLikelihoodLevel?: string | null
  distanceBand?: DistanceBand
}

export function createDefaultMapFilters(): EarthquakeMapFilters {
  return {
    events: { magnitude: null, depth: null, date: null },
    forecasts: {
      aftershock24hLikelihoods: [...FORECAST_LIKELIHOODS],
      m5PlusLikelihoods: [...FORECAST_LIKELIHOODS],
      distanceBands: [...DISTANCE_BANDS],
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

export function mostLikelyDistanceBand(
  probabilities: Partial<Record<DistanceBand, number | null>>
): DistanceBand | undefined {
  let winner: DistanceBand | undefined
  let highest = -Infinity

  for (const band of DISTANCE_BANDS) {
    const probability = probabilities[band]
    if (typeof probability === "number" && Number.isFinite(probability) && probability > highest) {
      winner = band
      highest = probability
    }
  }

  return winner
}

function matchesSelection(value: string | null | undefined, selected: string[], all: readonly string[]) {
  if (all.every((option) => selected.includes(option))) return true
  return Boolean(value && selected.includes(value.toLowerCase()))
}

export function filterMarkersByForecast<T extends ForecastMarker>(markers: T[], filters: ForecastFilters) {
  return markers.filter((marker) =>
    matchesSelection(marker.aftershock24hLikelihoodLevel, filters.aftershock24hLikelihoods, FORECAST_LIKELIHOODS)
    && matchesSelection(marker.m5PlusLikelihoodLevel, filters.m5PlusLikelihoods, FORECAST_LIKELIHOODS)
    && matchesSelection(marker.distanceBand, filters.distanceBands, DISTANCE_BANDS)
  )
}
