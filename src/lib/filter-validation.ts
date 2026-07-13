export type FilterKey = "magnitude" | "depth" | "date"
export type NumericFilterKey = Exclude<FilterKey, "date">
export type Range = { from: string; to: string }
export type FilterErrors = Partial<Record<FilterKey, string>>

export function isAfterToday(date?: Date, now = new Date()) {
  if (!date) return false
  const today = new Date(now)
  today.setHours(23, 59, 59, 999)
  return date > today
}

export function validateDateRange(
  dateRange: { from?: Date; to?: Date },
  now = new Date()
) {
  if (!dateRange.from || !dateRange.to) return undefined
  if (isAfterToday(dateRange.from, now)) return "From date cannot be after today."
  if (isAfterToday(dateRange.to, now)) return "To date cannot be after today."
  if (dateRange.from > dateRange.to) return "From date must be on or before To date."
  return undefined
}

export function validateFilters(
  filters: Record<FilterKey, boolean>,
  ranges: Record<NumericFilterKey, Range>,
  dateRange: { from?: Date; to?: Date }
): FilterErrors {
  const errors: FilterErrors = {}

  for (const filter of ["magnitude", "depth"] as const) {
    if (!filters[filter]) continue

    const { from, to } = ranges[filter]
    if (!from || !to) {
      errors[filter] = "Enter both From and To values."
    } else if (Number(from) < 0 || Number(to) < 0) {
      errors[filter] = "Values must be 0 or greater."
    } else if (Number(from) > Number(to)) {
      errors[filter] = "From must be less than or equal to To."
    }
  }

  if (filters.date) {
    if (!dateRange.from || !dateRange.to) {
      errors.date = "Select both From and To dates."
    } else {
      const dateError = validateDateRange(dateRange)
      if (dateError) errors.date = dateError
    }
  }

  return errors
}
