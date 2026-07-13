create extension if not exists pg_trgm with schema extensions;

create index if not exists raw_earthquake_events_location_trgm_idx
on public."RawEarthquakeEvents"
using gist (lower(coalesce("Location", '')) extensions.gist_trgm_ops);

create or replace function public.search_earthquake_events(
  query_text text,
  result_limit integer default 50
)
returns table (
  id text,
  "Date-Time" text,
  "Latitude" double precision,
  "Longitude" double precision,
  "Depth" text,
  "Magnitude" double precision,
  "Location" text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    event.id,
    event."Date-Time",
    event."Latitude",
    event."Longitude",
    event."Depth",
    event."Magnitude",
    event."Location"
  from public."RawEarthquakeEvents" as event
  where length(trim(query_text)) >= 3
    and event."Location" is not null
    and extensions.word_similarity(
      lower(trim(query_text)),
      lower(event."Location")
    ) >= 0.35
  order by
    lower(trim(query_text)) operator(extensions.<<->) lower(event."Location"),
    event.event_time desc nulls last,
    event.id desc
  limit least(greatest(coalesce(result_limit, 50), 1), 50);
$$;

revoke all on function public.search_earthquake_events(text, integer) from public;
grant execute on function public.search_earthquake_events(text, integer) to anon, authenticated;
