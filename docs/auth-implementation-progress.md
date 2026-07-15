# Auth implementation progress

Living log for session continuity. Update after each completed phase.

## Locked decisions

- **Auth methods:** email + password (sign up + sign in) and Google OAuth
- **Existing data:** migrate all current rows to the primary account (manual backfill SQL after sign-up)
- **Security model:** Supabase Auth + `@supabase/ssr` cookie sessions + RLS on `watchlist`, `watched`, `recommendations`
- **Docs:** ADR-003 for architecture; this file for operational progress

## Baseline (pre-implementation)

| Area | State |
|------|-------|
| Login UI | `/landing` — `signInWithPassword`, Google OAuth; sign-up link was non-functional |
| OAuth callback | Client page at `/auth/callback` using `exchangeCodeForSession` |
| Supabase client | Single browser client in `src/lib/supabase.ts` (anon key only) |
| Data layer | `src/lib/db.ts` — global queries, no `user_id` |
| Route protection | None — `/home` etc. open without session |
| Middleware | None |
| RLS | Not configured in repo |
| Sign out | None |

## Phase log

### Phase 0 — Planning (2026-07-14)

- Plan agreed: SSR auth, RLS, middleware, email + Google, migrate existing data to primary account
- Model choice: Auto over Composer 2.5 for security-sensitive work

### Phase 1 — Docs + Supabase clients (done)

- [x] ADR-003 written — `docs/adr/003-supabase-ssr-auth-and-rls.md`
- [x] `@supabase/ssr` installed
- [x] `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts` created
- [x] Old `src/lib/supabase.ts` removed; imports updated to `@/lib/supabase/client`

### Phase 2 — Database migration + RLS (SQL ready, apply manually)

- [x] `supabase/migrations/add_user_scoped_auth.sql` created
- [ ] Migration applied in Supabase (manual — **you**)
- [ ] Backfill SQL run with primary account UUID (manual — **you**)
- [ ] `user_id` set NOT NULL after backfill (manual — **you**)

### Phase 3 — Middleware + route protection (done)

- [x] `src/middleware.ts` created — session refresh + redirect unauthenticated users
- [x] `src/app/page.tsx` redirects by session (`/home` or `/landing`)
- [x] `src/app/auth/callback/route.ts` replaces client callback page (page deleted)

### Phase 4 — Auth flows (done)

- [x] Sign up wired on landing page (toggle sign-in / sign-up)
- [x] Sign out added to desktop nav (`TopOverlayNav`)
- [x] Apple button removed; Google only

### Phase 5 — Data layer + API (done)

- [x] `src/lib/db.ts` includes `user_id` on inserts (watchlist, watched, recommendations)
- [x] `/api/recommend` returns 401 when unauthenticated

### Phase 6 — Tests + verification

- [x] Tests updated (`MovieDetailClient.test.tsx` mock path)
- [x] `npm run test:run` — 41 tests passed
- [x] `npm run build` — succeeded
- [ ] Two-account leak test (manual — **you**)
- [ ] Google OAuth round-trip (manual — **you**, needs Supabase Google provider)

## Manual steps (you)

1. **Supabase Dashboard → Authentication → URL Configuration**
   - Site URL: your production/local origin (e.g. `http://localhost:3000`)
   - Redirect URLs: `http://localhost:3000/auth/callback` (+ production URL)
2. **Enable Google provider** with OAuth credentials
3. **Enable email provider**; set email confirmation policy for production
4. **Run migration** in Supabase SQL editor: `supabase/migrations/add_user_scoped_auth.sql`
5. **Sign up** with your email, then run backfill:

```sql
-- Get your UUID first:
select id, email from auth.users;

-- Replace <your-uuid> below
update watchlist set user_id = '<your-uuid>' where user_id is null;
update watched set user_id = '<your-uuid>' where user_id is null;
update recommendations set user_id = '<your-uuid>' where user_id is null;

alter table watchlist alter column user_id set not null;
alter table watched alter column user_id set not null;
alter table recommendations alter column user_id set not null;
```

6. **Verify:** sign in → see your diary; create second account → empty data; sign out → `/home` redirects to `/landing`

## Files changed (code)

| Created | `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts`, `src/middleware.ts`, `src/app/auth/callback/route.ts`, `supabase/migrations/add_user_scoped_auth.sql`, `docs/adr/003-supabase-ssr-auth-and-rls.md` |
| Updated | `src/app/landing/page.tsx`, `src/lib/db.ts`, `src/app/api/recommend/route.ts`, `src/app/page.tsx`, `src/components/TopOverlayNav.tsx`, `src/app/movie/[id]/MovieDetailClient.tsx`, `src/app/test/page.tsx`, `src/app/movie/[id]/MovieDetailClient.test.tsx`, `package.json` |
| Removed | `src/lib/supabase.ts`, `src/app/auth/callback/page.tsx` |

## Remaining work

- Apply SQL migration + backfill in Supabase (blocks RLS from taking effect until done)
- Configure Google OAuth in Supabase dashboard
- Manual two-account leak test

## Blockers / notes

- **Until migration is applied:** app works with new auth flows but RLS is not yet enforcing isolation
- **After migration, before backfill:** existing rows have `user_id = null` and won't show for anyone until backfill runs
- Next.js 16 warns middleware convention is deprecated in favor of "proxy" — current middleware still works; revisit when upgrading patterns
