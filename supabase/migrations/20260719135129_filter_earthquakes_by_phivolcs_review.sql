drop function if exists public.filter_earthquake_events(
  text, jsonb, double precision, double precision,
  timestamp without time zone, timestamp without time zone,
  text[], text[], double precision, boolean, integer, integer
);

create function public.filter_earthquake_events(
  query_text text default null,
  magnitude_ranges jsonb default null,
  depth_from double precision default null,
  depth_to double precision default null,
  date_from timestamp without time zone default null,
  date_to timestamp without time zone default null,
  aftershock_24h_likelihoods text[] default array['low', 'medium', 'high'],
  m5_plus_likelihoods text[] default array['low', 'medium', 'high'],
  minimum_estimated_strongest_aftershock double precision default null,
  include_no_forecast boolean default true,
  only_with_phivolcs_review boolean default false,
  result_limit integer default 51,
  result_offset integer default 0
)
returns table (
  id text,
  "Date-Time" text,
  "Latitude" double precision,
  "Longitude" double precision,
  "Depth" text,
  "Magnitude" double precision,
  "Location" text,
  event_time timestamp without time zone,
  has_forecast boolean,
  aftershock_24h_likelihood_level text,
  m5_plus_likelihood_level text,
  est_max_aftershock double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  with filtered as materialized (
    select
      event.id,
      event."Date-Time",
      event."Latitude",
      event."Longitude",
      event."Depth",
      event."Magnitude",
      event."Location",
      event.event_time,
      prediction.event_id is not null as has_forecast,
      prediction.aftershock_24h_likelihood_level,
      prediction.m5_plus_likelihood_level,
      prediction.est_max_aftershock,
      case
        when nullif(trim(query_text), '') is not null then
          lower(trim(query_text))
            operator(extensions.<<->) lower(coalesce(event."Location", ''))
      end as match_distance
    from public."RawEarthquakeEvents" as event
    left join public."SeisPredictions_v1" as prediction on prediction.event_id = event.id
    where (nullif(trim(query_text), '') is null
        or (length(trim(query_text)) >= 3 and event."Location" is not null))
      and (magnitude_ranges is null or exists (
        select 1
        from jsonb_array_elements(magnitude_ranges) as magnitude_range
        where event."Magnitude" >= (magnitude_range->>'from')::double precision
          and (
            not (magnitude_range ? 'to')
            or case
              when coalesce((magnitude_range->>'upperExclusive')::boolean, false)
                then event."Magnitude" < (magnitude_range->>'to')::double precision
              else event."Magnitude" <= (magnitude_range->>'to')::double precision
            end
          )
      ))
      and (depth_from is null or nullif(event."Depth", '--')::double precision >= depth_from)
      and (depth_to is null or nullif(event."Depth", '--')::double precision <= depth_to)
      and (date_from is null or event.event_time >= date_from)
      and (date_to is null or event.event_time <= date_to)
      and (
        (
          prediction.event_id is null
          and include_no_forecast
          and not only_with_phivolcs_review
        )
        or (
          prediction.event_id is not null
          and (
            array['low', 'medium', 'high'] <@ aftershock_24h_likelihoods
            or lower(prediction.aftershock_24h_likelihood_level) = any(aftershock_24h_likelihoods)
          )
          and (
            array['low', 'medium', 'high'] <@ m5_plus_likelihoods
            or lower(prediction.m5_plus_likelihood_level) = any(m5_plus_likelihoods)
          )
          and (
            minimum_estimated_strongest_aftershock is null
            or prediction.est_max_aftershock >= minimum_estimated_strongest_aftershock
          )
          and (
            not only_with_phivolcs_review
            or exists (
              select 1
              from public.forecast_reviews as review
              where review.event_id = prediction.event_id
                and review.forecast_created_at = prediction.created_at
                and review.status in ('REVIEWED_NO_ALERT', 'REVIEWED_FOR_ALERT')
                and review.reviewed_at is not null
                and btrim(review.review_text) <> ''
            )
          )
        )
      )
  )
  select
    filtered.id,
    filtered."Date-Time",
    filtered."Latitude",
    filtered."Longitude",
    filtered."Depth",
    filtered."Magnitude",
    filtered."Location",
    filtered.event_time,
    filtered.has_forecast,
    filtered.aftershock_24h_likelihood_level,
    filtered.m5_plus_likelihood_level,
    filtered.est_max_aftershock
  from filtered
  where nullif(trim(query_text), '') is null or filtered.match_distance <= 0.65
  order by
    filtered.match_distance asc nulls last,
    filtered.event_time desc nulls last,
    filtered.id desc
  limit least(
    least(greatest(coalesce(result_limit, 51), 1), 51),
    greatest(2000 - least(greatest(coalesce(result_offset, 0), 0), 2000), 0)
  )
  offset least(greatest(coalesce(result_offset, 0), 0), 2000);
$$;

revoke all on function public.filter_earthquake_events(
  text, jsonb, double precision, double precision,
  timestamp without time zone, timestamp without time zone,
  text[], text[], double precision, boolean, boolean, integer, integer
) from public;

grant execute on function public.filter_earthquake_events(
  text, jsonb, double precision, double precision,
  timestamp without time zone, timestamp without time zone,
  text[], text[], double precision, boolean, boolean, integer, integer
) to anon, authenticated;
