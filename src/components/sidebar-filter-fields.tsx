import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

function formatDate(date?: Date) {
  return date
    ? date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
    : "mm/dd/yyyy"
}

export function DatePicker({
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

export function FilterToggle({
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
