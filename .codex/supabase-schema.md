# Supabase schema context

Context only — not a runnable migration. Live `public` schema for Supabase project
`yrqraepkwrlxajyonwxj`, checked through the repo-scoped MCP on 2026-07-20.

## Tables

- `ScraperRuns` — `run_id` (identity PK), `trigger_type`
  (`scheduled|manual|historical_import`), `status`
  (`running|completed|failed`), `events_found`, `events_inserted`,
  `events_updated`, `error_message`, `started_at`, `finished_at`.
- `RawEarthquakeEvents` — `id` (PK), `Date-Time`, `Latitude`, `Longitude`,
  `Depth`, `Magnitude`, `Location`, `Month`, `Year`, `event_time`,
  `ingestion_run_id` (FK), and nullable source-revision fields
  `source_event_group_id`, `source_bulletin_id` (unique), and `source_url`.
  The three source-revision fields must be either all null or all populated.
  This is the map's source of earthquake events.
- `SeisPredictions_v1` — `event_id` (PK/FK), `prediction_json`, `created_at`,
  generated probabilities `aftershock_24h`, `m5_plus_aftershock`,
  `within_10km`, `between_10_25km`, `between_25_50km`, `beyond_50km`, and
  `est_max_aftershock`; generated labels `aftershock_24h_likelihood_level`
  and `m5_plus_likelihood_level`; generated messages `aftershock_msg`,
  `m5_plus_msg`, `distance_msg`, and `max_magnitude_msg`.
- `ProcessingJobs` — `job_id` (PK), `event_id` (FK), `scraper_run_id`
  (nullable FK), `status` (`queued|running|completed|failed`),
  `attempt_count`, `error_message`, `started_at`, `finished_at`, `created_at`.
- `PubUser` — `PUser_id` (PK), `auth_user_id` (unique), `role`
  (`user|admin`), `account_status` (`active|inactive`, default `active`),
  `Email`, `DisplayName`, `FName`, `Mname`, `LName`, `MobileNum`, `alerts_on`,
  `phivolcs_only`, `near_pins_only`, plus legacy nullable columns `Password`
  and `Fave_id`. Alert preferences are non-null booleans defaulting to
  `false`; dependent preferences must remain `false` while `alerts_on` is
  `false`.
  `MobileNum`, when present, must match `09` followed by nine digits.
- `PubUserAuditLog` — `aud_id` (PK), `profile_puser_id`,
  `profile_auth_user_id`, `profile_email`, `action` (`insert|update`),
  `changed_fields`, `old_values`, `new_values`, `changed_by`,
  `changed_by_email`, `changed_at`.
- `PasswordResetLog` — `log_id` (PK), `auth_user_id` (FK), `reset_email`,
  `status`, `reset_type`, `completed_at`.
- `SavedPins` — `favorite_id` (PK), `auth_user_id` (FK), `favorite_label`,
  `favorite_kind` (`location|city|map_pin`), `latitude`, `longitude`,
  `created_at`. Map pins require both coordinates. A user cannot have duplicate
  case-insensitive `(favorite_label, favorite_kind)` entries.
- `operator_profiles` — `id` (identity PK), `email` (unique), `display_name`,
  `created_at`, `updated_at`. This is the server-managed PHIVOLCS operator
  profile keyed by verified Cloudflare Access email.
- `forecast_reviews` — `id` (identity PK), `event_id` (FK),
  `forecast_created_at`, `status`
  (`PENDING_REVIEW|DRAFT|REVIEWED_NO_ALERT|REVIEWED_FOR_ALERT`),
  `review_text`, `internal_note`, `reviewed_at`, `created_at`, `updated_at`,
  `operator_id` (FK). `(event_id, forecast_created_at)` is unique.
- `audit_logs` — `id` (identity PK), `user_email`, `path`, `method`,
  `created_at`, `metadata`. This is the server-only portal activity log.

## Relationships

```text
ScraperRuns 1 -- * RawEarthquakeEvents 1 -- 1 SeisPredictions_v1
      \                         \
       \                         * -- ProcessingJobs
        * -----------------------/

PubUser 1 -- * SavedPins
    \    1 -- * PasswordResetLog

operator_profiles 1 -- * forecast_reviews * -- 1 RawEarthquakeEvents
```

- `RawEarthquakeEvents.ingestion_run_id -> ScraperRuns.run_id`.
- `SeisPredictions_v1.event_id -> RawEarthquakeEvents.id` (`ON DELETE CASCADE`).
- `ProcessingJobs.event_id -> RawEarthquakeEvents.id` (`ON DELETE CASCADE`).
- `ProcessingJobs.scraper_run_id -> ScraperRuns.run_id` (optional).
- `SavedPins.auth_user_id -> PubUser.auth_user_id` (`ON DELETE CASCADE`).
- `PasswordResetLog.auth_user_id -> PubUser.auth_user_id`
  (`ON DELETE CASCADE`).
- `forecast_reviews.event_id -> RawEarthquakeEvents.id`
  (`ON DELETE RESTRICT`).
- `forecast_reviews.operator_id -> operator_profiles.id`
  (`ON DELETE RESTRICT`).

There is currently no declared foreign key from `PubUser.auth_user_id` to
`auth.users.id`, or from `PubUserAuditLog` to `PubUser`/`auth.users`.
`auth.users` inserts and sign-ins instead call `handle_new_pubuser()` through
database triggers.

## Browser-facing earthquake RPCs

- `search_earthquake_events(query_text text, result_limit integer = 50,
  result_offset integer = 0)` — security invoker; returns event rows.
- `filter_earthquake_events(query_text text = null, magnitude_ranges jsonb =
  null, depth_from float8 = null, depth_to float8 = null, date_from timestamp =
  null, date_to timestamp = null, aftershock_24h_likelihoods text[] =
  ['low','medium','high'], m5_plus_likelihoods text[] =
  ['low','medium','high'], minimum_estimated_strongest_aftershock float8 = null,
  include_no_forecast boolean = true, only_with_phivolcs_review boolean = false,
  result_limit integer = 51, result_offset integer = 0)` — security definer;
  returns filtered event and forecast summary rows. Review-only matches finalized,
  non-empty reviews for the current forecast generation and takes precedence over
  `include_no_forecast`.
- `get_forecast_playback_page(trigger_event_id text, cursor_event_time
  timestamptz = null, cursor_event_id text = null, result_limit integer = 100)`
  — security definer; legacy/default-scope overload returning JSONB.
- `get_forecast_playback_page(trigger_event_id text, cursor_event_time
  timestamptz, cursor_event_id text, result_limit integer, playback_scope text)`
  — security definer; scoped overload returning JSONB. `playback_scope` is
  `gk`, `100km`, or `all`.
- `get_forecast_review(review_event_id text)` — security definer; returns only
  the finalized review text, review time, and operator display name for the
  event's current forecast generation.

These RPCs have execute grants for `anon` and `authenticated`. Search runs as
the caller. Filter, playback, and public review lookup are security definer
functions so they can expose narrow results without granting browser roles
direct table reads.

## Portal RPCs

- `get_portal_event_page(query_text text = null, magnitude_ranges jsonb = null,
  depth_from float8 = null, depth_to float8 = null, date_from date = null,
  date_to date = null, result_limit integer = 50, result_offset integer = 0)`.
- `get_portal_forecast_page(query_text text = null, review_statuses text[] =
  null, magnitude_ranges jsonb = null, depth_from float8 = null, depth_to
  float8 = null, date_from date = null, date_to date = null,
  aftershock_24h_likelihoods text[] = null, m5_plus_likelihoods text[] = null,
  minimum_estimated_strongest_aftershock float8 = null, result_limit integer =
  50, result_offset integer = 0)`.
- `get_portal_audit_log_page(query_text text = null, actions text[] = null,
  date_from date = null, date_to date = null, result_limit integer = 50,
  result_offset integer = 0)`.
- `get_admin_saved_pins()` — security definer; active-admin-only saved pin
  listing with owner email/name resolved from `PubUser` and `auth.users`.
- `get_admin_pin_users()` — security definer; active-admin-only owner list for
  pin assignment, using auth email as a fallback when profile data is partial.

The portal page RPCs return JSONB and are security invoker functions. The
admin pin RPCs return table rows and enforce active-admin access internally.

## Supporting functions and triggers

- `handle_new_pubuser()` creates or synchronizes `PubUser` rows after an
  `auth.users` insert and after `last_sign_in_at`, email, or ban-status
  changes. Supabase Auth bans map to `PubUser.account_status = 'inactive'`.
- `normalize_pubuser_profile_row()` normalizes profile fields before insert or
  profile-field updates; `audit_pubuser_profile_changes()` records those
  inserts/updates afterward.
- `prevent_pubuser_managed_field_changes()` blocks browser-authenticated
  clients from directly changing `role` or `account_status`; server-side admin
  routes perform those managed changes with the Supabase admin key.
- Helpers: `normalize_pubuser_name(text)`, `normalize_pubuser_phone(text)`,
  `pubuser_profile_snapshot(PubUser)`, and `is_admin_user()`; admin status
  checks require both `role = 'admin'` and `account_status = 'active'`.
- `rls_auto_enable()` is an event-trigger function that enables RLS for newly
  created public tables.

## Important indexes

- `raw_earthquake_events_location_trgm_idx` — GiST trigram index on normalized
  `RawEarthquakeEvents.Location`.
- `index_rawearthquakeevents_event_time` — descending event-time index.
- `raw_earthquake_events_source_event_group_id_idx` and the unique
  `raw_earthquake_events_source_bulletin_id_key` support bulletin revisions.
- `processing_jobs_event_id_idx` and `processing_jobs_scraper_run_id_idx`.
- `forecast_reviews_status_idx` on `(status, forecast_created_at desc)`.
- `audit_logs_created_at_idx` on `created_at desc`.

## RLS and browser access

RLS is enabled on every public table.

- `RawEarthquakeEvents` and `SeisPredictions_v1`: `anon` and `authenticated`
  may select all rows through the `public map reads ...` policies. No browser
  mutation policy exists.
- `PubUser`: authenticated users may select, insert, and update only their own
  row. Insert/update also require `Email` to match the JWT email. Browser
  clients cannot directly change `role` or `account_status`.
- `SavedPins`: authenticated users may select, insert, and delete only their
  own rows. Active admins may select, insert, update, and delete saved pins for
  any user through `is_admin_user()` policies.
- `PubUserAuditLog`: authenticated users may currently select all rows.
- `PasswordResetLog`: authenticated users may currently select all rows and
  insert a row when `reset_email` matches the JWT email.
- `ScraperRuns`, `ProcessingJobs`, `operator_profiles`, `forecast_reviews`, and
  `audit_logs`: no RLS policies are currently defined, so browser roles cannot
  access rows despite table-level grants.

The live grants are broader than the effective browser access; RLS policies
are the enforcement boundary described above.
