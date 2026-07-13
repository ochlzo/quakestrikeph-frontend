"use client"

import * as React from "react"
import type { CSSProperties, ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { EarthquakeFilterSidebar } from "@/components/earthquake-filter-sidebar"
import { searchEarthquakeMarkers, type EarthquakeMarker } from "@/data/earthquakes"
import {
  EARTHQUAKE_EVENTS_UPDATED_EVENT,
  EARTHQUAKE_FOCUS_EVENT,
  EARTHQUAKE_RENDER_EVENTS_EVENT,
  EARTHQUAKE_SELECTED_EVENT,
  FILTERS_ACTIVE_EVENT,
  FILTERS_REJECTED_EVENT,
} from "@/lib/earthquake-map-filters"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

type MapPageShellProps = { children: ReactNode }
type SearchStatus = "idle" | "loading" | "ready" | "error"

function dispatchRenderedEvents(events: EarthquakeMarker[], fitBounds = false) {
  document.dispatchEvent(new CustomEvent(EARTHQUAKE_RENDER_EVENTS_EVENT, {
    detail: { events, fitBounds },
  }))
}

function MapPageContent({ children }: MapPageShellProps) {
  const { isMobile, setOpen, setOpenMobile } = useSidebar()
  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false)
  const [filteredEvents, setFilteredEvents] = React.useState<EarthquakeMarker[]>([])
  const filteredEventsRef = React.useRef<EarthquakeMarker[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchEvents, setSearchEvents] = React.useState<EarthquakeMarker[]>([])
  const [searchStatus, setSearchStatus] = React.useState<SearchStatus>("idle")
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const [searchRetry, setSearchRetry] = React.useState(0)
  const searchRequest = React.useRef(0)
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null)
  const [selectionVersion, setSelectionVersion] = React.useState(0)
  const [activeFilterCount, setActiveFilterCount] = React.useState(0)
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

  const clearSearch = React.useCallback(() => {
    searchRequest.current += 1
    setSearchQuery("")
    setSearchEvents([])
    setSearchStatus("idle")
    setSearchError(null)
    dispatchRenderedEvents(filteredEventsRef.current)
  }, [])

  React.useEffect(() => {
    const updateEvents = (event: Event) => {
      const events = (event as CustomEvent<EarthquakeMarker[]>).detail
      filteredEventsRef.current = events
      setFilteredEvents(events)
    }
    const selectEvent = (event: Event) => {
      selectEarthquake((event as CustomEvent<string>).detail)
      openMainSidebar()
    }
    const updateFilterStatus = (event: Event) => {
      setActiveFilterCount((event as CustomEvent<number>).detail)
    }
    const reopenRejectedFilters = () => {
      if (!isMobile) return
      setOpenMobile(false)
      setFilterPanelOpen(true)
    }

    document.addEventListener(EARTHQUAKE_EVENTS_UPDATED_EVENT, updateEvents)
    document.addEventListener(EARTHQUAKE_SELECTED_EVENT, selectEvent)
    document.addEventListener(FILTERS_ACTIVE_EVENT, updateFilterStatus)
    document.addEventListener(FILTERS_REJECTED_EVENT, reopenRejectedFilters)
    return () => {
      document.removeEventListener(EARTHQUAKE_EVENTS_UPDATED_EVENT, updateEvents)
      document.removeEventListener(EARTHQUAKE_SELECTED_EVENT, selectEvent)
      document.removeEventListener(FILTERS_ACTIVE_EVENT, updateFilterStatus)
      document.removeEventListener(FILTERS_REJECTED_EVENT, reopenRejectedFilters)
    }
  }, [openMainSidebar, selectEarthquake])

  React.useEffect(() => {
    const requestId = ++searchRequest.current
    if (trimmedSearch.length < 3) {
      setSearchEvents([])
      setSearchStatus("idle")
      setSearchError(null)
      dispatchRenderedEvents(filteredEventsRef.current)
      return
    }

    setSearchStatus("loading")
    setSearchError(null)
    dispatchRenderedEvents(filteredEventsRef.current)
    const timer = window.setTimeout(async () => {
      try {
        const events = await searchEarthquakeMarkers(trimmedSearch)
        if (searchRequest.current !== requestId) return
        setSearchEvents(events)
        setSearchStatus("ready")
        dispatchRenderedEvents(events, true)
      } catch {
        if (searchRequest.current !== requestId) return
        setSearchStatus("error")
        setSearchError("Could not search all earthquake events.")
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchRetry, trimmedSearch])

  function openFilters() {
    if (isMobile) setOpenMobile(false)
    setFilterPanelOpen(true)
  }

  function setFiltersOpen(open: boolean) {
    setFilterPanelOpen(open)
    if (!open && isMobile) setOpenMobile(true)
  }

  function filtersApplied() {
    clearSearch()
    if (isMobile) {
      setFilterPanelOpen(false)
      setOpenMobile(true)
    }
  }

  function focusEarthquake(event: EarthquakeMarker) {
    selectEarthquake(event.id)
    document.dispatchEvent(new CustomEvent(EARTHQUAKE_FOCUS_EVENT, {
      detail: { id: event.id, latitude: event.latitude, longitude: event.longitude },
    }))
    if (isMobile) setOpenMobile(false)
  }

  return (
    <>
      <AppSidebar
        events={visibleEvents}
        selectedEventId={selectedEventId}
        selectionVersion={selectionVersion}
        searchQuery={searchQuery}
        searchLoading={searchStatus === "loading"}
        searchError={searchError}
        activeFilterCount={activeFilterCount}
        onSearchQueryChange={setSearchQuery}
        onRetrySearch={() => setSearchRetry((value) => value + 1)}
        onOpenFilters={openFilters}
        onSelectEvent={focusEarthquake}
      />
      <EarthquakeFilterSidebar open={filterPanelOpen} onOpenChange={setFiltersOpen} onApplied={filtersApplied} />
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
