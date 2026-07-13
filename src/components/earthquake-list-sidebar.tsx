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
  error?: string | null
  emptyMessage?: string
  onRetry?: () => void
  onSelectEvent: (event: EarthquakeMarker) => void
}

export function EarthquakeEventList({
  events,
  selectedEventId,
  selectionVersion,
  loading = false,
  error,
  emptyMessage = "No earthquake events found.",
  onRetry,
  onSelectEvent,
}: EarthquakeEventListProps) {
  const selectedRowRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (!selectedEventId) return
    selectedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [selectedEventId, selectionVersion])

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

  if (!events.length) {
    return <p className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
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
      <ul className="h-full space-y-1 overflow-y-auto p-2">
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
      </ul>
    </div>
  )
}
