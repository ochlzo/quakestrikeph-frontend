do $$
begin
  alter table public."PasswordResetLog" add column if not exists auth_user_id uuid;
  update public."PasswordResetLog" prl
  set auth_user_id = pu.auth_user_id
  from public."PubUser" pu
  where prl.auth_user_id is null
    and lower(prl.reset_email) = lower(pu."Email");
  alter table public."PasswordResetLog" alter column auth_user_id set not null;
  alter table public."PasswordResetLog" drop constraint if exists "PasswordResetLog_auth_user_id_fkey";
  alter table public."PasswordResetLog" add constraint "PasswordResetLog_auth_user_id_fkey" foreign key (auth_user_id) references public."PubUser" (auth_user_id) on delete cascade;
end $$;
