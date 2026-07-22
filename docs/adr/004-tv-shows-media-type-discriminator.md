# 004. TV shows via media_type discriminator

## Status

Accepted

## Context

FDFS started as a movie-only personal diary. Layout metadata already mentions "movies and TV shows," but every layer — Postgres schema, `db.ts`, TMDB integration, search, detail pages — assumed a single entity type: a film keyed by TMDB movie ID.

TMDB uses **separate ID namespaces** for movies and TV. Numeric ID `1396` can refer to a movie and a different TV series. Storing TV in the existing tables without a type discriminator would cause ID collisions and incorrect detail-page routing.

The product goal for v1 TV support:

- **Show-level tracking** — one watchlist entry, one rating, one review per series (same lifecycle as movies)
- **Unified library/watchlist** — Movies | TV | All filter on existing pages, not separate diary sections
- **No episode/season tracking** in v1

## Decision

1. Add `media_type text NOT NULL DEFAULT 'movie'` (`'movie' | 'tv'`) to `watchlist` and `watched`
2. Replace unique index `(user_id, tmdb_id)` with `(user_id, tmdb_id, media_type)` on both tables
3. Add optional nullable columns `seasons integer` and `episodes integer` for TV metadata denormalization
4. Extend the domain type to `MediaItem = Movie & { mediaType: MediaType; seasons?; episodes?; status? }`
5. Mirror the movie TMDB layer with parallel TV routes (`/api/tmdb/tv/*`, `/search/tv`) and a separate detail route `/tv/[id]`
6. Evolve search to a unified `MediaSearch` modal with Movies | TV tabs
7. Keep AI recommendations movie-only in v1; keep Wrapped runtime stats movie-only in v1

RLS policies from ADR-003 are unchanged — they key on `user_id`, not content type.

## Rationale

**Single-table inheritance (STI) over separate TV tables**

Show-level TV shares the same lifecycle as movies: watchlist → watched → rate → review. Separate `tv_watchlist` / `tv_watched` tables would duplicate RLS policies, `db.ts` functions, and UI state machines without benefit at show-level granularity.

**`media_type` column over polymorphic parent table**

The app already denormalizes TMDB metadata into rows for fast list rendering. A join to a shared `media` parent adds complexity without performance gain for a personal diary with hundreds of rows per user.

**Show-level over season/episode tracking**

Matches the existing movie model (one entry, one rating). Season/episode tracking requires new tables, progress UI, and different Wrapped math — out of scope for v1.

**Parallel TMDB routes over generic `/api/tmdb/[type]/[id]`**

TMDB response shapes differ (`title` vs `name`, `release_date` vs `first_air_date`, `runtime` vs `episode_run_time[]`). Separate routes keep mappers explicit and match the existing movie route structure.

**Separate `/tv/[id]` route over `/media/[type]/[id]`**

File-based Next.js routing stays unambiguous when TMDB IDs collide across namespaces. SSR pages call type-specific fetchers without runtime branching in one mega page.

**Defer TV recommendations and Wrapped runtime blending**

The recommendations pipeline is coupled to `discover/movie` and movie-specific Claude prompts. TV total runtime requires assumptions (all episodes watched?) that would produce misleading stats if blended with movie runtime.

## Consequences

Positive:

- Existing movie rows backfill automatically via `DEFAULT 'movie'`
- Shared UI components (poster cards, rating picker, review form) reuse ~90% of movie code
- RLS and auth model unchanged
- TMDB ID collision prevented at the database layer

Negative:

- All `db.ts` queries must filter or insert with `media_type`
- Direct Supabase queries in `MovieDetailClient` must add `.eq('media_type', 'movie')`
- TV-specific stats and recommendations require a follow-up phase
- `recommendations` table not extended in v1 (still movie-only inserts with implicit `movie` default if column added later)

## Alternatives considered

**Separate `tv_watchlist` / `tv_watched` tables**

- Clear separation of concerns
- Duplicates RLS, CRUD, and UI; rejected for show-level parity with movies

**Episode-level tracking (Trakt-style)**

- Rich progress UX
- Large schema and UI scope; deferred

**Unified polymorphic `/media/[type]/[id]` route**

- Single detail page component
- Harder SSR caching and TMDB mapper branching; rejected for clarity

**Mixed library with no type filter**

- Simplest UI
- User chose Movies | TV | All toggle for clarity when both types coexist

## Verification

Before marking TV v1 complete:

1. Movie ID and TV ID with the same numeric value can coexist in watchlist/watched for the same user
2. Search TV tab adds rows with `media_type = 'tv'` and routes to `/tv/[id]`
3. Library/watchlist filters correctly by Movies | TV | All
4. Movie detail page does not show TV row state when IDs collide
5. Wrapped runtime stats exclude TV rows; optional TV count displayed separately
