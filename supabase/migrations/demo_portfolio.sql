-- Public demo portfolio: one locked row (20 library + 5 watchlist) for guest mode.
-- Run in Supabase SQL editor after deploying the demo curator.

create table if not exists demo_portfolio (
  id integer primary key check (id = 1),
  watched jsonb not null default '[]'::jsonb,
  watchlist jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  locked_at timestamptz,
  locked_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

insert into demo_portfolio (id) values (1) on conflict (id) do nothing;

alter table demo_portfolio enable row level security;

drop policy if exists "demo_portfolio_public_read" on demo_portfolio;
drop policy if exists "demo_portfolio_auth_read" on demo_portfolio;
drop policy if exists "demo_portfolio_auth_update" on demo_portfolio;

create policy "demo_portfolio_public_read" on demo_portfolio
  for select using (locked_at is not null);

create policy "demo_portfolio_auth_read" on demo_portfolio
  for select to authenticated using (true);

create policy "demo_portfolio_auth_update" on demo_portfolio
  for update to authenticated using (true) with check (true);
