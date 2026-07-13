"use client"

import * as React from "react"
import { DayPicker, type DropdownProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function CalendarDropdown({ options, value, onChange, disabled, "aria-label": ariaLabel }: DropdownProps) {
  const items = options?.map((option) => ({
    label: option.label,
    value: option.value.toString(),
  })) ?? []

  return (
    <Select
      items={items}
      value={value?.toString() ?? null}
      disabled={disabled}
      onValueChange={(newValue) => {
        if (!newValue || !onChange) return
        onChange({ target: { value: newValue } } as React.ChangeEvent<HTMLSelectElement>)
      }}
    >
      <SelectTrigger size="sm" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options?.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value.toString()}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function Calendar({ className, components, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays
      className={cn("p-1", className)}
      components={{ Dropdown: CalendarDropdown, ...components }}
      style={
        {
          "--rdp-accent-color": "var(--primary)",
          "--rdp-accent-background-color": "var(--accent)",
          "--rdp-range_middle-background-color": "var(--muted)",
          "--rdp-range_middle-color": "var(--foreground)",
          "--rdp-range_start-color": "var(--primary-foreground)",
          "--rdp-range_end-color": "var(--primary-foreground)",
          "--rdp-day-height": "1.75rem",
          "--rdp-day-width": "1.75rem",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Calendar }
