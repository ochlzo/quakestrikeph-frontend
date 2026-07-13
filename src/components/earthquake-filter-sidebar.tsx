"use client"

import { LoaderCircleIcon, XIcon } from "lucide-react"

import { DatePicker, FilterToggle } from "@/components/sidebar-filter-fields"
import { ForecastFilterFields } from "@/components/forecast-filter-fields"
import { MagnitudeFilterField } from "@/components/magnitude-filter-field"
import { useEarthquakeFilters } from "@/hooks/use-earthquake-filters"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

function FilterPanel({
  state,
  onClose,
  closeAfterApply,
}: {
  state: ReturnType<typeof useEarthquakeFilters>
  onClose: () => void
  closeAfterApply: boolean
}) {
  const { loading } = state

  function applyFilters() {
    if (state.applyFilters() && closeAfterApply) onClose()
  }

  function resetFilters() {
    state.resetFilters()
    if (closeAfterApply) onClose()
  }

  return (
    <div className="flex h-full min-h-0 w-80 flex-col bg-sidebar text-sidebar-foreground">
      <header className="flex items-center justify-between border-b border-sidebar-border p-4">
        <div>
          <h2 className="font-medium">Filter earthquakes</h2>
          <p className="text-xs text-muted-foreground">Narrow the events shown on the map.</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close filters" onClick={onClose}>
          <XIcon />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Accordion multiple defaultValue={["events", "forecasts"]}>
          <AccordionItem value="events" className="px-2">
            <AccordionTrigger className="px-2">Earthquake event filters</AccordionTrigger>
            <AccordionContent className="space-y-5 px-2 pb-4">
              <FilterToggle
                label="Magnitude"
                checked={state.filters.magnitude}
                onCheckedChange={(enabled) => state.setFilterEnabled("magnitude", enabled)}
                error={state.validationErrors.magnitude}
              >
                <MagnitudeFilterField
                  value={state.selectedMagnitudes}
                  invalid={Boolean(state.validationErrors.magnitude)}
                  onValueChange={state.setSelectedMagnitudes}
                />
              </FilterToggle>

              <FilterToggle
                label="Depth (km)"
                checked={state.filters.depth}
                onCheckedChange={(enabled) => state.setFilterEnabled("depth", enabled)}
                error={state.validationErrors.depth}
              >
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    aria-invalid={Boolean(state.validationErrors.depth)}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="From"
                    value={state.ranges.depth.from}
                    onChange={(event) => state.setRangeValue("from", event.target.value)}
                  />
                  <Input
                    aria-invalid={Boolean(state.validationErrors.depth)}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="To"
                    value={state.ranges.depth.to}
                    onChange={(event) => state.setRangeValue("to", event.target.value)}
                  />
                </div>
              </FilterToggle>

              <FilterToggle
                label="Date range"
                checked={state.filters.date}
                onCheckedChange={(enabled) => state.setFilterEnabled("date", enabled)}
                error={state.dateError}
              >
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <DatePicker
                      invalid={Boolean(state.dateError)}
                      value={state.dateRange.from}
                      range={state.dateRange}
                      onSelect={state.selectDateRange}
                    />
                    <DatePicker
                      invalid={Boolean(state.dateError)}
                      value={state.dateRange.to}
                      range={state.dateRange}
                      onSelect={state.selectDateRange}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      ["today", "Today", 0],
                      ["24h", "Last 24h", 1],
                      ["7d", "Last 7 days", 7],
                    ] as const).map(([preset, label, days]) => (
                      <Button
                        key={preset}
                        type="button"
                        variant={state.selectedDatePreset === preset ? "default" : "outline"}
                        size="xs"
                        aria-pressed={state.selectedDatePreset === preset}
                        onClick={() => state.applyDatePreset(preset, days)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </FilterToggle>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="forecasts" className="px-2">
            <AccordionTrigger className="px-2">Forecast filters</AccordionTrigger>
            <AccordionContent className="px-2 pb-4">
              <ForecastFilterFields
                selections={state.selectedForecasts}
                onToggle={state.toggleForecast}
                minimumEstimatedStrongestAftershock={state.minimumEstimatedStrongestAftershock}
                onMinimumEstimatedStrongestAftershockChange={state.setMinimumEstimatedStrongestAftershock}
                includeNoForecast={state.includeNoForecast}
                onIncludeNoForecastChange={state.setIncludeNoForecast}
                magnitudeError={state.forecastMagnitudeError}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <footer className="border-t border-sidebar-border p-2">
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" disabled={Boolean(loading.loadingAction)} onClick={resetFilters}>
            {loading.loadingAction === "reset" ? <LoaderCircleIcon className="animate-spin" /> : null}
            Reset filters
          </Button>
          <Button
            type="button"
            disabled={Boolean(loading.loadingAction || state.liveDateError)}
            onClick={applyFilters}
          >
            {loading.loadingAction === "apply" ? <LoaderCircleIcon className="animate-spin" /> : null}
            Apply filters
          </Button>
        </div>
      </footer>

    </div>
  )
}

export function EarthquakeFilterSidebar({
  open,
  onOpenChange,
  onApplied,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied: () => void
}) {
  const isMobile = useIsMobile()
  const state = useEarthquakeFilters(onApplied)
  const content = (
    <FilterPanel
      state={state}
      onClose={() => onOpenChange(false)}
      closeAfterApply={isMobile}
    />
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" showCloseButton={false} className="w-80 gap-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Filter earthquakes</SheetTitle>
            <SheetDescription>Choose which earthquakes appear on the map.</SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      aria-label="Earthquake filters"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "h-svh shrink-0 overflow-hidden border-sidebar-border transition-[width] duration-200 ease-linear",
        open ? "w-80 border-r" : "w-0"
      )}
    >
      {content}
    </aside>
  )
}
