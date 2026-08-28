-- Run once in the Supabase SQL Editor.
-- One response is retained per browser-local UUID. A different device/browser
-- can still respond separately; this is deliberately a light-weight RSVP.

create table if not exists public.wedding_rsvps (
  id uuid primary key default gen_random_uuid(),
  client_token uuid not null unique,
  attendance text not null check (attendance in ('attending', 'declined')),
  guest_count integer not null default 0 check (guest_count between 0 and 5),
  guest_name text not null default '' check (char_length(btrim(guest_name)) <= 30),
  message text not null default '' check (char_length(btrim(message)) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_wedding_rsvp_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wedding_rsvps_updated_at on public.wedding_rsvps;
create trigger trg_wedding_rsvps_updated_at before update on public.wedding_rsvps
for each row execute function public.set_wedding_rsvp_updated_at();

alter table public.wedding_rsvps enable row level security;
grant usage on schema public to anon, authenticated;
grant select on public.wedding_rsvps to authenticated;

drop policy if exists "wedding rsvps admin read" on public.wedding_rsvps;
create policy "wedding rsvps admin read"
on public.wedding_rsvps
for select to authenticated
using (public.is_wedding_admin());

-- SECURITY DEFINER keeps public users from reading everyone else's response,
-- while allowing an atomic insert-or-update of their own browser token.
create or replace function public.submit_wedding_rsvp(
  p_client_token uuid,
  p_attendance text,
  p_guest_count integer,
  p_name text default '',
  p_message text default '',
  p_website text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_id uuid;
  safe_attendance text := lower(trim(coalesce(p_attendance, '')));
  safe_count integer := coalesce(p_guest_count, 0);
  safe_name text := btrim(coalesce(p_name, ''));
  safe_message text := btrim(coalesce(p_message, ''));
begin
  if coalesce(p_website, '') <> '' then
    raise exception 'Invalid request';
  end if;
  if p_client_token is null or safe_attendance not in ('attending', 'declined') then
    raise exception 'Invalid RSVP';
  end if;
  if safe_attendance = 'declined' then safe_count := 0; end if;
  if safe_count < 0 or safe_count > 5 or char_length(safe_name) > 30 or char_length(safe_message) > 200 then
    raise exception 'Invalid RSVP values';
  end if;

  insert into public.wedding_rsvps (client_token, attendance, guest_count, guest_name, message)
  values (p_client_token, safe_attendance, safe_count, safe_name, safe_message)
  on conflict (client_token) do update set
    attendance = excluded.attendance,
    guest_count = excluded.guest_count,
    guest_name = excluded.guest_name,
    message = excluded.message,
    updated_at = now()
  returning id into saved_id;

  return saved_id;
end;
$$;

revoke all on function public.submit_wedding_rsvp(uuid, text, integer, text, text, text) from public;
grant execute on function public.submit_wedding_rsvp(uuid, text, integer, text, text, text) to anon, authenticated;
