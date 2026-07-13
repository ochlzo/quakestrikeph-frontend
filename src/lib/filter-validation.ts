export type FilterKey = "magnitude" | "depth" | "date"
export type NumericFilterKey = Exclude<FilterKey, "date">
export type Range = { from: string; to: string }
export type FilterErrors = Partial<Record<FilterKey, string>>

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
    } else if (dateRange.from > dateRange.to) {
      errors.date = "From date must be on or before To date."
    }
  }

  return errors
}
