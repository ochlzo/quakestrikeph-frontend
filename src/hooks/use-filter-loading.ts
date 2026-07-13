import * as React from "react"

import { FILTERS_COMPLETE_EVENT } from "@/lib/earthquake-map-filters"

export type FilterAction = "apply" | "reset"
export function useFilterLoading() {
  const [loadingAction, setLoadingAction] = React.useState<FilterAction | null>(null)

  React.useEffect(() => {
    const finishLoading = () => setLoadingAction(null)
    document.addEventListener(FILTERS_COMPLETE_EVENT, finishLoading)
    return () => document.removeEventListener(FILTERS_COMPLETE_EVENT, finishLoading)
  }, [])

  return {
    loadingAction,
    setLoadingAction,
  }
}
