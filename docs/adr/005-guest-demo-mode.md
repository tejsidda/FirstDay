# 005. Guest demo mode for portfolio sharing

## Status

Accepted

## Context

FDFS is a personal movie diary (ADR-003) where all data is scoped per authenticated user via Supabase RLS. The app is shared with job recruiters and portfolio reviewers who will not create accounts.

Requirements:

- Show the full product UI without sign-in
- Pre-load a curated subset of titles that represent the builder's taste
- Allow interactive adds/edits during a visit without persisting to Supabase
- Never expose the owner's private diary data

## Decision

Implement **guest demo mode** using three layers:

1. **`fdfs_guest` cookie** — Middleware allows protected diary routes when this cookie is set (UX gate only; no Supabase access for guests).
2. **Static seed file** (`src/data/demo-seed.ts`) — Hand-curated watched, watchlist, and static recommendation entries bundled with the app.
3. **`sessionStorage` overlay** — Guest mutations (add to watchlist, mark watched, remove, rating/review edits) merge on top of the seed for the browser tab session only.

Entry: "Browse demo" on `/landing` sets the cookie and redirects to `/home`. Sign-in clears the guest cookie so modes never mix.

Data access: `src/lib/db.ts` delegates to `src/lib/guest-store.ts` when `isGuestMode()` is true. AI recommendation refresh is disabled; guests see static seed recommendations only.

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| Public RLS policy / shared demo user | Couples demo to Supabase; risk of data leakage; requires service role or special user |
| Magic link to owner's real data | Exposes personal diary; complex token auth |
| Read-only `/portfolio` page | Does not demonstrate interactive product |
| `localStorage` for guest deltas | Survives tab close; misleading persistence for "demo" |

## Consequences

**Positive**

- Recruiters see the real app with zero signup friction
- Owner's Supabase data stays isolated behind auth + RLS
- No API cost for Claude recommendations in demo
- Seed is version-controlled and safe to share publicly

**Negative**

- Demo data must be manually curated in `demo-seed.ts`
- Detail pages previously queried Supabase directly; they now use `db.ts` so guest delegation works
- Cookie is a UX gate, not a security boundary (same as middleware for auth — RLS still blocks anonymous DB access)

## References

- ADR-003: Supabase SSR auth and RLS
- Plan: Guest Demo Mode for Portfolio Sharing

## Update: demo setup in the app

Locked demo data is built inside guest mode — not on a separate page:

1. Sign in → **Set up demo** in the nav (starts empty guest mode).
2. Add **20 library** + **5 watchlist** titles through the normal app (search, mark watched, etc.).
3. **Publish demo** in the banner saves to `demo_portfolio` in Supabase.

Visitors who click **Browse demo** on the landing page see the published set (or empty if not published yet). Their own adds stay in the tab session only.
