create function public.get_forecast_review(review_event_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'review_text', review.review_text,
    'reviewed_at', review.reviewed_at,
    'display_name', operator.display_name
  )
  from public.forecast_reviews as review
  join public."SeisPredictions_v1" as forecast
    on forecast.event_id = review.event_id
    and forecast.created_at = review.forecast_created_at
  join public.operator_profiles as operator on operator.id = review.operator_id
  where review.event_id = review_event_id
    and review.status in ('REVIEWED_NO_ALERT', 'REVIEWED_FOR_ALERT')
    and review.reviewed_at is not null
    and btrim(review.review_text) <> '';
$$;

revoke all on function public.get_forecast_review(text) from public;
grant execute on function public.get_forecast_review(text) to anon, authenticated;
