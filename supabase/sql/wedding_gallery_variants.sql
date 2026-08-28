-- Run once in the Supabase SQL Editor.
-- Adds separate thumbnail metadata for browser-generated gallery variants.

alter table public.wedding_gallery
  add column if not exists thumbnail_url text,
  add column if not exists thumbnail_storage_path text,
  add column if not exists source_type text not null default 'asset';

alter table public.wedding_gallery
  drop constraint if exists wedding_gallery_source_type_check;
alter table public.wedding_gallery
  add constraint wedding_gallery_source_type_check
  check (source_type in ('asset', 'storage'));

-- Existing rows remain usable until they are replaced with optimized Storage variants.
update public.wedding_gallery
set thumbnail_url = image_url
where thumbnail_url is null or btrim(thumbnail_url) = '';

create index if not exists wedding_gallery_visible_order_idx
  on public.wedding_gallery (is_visible, display_order);
