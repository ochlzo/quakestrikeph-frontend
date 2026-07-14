"use client"

import * as React from "react"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getEarthquakeForecast,
  type EarthquakeForecast,
  type EarthquakeMarker,
} from "@/data/earthquakes"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  FORECAST_DISTANCE_BANDS,
  getMostLikelyDistance,
} from "@/lib/earthquake-forecast"

const PERCENT_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const CREATED_AT_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
})
const LIKELIHOOD_STYLES: Record<string, string> = {
  low: "bg-likelihood-low/10 text-likelihood-low",
  medium: "bg-likelihood-medium/10 text-likelihood-medium",
  high: "bg-likelihood-high/10 text-likelihood-high",
}

type ForecastLoadState = {
  eventId: string | null
  forecast: EarthquakeForecast | null
  error: boolean
}

function probability(value: number | null) {
  return value === null ? "Unavailable" : PERCENT_FORMATTER.format(value)
}

function ForecastMetric({
  title,
  probabilityValue,
  likelihood,
  message,
}: {
  title: string
  probabilityValue: number | null
  likelihood: string | null
  message: string | null
}) {
  const level = likelihood?.toLowerCase() ?? ""

  return (
    <section className="space-y-2 border-b border-sidebar-border p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="flex items-center justify-between gap-3">
        {likelihood ? (
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${LIKELIHOOD_STYLES[level] ?? "bg-muted text-muted-foreground"}`}>
            {likelihood}
          </span>
        ) : <span />}
        <strong className="text-lg">{probability(probabilityValue)}</strong>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </section>
  )
}

function ForecastLoading() {
  return (
    <div className="space-y-5 p-4" aria-label="Loading forecast details">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  )
}

function ForecastPanel({
  event,
  forecast,
  loading,
  error,
  onClose,
  onRetry,
}: {
  event: EarthquakeMarker | null
  forecast: EarthquakeForecast | null
  loading: boolean
  error: boolean
  onClose: () => void
  onRetry: () => void
}) {
  return (
    <div className="flex h-full min-h-0 w-80 flex-col bg-sidebar text-sidebar-foreground">
      <header className="flex items-start justify-between gap-3 border-b border-sidebar-border p-4">
        <div className="min-w-0">
          <h2 className="font-medium">Forecast details</h2>
          {event ? (
            <>
              <p className="truncate text-sm">{event.location ?? "Unknown location"}</p>
              <p className="text-xs text-muted-foreground">M{event.magnitude.toFixed(1)} · {event.date}</p>
            </>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close forecast details" onClick={onClose}>
          <XIcon />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? <ForecastLoading /> : null}
        {error ? (
          <div className="space-y-3 p-4 text-sm">
            <p>Could not load forecast details.</p>
            <Button type="button" variant="outline" onClick={onRetry}>Try again</Button>
          </div>
        ) : null}
        {forecast ? (
          <>
            <ForecastMetric
              title="Aftershock within 24 hours"
              probabilityValue={forecast.aftershock24h}
              likelihood={forecast.aftershock24hLikelihoodLevel}
              message={forecast.aftershockMessage}
            />
            <ForecastMetric
              title="Magnitude 5+ aftershock within 24 hours"
              probabilityValue={forecast.m5PlusAftershock}
              likelihood={forecast.m5PlusLikelihoodLevel}
              message={forecast.m5PlusMessage}
            />
            <section className="space-y-2 border-b border-sidebar-border p-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimated strongest aftershock</h3>
              <strong className="block text-lg">
                {forecast.estimatedStrongestAftershock === null
                  ? "Unavailable"
                  : `M${forecast.estimatedStrongestAftershock.toFixed(2)}`}
              </strong>
              {forecast.maxMagnitudeMessage ? <p className="text-sm text-muted-foreground">{forecast.maxMagnitudeMessage}</p> : null}
            </section>
            <section className="space-y-3 p-4">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely distance</h3>
                <strong className="text-lg">{getMostLikelyDistance(forecast)}</strong>
              </div>
              <dl className="space-y-1.5 text-sm">
                {FORECAST_DISTANCE_BANDS.map((band) => (
                  <div key={band.key} className="flex justify-between gap-4">
                    <dt>{band.label}</dt>
                    <dd className="font-medium tabular-nums">{probability(forecast[band.key])}</dd>
                  </div>
                ))}
              </dl>
              {forecast.distanceMessage ? <p className="text-sm text-muted-foreground">{forecast.distanceMessage}</p> : null}
            </section>
          </>
        ) : null}
      </div>

      {forecast ? (
        <footer className="border-t border-sidebar-border p-4 text-xs text-muted-foreground">
          Forecast generated {CREATED_AT_FORMATTER.format(new Date(forecast.createdAt))}. Forecasts are estimates.
        </footer>
      ) : null}
    </div>
  )
}

export function EarthquakeForecastSidebar({
  event,
  covered,
  onClose,
}: {
  event: EarthquakeMarker | null
  covered: boolean
  onClose: () => void
}) {
  const isMobile = useIsMobile()
  const [retry, setRetry] = React.useState(0)
  const [state, setState] = React.useState<ForecastLoadState>({ eventId: null, forecast: null, error: false })

  React.useEffect(() => {
    if (!event) return
    let cancelled = false
    setState({ eventId: event.id, forecast: null, error: false })
    getEarthquakeForecast(event.id)
      .then((forecast) => {
        if (!cancelled) setState({ eventId: event.id, forecast, error: !forecast })
      })
      .catch(() => {
        if (!cancelled) setState({ eventId: event.id, forecast: null, error: true })
      })
    return () => { cancelled = true }
  }, [event?.id, retry])

  const current = state.eventId === event?.id ? state : null
  const content = (
    <ForecastPanel
      event={event}
      forecast={current?.forecast ?? null}
      loading={Boolean(event && (!current || (!current.forecast && !current.error)))}
      error={current?.error ?? false}
      onClose={onClose}
      onRetry={() => setRetry((value) => value + 1)}
    />
  )

  if (isMobile) {
    return (
      <Sheet open={Boolean(event)} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="left" showCloseButton={false} className="w-80 gap-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Forecast details</SheetTitle>
            <SheetDescription>Forecast information for the selected earthquake.</SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      aria-label="Forecast details"
      aria-hidden={!event || covered}
      inert={!event || covered}
      className="absolute inset-0 z-10"
    >
      {content}
    </aside>
  )
}
