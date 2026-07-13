import * as React from "react"

import { FILTERS_COMPLETE_EVENT, FILTERS_REJECTED_EVENT } from "@/lib/earthquake-map-filters"

export type FilterAction = "apply" | "reset"
export type FilterLimitError = { count: number; max: number }

export function useFilterLoading() {
  const [loadingAction, setLoadingAction] = React.useState<FilterAction | null>(null)
  const [limitError, setLimitError] = React.useState<FilterLimitError | null>(null)

  React.useEffect(() => {
    const finishLoading = () => setLoadingAction(null)
    const rejectFilters = (event: Event) => {
      setLimitError((event as CustomEvent<FilterLimitError>).detail)
    }
    document.addEventListener(FILTERS_COMPLETE_EVENT, finishLoading)
    document.addEventListener(FILTERS_REJECTED_EVENT, rejectFilters)
    return () => {
      document.removeEventListener(FILTERS_COMPLETE_EVENT, finishLoading)
      document.removeEventListener(FILTERS_REJECTED_EVENT, rejectFilters)
    }
  }, [])

  return { loadingAction, setLoadingAction, limitError, clearLimitError: () => setLimitError(null) }
}
