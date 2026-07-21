-- Resolve saved pin owners for active admins, including auth email fallback.

create or replace function public.get_admin_pin_users()
returns table (
  "PUser_id" bigint,
  auth_user_id uuid,
  role text,
  account_status text,
  "Email" text,
  "DisplayName" text,
  "FName" text,
  "Mname" text,
  "LName" text,
  "MobileNum" text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Only active admins can read admin pin users.'
      using errcode = '42501';
  end if;

  return query
  select
    profile."PUser_id"::bigint,
    coalesce(profile.auth_user_id, auth_user.id),
    coalesce(profile.role, 'user'),
    coalesce(profile.account_status, 'active'),
    lower(coalesce(profile."Email", auth_user.email)),
    profile."DisplayName",
    profile."FName",
    profile."Mname",
    profile."LName",
    profile."MobileNum"
  from auth.users as auth_user
  left join public."PubUser" as profile
    on profile.auth_user_id = auth_user.id
  where auth_user.email is not null
  order by lower(coalesce(profile."Email", auth_user.email));
end;
$$;

create or replace function public.get_admin_saved_pins()
returns table (
  favorite_id bigint,
  auth_user_id uuid,
  favorite_label text,
  favorite_kind text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz,
  owner_email text,
  owner_label text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Only active admins can read admin saved pins.'
      using errcode = '42501';
  end if;

  return query
  select
    pin.favorite_id::bigint,
    pin.auth_user_id,
    pin.favorite_label,
    pin.favorite_kind,
    pin.latitude,
    pin.longitude,
    pin.created_at,
    lower(coalesce(profile."Email", auth_user.email)) as owner_email,
    coalesce(
      nullif(profile."DisplayName", ''),
      nullif(trim(concat_ws(' ', profile."FName", profile."Mname", profile."LName")), ''),
      nullif(profile."Email", ''),
      nullif(auth_user.email, ''),
      'Unknown user'
    ) as owner_label
  from public."SavedPins" as pin
  left join public."PubUser" as profile
    on profile.auth_user_id = pin.auth_user_id
  left join auth.users as auth_user
    on auth_user.id = pin.auth_user_id
  order by pin.created_at desc;
end;
$$;

grant execute on function public.get_admin_pin_users() to authenticated;
grant execute on function public.get_admin_saved_pins() to authenticated;
