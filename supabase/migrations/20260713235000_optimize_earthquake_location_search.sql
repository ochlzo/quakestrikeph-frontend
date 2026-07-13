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
      extensions.word_similarity(
        lower(trim(query_text)),
        lower(coalesce(event."Location", ''))
      ) as match_score,
      lower(coalesce(event."Location", ''))
        operator(extensions.<->>) lower(trim(query_text)) as match_distance
    from public."RawEarthquakeEvents" as event
    where length(trim(query_text)) >= 3
      and event."Location" is not null
    order by
      lower(coalesce(event."Location", ''))
        operator(extensions.<->>) lower(trim(query_text))
    limit 250
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
  where candidates.match_score >= 0.35
  order by
    candidates.match_distance,
    candidates.event_time desc nulls last,
    candidates.id desc
  limit least(greatest(coalesce(result_limit, 50), 1), 50);
$$;
