import { Separator } from "@/components/ui/separator";
import type {
  EarthquakeEventDetail,
  EarthquakeForecast,
  ForecastPlaybackEvent,
  ForecastPlaybackPage,
} from "@/data/earthquakes";
import {
  FORECAST_DISTANCE_BANDS,
  getMostLikelyDistance,
} from "@/lib/earthquake-forecast";
import {
  eventsWithinForecastWindow,
  gardnerKnopoffObservations,
  observationDiscussion,
  probabilityDiscussion,
} from "@/lib/forecast-playback";

const PERCENT = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});
const PHT_DATE = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

function probability(value: number | null) {
  return value === null ? "Unavailable" : PERCENT.format(value);
}

function likelihoodStyle(level: string | null) {
  switch (level?.toLowerCase()) {
    case "high":
      return "bg-likelihood-high/10 text-likelihood-high";
    case "medium":
      return "bg-likelihood-medium/10 text-likelihood-medium";
    case "low":
      return "bg-likelihood-low/10 text-likelihood-low";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ForecastDiscussionSummary({
  trigger,
  forecast,
}: {
  trigger: EarthquakeEventDetail;
  forecast: EarthquakeForecast;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className=" text-xs font-semibold uppercase tracking-wide text-primary">
          Forecast discussion
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {trigger.location ?? "Earthquake"} aftershock forecast
        </h1>
        <p className="text-sm text-muted-foreground">
          Trigger M{trigger.magnitude.toFixed(1)} · {trigger.date}
        </p>
      </header>

      <section className="rounded-xl border bg-card p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          Chance of at least one aftershock within 24 hours
        </p>
        <strong className="mt-2 block text-6xl font-semibold tabular-nums">
          {probability(forecast.aftershock24h)}
        </strong>
        {forecast.aftershock24hLikelihoodLevel ? (
          <span
            className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${likelihoodStyle(forecast.aftershock24hLikelihoodLevel)}`}
          >
            {forecast.aftershock24hLikelihoodLevel}
          </span>
        ) : null}
      </section>

      <p className="text-base leading-7 text-muted-foreground">
        {probabilityDiscussion(forecast.aftershock24h)}
      </p>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estimated strongest aftershock
          </dt>
          <dd className="mt-1 text-xl font-semibold">
            {forecast.estimatedStrongestAftershock === null
              ? "Unavailable"
              : `M${forecast.estimatedStrongestAftershock.toFixed(1)}`}
          </dd>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Most-likely distance
          </dt>
          <dd className="mt-1 text-xl font-semibold">
            {getMostLikelyDistance(forecast)}
          </dd>
        </div>
        <div className="rounded-lg border bg-card p-4 sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Chance of a magnitude 5 or stronger aftershock within 24 hours
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {probability(forecast.m5PlusAftershock)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function ForecastDiscussionSections({
  trigger,
  forecast,
  playback,
  observations,
}: {
  trigger: EarthquakeEventDetail;
  forecast: EarthquakeForecast;
  playback: ForecastPlaybackPage;
  observations: ForecastPlaybackEvent[];
}) {
  const screenedObservations = gardnerKnopoffObservations(observations);
  const firstDay = eventsWithinForecastWindow(
    screenedObservations,
    playback.forecastWindowEndsAt,
  );
  const later = screenedObservations.filter(
    (event) =>
      Date.parse(event.eventTime) > Date.parse(playback.forecastWindowEndsAt),
  );
  const strongest = firstDay.reduce<ForecastPlaybackEvent | null>(
    (current, event) =>
      !current || event.magnitude > current.magnitude ? event : current,
    null,
  );
  const nearest = firstDay.reduce<ForecastPlaybackEvent | null>(
    (current, event) =>
      !current || event.distanceKm < current.distanceKm ? event : current,
    null,
  );
  const magnitudeFiveCount = firstDay.filter(
    (event) => event.magnitude >= 5,
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-10 py-12">
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">
          What this forecast says
        </h2>
        <p className="leading-7 text-muted-foreground">
          This is a probability estimate, not a prediction of the exact time or
          location of an earthquake. It describes what the model considers
          plausible during the fixed 24-hour period beginning when the forecast
          was generated.
        </p>
        <p className="leading-7 text-muted-foreground">
          The chance of a magnitude 5 or stronger aftershock is{" "}
          {probability(forecast.m5PlusAftershock)}. The model estimates the
          strongest aftershock at{" "}
          {forecast.estimatedStrongestAftershock === null
            ? "an unavailable magnitude"
            : `about M${forecast.estimatedStrongestAftershock.toFixed(1)}`}
          , with {getMostLikelyDistance(forecast).toLowerCase()} as the
          most-likely distance from the trigger.
        </p>
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Observed earthquakes
          </h2>
          <p className="mt-2 leading-7 text-muted-foreground">
            {observationDiscussion(playback.status, firstDay.length)}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            For this discussion, the Gardner–Knopoff screening radius (
            {playback.gardnerKnopoffRadiusKm.toFixed(1)} km for this trigger) is
            used to identify possibly related earthquakes until further
            information is available from PHIVOLCS. This screening does not
            confirm that an earthquake is an aftershock.
          </p>
        </div>

        {strongest ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Possible related earthquakes
              </p>
              <strong className="mt-1 block text-2xl">{firstDay.length}</strong>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Largest observed
              </p>
              <strong className="mt-1 block text-2xl">
                M{strongest.magnitude.toFixed(1)}
              </strong>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Nearest observed
              </p>
              <strong className="mt-1 block text-2xl">
                {nearest?.distanceKm.toFixed(1)} km
              </strong>
            </div>
          </div>
        ) : null}

        {strongest ? (
          <div className="space-y-2 leading-7 text-muted-foreground">
            <p>
              The largest screened event recorded in the first 24 hours was M
              {strongest.magnitude.toFixed(1)}
              {forecast.estimatedStrongestAftershock === null
                ? "."
                : `, compared with the model estimate of M${forecast.estimatedStrongestAftershock.toFixed(1)}.`}
            </p>
            <p>
              {magnitudeFiveCount === 0
                ? "None of the screened observations reached magnitude 5."
                : magnitudeFiveCount === 1
                  ? "One screened observation reached magnitude 5 or higher."
                  : `${magnitudeFiveCount} screened observations reached magnitude 5 or higher.`}
              {nearest
                ? ` The nearest was ${nearest.distanceKm.toFixed(1)} km from the trigger.`
                : ""}
            </p>
          </div>
        ) : null}

        {later.length > 0 ? (
          <p className="rounded-lg border-l-4 border-primary bg-muted p-4 text-sm leading-6 text-muted-foreground">
            {later.length === 1
              ? "One later screened event is"
              : `${later.length} later screened events are`}{" "}
            available beyond the forecast window. These appear in playback for
            context and are not included in the 24-hour comparison.
          </p>
        ) : null}
      </section>

      <Separator />

      <section className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            Where activity was considered likely
          </h2>
          <p className="leading-7 text-muted-foreground">
            These bands show the model’s probability distribution for distance
            from the trigger. They do not define confirmed aftershock
            boundaries.
          </p>
          {forecast.distanceMessage ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {forecast.distanceMessage}
            </p>
          ) : null}
        </div>
        <dl className="divide-y rounded-xl border bg-card px-4">
          {FORECAST_DISTANCE_BANDS.map((band) => (
            <div
              key={band.key}
              className="flex items-center justify-between gap-4 py-3"
            >
              <dt>{band.label}</dt>
              <dd className="font-semibold tabular-nums">
                {probability(forecast[band.key])}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          Forecast and source details
        </h2>
        <dl className="grid gap-x-8 gap-y-4 rounded-xl border bg-muted/50 p-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Trigger event
            </dt>
            <dd className="mt-1 font-medium">{trigger.id}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Forecast generated
            </dt>
            <dd className="mt-1 font-medium">
              {PHT_DATE.format(new Date(playback.forecastStartedAt))} PHT
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Forecast window ends
            </dt>
            <dd className="mt-1 font-medium">
              {PHT_DATE.format(new Date(playback.forecastWindowEndsAt))} PHT
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Observed through
            </dt>
            <dd className="mt-1 font-medium">
              {playback.observedThrough
                ? `${PHT_DATE.format(new Date(playback.observedThrough))} PHT`
                : "No later successful catalog update"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Playback filter
            </dt>
            <dd className="mt-1 font-medium">
              {playback.playbackScope === "gk"
                ? `GK radius (${playback.gardnerKnopoffRadiusKm.toFixed(1)} km)`
                : playback.playbackScope === "100km"
                  ? "Within 100 km of the trigger"
                  : "All catalog observations"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Source status
            </dt>
            <dd className="mt-1 font-medium capitalize">{playback.status}</dd>
          </div>
        </dl>
      </section>

      <aside className="rounded-xl border border-l-4 border-l-primary bg-card p-5 text-sm leading-6 text-muted-foreground">
        <strong className="block text-foreground">Important limitation</strong>
        This academic prototype is not an official PHIVOLCS advisory. The
        discussion uses the Gardner–Knopoff radius to screen for possibly
        related earthquakes until further information is available from
        PHIVOLCS; screened events are not confirmed aftershocks. Forecast
        probabilities are estimates and should not be used as the sole basis for
        emergency decisions.
      </aside>
    </div>
  );
}
