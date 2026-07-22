-- TV shows support: media_type discriminator + TV metadata columns.
-- Existing rows backfill to 'movie' via DEFAULT.

alter table watchlist
  add column if not exists media_type text not null default 'movie';

alter table watchlist
  add column if not exists seasons integer;

alter table watchlist
  add column if not exists episodes integer;

alter table watchlist drop constraint if exists watchlist_user_id_tmdb_id_key;
drop index if exists watchlist_user_id_tmdb_id_key;
create unique index if not exists watchlist_user_id_tmdb_id_media_type_key
  on watchlist (user_id, tmdb_id, media_type);

alter table watched
  add column if not exists media_type text not null default 'movie';

alter table watched
  add column if not exists seasons integer;

alter table watched
  add column if not exists episodes integer;

alter table watched drop constraint if exists watched_user_id_tmdb_id_key;
drop index if exists watched_user_id_tmdb_id_key;
create unique index if not exists watched_user_id_tmdb_id_media_type_key
  on watched (user_id, tmdb_id, media_type);

-- Recommendations remain movie-only in v1; add media_type for future TV recs.
alter table recommendations
  add column if not exists media_type text not null default 'movie';
