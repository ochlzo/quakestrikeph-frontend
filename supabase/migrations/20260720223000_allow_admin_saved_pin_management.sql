-- Allow active admins to manage saved pins for any user through RLS.

alter table public."SavedPins"
  enable row level security;

grant select, insert, update, delete on public."SavedPins" to authenticated;

drop policy if exists "savedpins admin read rows" on public."SavedPins";
create policy "savedpins admin read rows"
on public."SavedPins"
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "savedpins admin insert rows" on public."SavedPins";
create policy "savedpins admin insert rows"
on public."SavedPins"
for insert
to authenticated
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public."PubUser"
    where auth_user_id = "SavedPins".auth_user_id
  )
);

drop policy if exists "savedpins admin update rows" on public."SavedPins";
create policy "savedpins admin update rows"
on public."SavedPins"
for update
to authenticated
using (public.is_admin_user())
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public."PubUser"
    where auth_user_id = "SavedPins".auth_user_id
  )
);

drop policy if exists "savedpins admin delete rows" on public."SavedPins";
create policy "savedpins admin delete rows"
on public."SavedPins"
for delete
to authenticated
using (public.is_admin_user());
