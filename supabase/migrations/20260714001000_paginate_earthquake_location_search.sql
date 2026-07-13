drop function if exists public.search_earthquake_events(text, integer);

create function public.search_earthquake_events(
  query_text text,
  result_limit integer default 50,
  result_offset integer default 0
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
  with candidates as materialized (
    select
      event.id,
      event."Date-Time",
      event."Latitude",
      event."Longitude",
      event."Depth",
      event."Magnitude",
      event."Location",
      event.event_time,
      lower(trim(query_text))
        operator(extensions.<<->) lower(coalesce(event."Location", '')) as match_distance
    from public."RawEarthquakeEvents" as event
    where length(trim(query_text)) >= 3
      and event."Location" is not null
    order by
      lower(trim(query_text))
        operator(extensions.<<->) lower(coalesce(event."Location", ''))
    limit least(
      least(greatest(coalesce(result_offset, 0), 0), 2000)
        + least(greatest(coalesce(result_limit, 50), 1), 51),
      2000
    )
  )
  select
    candidates.id,
    candidates."Date-Time",
    candidates."Latitude",
    candidates."Longitude",
    candidates."Depth",
    candidates."Magnitude",
    candidates."Location"
  from candidates
  where candidates.match_distance <= 0.65
  order by
    candidates.match_distance,
    candidates.event_time desc nulls last,
    candidates.id desc
  limit least(greatest(coalesce(result_limit, 50), 1), 51)
  offset least(greatest(coalesce(result_offset, 0), 0), 2000);
$$;

revoke all on function public.search_earthquake_events(text, integer, integer) from public;
grant execute on function public.search_earthquake_events(text, integer, integer) to anon, authenticated;
