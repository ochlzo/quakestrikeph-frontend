drop policy if exists "authenticated read password reset log"
on public."PasswordResetLog";

drop policy if exists "authenticated insert own password reset log"
on public."PasswordResetLog";

create policy "active admins read password reset log"
on public."PasswordResetLog"
for select
to authenticated
using (public.is_admin_user());

create policy "authenticated insert own password reset log"
on public."PasswordResetLog"
for insert
to authenticated
with check (
  auth.uid() = auth_user_id
  and lower(reset_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
