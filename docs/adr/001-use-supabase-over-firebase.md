# 001. Use Supabase over Firebase

## Status

Accepted

## Context

FDFS needs a small hosted backend for a personal movie diary app. The core data is relational:

- watched films
- watchlist entries
- ratings and reviews
- cached TMDB metadata such as genres and runtime
- generated recommendations with shown/dismissed state

The app already uses Next.js and TypeScript, and most client code benefits from a straightforward typed data access layer.

## Decision

Use Supabase as the primary application backend instead of Firebase.

Supabase provides Postgres, SQL migrations, JSON columns, indexes, and a JavaScript client that fits the app's current data model. The project keeps database access behind `src/lib/db.ts` so UI components do not need to know table details.

## Rationale

Supabase is a better fit because the domain is table-shaped and query-oriented. The app frequently needs ordered lists, duplicate checks by `tmdb_id`, updates to existing watched records, and recommendation filtering by `shown` and `added_at`.

Postgres also makes the schema easier to evolve. Existing migrations can add columns like `genres` and `runtime` without reshaping application data around a document model.

Firebase would work, but it would push more responsibility into application code for relational constraints, duplicate prevention, and query patterns that are native in SQL.

## Consequences

Positive:

- Data remains easy to inspect and migrate with SQL.
- `watchlist`, `watched`, and `recommendations` can be modeled directly.
- Duplicate checks and ordered reads stay simple.
- JSON metadata can be stored without abandoning relational structure.

Negative:

- The app depends on Supabase availability and configuration.
- Row-level security and table policies must be maintained carefully.
- Offline-first behavior is not a built-in architectural assumption.

## Alternatives Considered

Firebase Firestore:

- Strong hosted backend with good realtime support.
- Less natural for this app's relational reads and SQL-style migrations.
- Would likely require more app-side data shaping for duplicate checks and aggregate-style queries.

Local-only storage:

- Simpler operationally.
- Not suitable if the app needs persistence across devices or future authenticated users.
