"use client"

import * as React from "react"
import { LoaderCircleIcon, TerminalIcon, XIcon } from "lucide-react"

import { validateDateRange, validateFilters, type FilterErrors, type FilterKey, type Range } from "@/lib/filter-validation"
import { createDefaultMapFilters, endOfDay, type EarthquakeMapFilters } from "@/lib/earthquake-map-filters"
import { useFilterLoading } from "@/hooks/use-filter-loading"
import { createDefaultForecastSelections, FilterHelp, ForecastFilterFields, type ForecastFilterKey } from "@/components/forecast-filter-fields"
import { DatePicker, FilterToggle } from "@/components/sidebar-filter-fields"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const initialFilters = {
  magnitude: false,
  depth: false,
  date: false,
}

const initialRanges: Record<Exclude<FilterKey, "date">, Range> = {
  magnitude: { from: "", to: "" },
  depth: { from: "", to: "" },
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [filters, setFilters] = React.useState(initialFilters)
  const [ranges, setRanges] = React.useState(initialRanges)
  const [dateRange, setDateRange] = React.useState<{ from?: Date; to?: Date }>({})
  const [validationErrors, setValidationErrors] = React.useState<FilterErrors>({})
  const [selectedForecasts, setSelectedForecasts] = React.useState(createDefaultForecastSelections)
  const { loadingAction, setLoadingAction, limitError, clearLimitError } = useFilterLoading()
  const liveDateError = filters.date ? validateDateRange(dateRange) : undefined
  const dateError = liveDateError ?? (dateRange.from && dateRange.to ? undefined : validationErrors.date)

  function setFilterEnabled(filter: FilterKey, enabled: boolean) {
    clearLimitError()
    setFilters((current) => ({ ...current, [filter]: enabled }))

    if (!enabled && filter !== "date") {
      setRanges((current) => ({ ...current, [filter]: { from: "", to: "" } }))
    }

    if (!enabled && filter === "date") {
      setDateRange({})
    }
  }

  function setRangeValue(filter: Exclude<FilterKey, "date">, field: keyof Range, value: string) {
    clearLimitError()
    setRanges((current) => ({
      ...current,
      [filter]: { ...current[filter], [field]: value },
    }))
  }

  function applyDatePreset(days: number) {
    clearLimitError()
    const to = new Date()
    const from = new Date(to)
    from.setDate(from.getDate() - days)
    setFilters((current) => ({ ...current, date: true }))
    setDateRange({ from, to })
  }

  function toggleForecast(filter: ForecastFilterKey, option: string) {
    clearLimitError()
    setSelectedForecasts((current) => {
      const selection = new Set(current[filter])
      selection.has(option) ? selection.delete(option) : selection.add(option)
      return { ...current, [filter]: selection }
    })
  }

  function resetFilters() {
    clearLimitError()
    setFilters(initialFilters)
    setRanges(initialRanges)
    setDateRange({})
    setValidationErrors({})
    setSelectedForecasts(createDefaultForecastSelections())
    setLoadingAction("reset")
    document.dispatchEvent(new CustomEvent("quakestrike:filters", {
      detail: createDefaultMapFilters(),
    }))
  }

  function applyFilters() {
    const errors = validateFilters(filters, ranges, dateRange)
    setValidationErrors(errors)
    if (Object.keys(errors).length) return

    const detail: EarthquakeMapFilters = {
      events: {
        magnitude: filters.magnitude ? ranges.magnitude : null,
        depth: filters.depth ? ranges.depth : null,
        date: filters.date && dateRange.from && dateRange.to
          ? { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() }
          : null,
      },
      forecasts: {
        aftershock24hLikelihoods: [...selectedForecasts.aftershock24hLikelihoods],
        m5PlusLikelihoods: [...selectedForecasts.m5PlusLikelihoods],
        distanceBands: [...selectedForecasts.distanceBands],
      },
    }

    setLoadingAction("apply")
    document.dispatchEvent(new CustomEvent("quakestrike:filters", { detail }))
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-transparent hover:text-sidebar-foreground md:h-8 md:pl-0"
              render={<a href="#" aria-label="Home" />}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <TerminalIcon className="size-4" />
              </div>
              <span>QuakeStrike</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <Accordion multiple defaultValue={["events", "forecasts"]}>
          <AccordionItem value="events">
            <SidebarGroup>
              <AccordionTrigger className="px-2">
                <span className="inline-flex items-center gap-1">
                  Earthquake event filters
                  <FilterHelp insideTrigger label="Earthquake event filters">
                    Filter events by magnitude, depth, or date.
                  </FilterHelp>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <SidebarGroupContent className="space-y-5 px-2 pb-4 group-data-[collapsible=icon]:hidden">
                  <FilterToggle
                    label="Magnitude"
                    checked={filters.magnitude}
                    onCheckedChange={(enabled) => setFilterEnabled("magnitude", enabled)}
                    error={validationErrors.magnitude}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <Input aria-invalid={Boolean(validationErrors.magnitude)} type="number" min="0" step="0.1" placeholder="From" value={ranges.magnitude.from} onChange={(event) => setRangeValue("magnitude", "from", event.target.value)} />
                      <Input aria-invalid={Boolean(validationErrors.magnitude)} type="number" min="0" step="0.1" placeholder="To" value={ranges.magnitude.to} onChange={(event) => setRangeValue("magnitude", "to", event.target.value)} />
                    </div>
                  </FilterToggle>

                  <FilterToggle
                    label="Depth (km)"
                    checked={filters.depth}
                    onCheckedChange={(enabled) => setFilterEnabled("depth", enabled)}
                    error={validationErrors.depth}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <Input aria-invalid={Boolean(validationErrors.depth)} type="number" min="0" step="1" placeholder="From" value={ranges.depth.from} onChange={(event) => setRangeValue("depth", "from", event.target.value)} />
                      <Input aria-invalid={Boolean(validationErrors.depth)} type="number" min="0" step="1" placeholder="To" value={ranges.depth.to} onChange={(event) => setRangeValue("depth", "to", event.target.value)} />
                    </div>
                  </FilterToggle>

                  <FilterToggle
                    label="Date range"
                    checked={filters.date}
                    onCheckedChange={(enabled) => setFilterEnabled("date", enabled)}
                    error={dateError}
                  >
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <DatePicker invalid={Boolean(dateError)} value={dateRange.from} onSelect={(from) => { clearLimitError(); setDateRange((current) => ({ ...current, from })) }} />
                        <DatePicker invalid={Boolean(dateError)} value={dateRange.to} onSelect={(to) => { clearLimitError(); setDateRange((current) => ({ ...current, to: endOfDay(to) })) }} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button type="button" variant="outline" size="xs" onClick={() => applyDatePreset(1)}>Last 24h</Button>
                        <Button type="button" variant="outline" size="xs" onClick={() => applyDatePreset(7)}>Last 7 days</Button>
                        <Button type="button" variant="outline" size="xs" onClick={() => applyDatePreset(14)}>Last 2 weeks</Button>
                      </div>
                    </div>
                  </FilterToggle>
                </SidebarGroupContent>
              </AccordionContent>
            </SidebarGroup>
          </AccordionItem>
          <AccordionItem value="forecasts">
            <SidebarGroup>
              <AccordionTrigger className="px-2">Forecast filters</AccordionTrigger>
              <AccordionContent className="pb-0">
                <SidebarGroupContent className="px-2 pb-4 group-data-[collapsible=icon]:hidden">
                  <ForecastFilterFields selections={selectedForecasts} onToggle={toggleForecast} />
                </SidebarGroupContent>
              </AccordionContent>
            </SidebarGroup>
          </AccordionItem>
        </Accordion>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {limitError ? (
          <div role="alert" className="relative rounded-lg border border-destructive/30 bg-destructive/10 p-3 pr-8 text-xs text-destructive shadow-md">
            Too many events to display ({limitError.count.toLocaleString()}). Try M4+ events or a shorter date range.
            <button type="button" aria-label="Dismiss filter warning" onClick={clearLimitError} className="absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded-md text-destructive/70 hover:bg-destructive/15 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40">
              <XIcon className="size-3.5" />
            </button>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" disabled={Boolean(loadingAction)} aria-busy={loadingAction === "reset"} onClick={resetFilters}>{loadingAction === "reset" ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : null}Reset filters</Button>
          <Button type="button" disabled={Boolean(loadingAction || limitError || liveDateError)} aria-busy={loadingAction === "apply"} onClick={applyFilters}>{loadingAction === "apply" ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : null}Apply filters</Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
