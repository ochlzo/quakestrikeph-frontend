-- Normalize PubUser profile inputs at the database boundary.

create or replace function public.normalize_pubuser_name(value text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
  formatted text := '';
  current_character text;
  capitalize_next boolean := true;
  index_value integer;
begin
  if value is null then
    return null;
  end if;

  cleaned := regexp_replace(value, '[[:cntrl:]]+', ' ', 'g');
  cleaned := regexp_replace(cleaned, '[0-9]+', '', 'g');
  cleaned := regexp_replace(cleaned, '[<>{}\[\]"`~!@#$%^&*_+=|\\/:;?,]+', '', 'g');
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');
  cleaned := nullif(trim(cleaned), '');

  if cleaned is null then
    return null;
  end if;

  cleaned := translate(
    cleaned,
    'ABCDEFGHIJKLMNOPQRSTUVWXYZÑ',
    'abcdefghijklmnopqrstuvwxyzñ'
  );

  for index_value in 1..char_length(cleaned) loop
    current_character := substring(cleaned from index_value for 1);

    if capitalize_next then
      current_character := translate(
        current_character,
        'abcdefghijklmnopqrstuvwxyzñ',
        'ABCDEFGHIJKLMNOPQRSTUVWXYZÑ'
      );
    end if;

    formatted := formatted || current_character;
    capitalize_next := current_character in (' ', '-', '.', '''');
  end loop;

  return formatted;
end;
$$;

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

  cleaned := regexp_replace(value, '[^0-9+\-\s().]+', '', 'g');
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');
  return nullif(trim(left(cleaned, 32)), '');
end;
$$;

create or replace function public.normalize_pubuser_profile_row()
returns trigger
language plpgsql
as $$
begin
  new."Email" := nullif(lower(trim(new."Email")), '');
  new."FName" := public.normalize_pubuser_name(new."FName");
  new."Mname" := public.normalize_pubuser_name(new."Mname");
  new."LName" := public.normalize_pubuser_name(new."LName");
  new."MobileNum" := public.normalize_pubuser_phone(new."MobileNum");
  return new;
end;
$$;

drop trigger if exists normalize_pubuser_profile_before_write on public."PubUser";
create trigger normalize_pubuser_profile_before_write
before insert or update of "Email", "FName", "Mname", "LName", "MobileNum"
on public."PubUser"
for each row
execute function public.normalize_pubuser_profile_row();

update public."PubUser"
set
  "Email" = nullif(lower(trim("Email")), ''),
  "FName" = public.normalize_pubuser_name("FName"),
  "Mname" = public.normalize_pubuser_name("Mname"),
  "LName" = public.normalize_pubuser_name("LName"),
  "MobileNum" = public.normalize_pubuser_phone("MobileNum");
