# QuakeStrike PH frontend

## Stack and checks

- Astro 7 static site, React 19 islands, Tailwind 4, Leaflet, and `@supabase/supabase-js`.
- Use `pnpm run build` before handoff. For local development: `astro dev --background`; manage it with `astro dev status|logs|stop`.
- Keep changes small. Follow nearby Astro/React/Tailwind patterns and reuse `src/styles/global.css` tokens before adding local styling.

## Map

- The home page is `src/pages/index.astro`; `MapPageShell` owns the viewport shell and the inner rounded, overflow-hidden wrapper owns map clipping.
- `src/components/Map.astro` initializes Leaflet and loads the live event/prediction layer. Keep map overlays on the `leaflet:ready` event.
- Do not reintroduce demo data as production map data. Preserve the existing mobile bounds and tile-buffer behavior unless intentionally changing map interaction.

## Supabase

- Browser client: `src/db/supabase.js`, using `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_KEY`. Only publishable keys may use the `PUBLIC_` prefix; `DATABASE_URL` is server-only.
- Use the Supabase client as the only application data-access layer. Do not add or use an ORM or server database client.
- Schema reference: `.codex/supabase-schema.md`. Map data comes from `RawEarthquakeEvents`, with `SeisPredictions_v1.event_id -> RawEarthquakeEvents.id`.
- Browser access is read-only: only events and predictions grant `SELECT` to `anon`/`authenticated`; keep `ScraperRuns` and `ProcessingJobs` private.
- Put database changes in `supabase/migrations/`; apply with `DATABASE_URL`, then verify the policy and an anonymous read. The repo-scoped Supabase MCP is configured in `.codex/config.toml`.

## Guardrails

- Never expose `DATABASE_URL` or a service-role key to the browser or logs.
- Treat database schema changes and RLS policies as production changes: inspect current schema/policies first and verify afterward.
