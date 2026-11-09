create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  subscription jsonb not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location_name text not null,
  timezone text not null default 'Asia/Seoul',
  preferences jsonb not null default '{"rain":true,"cold":true,"heat":true,"severe":true}'::jsonb,
  active boolean not null default true,
  last_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
-- Subscription rows are written only by the register-push Edge Function (service role).
-- Never expose service-role credentials to the browser.
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;

create index if not exists push_subscriptions_active_idx on public.push_subscriptions (active) where active;
