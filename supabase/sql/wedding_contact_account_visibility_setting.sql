-- Run once in the Supabase SQL Editor.
-- Adds independent contact visibility control and hides both personal-information sections now.
alter table public.wedding_site_settings
  add column if not exists contacts_enabled boolean not null default true;

update public.wedding_site_settings
set contacts_enabled = false,
    accounts_enabled = false
where site_key in ('ksy_kwk_wed', 'kwk_ksy_wed');
