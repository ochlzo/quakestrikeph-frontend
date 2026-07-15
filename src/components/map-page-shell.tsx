"use client"

import * as React from "react"
import type { CSSProperties, ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { EarthquakeFilterSidebar } from "@/components/earthquake-filter-sidebar"
import { EarthquakeForecastSidebar } from "@/components/earthquake-forecast-sidebar"
import { searchEarthquakeMarkers, type EarthquakeMarker } from "@/data/earthquakes"
import {
  EARTHQUAKE_EVENTS_UPDATED_EVENT,
  EARTHQUAKE_EVENTS_REQUEST_EVENT,
  EARTHQUAKE_FOCUS_EVENT,
  EARTHQUAKE_LOAD_MORE_EVENT,
  EARTHQUAKE_RENDER_EVENTS_EVENT,
  EARTHQUAKE_SELECTED_EVENT,
  createDefaultMapFilters,
  FILTERS_ACTIVE_EVENT,
  type EarthquakeMapFilters,
} from "@/lib/earthquake-map-filters"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type MapPageShellProps = { children: ReactNode }
type SearchStatus = "idle" | "loading" | "ready" | "error"
type FilteredEventState = {
  events: EarthquakeMarker[]
  hasMore: boolean
  atLimit: boolean
  loadingMore: boolean
}

function dispatchRenderedEvents(events: EarthquakeMarker[], fitBounds = false) {
  document.dispatchEvent(new CustomEvent(EARTHQUAKE_RENDER_EVENTS_EVENT, {
    detail: { events, fitBounds },
  }))
}

function MapPageContent({ children }: MapPageShellProps) {
  const { isMobile, setOpen, setOpenMobile } = useSidebar()
  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false)
  const [filteredEvents, setFilteredEvents] = React.useState<EarthquakeMarker[]>([])
  const [filteredHasMore, setFilteredHasMore] = React.useState(false)
  const [filteredAtLimit, setFilteredAtLimit] = React.useState(false)
  const [filteredLoadingMore, setFilteredLoadingMore] = React.useState(false)
  const filteredEventsRef = React.useRef<EarthquakeMarker[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchEvents, setSearchEvents] = React.useState<EarthquakeMarker[]>([])
  const [searchStatus, setSearchStatus] = React.useState<SearchStatus>("idle")
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const [searchOffset, setSearchOffset] = React.useState(0)
  const [searchHasMore, setSearchHasMore] = React.useState(false)
  const [searchAtLimit, setSearchAtLimit] = React.useState(false)
  const [searchLoadingMore, setSearchLoadingMore] = React.useState(false)
  const [searchRetry, setSearchRetry] = React.useState(0)
  const searchRequest = React.useRef(0)
  const searchLoadingMoreRef = React.useRef(false)
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null)
  const [forecastEvent, setForecastEvent] = React.useState<EarthquakeMarker | null>(null)
  const [selectionVersion, setSelectionVersion] = React.useState(0)
  const [activeFilterCount, setActiveFilterCount] = React.useState(0)
  const [searchFilters, setSearchFilters] = React.useState(createDefaultMapFilters)
  const trimmedSearch = searchQuery.trim()
  const searchIsReady = trimmedSearch.length >= 3 && searchStatus === "ready"
  const visibleEvents = searchIsReady ? searchEvents : filteredEvents

  const openMainSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile(true)
    else setOpen(true)
  }, [isMobile, setOpen, setOpenMobile])

  const selectEarthquake = React.useCallback((eventId: string) => {
    setSelectedEventId(eventId)
    setSelectionVersion((version) => version + 1)
  }, [])

  React.useEffect(() => {
    const updateEvents = (event: Event) => {
      const detail = (event as CustomEvent<FilteredEventState>).detail
      filteredEventsRef.current = detail.events
      setFilteredEvents(detail.events)
      setFilteredHasMore(detail.hasMore)
      setFilteredAtLimit(detail.atLimit)
      setFilteredLoadingMore(detail.loadingMore)
    }
    const selectEvent = (event: Event) => {
      const selected = (event as CustomEvent<EarthquakeMarker>).detail
      if (selected.hasForecast) setFilterPanelOpen(false)
      selectEarthquake(selected.id)
      setForecastEvent(selected.hasForecast ? selected : null)
      if (isMobile && selected.hasForecast) setOpenMobile(false)
      else openMainSidebar()
    }
    const updateFilterStatus = (event: Event) => {
      setActiveFilterCount((event as CustomEvent<number>).detail)
    }
    const updateSearchFilters = (event: Event) => {
      setSearchFilters((event as CustomEvent<EarthquakeMapFilters>).detail)
    }

    document.addEventListener(EARTHQUAKE_EVENTS_UPDATED_EVENT, updateEvents)
    document.addEventListener(EARTHQUAKE_SELECTED_EVENT, selectEvent)
    document.addEventListener(FILTERS_ACTIVE_EVENT, updateFilterStatus)
    document.addEventListener("quakestrike:filters", updateSearchFilters)
    document.dispatchEvent(new Event(EARTHQUAKE_EVENTS_REQUEST_EVENT))
    return () => {
      document.removeEventListener(EARTHQUAKE_EVENTS_UPDATED_EVENT, updateEvents)
      document.removeEventListener(EARTHQUAKE_SELECTED_EVENT, selectEvent)
      document.removeEventListener(FILTERS_ACTIVE_EVENT, updateFilterStatus)
      document.removeEventListener("quakestrike:filters", updateSearchFilters)
    }
  }, [isMobile, openMainSidebar, selectEarthquake, setOpenMobile])

  React.useEffect(() => {
    const requestId = ++searchRequest.current
    if (trimmedSearch.length < 3) {
      setSearchEvents([])
      setSearchStatus("idle")
      setSearchError(null)
      setSearchOffset(0)
      setSearchHasMore(false)
      setSearchAtLimit(false)
      setSearchLoadingMore(false)
      searchLoadingMoreRef.current = false
      dispatchRenderedEvents(filteredEventsRef.current)
      return
    }

    setSearchStatus("loading")
    setSearchError(null)
    setSearchOffset(0)
    setSearchHasMore(false)
    setSearchAtLimit(false)
    setSearchLoadingMore(false)
    searchLoadingMoreRef.current = false
    dispatchRenderedEvents(filteredEventsRef.current)
    const timer = window.setTimeout(async () => {
      try {
        const page = await searchEarthquakeMarkers(trimmedSearch, searchFilters)
        if (searchRequest.current !== requestId) return
        setSearchEvents(page.events)
        setSearchOffset(page.nextOffset)
        setSearchHasMore(page.hasMore)
        setSearchAtLimit(page.atLimit)
        setSearchStatus("ready")
        dispatchRenderedEvents(page.events, true)
      } catch {
        if (searchRequest.current !== requestId) return
        setSearchStatus("error")
        setSearchError("Could not search all earthquake events.")
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchFilters, searchRetry, trimmedSearch])

  function openFilters() {
    if (isMobile) setOpenMobile(false)
    setFilterPanelOpen(true)
  }

  function setFiltersOpen(open: boolean) {
    setFilterPanelOpen(open)
    if (!open && isMobile && !forecastEvent) setOpenMobile(true)
  }

  function filtersApplied() {
    if (isMobile) {
      setFilterPanelOpen(false)
      if (!forecastEvent) setOpenMobile(true)
    }
  }

  function closeForecast() {
    setForecastEvent(null)
    if (isMobile) setOpenMobile(true)
  }

  function focusEarthquake(event: EarthquakeMarker) {
    selectEarthquake(event.id)
    setForecastEvent((current) => current ? (event.hasForecast ? event : null) : null)
    document.dispatchEvent(new CustomEvent(EARTHQUAKE_FOCUS_EVENT, {
      detail: { id: event.id, latitude: event.latitude, longitude: event.longitude },
    }))
    if (isMobile) setOpenMobile(false)
  }

  async function loadMoreEvents() {
    if (!searchIsReady) {
      if (filteredHasMore && !filteredLoadingMore && !filteredAtLimit) {
        document.dispatchEvent(new Event(EARTHQUAKE_LOAD_MORE_EVENT))
      }
      return
    }
    if (!searchHasMore || searchAtLimit || searchLoadingMoreRef.current) return

    const requestId = searchRequest.current
    searchLoadingMoreRef.current = true
    setSearchLoadingMore(true)
    setSearchError(null)
    try {
      const page = await searchEarthquakeMarkers(trimmedSearch, searchFilters, searchOffset)
      if (searchRequest.current !== requestId) return
      const events = [...searchEvents, ...page.events]
      setSearchEvents(events)
      setSearchOffset(page.nextOffset)
      setSearchHasMore(page.hasMore)
      setSearchAtLimit(page.atLimit)
      dispatchRenderedEvents(events)
    } catch {
      if (searchRequest.current === requestId) {
        setSearchError("Could not load more earthquake events.")
      }
    } finally {
      searchLoadingMoreRef.current = false
      if (searchRequest.current === requestId) setSearchLoadingMore(false)
    }
  }

  return (
    <>
      <AppSidebar
        events={visibleEvents}
        selectedEventId={selectedEventId}
        selectionVersion={selectionVersion}
        searchQuery={searchQuery}
        searchLoading={searchStatus === "loading"}
        globalSearchActive={searchIsReady}
        searchError={searchError}
        loadingMore={searchIsReady ? searchLoadingMore : filteredLoadingMore}
        hasMore={searchIsReady ? searchHasMore : filteredHasMore}
        atLimit={searchIsReady ? searchAtLimit : filteredAtLimit}
        activeFilterCount={activeFilterCount}
        onSearchQueryChange={setSearchQuery}
        onRetrySearch={() => setSearchRetry((value) => value + 1)}
        onLoadMore={loadMoreEvents}
        onOpenFilters={openFilters}
        onSelectEvent={focusEarthquake}
      />
      <div
        className={cn(
          "relative hidden h-svh shrink-0 overflow-hidden border-sidebar-border transition-[width] duration-200 ease-linear md:block",
          forecastEvent || filterPanelOpen ? "w-80 border-r" : "w-0"
        )}
      >
        <EarthquakeForecastSidebar event={forecastEvent} covered={filterPanelOpen} onClose={closeForecast} />
        <EarthquakeFilterSidebar open={filterPanelOpen} onOpenChange={setFiltersOpen} onApplied={filtersApplied} />
      </div>
      <SidebarInset className="isolate flex h-svh min-w-0 flex-col overflow-hidden">
        <header className="relative z-10 flex h-12 shrink-0 items-center bg-background/95 px-4 backdrop-blur-sm">
          <SidebarTrigger className="-ml-1" />
        </header>
        <div className="relative z-0 h-[calc(100svh-3rem)] min-h-0 overflow-hidden px-2 pb-2">
          {children}
        </div>
      </SidebarInset>
    </>
  )
}

export function MapPageShell({ children }: MapPageShellProps) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen style={{ "--sidebar-width": "350px" } as CSSProperties}>
        <MapPageContent>{children}</MapPageContent>
      </SidebarProvider>
    </TooltipProvider>
  )
}
