"use client"

import * as React from "react"
import { XIcon } from "lucide-react"

import type { EarthquakeMarker } from "@/data/earthquakes"
import { useIsMobile } from "@/hooks/use-mobile"
import { locationSearchScore } from "@/lib/location-search"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

function EarthquakeList({
  events,
  selectedEventId,
  selectionVersion,
  hasActiveFilters,
  onClearFilters,
  onSelectEvent,
  onClose,
}: {
  events: EarthquakeMarker[]
  selectedEventId: string | null
  selectionVersion: number
  hasActiveFilters: boolean
  onClearFilters: () => void
  onSelectEvent: (event: EarthquakeMarker) => void
  onClose: () => void
}) {
  const [search, setSearch] = React.useState("")
  const deferredSearch = React.useDeferredValue(search)
  const selectedRowRef = React.useRef<HTMLButtonElement>(null)
  const visibleEvents = React.useMemo(() => {
    // ponytail: linear scan is enough for the 2,000-event map limit; add an index only if that limit grows.
    return events
      .map((event, index) => ({ event, index, score: locationSearchScore(event.location, deferredSearch) }))
      .filter((result) => result.score !== null)
      .sort((left, right) => left.score! - right.score! || left.index - right.index)
      .map((result) => result.event)
  }, [deferredSearch, events])

  React.useEffect(() => {
    if (selectedEventId) setSearch("")
  }, [selectedEventId, selectionVersion])

  React.useEffect(() => {
    if (!selectedEventId || deferredSearch) return
    selectedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [deferredSearch, selectedEventId, selectionVersion])

  return (
    <div className="flex h-full min-h-0 w-80 flex-col bg-sidebar text-sidebar-foreground">
      <header className="flex items-start justify-between gap-3 border-b border-sidebar-border p-4">
        <div>
          <h2 className="font-medium">Earthquake events</h2>
          <p className="text-xs text-muted-foreground">
            {visibleEvents.length.toLocaleString()} {visibleEvents.length === 1 ? "result" : "results"}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close earthquake list" onClick={onClose}>
          <XIcon />
        </Button>
      </header>
      <div className="border-b border-sidebar-border p-3">
        <label htmlFor="earthquake-location-search" className="sr-only">Search earthquake locations</label>
        <Input
          id="earthquake-location-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by location"
        />
      </div>
      {visibleEvents.length ? (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {visibleEvents.map((event) => (
            <li key={event.id}>
              <button
                ref={event.id === selectedEventId ? selectedRowRef : undefined}
                type="button"
                aria-pressed={event.id === selectedEventId}
                onClick={() => onSelectEvent(event)}
                className={cn(
                  "w-full rounded-lg border border-transparent p-3 text-left text-sm hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  event.id === selectedEventId && "border-sidebar-border bg-sidebar-accent"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium leading-snug">{event.location ?? "Unknown location"}</span>
                  <span className="shrink-0 font-medium">M{event.magnitude.toFixed(1)}</span>
                </div>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {event.date} · {event.depth} km deep
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {events.length ? "No similar earthquake locations found." : "No earthquake events match the current filters."}
          </p>
          {hasActiveFilters ? (
            <Button type="button" variant="outline" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function EarthquakeListSidebar({
  open,
  onOpenChange,
  events,
  selectedEventId,
  selectionVersion,
  hasActiveFilters,
  onClearFilters,
  onSelectEvent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  events: EarthquakeMarker[]
  selectedEventId: string | null
  selectionVersion: number
  hasActiveFilters: boolean
  onClearFilters: () => void
  onSelectEvent: (event: EarthquakeMarker) => void
}) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" showCloseButton={false} className="w-80 gap-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Earthquake events</SheetTitle>
            <SheetDescription>Earthquakes matching the current map filters.</SheetDescription>
          </SheetHeader>
          <EarthquakeList
            events={events}
            selectedEventId={selectedEventId}
            selectionVersion={selectionVersion}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={onClearFilters}
            onSelectEvent={onSelectEvent}
            onClose={() => onOpenChange(false)}
          />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      aria-label="Earthquake events"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "h-svh shrink-0 overflow-hidden border-sidebar-border transition-[width] duration-200 ease-linear",
        open ? "w-80 border-r" : "w-0"
      )}
    >
      <EarthquakeList
        events={events}
        selectedEventId={selectedEventId}
        selectionVersion={selectionVersion}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        onSelectEvent={onSelectEvent}
        onClose={() => onOpenChange(false)}
      />
    </aside>
  )
}
