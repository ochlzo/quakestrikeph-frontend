# Supabase schema context

Context only — not a runnable migration. Schema: `public`.

## Tables

- `ScraperRuns` — `run_id` (PK), `trigger_type` (`scheduled|manual|historical_import`), `status` (`running|completed|failed`), `events_found`, `events_inserted`, `error_message`, `started_at`, `finished_at`.
- `RawEarthquakeEvents` — `id` (PK), `Date-Time`, `Latitude`, `Longitude`, `Depth`, `Magnitude`, `Location`, `Month`, `Year`, `event_time`, `ingestion_run_id` (FK). This is the map's source of real events.
- `SeisPredictions_v1` — `event_id` (PK/FK), `prediction_json`, `created_at`, probabilities: `aftershock_24h`, `m5_plus_aftershock`, `within_10km`, `between_10_25km`, `between_25_50km`, `beyond_50km`, `est_max_aftershock`; labels: `aftershock_24h_likelihood_level`, `m5_plus_likelihood_level`; messages: `aftershock_msg`, `m5_plus_msg`, `distance_msg`, `max_magnitude_msg`. Most scalar prediction fields default from `prediction_json`.
- `ProcessingJobs` — `job_id` (PK), `event_id` (FK), `scraper_run_id` (nullable FK), `status` (`queued|running|completed|failed`), `attempt_count`, `error_message`, `started_at`, `finished_at`, `created_at`.

## Relationships

```text
ScraperRuns 1 -- * RawEarthquakeEvents 1 -- 1 SeisPredictions_v1
      \                         \
       \                         * -- ProcessingJobs
        * -----------------------/
```

`RawEarthquakeEvents.ingestion_run_id -> ScraperRuns.run_id`  
`SeisPredictions_v1.event_id -> RawEarthquakeEvents.id`  
`ProcessingJobs.event_id -> RawEarthquakeEvents.id`  
`ProcessingJobs.scraper_run_id -> ScraperRuns.run_id` (optional)

## Public search RPC

`search_earthquake_events(query_text, result_limit, result_offset)` searches `RawEarthquakeEvents.Location` across the full table with `pg_trgm` typo tolerance. It requires at least 3 characters, supports stable 50-event pages up to the 2,000-event map cap, runs as the caller (`security invoker`), and is executable only by `anon` and `authenticated`.

The map uses `filter_earthquake_events(...)` for both recent events and location search. It joins `SeisPredictions_v1`, applies earthquake and forecast criteria before pagination, returns forecast fields with each event, and keeps the same security-invoker, 50-row page, and 2,000-result cap contract.

The supporting `raw_earthquake_events_location_trgm_idx` GiST expression index is defined in `supabase/migrations/`.

## Forecast playback RPC

`get_forecast_playback_page(trigger_event_id, cursor_event_time, cursor_event_id, result_limit, playback_scope)` is the browser-safe forecast playback boundary. It converts Philippine-local `RawEarthquakeEvents.event_time` before comparisons, excludes the trigger, caps pages at 100 rows, and uses `(event_time, id)` cursor pagination so equal timestamps remain stable. `playback_scope` accepts `gk`, `100km`, or `all`; `gk` uses the magnitude-dependent Gardner–Knopoff radius `10^(0.1238M + 0.983)` km, `100km` applies the fixed 100 km boundary, and `all` applies no distance filter.

The RPC returns the selected playback scope, the trigger's Gardner–Knopoff radius, an exact `within_gk_radius` flag on every event, the fixed forecast start/end, a conservative `observed_through` watermark, `pending | current | complete | delayed` freshness, events, `next_cursor`, and `has_more`. The watermark is the latest successful scheduled/manual `ScraperRuns.started_at`. No later success after the forecast is `pending`; coverage inside 24 hours is `current`; coverage through 24 hours is `complete`; a newer failed attempt after the last success is `delayed`.

The function is `security definer` so it can expose only this conservative watermark without granting browser roles direct access to `ScraperRuns`. Execute is revoked from `public` and granted only to `anon` and `authenticated`.

## RLS

RLS is enabled on all four tables. Browser map access must be read-only:

- Allow `SELECT` for `anon` and `authenticated` on `RawEarthquakeEvents`.
- Allow `SELECT` for `anon` and `authenticated` on `SeisPredictions_v1`.
- Do not expose `ScraperRuns` or `ProcessingJobs` to the browser.
- Do not replace the playback RPC watermark with direct browser access to `ScraperRuns`.

Required policies (apply through Supabase, not from this file):

```sql
create policy "public map reads events"
on public."RawEarthquakeEvents" for select
to anon, authenticated using (true);

create policy "public map reads predictions"
on public."SeisPredictions_v1" for select
to anon, authenticated using (true);
```
