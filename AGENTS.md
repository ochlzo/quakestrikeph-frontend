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
- Clicking a pin opens the main sidebar, selects and scrolls to its event, and opens its popup. Clicking a list event centers and zooms the map, selects its pin, and opens its popup.
- Keep every pin the same size. Magnitude controls pin color through the shared magnitude ranges used by the filters and legend.
- Popup content is raw event information only: centered location, date, latitude/longitude, magnitude, and depth. Forecast data is represented only by a `Show forecast info` link or the no-forecast status.
- Do not reintroduce demo data as production map data. Preserve the existing mobile bounds and tile-buffer behavior unless intentionally changing map interaction.

## Sidebar terminology

- **Main sidebar**: the leftmost event-discovery panel. It contains the brand, map legend, location search, `Filter earthquakes` button, and earthquake list. Its `SidebarTrigger` collapses it completely off-canvas; do not restore an icon gutter.
- **Nested sidebar / filter sidebar**: a separate secondary panel containing earthquake-event and forecast filters with persistent Reset and Apply actions.
- On desktop, the filter sidebar opens beside the main sidebar and stays open after Apply. On mobile, it replaces the main sidebar sheet and returns to the event list when closed or applied.
- Keep main-sidebar and filter-sidebar visibility independent except for the intentional mobile handoff.

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
