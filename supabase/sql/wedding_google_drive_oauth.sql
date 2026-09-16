-- Run once in the Supabase SQL Editor before connecting Google Drive.
-- Refresh tokens are server-only: no browser role is granted access.

create table if not exists public.wedding_google_drive_connections (
  connection_key text primary key default 'primary' check (connection_key = 'primary'),
  refresh_token text not null check (char_length(btrim(refresh_token)) between 1 and 4000),
  scope text,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wedding_google_drive_oauth_states (
  state text primary key check (char_length(btrim(state)) between 32 and 300),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists wedding_google_drive_oauth_states_expires_idx
  on public.wedding_google_drive_oauth_states (expires_at);

alter table public.wedding_google_drive_connections enable row level security;
alter table public.wedding_google_drive_oauth_states enable row level security;

-- Do not add browser policies or grants to either table.
-- Supabase Edge Functions use the service-role key and bypass RLS.
