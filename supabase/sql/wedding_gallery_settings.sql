-- Run once in the Supabase SQL Editor.
-- Keeps uploaded Storage photos available but disabled by default, and stores
-- a per-invitation order override for local assets/photos.json entries.

alter table public.wedding_site_settings
  add column if not exists gallery_storage_enabled boolean not null default false,
  add column if not exists gallery_order jsonb not null default '[]'::jsonb;

alter table public.wedding_site_settings
  drop constraint if exists wedding_site_settings_gallery_order_check;
alter table public.wedding_site_settings
  add constraint wedding_site_settings_gallery_order_check
  check (jsonb_typeof(gallery_order) = 'array');
