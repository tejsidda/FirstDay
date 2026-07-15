-- Per-user auth: user_id columns, constraints, and RLS.
-- Run in Supabase SQL editor after app ships SSR clients + middleware.
--
-- After signing up with your primary email, backfill orphan rows:
--   select id from auth.users where email = 'you@example.com';
--   update watchlist set user_id = '<uuid>' where user_id is null;
--   update watched set user_id = '<uuid>' where user_id is null;
--   update recommendations set user_id = '<uuid>' where user_id is null;
-- Then run the NOT NULL section at the bottom.

alter table watchlist
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table watchlist drop constraint if exists watchlist_tmdb_id_key;
alter table watchlist drop constraint if exists watchlist_user_id_tmdb_id_key;
create unique index if not exists watchlist_user_id_tmdb_id_key
  on watchlist (user_id, tmdb_id);

alter table watched
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table watched drop constraint if exists watched_tmdb_id_key;
alter table watched drop constraint if exists watched_user_id_tmdb_id_key;
create unique index if not exists watched_user_id_tmdb_id_key
  on watched (user_id, tmdb_id);

alter table recommendations
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table watchlist enable row level security;
alter table watched enable row level security;
alter table recommendations enable row level security;

drop policy if exists "watchlist_select_own" on watchlist;
drop policy if exists "watchlist_insert_own" on watchlist;
drop policy if exists "watchlist_update_own" on watchlist;
drop policy if exists "watchlist_delete_own" on watchlist;

create policy "watchlist_select_own" on watchlist
  for select using (auth.uid() = user_id);

create policy "watchlist_insert_own" on watchlist
  for insert with check (auth.uid() = user_id);

create policy "watchlist_update_own" on watchlist
  for update using (auth.uid() = user_id);

create policy "watchlist_delete_own" on watchlist
  for delete using (auth.uid() = user_id);

drop policy if exists "watched_select_own" on watched;
drop policy if exists "watched_insert_own" on watched;
drop policy if exists "watched_update_own" on watched;
drop policy if exists "watched_delete_own" on watched;

create policy "watched_select_own" on watched
  for select using (auth.uid() = user_id);

create policy "watched_insert_own" on watched
  for insert with check (auth.uid() = user_id);

create policy "watched_update_own" on watched
  for update using (auth.uid() = user_id);

create policy "watched_delete_own" on watched
  for delete using (auth.uid() = user_id);

drop policy if exists "recommendations_select_own" on recommendations;
drop policy if exists "recommendations_insert_own" on recommendations;
drop policy if exists "recommendations_update_own" on recommendations;
drop policy if exists "recommendations_delete_own" on recommendations;

create policy "recommendations_select_own" on recommendations
  for select using (auth.uid() = user_id);

create policy "recommendations_insert_own" on recommendations
  for insert with check (auth.uid() = user_id);

create policy "recommendations_update_own" on recommendations
  for update using (auth.uid() = user_id);

create policy "recommendations_delete_own" on recommendations
  for delete using (auth.uid() = user_id);

-- alter table watchlist alter column user_id set not null;
-- alter table watched alter column user_id set not null;
-- alter table recommendations alter column user_id set not null;
