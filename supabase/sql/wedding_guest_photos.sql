-- Run once in the Supabase SQL Editor before enabling guest photo uploads.
-- Stores lightweight display metadata only. Original image files will be sent
-- to Google Drive later by a server-side Edge Function.

create table if not exists public.wedding_guest_photo_settings (
  site_key text primary key check (char_length(btrim(site_key)) between 1 and 80),
  google_drive_folder_id text not null check (char_length(btrim(google_drive_folder_id)) between 1 and 200),
  uploads_enabled boolean not null default false,
  auto_publish boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.wedding_guest_photos (
  id uuid primary key default gen_random_uuid(),
  site_key text not null check (char_length(btrim(site_key)) between 1 and 80),
  display_name text check (char_length(btrim(display_name)) between 1 and 30),
  message text check (char_length(btrim(message)) between 1 and 140),
  thumbnail_path text not null unique check (char_length(btrim(thumbnail_path)) between 1 and 1000),
  drive_file_id text not null unique check (char_length(btrim(drive_file_id)) between 1 and 300),
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wedding_guest_photos_site_status_created_idx
  on public.wedding_guest_photos (site_key, status, created_at desc);

alter table public.wedding_guest_photo_settings enable row level security;
alter table public.wedding_guest_photos enable row level security;

drop policy if exists "guest photo settings admin manage" on public.wedding_guest_photo_settings;
create policy "guest photo settings admin manage"
on public.wedding_guest_photo_settings for all to authenticated
using (public.is_wedding_admin())
with check (public.is_wedding_admin());

drop policy if exists "guest photos public read published" on public.wedding_guest_photos;
create policy "guest photos public read published"
on public.wedding_guest_photos for select to anon, authenticated
using (status = 'published');

drop policy if exists "guest photos admin manage" on public.wedding_guest_photos;
create policy "guest photos admin manage"
on public.wedding_guest_photos for all to authenticated
using (public.is_wedding_admin())
with check (public.is_wedding_admin());

grant select on public.wedding_guest_photos to anon, authenticated;
grant select, insert, update, delete on public.wedding_guest_photo_settings to authenticated;
grant select, insert, update, delete on public.wedding_guest_photos to authenticated;

-- Both invitation links can use the same wedding-day original-photo folder.
insert into public.wedding_guest_photo_settings (site_key, google_drive_folder_id)
values
  ('ksy_kwk_wed', '1Lg5FSjj3a3Hi48YKY4eB9g59IPNNfe8v'),
  ('kwk_ksy_wed', '1Lg5FSjj3a3Hi48YKY4eB9g59IPNNfe8v')
on conflict (site_key) do update
set google_drive_folder_id = excluded.google_drive_folder_id,
    updated_at = now();
