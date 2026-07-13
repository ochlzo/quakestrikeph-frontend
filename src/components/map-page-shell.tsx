import * as React from "react";
import type { CSSProperties, ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { EarthquakeListSidebar } from "@/components/earthquake-list-sidebar";
import type { EarthquakeMarker } from "@/data/earthquakes";
import {
  EARTHQUAKE_EVENTS_UPDATED_EVENT,
  EARTHQUAKE_SELECTED_EVENT,
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

  React.useEffect(() => {
    const updateEvents = (event: Event) => {
      setEarthquakeEvents((event as CustomEvent<EarthquakeMarker[]>).detail);
    };
    const selectEvent = (event: Event) => {
      setSelectedEventId((event as CustomEvent<string>).detail);
      setEarthquakeListOpen(true);
    };

    document.addEventListener(EARTHQUAKE_EVENTS_UPDATED_EVENT, updateEvents);
    document.addEventListener(EARTHQUAKE_SELECTED_EVENT, selectEvent);
    return () => {
      document.removeEventListener(EARTHQUAKE_EVENTS_UPDATED_EVENT, updateEvents);
      document.removeEventListener(EARTHQUAKE_SELECTED_EVENT, selectEvent);
    };
  }, []);

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
