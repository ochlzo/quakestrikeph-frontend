-- Add admin-managed user status and protect account management fields.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'PubUserAuditLog'
      and column_name = 'audit_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'PubUserAuditLog'
      and column_name = 'aud_id'
  ) then
    alter table public."PubUserAuditLog"
      rename column audit_id to aud_id;
  end if;
end $$;

alter table public."PubUser"
  add column if not exists account_status text not null default 'active';

alter table public."PubUser"
  drop constraint if exists "PubUser_account_status_check";

alter table public."PubUser"
  add constraint "PubUser_account_status_check"
  check (account_status in ('active', 'inactive'));

update public."PubUser" as profile
set account_status = case
  when auth_user.banned_until is not null and auth_user.banned_until > now() then 'inactive'
  else 'active'
end
from auth.users as auth_user
where profile.auth_user_id = auth_user.id;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."PubUser"
    where auth_user_id = auth.uid()
      and role = 'admin'
      and account_status = 'active'
  );
$$;

create or replace function public.prevent_pubuser_managed_field_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
    and coalesce(auth.role(), '') <> 'service_role'
    and (
      new.role is distinct from old.role
      or new.account_status is distinct from old.account_status
    )
  then
    raise exception 'Only server-side admin user management can change role or account_status.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_pubuser_managed_fields_before_update on public."PubUser";
create trigger prevent_pubuser_managed_fields_before_update
before update of role, account_status
on public."PubUser"
for each row
execute function public.prevent_pubuser_managed_field_changes();

create or replace function public.handle_new_pubuser()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null then
    return new;
  end if;

  insert into public."PubUser" (
    auth_user_id,
    "Email",
    "DisplayName",
    "FName",
    "Mname",
    "LName",
    "MobileNum",
    account_status
  )
  values (
    new.id,
    lower(new.email),
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'middle_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'mobile_number', ''),
    case
      when new.banned_until is not null and new.banned_until > now() then 'inactive'
      else 'active'
    end
  )
  on conflict (auth_user_id) do update
  set
    "Email" = excluded."Email",
    account_status = excluded.account_status;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_pubuser on auth.users;
drop trigger if exists on_auth_user_signed_in_pubuser on auth.users;
drop trigger if exists on_auth_user_updated_pubuser on auth.users;

create trigger on_auth_user_created_pubuser
after insert on auth.users
for each row
execute function public.handle_new_pubuser();

create trigger on_auth_user_updated_pubuser
after update of last_sign_in_at, email, banned_until on auth.users
for each row
when (
  old.last_sign_in_at is distinct from new.last_sign_in_at
  or old.email is distinct from new.email
  or old.banned_until is distinct from new.banned_until
)
execute function public.handle_new_pubuser();

create or replace function public.pubuser_profile_snapshot(row_value public."PubUser")
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'Email', row_value."Email",
    'DisplayName', row_value."DisplayName",
    'FName', row_value."FName",
    'Mname', row_value."Mname",
    'LName', row_value."LName",
    'MobileNum', row_value."MobileNum",
    'account_status', row_value.account_status,
    'role', row_value.role
  );
$$;

create or replace function public.audit_pubuser_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_snapshot jsonb := '{}'::jsonb;
  new_snapshot jsonb := '{}'::jsonb;
  changed text[] := '{}';
  field_name text;
begin
  if tg_op = 'UPDATE' then
    old_snapshot := public.pubuser_profile_snapshot(old);
    new_snapshot := public.pubuser_profile_snapshot(new);

    foreach field_name in array array['Email', 'DisplayName', 'FName', 'Mname', 'LName', 'MobileNum', 'account_status', 'role'] loop
      if old_snapshot ->> field_name is distinct from new_snapshot ->> field_name then
        changed := array_append(changed, field_name);
      end if;
    end loop;

    if cardinality(changed) = 0 then
      return new;
    end if;
  else
    new_snapshot := public.pubuser_profile_snapshot(new);
    changed := array['Email', 'DisplayName', 'FName', 'Mname', 'LName', 'MobileNum', 'account_status', 'role'];
  end if;

  insert into public."PubUserAuditLog" (
    profile_puser_id,
    profile_auth_user_id,
    profile_email,
    action,
    changed_fields,
    old_values,
    new_values,
    changed_by,
    changed_by_email
  )
  values (
    new."PUser_id",
    new.auth_user_id,
    new."Email",
    lower(tg_op),
    changed,
    old_snapshot,
    new_snapshot,
    auth.uid(),
    lower(coalesce(auth.jwt() ->> 'email', null))
  );

  return new;
end;
$$;

drop trigger if exists audit_pubuser_profile_after_insert_update on public."PubUser";
create trigger audit_pubuser_profile_after_insert_update
after insert or update of "Email", "DisplayName", "FName", "Mname", "LName", "MobileNum", account_status, role
on public."PubUser"
for each row
execute function public.audit_pubuser_profile_changes();
