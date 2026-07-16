-- Align PubUser with Supabase Auth profiles.

create sequence if not exists public."PubUser_PUser_id_profile_seq";

select setval(
  'public."PubUser_PUser_id_profile_seq"',
  coalesce((select max("PUser_id") from public."PubUser"), 1),
  exists (select 1 from public."PubUser")
);

alter sequence public."PubUser_PUser_id_profile_seq"
  owned by public."PubUser"."PUser_id";

alter table public."PubUser"
  alter column "PUser_id" set default nextval('public."PubUser_PUser_id_profile_seq"'::regclass);

alter table public."PubUser"
  alter column auth_user_id drop identity if exists;

alter table public."PubUser"
  alter column auth_user_id drop not null;

alter table public."PubUser"
  alter column auth_user_id type uuid using null::uuid;

alter table public."PubUser"
  alter column auth_user_id set not null;

alter table public."PubUser"
  add constraint "PubUser_auth_user_id_key" unique (auth_user_id);

alter table public."PubUser"
  add column if not exists role text not null default 'user';

alter table public."PubUser"
  drop constraint if exists "PubUser_role_check";

alter table public."PubUser"
  add constraint "PubUser_role_check"
  check (role in ('user', 'admin'));

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
  );
$$;

alter table public."PubUser"
  enable row level security;

drop policy if exists "pubuser read own row" on public."PubUser";
create policy "pubuser read own row"
on public."PubUser"
for select
to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists "pubuser read admin rows" on public."PubUser";
create policy "pubuser read admin rows"
on public."PubUser"
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "pubuser insert own row" on public."PubUser";
create policy "pubuser insert own row"
on public."PubUser"
for insert
to authenticated
with check (
  auth.uid() = auth_user_id
  and lower("Email") = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "pubuser update own row" on public."PubUser";
create policy "pubuser update own row"
on public."PubUser"
for update
to authenticated
using (auth.uid() = auth_user_id)
with check (
  auth.uid() = auth_user_id
  and lower("Email") = lower(coalesce(auth.jwt() ->> 'email', ''))
);

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
    "Email"
  )
  values (
    new.id,
    lower(new.email)
  )
  on conflict (auth_user_id) do update
  set "Email" = excluded."Email";

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_pubuser on auth.users;
drop trigger if exists on_auth_user_signed_in_pubuser on auth.users;

create trigger on_auth_user_created_pubuser
after insert on auth.users
for each row
execute function public.handle_new_pubuser();

create trigger on_auth_user_signed_in_pubuser
after update of last_sign_in_at on auth.users
for each row
when (old.last_sign_in_at is distinct from new.last_sign_in_at)
execute function public.handle_new_pubuser();

insert into public."PubUser" (
  auth_user_id,
  "Email"
)
select
  u.id,
  lower(u.email)
from auth.users as u
where u.email is not null
on conflict (auth_user_id) do update
set "Email" = excluded."Email";
