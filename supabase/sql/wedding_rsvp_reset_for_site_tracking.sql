-- DESTRUCTIVE: clears all existing RSVP responses before starting again.
-- Run this file first, then run wedding_rsvp.sql.

alter table public.wedding_rsvps add column if not exists site_key text;

-- The couple confirmed that the existing two responses can be removed.
delete from public.wedding_rsvps;

-- A browser can now submit one response to each invitation link.
alter table public.wedding_rsvps drop constraint if exists wedding_rsvps_client_token_key;
alter table public.wedding_rsvps alter column site_key set not null;
alter table public.wedding_rsvps add constraint wedding_rsvps_client_token_site_key_key
  unique (client_token, site_key);
