-- Store TMDB genres + runtime on insert so watchlist/wrapped skip live TMDB hydration.
alter table watchlist
  add column if not exists genres jsonb not null default '[]'::jsonb,
  add column if not exists runtime integer;

alter table watched
  add column if not exists genres jsonb not null default '[]'::jsonb,
  add column if not exists runtime integer;
