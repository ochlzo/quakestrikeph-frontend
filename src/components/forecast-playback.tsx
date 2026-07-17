"use client";

import * as React from "react";
import { PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react";

import { ForecastPlaybackMap } from "@/components/forecast-playback-map";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  getForecastPlaybackPage,
  type EarthquakeEventDetail,
  type EarthquakeForecast,
  type ForecastPlaybackEvent,
  type ForecastPlaybackPage,
  type ForecastPlaybackScope,
} from "@/data/earthquakes";
import {
  FORECAST_WINDOW_MS,
  formatElapsedTime,
  getPlaybackHorizon,
  scrubPlaybackTime,
  tickPlaybackTime,
} from "@/lib/forecast-playback";

const PLAYBACK_SPEEDS = [1, 2, 4] as const;
const PLAYBACK_SCOPES: Array<{ value: ForecastPlaybackScope; label: string }> =
  [
    { value: "gk", label: "GK radius" },
    { value: "100km", label: "Only within 100 km" },
    { value: "all", label: "All (no filter)" },
  ];

function mergeEvents(
  current: ForecastPlaybackEvent[],
  incoming: ForecastPlaybackEvent[],
) {
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) byId.set(event.id, event);
  return [...byId.values()].sort((a, b) => {
    const timeDifference = Date.parse(a.eventTime) - Date.parse(b.eventTime);
    return timeDifference || a.id.localeCompare(b.id);
  });
}

export function ForecastPlayback({
  eventId,
  trigger,
  forecast,
  initialPage,
  onPlaybackChange,
}: {
  eventId: string;
  trigger: EarthquakeEventDetail;
  forecast: EarthquakeForecast;
  initialPage: ForecastPlaybackPage;
  onPlaybackChange: (
    events: ForecastPlaybackEvent[],
    page: ForecastPlaybackPage,
  ) => void;
}) {
  const [events, setEvents] = React.useState(initialPage.events);
  const [page, setPage] = React.useState(initialPage);
  const [currentTime, setCurrentTime] = React.useState(() =>
    Date.parse(initialPage.forecastStartedAt),
  );
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState<(typeof PLAYBACK_SPEEDS)[number]>(1);
  const [showAllRings, setShowAllRings] = React.useState(false);
  const [scope, setScope] = React.useState<ForecastPlaybackScope>(
    initialPage.playbackScope,
  );
  const [scopeLoading, setScopeLoading] = React.useState(false);
  const [scopeError, setScopeError] = React.useState(false);
  const [bufferError, setBufferError] = React.useState(false);
  const fetchingCursorRef = React.useRef<string | null>(null);
  const scopeRef = React.useRef(initialPage.playbackScope);

  const startedAt = Date.parse(page.forecastStartedAt);
  const observedThrough = page.observedThrough
    ? Date.parse(page.observedThrough)
    : null;
  const forecastEndsAt = Date.parse(page.forecastWindowEndsAt);
  const caughtUp = observedThrough !== null && currentTime >= observedThrough;

  React.useEffect(() => {
    onPlaybackChange(events, page);
  }, [events, onPlaybackChange, page]);

  React.useEffect(() => {
    if (!playing || observedThrough === null || caughtUp) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - previous;
      previous = now;
      setCurrentTime((value) =>
        tickPlaybackTime(value, elapsed, speed, observedThrough, true),
      );
    }, 100);
    return () => window.clearInterval(timer);
  }, [caughtUp, observedThrough, playing, speed]);

  React.useEffect(() => {
    if (caughtUp && playing) setPlaying(false);
  }, [caughtUp, playing]);

  React.useEffect(() => {
    if (bufferError || !page.hasMore || !page.nextCursor) return;
    const unrevealed = events.filter(
      (event) => Date.parse(event.eventTime) > currentTime,
    ).length;
    const lastEventTime = events.at(-1)?.eventTime;
    const needsForecastWindow =
      !lastEventTime || Date.parse(lastEventTime) <= forecastEndsAt;
    if (!needsForecastWindow && unrevealed >= 20) return;

    const cursorKey = `${page.nextCursor.eventTime}:${page.nextCursor.eventId}`;
    if (fetchingCursorRef.current === cursorKey) return;
    fetchingCursorRef.current = cursorKey;
    const requestedScope = page.playbackScope;
    void getForecastPlaybackPage(eventId, page.nextCursor, 100, requestedScope)
      .then((nextPage) => {
        if (!nextPage || scopeRef.current !== requestedScope) return;
        setBufferError(false);
        setEvents((current) => mergeEvents(current, nextPage.events));
        setPage(nextPage);
      })
      .catch(() => setBufferError(true))
      .finally(() => {
        fetchingCursorRef.current = null;
      });
  }, [bufferError, currentTime, eventId, events, forecastEndsAt, page]);

  const horizon =
    observedThrough === null
      ? startedAt + FORECAST_WINDOW_MS
      : getPlaybackHorizon(startedAt, currentTime, observedThrough);
  const sliderMaximum = Math.max(0, horizon - startedAt);
  const sliderValue = Math.max(0, currentTime - startedAt);
  const beyondForecast = currentTime > forecastEndsAt;
  function changeScope(nextScope: ForecastPlaybackScope) {
    if (nextScope === scope || scopeLoading) return;
    const previousScope = scope;
    scopeRef.current = nextScope;
    setScope(nextScope);
    setPlaying(false);
    setScopeLoading(true);
    setScopeError(false);
    void getForecastPlaybackPage(eventId, null, 100, nextScope)
      .then((nextPage) => {
        if (!nextPage) throw new Error("Playback data is unavailable");
        if (scopeRef.current !== nextScope) return;
        setEvents(nextPage.events);
        setPage(nextPage);
        setBufferError(false);
        fetchingCursorRef.current = null;
      })
      .catch(() => {
        if (scopeRef.current !== nextScope) return;
        scopeRef.current = previousScope;
        setScope(previousScope);
        setScopeError(true);
      })
      .finally(() => setScopeLoading(false));
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm lg:sticky lg:top-6">
      <div className="h-[clamp(26rem,52vh,31.25rem)] border-b">
        <ForecastPlaybackMap
          trigger={trigger}
          forecast={forecast}
          events={events}
          currentTime={currentTime}
          showAllRings={showAllRings}
        />
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">
              {caughtUp
                ? "Caught up to latest confirmed observations"
                : beyondForecast
                  ? "Beyond forecast window"
                  : "24-hour forecast window"}
            </p>
            <p className="text-xs text-muted-foreground">
              T+{formatElapsedTime(sliderValue)} ·{" "}
              {
                events.filter(
                  (event) => Date.parse(event.eventTime) <= currentTime,
                ).length
              }{" "}
              shown
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Restart playback"
              onClick={() => {
                setPlaying(false);
                setCurrentTime(
                  scrubPlaybackTime(
                    startedAt,
                    startedAt,
                    observedThrough ?? startedAt,
                  ),
                );
              }}
            >
              <RotateCcwIcon />
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={observedThrough === null || caughtUp}
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
              {playing ? "Pause" : "Play"}
            </Button>
          </div>
        </div>

        <label className="block space-y-2 text-xs font-medium">
          <span className="sr-only">Playback time</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, sliderMaximum)}
            step={60_000}
            value={Math.min(sliderValue, Math.max(1, sliderMaximum))}
            disabled={sliderMaximum === 0}
            className="w-full accent-primary"
            onChange={(event) => {
              setPlaying(false);
              setCurrentTime(
                scrubPlaybackTime(
                  startedAt + Number(event.currentTarget.value),
                  startedAt,
                  observedThrough ?? startedAt,
                ),
              );
            }}
          />
          <span className="flex justify-between text-muted-foreground">
            <span>T+0</span>
            <span>T+{formatElapsedTime(sliderMaximum)}</span>
          </span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1" aria-label="Playback speed">
            {PLAYBACK_SPEEDS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={speed === value ? "secondary" : "ghost"}
                aria-pressed={speed === value}
                onClick={() => setSpeed(value)}
              >
                {value}×
              </Button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch
              checked={showAllRings}
              onCheckedChange={setShowAllRings}
              aria-label="Show all distance rings"
            />
            Show all distance rings
          </label>
        </div>

        <fieldset
          className="space-y-2 rounded-lg border bg-muted/40 p-3"
          disabled={scopeLoading}
        >
          <legend className="px-1 text-sm font-semibold">
            Show only which earthquakes?
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {PLAYBACK_SCOPES.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="playback-scope"
                  value={option.value}
                  checked={scope === option.value}
                  className="size-4 accent-primary"
                  onChange={() => changeScope(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {scopeLoading
              ? "Updating playback…"
              : scope === "gk"
                ? `Showing the ${page.gardnerKnopoffRadiusKm.toFixed(1)} km Gardner–Knopoff screening radius.`
                : scope === "100km"
                  ? "Showing catalog observations within 100 km of the trigger."
                  : "Showing all catalog observations with no distance filter."}
          </p>
        </fieldset>

        {bufferError ? (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3 text-xs">
            <span>Later observations could not be buffered.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBufferError(false)}
            >
              Retry
            </Button>
          </div>
        ) : null}
        {scopeError ? (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3 text-xs">
            <span>The playback filter could not be changed.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScopeError(false)}
            >
              Dismiss
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
