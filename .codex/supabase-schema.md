# Supabase schema context

Context only — not a runnable migration. Schema: `public`.

## Tables

- `ScraperRuns` — `run_id` (PK), `trigger_type` (`scheduled|manual|historical_import`), `status` (`running|completed|failed`), `events_found`, `events_inserted`, `error_message`, `started_at`, `finished_at`.
- `RawEarthquakeEvents` — `id` (PK), `Date-Time`, `Latitude`, `Longitude`, `Depth`, `Magnitude`, `Location`, `Month`, `Year`, `event_time`, `ingestion_run_id` (FK). This is the map's source of real events.
- `SeisPredictions_v1` — `event_id` (PK/FK), `prediction_json`, `created_at`, probabilities: `aftershock_24h`, `m5_plus_aftershock`, `within_10km`, `between_10_25km`, `between_25_50km`, `beyond_50km`, `est_max_aftershock`; labels: `aftershock_24h_likelihood_level`, `m5_plus_likelihood_level`; messages: `aftershock_msg`, `m5_plus_msg`, `distance_msg`, `max_magnitude_msg`. Most scalar prediction fields default from `prediction_json`.
- `ProcessingJobs` — `job_id` (PK), `event_id` (FK), `scraper_run_id` (nullable FK), `status` (`queued|running|completed|failed`), `attempt_count`, `error_message`, `started_at`, `finished_at`, `created_at`.
- `PubUser` — `PUser_id` (PK), `auth_user_id` (unique FK to `auth.users.id`), `role` (`user|admin`), `Email`, `DisplayName`, `FName`, `Mname`, `LName`, `MobileNum`. This is the authenticated profile row for each app account.
- `PubUserAuditLog` — `audit_id` (PK), `profile_puser_id` (FK), `profile_auth_user_id` (FK), `profile_email`, `action`, `changed_fields`, `old_values`, `new_values`, `changed_by` (FK to `auth.users.id`), `changed_by_email`, `changed_at`. This records profile edits.
- `PasswordResetLog` — `log_id` (PK), `auth_user_id` (FK to `PubUser.auth_user_id`), `reset_email`, `status`, `reset_type`, `completed_at`. This records completed password resets.

## Relationships

```text
ScraperRuns 1 -- * RawEarthquakeEvents 1 -- 1 SeisPredictions_v1
      \                         \
       \                         * -- ProcessingJobs
        * -----------------------/
auth.users 1 -- 1 PubUser 1 -- * PubUserAuditLog
            \                   \
             \                   * -- PasswordResetLog
              * -----------------/
```

`RawEarthquakeEvents.ingestion_run_id -> ScraperRuns.run_id`  
`SeisPredictions_v1.event_id -> RawEarthquakeEvents.id`  
`ProcessingJobs.event_id -> RawEarthquakeEvents.id`  
`ProcessingJobs.scraper_run_id -> ScraperRuns.run_id` (optional)
`PubUser.auth_user_id -> auth.users.id`  
`PubUser.role` determines admin access in the application  
`PubUserAuditLog.profile_auth_user_id -> PubUser.auth_user_id`  
`PubUserAuditLog.changed_by -> auth.users.id`  
`PasswordResetLog.auth_user_id -> PubUser.auth_user_id`

## Public search RPC

`search_earthquake_events(query_text, result_limit, result_offset)` searches `RawEarthquakeEvents.Location` across the full table with `pg_trgm` typo tolerance. It requires at least 3 characters, supports stable 50-event pages up to the 2,000-event map cap, runs as the caller (`security invoker`), and is executable only by `anon` and `authenticated`.

The map uses `filter_earthquake_events(...)` for both recent events and location search. It joins `SeisPredictions_v1`, applies earthquake and forecast criteria before pagination, returns forecast fields with each event, and keeps the same security-invoker, 50-row page, and 2,000-result cap contract.

The supporting `raw_earthquake_events_location_trgm_idx` GiST expression index is defined in `supabase/migrations/`.

## RLS

 RLS is enabled on the public tables. Browser map access must be read-only:

- Allow `SELECT` for `anon` and `authenticated` on `RawEarthquakeEvents`.
- Allow `SELECT` for `anon` and `authenticated` on `SeisPredictions_v1`.
- Do not expose `ScraperRuns` or `ProcessingJobs` to the browser.
- Allow authenticated users to read their own `PubUser` row, `PubUserAuditLog`, and `PasswordResetLog` rows through the application.
- Treat `PubUser.role = 'admin'` as the admin-dashboard access gate.

Required policies (apply through Supabase, not from this file):

```sql
create policy "public map reads events"
on public."RawEarthquakeEvents" for select
to anon, authenticated using (true);

create policy "public map reads predictions"
on public."SeisPredictions_v1" for select
to anon, authenticated using (true);
```
