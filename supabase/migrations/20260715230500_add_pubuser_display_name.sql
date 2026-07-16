-- Add an editable display name to PubUser profiles.

alter table public."PubUser"
  add column if not exists "DisplayName" text;

create or replace function public.normalize_pubuser_profile_row()
returns trigger
language plpgsql
as $$
begin
  new."Email" := nullif(lower(trim(new."Email")), '');
  new."DisplayName" := public.normalize_pubuser_name(new."DisplayName");
  new."FName" := public.normalize_pubuser_name(new."FName");
  new."Mname" := public.normalize_pubuser_name(new."Mname");
  new."LName" := public.normalize_pubuser_name(new."LName");
  new."MobileNum" := public.normalize_pubuser_phone(new."MobileNum");
  return new;
end;
$$;

drop trigger if exists normalize_pubuser_profile_before_write on public."PubUser";
create trigger normalize_pubuser_profile_before_write
before insert or update of "Email", "DisplayName", "FName", "Mname", "LName", "MobileNum"
on public."PubUser"
for each row
execute function public.normalize_pubuser_profile_row();

update public."PubUser"
set "DisplayName" = public.normalize_pubuser_name(
  coalesce(
    nullif(trim("DisplayName"), ''),
    nullif(trim(concat_ws(' ', "FName", "Mname", "LName")), '')
  )
);
