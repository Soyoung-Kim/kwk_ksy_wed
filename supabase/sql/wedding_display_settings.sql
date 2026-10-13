-- Run this once in the Supabase SQL Editor.
-- Both values are saved independently for each invitation site_key.
alter table public.wedding_site_settings
  add column if not exists flower_notice_enabled boolean not null default true,
  add column if not exists guest_photo_share_enabled boolean not null default true;
