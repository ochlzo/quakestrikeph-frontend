-- Browser map data: public read-only access to events and their predictions.

alter table public."RawEarthquakeEvents" enable row level security;
alter table public."SeisPredictions_v1" enable row level security;

grant select on public."RawEarthquakeEvents" to anon, authenticated;
grant select on public."SeisPredictions_v1" to anon, authenticated;

drop policy if exists "public map reads events" on public."RawEarthquakeEvents";
create policy "public map reads events"
on public."RawEarthquakeEvents" for select
to anon, authenticated using (true);

drop policy if exists "public map reads predictions" on public."SeisPredictions_v1";
create policy "public map reads predictions"
on public."SeisPredictions_v1" for select
to anon, authenticated using (true);
