"use client"

import * as React from "react"
import { LoaderCircleIcon, RotateCcwIcon } from "lucide-react"

import type { EarthquakeMarker } from "@/data/earthquakes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type EarthquakeEventListProps = {
  events: EarthquakeMarker[]
  selectedEventId: string | null
  selectionVersion: number
  loading?: boolean
  loadingMore: boolean
  hasMore: boolean
  atLimit: boolean
  error?: string | null
  emptyMessage?: string
  onRetry?: () => void
  onLoadMore: () => void
  onSelectEvent: (event: EarthquakeMarker) => void
}

export function EarthquakeEventList({
  events,
  selectedEventId,
  selectionVersion,
  loading = false,
  loadingMore,
  hasMore,
  atLimit,
  error,
  emptyMessage = "No earthquake events found.",
  onRetry,
  onLoadMore,
  onSelectEvent,
}: EarthquakeEventListProps) {
  const selectedRowRef = React.useRef<HTMLButtonElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const endRef = React.useRef<HTMLLIElement>(null)

  React.useEffect(() => {
    if (!selectedEventId) return
    selectedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [selectedEventId, selectionVersion])

  React.useEffect(() => {
    if (loading || error || !hasMore || loadingMore || atLimit || !endRef.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onLoadMore()
    }, { root: listRef.current, rootMargin: "0px 0px 120px" })
    observer.observe(endRef.current)
    return () => observer.disconnect()
  }, [atLimit, error, hasMore, loading, loadingMore, onLoadMore])

  if (!events.length && (loading || error)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        {loading ? (
          <><LoaderCircleIcon className="size-5 animate-spin" />Searching all earthquake events…</>
        ) : (
          <>
            <p>{error}</p>
            {onRetry && <Button type="button" variant="outline" size="sm" onClick={onRetry}><RotateCcwIcon />Retry search</Button>}
          </>
        )}
      </div>
    )
  }

  if (!events.length && !hasMore) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <p>{emptyMessage}</p>
        {atLimit && <p>Cannot load data more than 2000</p>}
      </div>
    )
  }

  return (
    <div className="relative min-h-0 flex-1">
      {loading && (
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 border-b border-sidebar-border bg-sidebar/95 py-2 text-xs text-muted-foreground backdrop-blur-sm">
          <LoaderCircleIcon className="size-3.5 animate-spin" />Searching all events…
        </div>
      )}
      {error && (
        <div className="absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-sidebar p-2 text-xs">
          <span className="text-destructive">{error}</span>
          {onRetry && <Button type="button" variant="ghost" size="xs" onClick={onRetry}>Retry</Button>}
        </div>
      )}
      <ul ref={listRef} aria-busy={loadingMore} className="h-full space-y-1 overflow-y-auto p-2">
        {events.map((event) => (
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
        {(hasMore || atLimit) && (
          <li ref={endRef} role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
            {atLimit ? (
              "Cannot load data more than 2000"
            ) : (
              <>Loading more events...<LoaderCircleIcon className="size-3.5 animate-spin" /></>
            )}
          </li>
        )}
      </ul>
    </div>
  )
}
