import * as React from "react"

import { FILTERS_COMPLETE_EVENT, FILTERS_REJECTED_EVENT } from "@/lib/earthquake-map-filters"

export type FilterAction = "apply" | "reset"
export type FilterLimitError = { count: number; max: number }

export function useFilterLoading() {
  const [loadingAction, setLoadingAction] = React.useState<FilterAction | null>(null)
  const [limitError, setLimitError] = React.useState<FilterLimitError | null>(null)
  const [limitDialogOpen, setLimitDialogOpen] = React.useState(false)

  React.useEffect(() => {
    const finishLoading = () => setLoadingAction(null)
    const rejectFilters = (event: Event) => {
      setLimitError((event as CustomEvent<FilterLimitError>).detail)
      setLimitDialogOpen(true)
    }
    document.addEventListener(FILTERS_COMPLETE_EVENT, finishLoading)
    document.addEventListener(FILTERS_REJECTED_EVENT, rejectFilters)
    return () => {
      document.removeEventListener(FILTERS_COMPLETE_EVENT, finishLoading)
      document.removeEventListener(FILTERS_REJECTED_EVENT, rejectFilters)
    }
  }, [])

  function clearLimitError() {
    setLimitError(null)
    setLimitDialogOpen(false)
  }

  return {
    loadingAction,
    setLoadingAction,
    limitError,
    clearLimitError,
    limitDialogOpen,
    setLimitDialogOpen,
  }
}
