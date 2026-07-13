import { CircleHelpIcon } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DISTANCE_BANDS, FORECAST_LIKELIHOODS } from "@/lib/earthquake-map-filters"

export type ForecastFilterKey =
  | "aftershock24hLikelihoods"
  | "m5PlusLikelihoods"
  | "distanceBands"

export type ForecastSelections = Record<ForecastFilterKey, Set<string>>

const likelihoodClassNames = {
  low: "bg-emerald-600 text-white",
  medium: "bg-amber-700 text-white",
  high: "bg-destructive text-white",
}
const likelihoodOptions = FORECAST_LIKELIHOODS.map((id) => ({
  id,
  label: id.toUpperCase(),
  className: likelihoodClassNames[id],
}))
const distanceLabels = {
  within_10km: "Within 10 km",
  between_10_25km: "10–25 km",
  between_25_50km: "25–50 km",
  beyond_50km: "Beyond 50 km",
}

const forecastFilterGroups: Array<{
  id: ForecastFilterKey
  label: string
  help: string
  options: Array<{ id: string; label: string; className?: string }>
  description?: string
}> = [
  {
    id: "aftershock24hLikelihoods",
    label: "24h aftershock likelihood",
    help: "Chance of any aftershock within 24 hours.",
    options: likelihoodOptions,
  },
  {
    id: "m5PlusLikelihoods",
    label: "M5+ aftershock likelihood",
    help: "Chance of an M5+ aftershock.",
    options: likelihoodOptions,
  },
  {
    id: "distanceBands",
    label: "Most likely aftershock distance",
    help: "Distance band with the highest predicted probability.",
    options: DISTANCE_BANDS.map((id) => ({ id, label: distanceLabels[id] })),
    description: "Based on the highest predicted distance probability.",
  },
]

export function FilterHelp({
  label,
  children,
  insideTrigger = false,
}: {
  label: string
  children: string
  insideTrigger?: boolean
}) {
  const className = "inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          insideTrigger
            ? <span aria-hidden="true" className={className} />
            : <button type="button" aria-label={`About ${label}`} className={className} />
        }
      >
        <CircleHelpIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="right">{children}</TooltipContent>
    </Tooltip>
  )
}

export function createDefaultForecastSelections(): ForecastSelections {
  return Object.fromEntries(
    forecastFilterGroups.map((group) => [group.id, new Set(group.options.map((option) => option.id))])
  ) as ForecastSelections
}

export function ForecastFilterFields({
  selections,
  onToggle,
}: {
  selections: ForecastSelections
  onToggle: (filter: ForecastFilterKey, option: string) => void
}) {
  return (
    <div className="space-y-5">
      {forecastFilterGroups.map((group) => (
        <fieldset key={group.id} className="space-y-2">
          <legend className="text-sm font-medium">
            <span className="inline-flex items-center gap-1">
              {group.label}
              <FilterHelp label={group.label}>{group.help}</FilterHelp>
            </span>
          </legend>
          {group.options.map((option) => (
            <Label key={option.id} className="cursor-pointer">
              <input
                type="checkbox"
                checked={selections[group.id].has(option.id)}
                onChange={() => onToggle(group.id, option.id)}
                className="size-4 rounded border-input accent-primary"
              />
              <span className={option.className ? `rounded-sm px-2 py-0.5 text-xs font-semibold ${option.className}` : "text-sm"}>
                {option.label}
              </span>
            </Label>
          ))}
          {group.description ? <p className="text-xs text-muted-foreground">{group.description}</p> : null}
        </fieldset>
      ))}
    </div>
  )
}
