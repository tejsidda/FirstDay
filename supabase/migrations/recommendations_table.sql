-- Run in Supabase SQL editor if migrations aren't applied automatically
create table if not exists recommendations (
  id uuid primary key default gen_random_uuid(),
  tmdb_id text not null,
  title text not null,
  year int not null default 0,
  language text not null default '',
  poster text not null default '',
  backdrop text not null default '',
  reason text not null default '',
  shown boolean not null default false,
  added_at timestamptz not null default now()
);

create index if not exists recommendations_shown_added_at_idx
  on recommendations (shown, added_at);
