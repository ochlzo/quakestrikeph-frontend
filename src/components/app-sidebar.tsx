"use client";

import * as React from "react";
import {
  SearchIcon,
  SlidersHorizontalIcon,
  TerminalIcon,
  XIcon,
} from "lucide-react";

import type { EarthquakeMarker } from "@/data/earthquakes";
import { MAGNITUDE_RANGE_OPTIONS } from "@/lib/magnitude-ranges";
import { EarthquakeEventList } from "@/components/earthquake-list-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type AppSidebarProps = {
  events: EarthquakeMarker[];
  selectedEventId: string | null;
  selectionVersion: number;
  searchQuery: string;
  searchLoading: boolean;
  globalSearchActive: boolean;
  searchError: string | null;
  loadingMore: boolean;
  hasMore: boolean;
  atLimit: boolean;
  activeFilterCount: number;
  onSearchQueryChange: (value: string) => void;
  onRetrySearch: () => void;
  onLoadMore: () => void;
  onOpenFilters: () => void;
  onSelectEvent: (event: EarthquakeMarker) => void;
};

export function AppSidebar({
  events,
  selectedEventId,
  selectionVersion,
  searchQuery,
  searchLoading,
  globalSearchActive,
  searchError,
  loadingMore,
  hasMore,
  atLimit,
  activeFilterCount,
  onSearchQueryChange,
  onRetrySearch,
  onLoadMore,
  onOpenFilters,
  onSelectEvent,
}: AppSidebarProps) {
  const trimmedSearch = searchQuery.trim();
  const resultLabel = `${events.length.toLocaleString()} ${events.length === 1 ? "event" : "events"}`;

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="QuakeStrike PH"
              className="cursor-default hover:bg-transparent active:bg-transparent"
            >
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <TerminalIcon className="size-4" />
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">QuakeStrike PH</span>
                <span className="truncate text-xs text-muted-foreground">
                  Earthquake monitoring
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="overflow-hidden">
        <SidebarGroup className="shrink-0 border-b border-sidebar-border">
          <SidebarGroupLabel>Map legend</SidebarGroupLabel>
          <SidebarGroupContent>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              {MAGNITUDE_RANGE_OPTIONS.map((option) => (
                <li key={option.value} className="flex items-center gap-2">
                  <span
                    className={`size-2.5 rounded-full ${option.colorClass}`}
                    aria-hidden="true"
                  />
                  <span>{option.label}</span>
                </li>
              ))}
            </ul>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="shrink-0 border-b border-sidebar-border pb-3">
          <SidebarGroupLabel>Search earthquake locations</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="earthquake-location-search"
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="Search all provinces"
                className="px-9 [&::-webkit-search-cancel-button]:hidden"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  aria-label="Clear location search"
                  onClick={() => onSearchQueryChange("")}
                >
                  <XIcon />
                </Button>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full justify-start"
              onClick={onOpenFilters}
            >
              <SlidersHorizontalIcon />
              Filter earthquakes
              {activeFilterCount > 0 && (
                <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                  {activeFilterCount} active
                </span>
              )}
            </Button>
            {trimmedSearch.length > 0 && trimmedSearch.length < 3 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Type at least 3 characters.
              </p>
            )}
            {globalSearchActive && (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing matches from all earthquake events.
              </p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="min-h-0 flex-1 p-0">
          <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
            <span>
              {globalSearchActive ? "Search results" : "Current map results"}
            </span>
            <span>{resultLabel}</span>
          </div>
          <EarthquakeEventList
            events={events}
            selectedEventId={selectedEventId}
            selectionVersion={selectionVersion}
            loading={searchLoading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            atLimit={atLimit}
            error={searchError}
            emptyMessage={
              globalSearchActive
                ? "No matching earthquake locations found."
                : "No earthquakes match the current filters."
            }
            onRetry={onRetrySearch}
            onLoadMore={onLoadMore}
            onSelectEvent={onSelectEvent}
          />
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
