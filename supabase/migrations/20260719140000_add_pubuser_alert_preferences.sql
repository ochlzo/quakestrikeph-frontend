alter table public."PubUser"
  add column if not exists alerts_on boolean not null default false,
  add column if not exists phivolcs_only boolean not null default false,
  add column if not exists near_pins_only boolean not null default false;

alter table public."PubUser"
  drop constraint if exists "PubUser_alert_preferences_consistent",
  add constraint "PubUser_alert_preferences_consistent"
  check (alerts_on or (not phivolcs_only and not near_pins_only));
