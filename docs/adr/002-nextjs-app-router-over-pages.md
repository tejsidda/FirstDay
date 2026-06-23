# 002. Use Next.js App Router over Pages Router

## Status

Accepted

## Context

FDFS is a Next.js app with route-level UI for home, library, watchlist, movie detail pages, authentication callback handling, and API routes for external services.

The codebase uses React client components for rich interactions, but also needs server-only code for TMDB requests and API keys.

## Decision

Use the Next.js App Router instead of the legacy Pages Router.

Application routes live under `src/app`, shared UI lives under `src/components`, and shared data/API helpers live under `src/lib`.

## Rationale

The App Router fits the current architecture because it supports colocated route segments, server components, client components, and route handlers in one model.

This matters for movie detail pages in particular: the route can fetch TMDB details, credits, keywords, and backdrops server-side before passing sanitized data into a client component for interactive actions such as rating, watchlist changes, and review editing.

Route handlers also provide a natural place to protect secrets. Browser code calls local endpoints such as `/api/tmdb/search`, `/api/tmdb/movie/[id]`, and `/api/recommend`, while server code uses `TMDB_TOKEN` and `ANTHROPIC_API_KEY`.

## Consequences

Positive:

- Server-only TMDB helpers can stay out of the browser bundle.
- API routes and UI routes share the same routing convention.
- Client-heavy pages can still use server-fetched initial data where useful.
- The app can keep global shell behavior in `layout.tsx`.

Negative:

- Developers must be explicit about client boundaries with `"use client"`.
- Some APIs, such as dynamic route `params`, differ from older Pages Router habits.
- Large client components can grow quickly if not split deliberately.

## Alternatives Considered

Pages Router:

- Mature and familiar.
- Less aligned with server components and the current route handler structure.
- Would separate API routes and page data patterns in a way that does not improve this app.

Single-page React app:

- Simpler routing model.
- Would require a separate backend/proxy layer for TMDB and Anthropic secrets.
- Would lose useful Next.js server rendering and route-handler primitives.
