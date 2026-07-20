drop policy if exists "pubuser read admin rows"
on public."PubUser";

create policy "pubuser read admin rows"
on public."PubUser"
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "authenticated read pubuser audit log"
on public."PubUserAuditLog";

drop policy if exists "active admins read pubuser audit log"
on public."PubUserAuditLog";

create policy "active admins read pubuser audit log"
on public."PubUserAuditLog"
for select
to authenticated
using (public.is_admin_user());
