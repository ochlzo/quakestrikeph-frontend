import * as React from "react";
import type { CSSProperties, ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { EarthquakeListSidebar } from "@/components/earthquake-list-sidebar";
import type { EarthquakeMarker } from "@/data/earthquakes";
import {
  EARTHQUAKE_EVENTS_UPDATED_EVENT,
  EARTHQUAKE_FOCUS_EVENT,
  EARTHQUAKE_SELECTED_EVENT,
  FILTERS_ACTIVE_EVENT,
  RESET_FILTERS_REQUEST_EVENT,
} from "@/lib/earthquake-map-filters";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

type MapPageShellProps = {
  children: ReactNode;
};

export function MapPageShell({ children }: MapPageShellProps) {
  const [earthquakeListOpen, setEarthquakeListOpen] = React.useState(false);
  const [earthquakeEvents, setEarthquakeEvents] = React.useState<EarthquakeMarker[]>([]);
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null);
  const [selectionVersion, setSelectionVersion] = React.useState(0);
  const [hasActiveFilters, setHasActiveFilters] = React.useState(false);
  const selectEarthquake = React.useCallback((eventId: string) => {
    setSelectedEventId(eventId);
    setSelectionVersion((version) => version + 1);
    setEarthquakeListOpen(true);
  }, []);

  React.useEffect(() => {
    const updateEvents = (event: Event) => {
      setEarthquakeEvents((event as CustomEvent<EarthquakeMarker[]>).detail);
    };
    const selectEvent = (event: Event) => {
      selectEarthquake((event as CustomEvent<string>).detail);
    };
    const updateFilterStatus = (event: Event) => {
      setHasActiveFilters((event as CustomEvent<boolean>).detail);
    };

    document.addEventListener(EARTHQUAKE_EVENTS_UPDATED_EVENT, updateEvents);
    document.addEventListener(EARTHQUAKE_SELECTED_EVENT, selectEvent);
    document.addEventListener(FILTERS_ACTIVE_EVENT, updateFilterStatus);
    return () => {
      document.removeEventListener(EARTHQUAKE_EVENTS_UPDATED_EVENT, updateEvents);
      document.removeEventListener(EARTHQUAKE_SELECTED_EVENT, selectEvent);
      document.removeEventListener(FILTERS_ACTIVE_EVENT, updateFilterStatus);
    };
  }, [selectEarthquake]);

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen style={{ "--sidebar-width": "350px" } as CSSProperties}>
        <AppSidebar
          earthquakeListOpen={earthquakeListOpen}
          onToggleEarthquakeList={() => setEarthquakeListOpen((open) => !open)}
        />
        <EarthquakeListSidebar
          open={earthquakeListOpen}
          onOpenChange={setEarthquakeListOpen}
          events={earthquakeEvents}
          selectedEventId={selectedEventId}
          selectionVersion={selectionVersion}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={() => document.dispatchEvent(new Event(RESET_FILTERS_REQUEST_EVENT))}
          onSelectEvent={(event) => {
            selectEarthquake(event.id);
            document.dispatchEvent(new CustomEvent(EARTHQUAKE_FOCUS_EVENT, {
              detail: { id: event.id, latitude: event.latitude, longitude: event.longitude },
            }));
          }}
        />
        <SidebarInset className="isolate flex h-svh min-w-0 flex-col overflow-hidden">
          <header className="relative z-10 flex h-12 shrink-0 items-center bg-background/95 px-4 backdrop-blur-sm">
            <SidebarTrigger className="-ml-1" />
          </header>
          <div className="relative z-0 h-[calc(100svh-3rem)] min-h-0 overflow-hidden px-2 pb-2">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
