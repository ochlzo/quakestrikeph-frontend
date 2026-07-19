import { CircleHelpIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { FORECAST_LIKELIHOODS } from "@/lib/earthquake-map-filters"

export type ForecastFilterKey =
  | "aftershock24hLikelihoods"
  | "m5PlusLikelihoods"

export type ForecastSelections = Record<ForecastFilterKey, Set<string>>

const likelihoodOptions = FORECAST_LIKELIHOODS.map((id) => ({
  id,
  label: id,
}))
const forecastFilterGroups: Array<{
  id: ForecastFilterKey
  label: string
  options: Array<{ id: string; label: string }>
}> = [
  {
    id: "aftershock24hLikelihoods",
    label: "Chance of any aftershock within 24 hours",
    options: likelihoodOptions,
  },
  {
    id: "m5PlusLikelihoods",
    label: "Chance of a magnitude 5 or stronger aftershock",
    options: likelihoodOptions,
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
  minimumEstimatedStrongestAftershock,
  onMinimumEstimatedStrongestAftershockChange,
  includeNoForecast,
  onIncludeNoForecastChange,
  onlyWithPhivolcsReview,
  onOnlyWithPhivolcsReviewChange,
  magnitudeError,
}: {
  selections: ForecastSelections
  onToggle: (filter: ForecastFilterKey, option: string) => void
  minimumEstimatedStrongestAftershock: string
  onMinimumEstimatedStrongestAftershockChange: (value: string) => void
  includeNoForecast: boolean
  onIncludeNoForecastChange: (checked: boolean) => void
  onlyWithPhivolcsReview: boolean
  onOnlyWithPhivolcsReviewChange: (checked: boolean) => void
  magnitudeError?: string
}) {
  return (
    <div className="space-y-5">
      {forecastFilterGroups.map((group) => (
        <fieldset key={group.id} className="space-y-2">
          <legend className="text-sm font-medium">{group.label}</legend>
          {group.options.map((option) => (
            <Label key={option.id} className="cursor-pointer">
              <input
                type="checkbox"
                checked={selections[group.id].has(option.id)}
                onChange={() => onToggle(group.id, option.id)}
                className="size-4 rounded border-input accent-primary"
              />
              <span className="text-sm capitalize">{option.label}</span>
            </Label>
          ))}
        </fieldset>
      ))}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Estimated strongest aftershock</legend>
        <Label htmlFor="minimum-estimated-aftershock" className="font-normal">
          Show M
          <Input
            id="minimum-estimated-aftershock"
            type="number"
            min="0"
            step="0.1"
            inputMode="decimal"
            placeholder="4.0"
            value={minimumEstimatedStrongestAftershock}
            aria-invalid={Boolean(magnitudeError)}
            onChange={(event) => onMinimumEstimatedStrongestAftershockChange(event.target.value)}
            className="w-20"
          />
          or stronger
        </Label>
        {magnitudeError ? <p role="alert" className="text-xs text-destructive">{magnitudeError}</p> : null}
      </fieldset>
      <Label className="cursor-pointer leading-snug">
        <input
          type="checkbox"
          checked={includeNoForecast}
          onChange={(event) => onIncludeNoForecastChange(event.target.checked)}
          className="size-4 shrink-0 rounded border-input accent-primary"
        />
        <span>Include earthquakes with no forecast available</span>
      </Label>
      <Label className="cursor-pointer leading-snug">
        <input
          type="checkbox"
          checked={onlyWithPhivolcsReview}
          onChange={(event) => onOnlyWithPhivolcsReviewChange(event.target.checked)}
          className="size-4 shrink-0 rounded border-input accent-primary"
        />
        <span>Only earthquakes with an available PHIVOLCS review</span>
      </Label>
    </div>
  )
}
