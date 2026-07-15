# 003. Supabase SSR auth with row-level security

## Status

Accepted

## Context

FDFS is a personal movie diary backed by Supabase Postgres. ADR-001 chose Supabase for relational data (`watchlist`, `watched`, `recommendations`). ADR-002 chose the Next.js App Router.

Before this change, the app had a login UI on `/landing` (`signInWithPassword`, Google OAuth) and a client-side OAuth callback, but:

- No middleware or route guards
- A single browser Supabase client using the public anon key
- All database queries in `src/lib/db.ts` were global — no `user_id`, no session scoping
- Anyone with the anon key (embedded in the client bundle) could read and write all diary data

The product goal is per-user isolation: one user's watchlist, ratings, and recommendations must not be visible to other users or anonymous callers.

## Decision

Implement authentication and authorization using:

1. **Supabase Auth** (email + password and Google OAuth) — stay on the existing provider
2. **`@supabase/ssr`** — cookie-based sessions readable in middleware, server components, and route handlers
3. **Next.js middleware** — session refresh on each request; redirect unauthenticated users away from diary routes
4. **Row-level security (RLS)** on `watchlist`, `watched`, and `recommendations` — policies keyed on `auth.uid() = user_id`
5. **Schema migration** — add `user_id` to all diary tables; per-user unique constraints on `(user_id, tmdb_id)`; one-time backfill of existing rows to the primary account
6. **Server OAuth callback** — route handler at `/auth/callback` instead of a client page

The service role key is **not** used in the application. Security depends on RLS enforcing the authenticated user's JWT.

## Rationale

**RLS is the real security boundary.** Middleware and UI redirects improve UX but can be bypassed by direct API calls. With correct RLS, even a caller holding the public anon key cannot read another user's rows.

**SSR cookies over client-only sessions.** The previous client-only `exchangeCodeForSession` stored session state in a way that server code could not trust. `@supabase/ssr` aligns with Supabase's recommended Next.js App Router pattern and lets middleware refresh tokens before they expire.

**Stay on Supabase Auth rather than adding a second auth system.** Login UI, OAuth, and Postgres live in one place. ADR-001 already committed to Supabase; introducing NextAuth or Clerk would add cost, complexity, and a second identity model without improving RLS integration.

**No service role key in the app.** The service role bypasses RLS. Keeping it server-only (or out of the repo entirely) prevents accidental full-database access from a leaked env var in the client bundle.

**Migrate existing data to one account.** The app was effectively single-user. Backfilling orphan rows to the primary `auth.users` id preserves the existing diary instead of wiping it.

## Consequences

Positive:

- Per-user data isolation enforced at the database, not only in React
- Standard Supabase multi-tenant pattern; well-documented and auditable
- Cookie sessions work across server and client boundaries in the App Router
- OAuth callback on the server avoids client-only session races

Negative:

- Requires Supabase Dashboard configuration (redirect URLs, Google OAuth, email policy)
- Migration and one-time backfill are manual steps with a short nullable `user_id` window
- RLS misconfiguration would block all queries or leak data — two-account testing is mandatory before calling it done
- `src/lib/db.ts` and tests must be updated; client components still call Supabase directly in a few places (RLS protects those calls)

## Alternatives considered

**NextAuth / Auth.js**

- Popular in Next.js ecosystems
- Would still require Supabase RLS integration or a separate user table mapping
- Adds a second session model on top of Supabase Auth already partially wired

**Clerk**

- Fast hosted auth UX
- Additional vendor, pricing, and duplicate user store relative to Supabase
- Less natural fit for Postgres RLS keyed on `auth.uid()`

**App-side `user_id` filters without RLS**

- Simpler to write initially
- Insecure: anon key + crafted REST requests bypass application code entirely

**Service role server layer (no RLS)**

- Server actions with service role could scope queries in code
- One leaked key exposes the entire database; violates least-privilege

**Keep client-only auth; protect routes in React only**

- Minimal code change
- Does not prevent data leaks via direct Supabase API access

**Lucia / custom JWT auth**

- Full control over session format
- Unnecessary rebuild when Supabase Auth already handles credentials and OAuth

## Verification

Before marking auth complete:

1. Primary account sees migrated diary data after backfill
2. Second test account sees empty tables
3. Unauthenticated `/api/recommend` returns 401
4. Signed-out access to `/home` redirects to `/landing`
