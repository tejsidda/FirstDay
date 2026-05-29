"use client"

import { useEffect, useMemo, useState } from "react"
import { getWatched } from "@/lib/db"
import { getMovieDetails, formatLanguage } from "@/lib/tmdb"
import type { Movie } from "@/lib/types"
import MovieSearch from "@/components/MovieSearch"
import FilterChip from "@/components/FilterChip"
import { addToWatchlist } from "@/lib/db"
import { useIsMobile, MOBILE_TAB_BAR_INSET } from "@/hooks/useIsMobile"

const TMDB_CACHE_KEY = "fdfs:wrapped:tmdb-cache:v1"

type TMDBGenre = { id: number; name: string }
type TMDBDetails = {
  id: number
  runtime?: number | null
  genres?: TMDBGenre[]
}

type CacheMap = Record<string, TMDBDetails>

function readCache(): CacheMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.sessionStorage.getItem(TMDB_CACHE_KEY)
    return raw ? (JSON.parse(raw) as CacheMap) : {}
  } catch {
    return {}
  }
}

function writeCache(c: CacheMap) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(TMDB_CACHE_KEY, JSON.stringify(c))
  } catch {
    /* sessionStorage full or unavailable */
  }
}

async function fetchInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize)
    const out = await Promise.all(slice.map(fn))
    results.push(...out)
    if (onProgress) onProgress(Math.min(i + batchSize, items.length), items.length)
  }
  return results
}

type Scope = "all" | "year"

function getWatchedYear(m: Movie): number | null {
  if (!m.watchedAt) return null
  const d = new Date(m.watchedAt)
  if (Number.isNaN(d.getTime())) return null
  return d.getFullYear()
}

function getWatchedMonth(m: Movie): string | null {
  if (!m.watchedAt) return null
  const d = new Date(m.watchedAt)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

export default function WrappedPage() {
  const [watched, setWatched] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()
  const [searchOpen, setSearchOpen] = useState(false)
  const [scope, setScope] = useState<Scope>("all")

  useEffect(() => {
    const handler = () => setSearchOpen(true)
    window.addEventListener("fdfs:open-search", handler)
    return () => window.removeEventListener("fdfs:open-search", handler)
  }, [])
  const [tmdbCache, setTmdbCache] = useState<CacheMap>({})
  const [tmdbProgress, setTmdbProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const films = await getWatched()
      if (!active) return
      setWatched(films)
      setTmdbCache(readCache())
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  // Hydrate TMDB details (genres + runtime) for films not yet cached
  useEffect(() => {
    if (watched.length === 0) return
    let active = true
    const cache = readCache()
    const missing = watched.filter((w) => !cache[w.id])
    if (missing.length === 0) return

    // Defer the initial progress setState so the new react-hooks/set-state-in-effect
    // lint rule doesn't trip; the work below is async anyway.
    queueMicrotask(() => {
      if (!active) return
      setTmdbProgress({ done: 0, total: missing.length })
    })

    fetchInBatches(
      missing,
      8,
      async (m) => {
        try {
          const d = (await getMovieDetails(m.id)) as TMDBDetails
          if (!d || typeof d.id === "undefined") return null
          return {
            id: m.id,
            details: {
              id: d.id,
              runtime: d.runtime ?? null,
              genres: d.genres || [],
            },
          }
        } catch {
          return null
        }
      },
      (done, total) => {
        if (active) setTmdbProgress({ done, total })
      },
    ).then((entries) => {
      if (!active) return
      const next: CacheMap = { ...cache }
      for (const e of entries) {
        if (!e) continue
        next[e.id] = e.details
      }
      writeCache(next)
      setTmdbCache(next)
      setTmdbProgress(null)
    })

    return () => {
      active = false
    }
  }, [watched])

  const scoped = useMemo(() => {
    if (scope === "all") return watched
    return watched.filter((w) => getWatchedYear(w) === currentYear)
  }, [watched, scope, currentYear])

  const stats = useMemo(() => computeStats(scoped, tmdbCache), [scoped, tmdbCache])

  const handleAdd = async (movie: Movie) => {
    const ok = await addToWatchlist(movie)
    if (ok) return { ok: true }
    return { ok: false, message: "Already on your list." }
  }

  if (loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background-raised)" }}
      >
        <p className="t-meta" style={{ color: "var(--text-search)" }}>
          Loading…
        </p>
      </main>
    )
  }

  if (watched.length === 0) {
    return (
      <main
        className="min-h-screen page-with-mobile-tabs"
        style={{ background: "var(--background-raised)" }}
      >
        <div
          style={{
            paddingTop: 140,
            paddingBottom: 60,
            paddingLeft: 20,
            paddingRight: 20,
            textAlign: "center",
            maxWidth: 520,
            margin: "0 auto",
          }}
        >
          <div
            className="t-label"
            style={{ color: "var(--text-label)", marginBottom: 20 }}
          >
            Your year in film
          </div>
          <h1
            className="t-display"
            style={{ margin: 0, color: "var(--text-strong)" }}
          >
            Nothing to wrap yet.
          </h1>
          <p
            className="t-body"
            style={{ marginTop: 16, color: "var(--text-dim)" }}
          >
            Rate a few films and we&apos;ll start writing your year in cinema.
          </p>
        </div>
        {searchOpen && (
          <MovieSearch onAdd={handleAdd} onClose={() => setSearchOpen(false)} />
        )}
      </main>
    )
  }

  return (
    <main
      className="min-h-screen page-with-mobile-tabs"
      style={{ background: "var(--background-raised)" }}
    >

      {/* ── Masthead ── */}
      <header
        className={isMobile ? "mobile-stagger-in" : undefined}
        style={{
          position: "relative",
          paddingTop: isMobile ? 88 : 140,
          paddingBottom: isMobile ? 32 : 56,
          paddingLeft: isMobile ? 20 : 56,
          paddingRight: isMobile ? 20 : 56,
          textAlign: "center",
        }}
      >
        <div
          className="t-label"
          style={{ color: "var(--text-label)", marginBottom: 14 }}
        >
          {scope === "year" ? `${currentYear} in film` : "Your year in film"}
        </div>
        <div
          className={
            isMobile ? "t-display-num-compact t-tabular" : "t-display-num t-tabular"
          }
          style={{ color: "var(--text-strong)" }}
        >
          {stats.totalFilms}
        </div>
        <p
          className="t-title"
          style={{ margin: 0, marginTop: 16, color: "var(--text-dim)" }}
        >
          {stats.totalFilms === 1 ? "film" : "films"} watched
        </p>

        {/* Scope toggle */}
        <div
          role="tablist"
          aria-label="Time range"
          style={{
            marginTop: 28,
            display: "inline-flex",
            gap: 4,
            padding: 4,
            background: "var(--tint-base)",
            border: "1px solid var(--border-default)",
            borderRadius: 999,
          }}
        >
          <ScopeTab
            label={`All time`}
            active={scope === "all"}
            onClick={() => setScope("all")}
          />
          <ScopeTab
            label={`${currentYear}`}
            active={scope === "year"}
            onClick={() => setScope("year")}
          />
        </div>

        {tmdbProgress && (
          <p
            className="t-caption"
            style={{ marginTop: 24, color: "var(--text-dim)" }}
          >
            Loading genres & runtimes… {tmdbProgress.done}/{tmdbProgress.total}
          </p>
        )}
      </header>

      {/* ── Stat cards ── */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: isMobile
            ? `0 16px calc(32px + ${MOBILE_TAB_BAR_INSET})`
            : "0 56px 120px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(auto-fit, minmax(280px, 1fr))",
            gap: isMobile ? 10 : 24,
          }}
        >
          {/* Hours watched */}
          <StatCard
            compact={isMobile}
            staggerClass="mobile-stagger-in mobile-stagger-in-1"
            label="Time at the cinema"
            value={
              stats.totalRuntime != null
                ? formatRuntime(stats.totalRuntime)
                : "—"
            }
            hint={
              stats.totalRuntime != null
                ? `that's ${(stats.totalRuntime / 60 / 24).toFixed(1)} days`
                : tmdbProgress
                  ? "still loading"
                  : "no runtime data"
            }
          />

          {/* Average rating */}
          <StatCard
            compact={isMobile}
            staggerClass="mobile-stagger-in mobile-stagger-in-2"
            label="Average rating"
            value={stats.avgRating != null ? stats.avgRating.toFixed(1) : "—"}
            hint={
              stats.ratedCount > 0
                ? `across ${stats.ratedCount} rated`
                : "rate a film to start"
            }
          />

          {/* Standing ovations */}
          <StatCard
            compact={isMobile}
            staggerClass="mobile-stagger-in mobile-stagger-in-3"
            label="Standing ovations"
            value={String(stats.tens)}
            hint={`films rated 10/10`}
          />

          {/* Top language */}
          <StatCard
            compact={isMobile}
            staggerClass="mobile-stagger-in mobile-stagger-in-4"
            label="Top language"
            value={stats.topLanguage?.name || "—"}
            hint={
              stats.topLanguage
                ? `${stats.topLanguage.count} ${
                    stats.topLanguage.count === 1 ? "film" : "films"
                  }`
                : ""
            }
          />

          {/* Top genre */}
          <StatCard
            compact={isMobile}
            staggerClass="mobile-stagger-in mobile-stagger-in-5"
            label="Top genre"
            value={stats.topGenre?.name || (tmdbProgress ? "…" : "—")}
            hint={
              stats.topGenre
                ? `${stats.topGenre.count} ${
                    stats.topGenre.count === 1 ? "film" : "films"
                  }`
                : tmdbProgress
                  ? "still loading"
                  : "no genre data"
            }
          />

          {/* Most prolific month */}
          <StatCard
            compact={isMobile}
            staggerClass="mobile-stagger-in mobile-stagger-in-6"
            label="Most cinematic month"
            value={stats.topMonth?.name || "—"}
            hint={
              stats.topMonth
                ? `${stats.topMonth.count} ${
                    stats.topMonth.count === 1 ? "film" : "films"
                  }`
                : "needs watched dates"
            }
          />
        </div>

        {/* Top rated */}
        {stats.topRated.length > 0 && (
          <Section
            title="Highest rated"
            compact={isMobile}
            className="mobile-stagger-in mobile-stagger-in-4"
          >
            <ol
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {stats.topRated.map((m, i) => (
                <li key={m.id}>
                  <RankedRow
                    rank={i + 1}
                    movie={m}
                    rightLabel={
                      m.rating != null ? `${formatRating(m.rating)}/10` : ""
                    }
                  />
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* Per-year sparkline */}
        {stats.perYear.length > 1 && (
          <Section title="Films per year" compact={isMobile}>
            <PerYearBars data={stats.perYear} />
          </Section>
        )}

        {/* Language breakdown */}
        {stats.languages.length > 0 && (
          <Section title="Languages you visited" compact={isMobile}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {stats.languages.slice(0, 10).map((l) => (
                <Tag key={l.name} label={l.name} count={l.count} />
              ))}
            </div>
          </Section>
        )}

        {/* Genres */}
        {stats.genres.length > 0 && (
          <Section title="Genres you visited" compact={isMobile}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {stats.genres.slice(0, 12).map((g) => (
                <Tag key={g.name} label={g.name} count={g.count} />
              ))}
            </div>
          </Section>
        )}
      </div>

      {searchOpen && (
        <MovieSearch onAdd={handleAdd} onClose={() => setSearchOpen(false)} />
      )}
    </main>
  )
}

// ─────────────────────────── helpers ───────────────────────────

function ScopeTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <FilterChip
      label={label}
      active={active}
      onClick={onClick}
      ariaLabel={`Show ${label}`}
      role="tab"
    />
  )
}

function StatCard({
  label,
  value,
  hint,
  compact,
  staggerClass,
}: {
  label: string
  value: string
  hint?: string
  compact?: boolean
  staggerClass?: string
}) {
  return (
    <div
      className={staggerClass}
      style={{
        padding: compact ? 14 : 24,
        background: "var(--tint-base)",
        border: "1px solid var(--border-default)",
        borderRadius: compact ? 12 : 16,
      }}
    >
      <div className="t-label" style={{ color: "var(--text-label)" }}>
        {label}
      </div>
      <div
        className={compact ? "t-title t-tabular" : "t-heading t-tabular"}
        style={{ marginTop: compact ? 8 : 12, color: "var(--text-strong)" }}
      >
        {value}
      </div>
      {hint && (
        <div
          className="t-caption"
          style={{
            marginTop: compact ? 4 : 6,
            color: "var(--text-dim)",
            fontSize: compact ? 10 : undefined,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  children,
  compact,
  className,
}: {
  title: string
  children: React.ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <section
      className={className}
      style={{
        marginTop: compact ? 36 : 56,
        paddingTop: compact ? 28 : 40,
        borderTop: "1px solid var(--border-default)",
      }}
    >
      <h2
        className="t-heading"
        style={{ margin: 0, color: "var(--text-strong)", marginBottom: 20 }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function RankedRow({
  rank,
  movie,
  rightLabel,
}: {
  rank: number
  movie: Movie
  rightLabel?: string
}) {
  return (
    <a
      href={`/movie/${movie.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 10,
        textDecoration: "none",
        background: "var(--tint-base)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
      }}
    >
      <div
        className="t-title-sm t-tabular"
        style={{
          color: "var(--text-search)",
          width: 24,
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {rank}
      </div>
      <div
        style={{
          width: 40,
          height: 60,
          flexShrink: 0,
          backgroundImage: `url(${movie.poster})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: 4,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="t-title-sm"
          style={{
            color: "var(--text-emphasis)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {movie.title}
        </div>
        <div
          className="t-caption"
          style={{ marginTop: 2, color: "var(--text-search)" }}
        >
          {formatLanguage(movie.language)}
          {movie.year ? ` · ${movie.year}` : ""}
        </div>
      </div>
      {rightLabel && (
        <div
          className="t-caption-strong t-tabular"
          style={{ color: "var(--text-emphasis)", flexShrink: 0 }}
        >
          {rightLabel}
        </div>
      )}
    </a>
  )
}

function Tag({ label, count }: { label: string; count: number }) {
  return (
    <span
      className="t-label-value"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        color: "var(--text-emphasis)",
        background: "var(--tint-base)",
        border: "1px solid var(--border-default)",
        borderRadius: 999,
      }}
    >
      <span>{label}</span>
      <span
        className="t-caption-strong t-tabular"
        style={{ color: "var(--text-search)" }}
      >
        {count}
      </span>
    </span>
  )
}

function PerYearBars({
  data,
}: {
  data: { year: number; count: number }[]
}) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 12,
        overflowX: "auto",
        paddingBottom: 8,
      }}
    >
      {data.map((d) => {
        const h = Math.round((d.count / max) * 160) + 4
        return (
          <div
            key={d.year}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <div
              className="t-caption-strong t-tabular"
              style={{ color: "var(--text-emphasis)" }}
            >
              {d.count}
            </div>
            <div
              style={{
                width: 28,
                height: h,
                background: "var(--text-strong)",
                opacity: 0.85,
                borderRadius: 4,
              }}
              aria-label={`${d.count} films in ${d.year}`}
            />
            <div
              className="t-caption t-tabular"
              style={{ color: "var(--text-search)" }}
            >
              {d.year}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────── computations ───────────────────────────

type Stats = {
  totalFilms: number
  totalRuntime: number | null
  avgRating: number | null
  ratedCount: number
  tens: number
  topLanguage: { name: string; count: number } | null
  topGenre: { name: string; count: number } | null
  topMonth: { name: string; count: number } | null
  topRated: Movie[]
  perYear: { year: number; count: number }[]
  languages: { name: string; count: number }[]
  genres: { name: string; count: number }[]
}

function computeStats(films: Movie[], cache: CacheMap): Stats {
  const total = films.length
  const rated = films.filter((f) => typeof f.rating === "number")
  const avg =
    rated.length > 0
      ? rated.reduce((acc, f) => acc + (f.rating as number), 0) / rated.length
      : null
  const tens = films.filter((f) => f.rating === 10).length

  const langCounts = new Map<string, number>()
  for (const f of films) {
    const lang = formatLanguage(f.language) || "Unknown"
    langCounts.set(lang, (langCounts.get(lang) || 0) + 1)
  }
  const languages = [...langCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  const genreCounts = new Map<string, number>()
  let runtimeKnown = 0
  let runtimeSum = 0
  for (const f of films) {
    const d = cache[f.id]
    if (!d) continue
    if (typeof d.runtime === "number" && d.runtime > 0) {
      runtimeKnown++
      runtimeSum += d.runtime
    }
    for (const g of d.genres || []) {
      genreCounts.set(g.name, (genreCounts.get(g.name) || 0) + 1)
    }
  }
  const genres = [...genreCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  const monthCounts = new Map<string, number>()
  for (const f of films) {
    const k = getWatchedMonth(f)
    if (!k) continue
    monthCounts.set(k, (monthCounts.get(k) || 0) + 1)
  }
  const months = [...monthCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  const yearCounts = new Map<number, number>()
  for (const f of films) {
    const y = getWatchedYear(f)
    if (y == null) continue
    yearCounts.set(y, (yearCounts.get(y) || 0) + 1)
  }
  const perYear = [...yearCounts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year)

  const topRated = [...rated]
    .sort((a, b) => {
      const r = (b.rating as number) - (a.rating as number)
      if (r !== 0) return r
      return (a.title || "").localeCompare(b.title || "")
    })
    .slice(0, 5)

  return {
    totalFilms: total,
    totalRuntime: runtimeKnown > 0 ? runtimeSum : null,
    avgRating: avg,
    ratedCount: rated.length,
    tens,
    topLanguage: languages[0] || null,
    topGenre: genres[0] || null,
    topMonth: months[0] || null,
    topRated,
    perYear,
    languages,
    genres,
  }
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatRating(r: number): string {
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
