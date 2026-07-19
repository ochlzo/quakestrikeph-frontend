import * as React from "react"

import {
  createDefaultForecastSelections,
  type ForecastFilterKey,
} from "@/components/forecast-filter-fields"
import { useFilterLoading } from "@/hooks/use-filter-loading"
import {
  createDefaultMapFilters,
  endOfDay,
  toEventTime,
  type EarthquakeMapFilters,
} from "@/lib/earthquake-map-filters"
import {
  validateDateRange,
  validateFilters,
  type FilterErrors,
  type FilterKey,
  type Range,
  type RangeFilterKey,
} from "@/lib/filter-validation"
import {
  sanitizeDecimalInput,
  sanitizeIntegerInput,
} from "@/lib/input-security"
import { magnitudeSelectionsToRanges } from "@/lib/magnitude-ranges"

const initialFilters = { magnitude: false, depth: false, date: false }
const initialRanges: Record<RangeFilterKey, Range> = { depth: { from: "", to: "" } }
export type DatePreset = "today" | "24h" | "7d"

export function useEarthquakeFilters(onApplied: () => void) {
  const [filters, setFilters] = React.useState(initialFilters)
  const [ranges, setRanges] = React.useState(initialRanges)
  const [dateRange, setDateRange] = React.useState<{ from?: Date; to?: Date }>({})
  const [selectedDatePreset, setSelectedDatePreset] = React.useState<DatePreset | null>(null)
  const [validationErrors, setValidationErrors] = React.useState<FilterErrors>({})
  const [selectedForecasts, setSelectedForecasts] = React.useState(createDefaultForecastSelections)
  const [selectedMagnitudes, setSelectedMagnitudes] = React.useState<string[]>([])
  const [minimumEstimatedStrongestAftershock, setMinimumEstimatedStrongestAftershock] = React.useState("")
  const [includeNoForecast, setIncludeNoForecast] = React.useState(true)
  const [onlyWithPhivolcsReview, setOnlyWithPhivolcsReview] = React.useState(false)
  const loading = useFilterLoading()

  const liveDateError = filters.date ? validateDateRange(dateRange) : undefined
  const dateError = liveDateError
    ?? (dateRange.from && dateRange.to ? undefined : validationErrors.date)
  const parsedMinimumAftershock = minimumEstimatedStrongestAftershock === ""
    ? null
    : Number(minimumEstimatedStrongestAftershock)
  const forecastMagnitudeError = parsedMinimumAftershock !== null
    && (!Number.isFinite(parsedMinimumAftershock) || parsedMinimumAftershock < 0)
      ? "Enter a magnitude of 0 or higher."
      : undefined

  function setFilterEnabled(filter: FilterKey, enabled: boolean) {
    setFilters((current) => ({ ...current, [filter]: enabled }))
    if (!enabled && filter === "magnitude") setSelectedMagnitudes([])
    if (!enabled && filter === "depth") setRanges(initialRanges)
    if (!enabled && filter === "date") {
      setDateRange({})
      setSelectedDatePreset(null)
    }
  }

  function setRangeValue(field: keyof Range, value: string) {
    setRanges((current) => ({
      ...current,
      depth: { ...current.depth, [field]: sanitizeIntegerInput(value) },
    }))
  }

  function applyDatePreset(preset: DatePreset, days = 0) {
    const to = new Date()
    const from = new Date(to)
    if (preset === "today") from.setHours(0, 0, 0, 0)
    else from.setDate(from.getDate() - days)
    setFilters((current) => ({ ...current, date: true }))
    setDateRange({ from, to: preset === "today" ? endOfDay(to) : to })
    setSelectedDatePreset(preset)
  }

  function selectDateRange(range: typeof dateRange) {
    setSelectedDatePreset(null)
    setDateRange({ from: range.from, to: endOfDay(range.to) })
  }

  function toggleForecast(filter: ForecastFilterKey, option: string) {
    setSelectedForecasts((current) => {
      const selection = new Set(current[filter])
      if (selection.has(option)) selection.delete(option)
      else selection.add(option)
      return { ...current, [filter]: selection }
    })
  }

  function changeIncludeNoForecast(checked: boolean) {
    setIncludeNoForecast(checked)
    if (checked) setOnlyWithPhivolcsReview(false)
  }

  function changeOnlyWithPhivolcsReview(checked: boolean) {
    setOnlyWithPhivolcsReview(checked)
    if (checked) setIncludeNoForecast(false)
  }

  function resetFilters() {
    setFilters(initialFilters)
    setRanges(initialRanges)
    setDateRange({})
    setSelectedDatePreset(null)
    setValidationErrors({})
    setSelectedForecasts(createDefaultForecastSelections())
    setSelectedMagnitudes([])
    setMinimumEstimatedStrongestAftershock("")
    setIncludeNoForecast(true)
    setOnlyWithPhivolcsReview(false)
    loading.setLoadingAction("reset")
    onApplied()
    document.dispatchEvent(new CustomEvent("quakestrike:filters", {
      detail: createDefaultMapFilters(),
    }))
  }

  function applyFilters() {
    const magnitudeRanges = magnitudeSelectionsToRanges(selectedMagnitudes)
    const errors = validateFilters(filters, ranges, dateRange, magnitudeRanges)
    setValidationErrors(errors)
    if (Object.keys(errors).length || forecastMagnitudeError) return false

    const detail: EarthquakeMapFilters = {
      events: {
        magnitude: filters.magnitude ? magnitudeRanges : null,
        depth: filters.depth ? ranges.depth : null,
        date: filters.date && dateRange.from && dateRange.to
          ? { from: toEventTime(dateRange.from), to: toEventTime(dateRange.to) }
          : null,
      },
      forecasts: {
        aftershock24hLikelihoods: [...selectedForecasts.aftershock24hLikelihoods],
        m5PlusLikelihoods: [...selectedForecasts.m5PlusLikelihoods],
        minimumEstimatedStrongestAftershock: parsedMinimumAftershock,
        includeNoForecast,
        onlyWithPhivolcsReview,
      },
    }

    loading.setLoadingAction("apply")
    onApplied()
    document.dispatchEvent(new CustomEvent("quakestrike:filters", { detail }))
    return true
  }

  return {
    filters,
    ranges,
    dateRange,
    selectedDatePreset,
    validationErrors,
    selectedForecasts,
    selectedMagnitudes,
    minimumEstimatedStrongestAftershock,
    includeNoForecast,
    onlyWithPhivolcsReview,
    liveDateError,
    dateError,
    forecastMagnitudeError,
    loading,
    setFilterEnabled,
    setRangeValue,
    applyDatePreset,
    selectDateRange,
    toggleForecast,
    resetFilters,
    applyFilters,
    setSelectedMagnitudes,
    setMinimumEstimatedStrongestAftershock: (value: string) => {
      setMinimumEstimatedStrongestAftershock(sanitizeDecimalInput(value))
    },
    setIncludeNoForecast: changeIncludeNoForecast,
    setOnlyWithPhivolcsReview: changeOnlyWithPhivolcsReview,
  }
}
