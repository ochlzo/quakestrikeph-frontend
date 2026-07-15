# QuakeStrike PH frontend

## Stack and checks

- Astro 7 static site, React 19 islands, Tailwind 4, Leaflet, and `@supabase/supabase-js`.
- Use `pnpm run build` before handoff. For local development: `astro dev --background`; manage it with `astro dev status|logs|stop`.
- Run `pnpm run test:filters` when changing filter parsing or query behavior.
- Keep changes small. Follow nearby Astro/React/Tailwind patterns and reuse `src/styles/global.css` tokens before adding local styling.

## Map

- The home page is `src/pages/index.astro`; `MapPageShell` owns the viewport shell and the inner rounded, overflow-hidden wrapper owns map clipping.
- `MapPageShell` coordinates sidebar, search/list, filter, and map state. `src/components/Map.astro` owns Leaflet and the live event/prediction layer. Keep map overlays on the `leaflet:ready` event.
- Use the shared document events in `src/lib/earthquake-map-filters.ts` to connect React UI and Leaflet; do not couple sidebar components directly to Leaflet.
- Clicking a pin selects and scrolls to its event and opens its popup. A pin with a forecast also opens the forecast sidebar; a pin without one does not. Clicking a list event centers and zooms the map, selects its pin, and opens its popup without automatically opening a closed forecast sidebar.
- Keep every pin the same size. Magnitude controls pin color through the shared magnitude ranges used by the filters and legend.
- Popup content keeps the raw event information: centered location, date, latitude/longitude, magnitude, and depth. Forecast pins add `View forecast discussion →` at the popup footer and link to `/forecast?event=<id>`. Keep the existing `No forecast available see why` fallback and link styling unchanged for events without forecasts.
- Do not reintroduce demo data as production map data. Preserve the existing mobile bounds and tile-buffer behavior unless intentionally changing map interaction.

## Forecast discussion and playback

- `/forecast?event=<id>` is a static Astro route with a client-only React report. It loads the trigger, forecast, and playback data through `src/data/earthquakes.ts`.
- Playback begins at forecast generation time. Its initial horizon is 24 hours, then it continues automatically in 24-hour increments until the conservative `observed_through` watermark; it does not poll after catching up.
- The discussion compares only observations inside the trigger's Gardner–Knopoff radius and the original 24-hour forecast window. Describe these as possibly related screened earthquakes pending further PHIVOLCS information, never confirmed aftershocks. Later screened events are playback context only.
- Playback uses `get_forecast_playback_page(...)`, a chronological `(event_time, id)` cursor RPC limited to 100 events per page. The mutually exclusive playback scopes are the Gardner–Knopoff radius (default), within 100 km, and all catalog observations with no distance filter; changing playback scope must not change the discussion's Gardner–Knopoff comparison set.
- Keep the trigger visible. Observation popups show only magnitude, depth, and distance from the trigger. Post-window markers retain magnitude color and use a secondary stroke.
- Show the most-likely distance boundaries by default. The accessible all-rings switch shows 10 km, 25 km, and 50 km boundaries while keeping the likely band visually stronger; the beyond-50 km boundary is dashed.

## Sidebar terminology

- **Main sidebar**: the leftmost event-discovery panel. It contains the brand, map legend, location search, `Filter earthquakes` button, and earthquake list. Its `SidebarTrigger` collapses it completely off-canvas; do not restore an icon gutter.
- **Forecast sidebar**: the secondary contextual panel for the selected forecast event. Show aftershock likelihoods, estimated strongest aftershock, a bold most-likely distance, all four distance-band chances, prediction messages, and generation time.
- **Filter sidebar**: the earthquake-event and forecast filter panel with persistent Reset and Apply actions. It shares the forecast sidebar's secondary slot and overlays forecast details rather than creating a third column.
- When filters cover forecast details, keep the forecast state underneath but make it inert. Clicking a forecast pin closes filters and reveals that pin's forecast; clicking a no-forecast pin leaves filters open.
- On mobile, forecast and filter panels use the same left-sheet handoff. Closing filters reveals an active forecast; otherwise it returns to the event list.

## Event loading and search

- Do not apply an implicit last-24-hours filter. The initial query starts with the newest events across the table.
- `MAP_PAGE_SIZE` is 50 and `MAX_MAP_EVENTS` is 2000 in `src/lib/earthquake-map-filters.ts`. Keep these as the shared pagination contract.
- Load the first 50 events, then use the list's intersection sentinel to load subsequent pages automatically. Append events to the list and map together without replacing already loaded results.
- At the cap, show `Cannot load data more than 2000`. Do not add a manual load-more button or pre-count/rejection dialog.
- Location search begins after 3 trimmed characters and uses the existing debounce. It is typo-tolerant and searches the full table through `search_earthquake_events`, not only the currently loaded events.
- Search results replace the visible map/list dataset while search is active. Clearing search restores results for the current filters.
- Active earthquake and forecast filters also apply to search results. Apply and Reset preserve the search text and restart pagination from the first page; Reset removes filters rather than restoring a time default.
- Keep normal-query and search-query offsets separate so switching modes cannot skip or duplicate pages.
- Keep Supabase fetch and join logic in `src/data/*`; UI components must not query Supabase directly.
- Fetch detailed `SeisPredictions_v1` forecast fields on demand through `src/data/earthquakes.ts`; do not add them to every paginated map row by default.

## Filters

- Use public-facing labels that explain the forecast criteria directly; do not render help tooltips for forecast-filter labels.
- Magnitude selections map to the same colors shown on the map and accept custom comma-separated ranges in `<num>-<num>` form.
- Preserve the forecast filters for aftershock likelihood within 24 hours, magnitude-5-or-higher aftershock likelihood, estimated strongest-aftershock minimum, and inclusion of events with no forecast.
- Keep filter parsing and validation dependency-free in `src/lib`, and apply filters only through the existing Apply/Reset flow.

## Supabase

- Browser client: `src/db/supabase.js`, using `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_KEY`. Only publishable keys may use the `PUBLIC_` prefix; `DATABASE_URL` is server-only.
- Use the Supabase client as the only application data-access layer. Do not add or use an ORM or server database client.
- Schema reference: `.codex/supabase-schema.md`. Map data comes from `RawEarthquakeEvents`, with `SeisPredictions_v1.event_id -> RawEarthquakeEvents.id`.
- Global typo-tolerant location search uses `search_earthquake_events(query_text, result_limit, result_offset)`. Preserve its stable ordering, 50-row pages, 2000-row cap, invoker security, and anonymous/authenticated execute access.
- Browser access is read-only: only events and predictions grant `SELECT` to `anon`/`authenticated`; keep `ScraperRuns` and `ProcessingJobs` private.
- Put database changes in `supabase/migrations/`; apply with `DATABASE_URL`, then verify the policy and an anonymous read. The repo-scoped Supabase MCP is configured in `.codex/config.toml`.

## Guardrails

- Never expose `DATABASE_URL` or a service-role key to the browser or logs.
- Treat database schema changes and RLS policies as production changes: inspect current schema/policies first and verify afterward.
