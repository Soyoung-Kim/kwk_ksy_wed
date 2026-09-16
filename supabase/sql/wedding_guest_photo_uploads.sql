-- Run once in the Supabase SQL Editor before testing /upload/.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wedding-guest-thumbnails', 'wedding-guest-thumbnails', true, 1048576, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];

-- The browser never receives insert permission. The upload Edge Function uses
-- the service-role key and is the only writer for this bucket.

insert into public.wedding_guest_photo_settings (site_key, google_drive_folder_id, uploads_enabled, auto_publish)
values
  ('ksy_kwk_wed', '1Lg5FSjj3a3Hi48YKY4eB9g59IPNNfe8v', false, true),
  ('kwk_ksy_wed', '1Lg5FSjj3a3Hi48YKY4eB9g59IPNNfe8v', false, true)
on conflict (site_key) do nothing;
