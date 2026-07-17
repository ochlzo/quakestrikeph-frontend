"use client"

import * as React from "react"
import { ArrowLeftIcon, RefreshCwIcon } from "lucide-react"

import {
  ForecastDiscussionSections,
  ForecastDiscussionSummary,
} from "@/components/forecast-discussion-content"
import { ForecastPlayback } from "@/components/forecast-playback"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getEarthquakeEvent,
  getEarthquakeForecast,
  getForecastPlaybackPage,
  type EarthquakeEventDetail,
  type EarthquakeForecast,
  type ForecastPlaybackEvent,
  type ForecastPlaybackPage,
} from "@/data/earthquakes"

type ReportData = {
  trigger: EarthquakeEventDetail
  forecast: EarthquakeForecast
  playback: ForecastPlaybackPage
}

type LoadError =
  | "missing-id"
  | "unknown-event"
  | "no-forecast"
  | "unavailable-data"

function LoadingReport() {
  return (
    <main className="mx-auto max-w-[1600px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-9 w-32" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(28rem,52%)]">
        <div className="space-y-5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-24 w-4/5" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-[31rem] w-full rounded-xl" />
      </div>
    </main>
  )
}

function ErrorReport({ error, onRetry }: { error: LoadError; onRetry: () => void }) {
  const messages: Record<LoadError, { title: string; detail: string }> = {
    "missing-id": {
      title: "Choose an earthquake from the map",
      detail: "This forecast discussion link is missing an event ID.",
    },
    "unknown-event": {
      title: "Earthquake not found",
      detail: "The selected earthquake is unavailable or may no longer exist.",
    },
    "no-forecast": {
      title: "No forecast is available",
      detail: "A discussion can only be shown after a forecast has been generated for this earthquake.",
    },
    "unavailable-data": {
      title: "Forecast data could not be loaded",
      detail: "The observation source may be temporarily unavailable. Try again in a moment.",
    },
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-12">
      <div className="w-full space-y-5 rounded-xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">{messages[error].title}</h1>
        <p className="text-muted-foreground">{messages[error].detail}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <a href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <ArrowLeftIcon /> Back to map
          </a>
          {error === "unavailable-data" ? (
            <Button type="button" size="lg" onClick={onRetry}>
              <RefreshCwIcon /> Try again
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  )
}

export function ForecastDiscussionPage() {
  const isIframe = new URLSearchParams(window.location.search).get("iframe") === "true"
  const [retry, setRetry] = React.useState(0)
  const [data, setData] = React.useState<ReportData | null>(null)
  const [error, setError] = React.useState<LoadError | null>(null)
  const [observations, setObservations] = React.useState<ForecastPlaybackEvent[]>([])
  const [playback, setPlayback] = React.useState<ForecastPlaybackPage | null>(null)

  React.useEffect(() => {
    const eventId = new URLSearchParams(window.location.search).get("event")?.trim()
    if (!eventId) {
      setError("missing-id")
      return
    }

    let cancelled = false
    setData(null)
    setError(null)
    Promise.all([
      getEarthquakeEvent(eventId),
      getEarthquakeForecast(eventId),
      getForecastPlaybackPage(eventId),
    ])
      .then(([trigger, forecast, initialPlayback]) => {
        if (cancelled) return
        if (!trigger) return setError("unknown-event")
        if (!forecast) return setError("no-forecast")
        if (!initialPlayback) return setError("unavailable-data")
        setData({ trigger, forecast, playback: initialPlayback })
        setPlayback(initialPlayback)
        setObservations(initialPlayback.events)
      })
      .catch(() => {
        if (!cancelled) setError("unavailable-data")
      })
    return () => { cancelled = true }
  }, [retry])

  const handlePlaybackChange = React.useCallback((
    nextEvents: ForecastPlaybackEvent[],
    nextPage: ForecastPlaybackPage
  ) => {
    setObservations(nextEvents)
    setPlayback(nextPage)
  }, [])

  if (error) return <ErrorReport error={error} onRetry={() => setRetry((value) => value + 1)} />
  if (!data || !playback) return <LoadingReport />

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {isIframe ? null : (
        <a href="/" className={buttonVariants({ variant: "ghost", size: "lg", className: "mb-6" })}>
          <ArrowLeftIcon /> Back to map
        </a>
      )}

      {playback.status === "delayed" ? (
        <div className="mb-6 rounded-lg border border-l-4 border-l-likelihood-medium bg-likelihood-medium/5 p-4 text-sm">
          The latest catalog update was delayed. Playback uses the most recent successful observation watermark and may be incomplete.
        </div>
      ) : null}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(28rem,52%)] xl:gap-12">
        <ForecastDiscussionSummary trigger={data.trigger} forecast={data.forecast} />
        <ForecastPlayback
          eventId={data.trigger.id}
          trigger={data.trigger}
          forecast={data.forecast}
          initialPage={data.playback}
          onPlaybackChange={handlePlaybackChange}
        />
      </div>

      <ForecastDiscussionSections
        trigger={data.trigger}
        forecast={data.forecast}
        playback={playback}
        observations={observations}
      />
    </main>
  )
}
