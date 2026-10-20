-- Run once in Supabase SQL Editor to add the RSVP welcome-popup setting.
alter table public.wedding_site_settings
  add column if not exists rsvp_prompt_enabled boolean not null default true;

-- The current invitations start with the automatic prompt turned off.
-- The RSVP section and its manual button stay available.
update public.wedding_site_settings
set rsvp_prompt_enabled = false
where site_key in ('ksy_kwk_wed', 'kwk_ksy_wed');
