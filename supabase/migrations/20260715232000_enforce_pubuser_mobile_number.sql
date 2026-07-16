-- Enforce Philippine mobile numbers on PubUser profiles.
-- Saved mobile numbers must be exactly 11 digits and start with 09.

create or replace function public.normalize_pubuser_phone(value text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
begin
  if value is null then
    return null;
  end if;

  cleaned := regexp_replace(value, '\D+', '', 'g');
  return nullif(cleaned, '');
end;
$$;

update public."PubUser"
set "MobileNum" = public.normalize_pubuser_phone("MobileNum");

update public."PubUser"
set "MobileNum" = null
where "MobileNum" is not null
  and "MobileNum" !~ '^09[0-9]{9}$';

alter table public."PubUser"
  drop constraint if exists "PubUser_mobile_number_format";

alter table public."PubUser"
  add constraint "PubUser_mobile_number_format"
  check ("MobileNum" is null or "MobileNum" ~ '^09[0-9]{9}$');
