-- Enforce one PubUser record per Philippine mobile number.
-- Null values are allowed so newly-created accounts can finish their profile later.

do $$
begin
  if exists (
    select 1
    from public."PubUser"
    where "MobileNum" is not null
    group by "MobileNum"
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce unique PubUser mobile numbers while duplicate MobileNum values exist.';
  end if;
end;
$$;

create unique index if not exists "PubUser_mobile_number_unique"
  on public."PubUser" ("MobileNum")
  where "MobileNum" is not null;
