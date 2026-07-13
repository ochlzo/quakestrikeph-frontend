"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"

function Calendar({ className, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays
      className={cn("p-1", className)}
      style={
        {
          "--rdp-accent-color": "var(--primary)",
          "--rdp-accent-background-color": "var(--accent)",
          "--rdp-day-height": "1.75rem",
          "--rdp-day-width": "1.75rem",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Calendar }
