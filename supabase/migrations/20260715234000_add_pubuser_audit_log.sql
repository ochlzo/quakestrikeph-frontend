-- Audit PubUser profile edits for accountability and non-repudiation.

create table if not exists public."PubUserAuditLog" (
  audit_id bigserial primary key,
  profile_puser_id bigint,
  profile_auth_user_id uuid,
  profile_email text,
  action text not null check (action in ('insert', 'update')),
  changed_fields text[] not null default '{}',
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  changed_by uuid,
  changed_by_email text,
  changed_at timestamptz not null default now()
);

alter table public."PubUserAuditLog"
  enable row level security;

revoke insert, update, delete on public."PubUserAuditLog" from anon, authenticated;
grant select on public."PubUserAuditLog" to authenticated;

drop policy if exists "authenticated read pubuser audit log" on public."PubUserAuditLog";
create policy "authenticated read pubuser audit log"
on public."PubUserAuditLog"
for select
to authenticated
using (true);

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
    'MobileNum', row_value."MobileNum"
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

    foreach field_name in array array['Email', 'DisplayName', 'FName', 'Mname', 'LName', 'MobileNum'] loop
      if old_snapshot ->> field_name is distinct from new_snapshot ->> field_name then
        changed := array_append(changed, field_name);
      end if;
    end loop;

    if cardinality(changed) = 0 then
      return new;
    end if;
  else
    new_snapshot := public.pubuser_profile_snapshot(new);
    changed := array['Email', 'DisplayName', 'FName', 'Mname', 'LName', 'MobileNum'];
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
after insert or update of "Email", "DisplayName", "FName", "Mname", "LName", "MobileNum"
on public."PubUser"
for each row
execute function public.audit_pubuser_profile_changes();
