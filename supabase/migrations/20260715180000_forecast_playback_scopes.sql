drop function if exists public.get_forecast_playback_page(
  text, timestamp with time zone, text, integer, text
);

create function public.get_forecast_playback_page(
  trigger_event_id text,
  cursor_event_time timestamp with time zone,
  cursor_event_id text,
  result_limit integer,
  playback_scope text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  page_limit integer := least(greatest(coalesce(result_limit, 100), 1), 100);
  requested_scope text := lower(coalesce(playback_scope, 'gk'));
  forecast_started_at timestamp with time zone;
  forecast_window_ends_at timestamp with time zone;
  observed_through timestamp with time zone;
  latest_attempt_started_at timestamp with time zone;
  latest_attempt_status text;
  trigger_latitude double precision;
  trigger_longitude double precision;
  trigger_magnitude double precision;
  gk_radius_km double precision;
  scope_radius_km double precision;
  playback_status text;
  playback_events jsonb := '[]'::jsonb;
  has_more boolean := false;
  next_cursor jsonb := null;
begin
  if requested_scope not in ('gk', '100km', 'all') then
    raise exception 'playback_scope must be gk, 100km, or all'
      using errcode = '22023';
  end if;

  if (cursor_event_time is null) <> (cursor_event_id is null) then
    raise exception 'cursor_event_time and cursor_event_id must be provided together'
      using errcode = '22023';
  end if;

  select
    prediction.created_at,
    prediction.created_at + interval '24 hours',
    event."Latitude",
    event."Longitude",
    event."Magnitude"
  into
    forecast_started_at,
    forecast_window_ends_at,
    trigger_latitude,
    trigger_longitude,
    trigger_magnitude
  from public."SeisPredictions_v1" as prediction
  join public."RawEarthquakeEvents" as event on event.id = prediction.event_id
  where prediction.event_id = trigger_event_id;

  if not found then
    return null;
  end if;

  -- Gardner–Knopoff distance window used by OpenQuake HMTK.
  gk_radius_km := power(10.0, 0.1238 * trigger_magnitude + 0.983);
  scope_radius_km := case requested_scope
    when 'gk' then gk_radius_km
    when '100km' then 100.0
    else null
  end;

  select run.started_at
  into observed_through
  from public."ScraperRuns" as run
  where run.trigger_type in ('scheduled', 'manual')
    and run.status = 'completed'
  order by run.started_at desc
  limit 1;

  select run.started_at, run.status
  into latest_attempt_started_at, latest_attempt_status
  from public."ScraperRuns" as run
  where run.trigger_type in ('scheduled', 'manual')
    and run.started_at > forecast_started_at
  order by run.started_at desc
  limit 1;

  if latest_attempt_status = 'failed'
    and (observed_through is null or latest_attempt_started_at > observed_through) then
    playback_status := 'delayed';
    if observed_through is null or observed_through <= forecast_started_at then
      observed_through := null;
    end if;
  elsif observed_through is null or observed_through <= forecast_started_at then
    playback_status := 'pending';
    observed_through := null;
  elsif observed_through >= forecast_window_ends_at then
    playback_status := 'complete';
  else
    playback_status := 'current';
  end if;

  if observed_through is not null then
    with candidates as materialized (
      select
        event.id,
        event."Date-Time" as date_time,
        event.event_time at time zone 'Asia/Manila' as event_time,
        event."Latitude" as latitude,
        event."Longitude" as longitude,
        event."Depth" as depth,
        event."Magnitude" as magnitude,
        6371.0088 * 2 * asin(sqrt(least(1.0, greatest(0.0,
          power(sin(radians((event."Latitude" - trigger_latitude) / 2)), 2)
          + cos(radians(trigger_latitude)) * cos(radians(event."Latitude"))
          * power(sin(radians((event."Longitude" - trigger_longitude) / 2)), 2)
        )))) as distance_km
      from public."RawEarthquakeEvents" as event
      where event.id <> trigger_event_id
        and event.event_time is not null
        and event.event_time at time zone 'Asia/Manila' > forecast_started_at
        and event.event_time at time zone 'Asia/Manila' <= observed_through
    ), scoped as (
      select *
      from candidates
      where (scope_radius_km is null or candidates.distance_km <= scope_radius_km)
        and (
          cursor_event_time is null
          or candidates.event_time > cursor_event_time
          or (
            candidates.event_time = cursor_event_time
            and candidates.id > coalesce(cursor_event_id, '')
          )
        )
      order by candidates.event_time, candidates.id
      limit page_limit + 1
    ), page as (
      select *
      from scoped
      order by scoped.event_time, scoped.id
      limit page_limit
    )
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', page.id,
            'date_time', page.date_time,
            'event_time', page.event_time,
            'latitude', page.latitude,
            'longitude', page.longitude,
            'depth', page.depth,
            'magnitude', page.magnitude,
            'distance_km', round(page.distance_km::numeric, 2),
            'within_gk_radius', page.distance_km <= gk_radius_km
          ) order by page.event_time, page.id
        ),
        '[]'::jsonb
      ),
      (select count(*) > page_limit from scoped)
    into playback_events, has_more
    from page;
  end if;

  if jsonb_array_length(playback_events) > 0 then
    next_cursor := jsonb_build_object(
      'event_time', playback_events -> (jsonb_array_length(playback_events) - 1) ->> 'event_time',
      'event_id', playback_events -> (jsonb_array_length(playback_events) - 1) ->> 'id'
    );
  end if;

  return jsonb_build_object(
    'status', playback_status,
    'playback_scope', requested_scope,
    'gk_radius_km', gk_radius_km,
    'forecast_started_at', forecast_started_at,
    'forecast_window_ends_at', forecast_window_ends_at,
    'observed_through', observed_through,
    'events', playback_events,
    'next_cursor', next_cursor,
    'has_more', has_more
  );
end;
$$;

revoke all on function public.get_forecast_playback_page(
  text, timestamp with time zone, text, integer, text
) from public;

revoke select on table public."ScraperRuns" from anon, authenticated;

grant execute on function public.get_forecast_playback_page(
  text, timestamp with time zone, text, integer, text
) to anon, authenticated;
