"use client"

import * as React from "react"
import { CalendarIcon, TerminalIcon } from "lucide-react"

import { validateFilters, type FilterErrors, type FilterKey, type Range } from "@/lib/filter-validation"
import {
  createDefaultForecastSelections,
  FilterHelp,
  ForecastFilterFields,
  type ForecastFilterKey,
} from "@/components/forecast-filter-fields"
import { Calendar } from "@/components/ui/calendar"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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

function formatDate(date?: Date) {
  return date
    ? date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      })
    : "mm/dd/yyyy"
}

function DatePicker({
  value,
  onSelect,
  invalid,
}: {
  value?: Date
  onSelect: (date?: Date) => void
  invalid?: boolean
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-invalid={invalid}
        className="flex h-8 min-w-0 flex-1 items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {formatDate(value)}
        <CalendarIcon className="size-4 text-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onSelect(date)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function FilterToggle({
  checked,
  label,
  onCheckedChange,
  error,
  children,
}: {
  checked: boolean
  label: string
  onCheckedChange: (checked: boolean) => void
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label className="cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="size-4 rounded border-input accent-primary"
        />
        {label}
      </Label>
      {checked ? (
        <div className="space-y-2 pl-6">
          {children}
          {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [filters, setFilters] = React.useState(initialFilters)
  const [ranges, setRanges] = React.useState(initialRanges)
  const [dateRange, setDateRange] = React.useState<{ from?: Date; to?: Date }>({})
  const [validationErrors, setValidationErrors] = React.useState<FilterErrors>({})
  const [selectedForecasts, setSelectedForecasts] = React.useState(createDefaultForecastSelections)

  function setFilterEnabled(filter: FilterKey, enabled: boolean) {
    setFilters((current) => ({ ...current, [filter]: enabled }))

    if (!enabled && filter !== "date") {
      setRanges((current) => ({ ...current, [filter]: { from: "", to: "" } }))
    }

    if (!enabled && filter === "date") {
      setDateRange({})
    }
  }

  function setRangeValue(filter: Exclude<FilterKey, "date">, field: keyof Range, value: string) {
    setRanges((current) => ({
      ...current,
      [filter]: { ...current[filter], [field]: value },
    }))
  }

  function applyDatePreset(days: number) {
    const to = new Date()
    const from = new Date(to)
    from.setDate(from.getDate() - days)
    setFilters((current) => ({ ...current, date: true }))
    setDateRange({ from, to })
  }

  function toggleForecast(filter: ForecastFilterKey, option: string) {
    setSelectedForecasts((current) => {
      const selection = new Set(current[filter])
      selection.has(option) ? selection.delete(option) : selection.add(option)
      return { ...current, [filter]: selection }
    })
  }

  function resetFilters() {
    setFilters(initialFilters)
    setRanges(initialRanges)
    setDateRange({})
    setValidationErrors({})
    setSelectedForecasts(createDefaultForecastSelections())
  }

  function applyFilters() {
    const errors = validateFilters(filters, ranges, dateRange)
    setValidationErrors(errors)
    if (Object.keys(errors).length) return

    document.dispatchEvent(new CustomEvent("quakestrike:filters", {
      detail: {
        events: {
          magnitude: filters.magnitude ? ranges.magnitude : null,
          depth: filters.depth ? ranges.depth : null,
          date: filters.date ? dateRange : null,
        },
        forecasts: {
          aftershock24hLikelihoods: [...selectedForecasts.aftershock24hLikelihoods],
          m5PlusLikelihoods: [...selectedForecasts.m5PlusLikelihoods],
          distanceBands: [...selectedForecasts.distanceBands],
        },
      },
    }))
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
                    error={validationErrors.date}
                  >
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <DatePicker invalid={Boolean(validationErrors.date)} value={dateRange.from} onSelect={(from) => setDateRange((current) => ({ ...current, from }))} />
                        <DatePicker invalid={Boolean(validationErrors.date)} value={dateRange.to} onSelect={(to) => setDateRange((current) => ({ ...current, to }))} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button type="button" variant="outline" size="xs" onClick={() => applyDatePreset(1)}>Last 24h</Button>
                        <Button type="button" variant="outline" size="xs" onClick={() => applyDatePreset(7)}>Last 7 days</Button>
                        <Button type="button" variant="outline" size="xs" onClick={() => applyDatePreset(30)}>Last 30 days</Button>
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
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={resetFilters}>Reset filters</Button>
          <Button type="button" onClick={applyFilters}>Apply filters</Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
