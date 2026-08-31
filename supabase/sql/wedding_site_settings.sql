-- Per-invitation display settings. Run once in Supabase SQL Editor.
create table if not exists public.wedding_site_settings (
  site_key text primary key check (char_length(btrim(site_key)) between 1 and 80),
  accounts_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.wedding_site_settings enable row level security;

drop policy if exists "site settings public read" on public.wedding_site_settings;
create policy "site settings public read"
on public.wedding_site_settings for select to anon, authenticated
using (true);

drop policy if exists "site settings admin manage" on public.wedding_site_settings;
create policy "site settings admin manage"
on public.wedding_site_settings for all to authenticated
using (public.is_wedding_admin())
with check (public.is_wedding_admin());

grant select on public.wedding_site_settings to anon, authenticated;
grant insert, update on public.wedding_site_settings to authenticated;

insert into public.wedding_site_settings (site_key, accounts_enabled)
values ('ksy_kwk_wed', true), ('kwk_ksy_wed', true)
on conflict (site_key) do nothing;
