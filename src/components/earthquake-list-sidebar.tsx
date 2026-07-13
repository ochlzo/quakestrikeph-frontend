"use client"

import { XIcon } from "lucide-react"

import type { EarthquakeMarker } from "@/data/earthquakes"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  onClose,
}: {
  events: EarthquakeMarker[]
  selectedEventId: string | null
  onClose: () => void
}) {
  return (
    <div className="flex h-full min-h-0 w-80 flex-col bg-sidebar text-sidebar-foreground">
      <header className="flex items-start justify-between gap-3 border-b border-sidebar-border p-4">
        <div>
          <h2 className="font-medium">Earthquake events</h2>
          <p className="text-xs text-muted-foreground">
            {events.length.toLocaleString()} {events.length === 1 ? "result" : "results"}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close earthquake list" onClick={onClose}>
          <XIcon />
        </Button>
      </header>
      {events.length ? (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {events.map((event) => (
            <li
              key={event.id}
              className={cn(
                "rounded-lg border border-transparent p-3 text-sm",
                event.id === selectedEventId && "border-sidebar-border bg-sidebar-accent"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium leading-snug">{event.location ?? "Unknown location"}</p>
                <span className="shrink-0 font-medium">M{event.magnitude.toFixed(1)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {event.date} · {event.depth} km deep
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">No earthquake events match the current filters.</p>
      )}
    </div>
  )
}

export function EarthquakeListSidebar({
  open,
  onOpenChange,
  events,
  selectedEventId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  events: EarthquakeMarker[]
  selectedEventId: string | null
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
          <EarthquakeList events={events} selectedEventId={selectedEventId} onClose={() => onOpenChange(false)} />
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
      <EarthquakeList events={events} selectedEventId={selectedEventId} onClose={() => onOpenChange(false)} />
    </aside>
  )
}
