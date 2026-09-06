"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import MediaSearch from "@/components/MediaSearch"
import MediaTypeFilterBar from "@/components/MediaTypeFilterBar"
import {
  getWatchlist,
  getWatched,
  addToWatchlistDetailed,
  messageForAddToWatchlistFailure,
  markRecommendationShown,
  getUnshownRecommendations,
} from "@/lib/db"
import { filterByMediaType, mediaDetailPath, resolveMediaType } from "@/lib/media"
import { PULL_REFRESH_EVENT } from "@/lib/pullToRefresh"
import { getRecommendations, refreshRecommendations } from "@/lib/recommend"
import { isGuestMode } from "@/lib/guest-mode"
import { MediaItem, Movie, type MediaTypeFilter, type Recommendation } from "@/lib/types"
import { formatLanguage } from "@/lib/tmdb"
import RatingDisplay from "@/components/RatingDisplay"
import SplitReveal from "@/components/motion/SplitReveal"
import ClipReveal from "@/components/motion/ClipReveal"
import ParallaxY from "@/components/motion/ParallaxY"
import FooterWordmark from "@/components/motion/FooterWordmark"
import HeroCarousel from "@/components/cinematic/HeroCarousel"
import { ensureGsap } from "@/components/motion/gsapSetup"

const GRID_PRESETS = [
  { col: "1 / 6", mt: 0, featured: true, parallax: 60 },
  { col: "7 / 10", mt: 96, featured: false, parallax: -120 },
  { col: "10 / 13", mt: 32, featured: false, parallax: -80 },
  { col: "2 / 5", mt: 64, featured: false, parallax: -130 },
  { col: "6 / 9", mt: 0, featured: false, parallax: 80 },
  { col: "10 / 13", mt: 112, featured: false, parallax: -70 },
]

function PolaroidCard({
  film,
  onClick,
  featured = false,
  clipVariant,
}: {
  film: MediaItem
  onClick: () => void
  featured?: boolean
  clipVariant?: number
}) {
  const poster = (
    <div
      className="poster-hover"
      style={{
        position: "relative",
        aspectRatio: "2 / 3",
        overflow: "hidden",
        borderRadius: featured ? 12 : 8,
        boxShadow:
          "0 2px 4px rgba(0,0,0,0.4), 0 10px 24px rgba(0,0,0,0.55), 0 28px 48px rgba(0,0,0,0.35)",
      }}
    >
      <img
        src={film.poster}
        alt={film.title}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {film.rating != null && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(245,197,24,0.35)",
            borderRadius: 6,
            padding: "4px 8px",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <RatingDisplay rating={film.rating} size="sm" />
        </div>
      )}
    </div>
  )

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${film.title}`}
      style={{
        display: "block",
        width: "100%",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {clipVariant != null ? (
        <ClipReveal variant={clipVariant}>{poster}</ClipReveal>
      ) : (
        poster
      )}
      <div
        className={featured ? "t-sub" : "t-title"}
        style={{
          marginTop: 10,
          color: "var(--text-emphasis)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {film.title}
      </div>
      <div
        style={{
          marginTop: 4,
          color: "rgba(245,197,24,0.6)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontFamily: "var(--font-body)",
          fontWeight: 500,
        }}
      >
        {formatLanguage(film.language)}
        {film.year != null ? ` · ${film.year}` : ""}
      </div>
    </button>
  )
}

function SectionHeader({
  index,
  eyebrow,
  title,
  action,
  isMobile,
  titleColor = "var(--text-strong)",
}: {
  index: string
  eyebrow: string
  title: string
  action?: React.ReactNode
  isMobile: boolean
  titleColor?: string
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        marginBottom: isMobile ? 32 : 56,
        flexWrap: "wrap",
        position: "relative",
      }}
    >
      <div style={{ maxWidth: 640 }}>
        <div
          className="t-label"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: isMobile ? 12 : 18,
            color: "var(--text-faint)",
          }}
        >
          <span style={{ color: "var(--accent-amber)", opacity: 0.7 }}>{index}</span>
          <span style={{ width: 28, height: 1, background: "var(--border-muted)" }} />
          <span>{eyebrow}</span>
        </div>
        <SplitReveal
          as="h2"
          split="lines"
          className="t-display"
          style={{
            margin: 0,
            color: titleColor,
            fontSize: isMobile ? "clamp(30px, 8vw, 40px)" : "clamp(36px, 5vw, 58px)",
          }}
        >
          {title}
        </SplitReveal>
      </div>
      {action}
    </div>
  )
}

function SectionLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="t-button arrow-link"
      style={{
        color: "var(--text-emphasis)",
        textDecoration: "none",
        padding: "10px 0",
      }}
    >
      <span>{children}</span>
      <span className="arrow-line" aria-hidden />
    </Link>
  )
}

export default function HomeContent() {
  const [watchlist, setWatchlist] = useState<MediaItem[]>([])
  const [watched, setWatched] = useState<MediaItem[]>([])
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaTypeFilter>("all")
  const [isMobile, setIsMobile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [recsLoading, setRecsLoading] = useState(false)
  const [guestMode, setGuestMode] = useState(false)
  const router = useRouter()
  const recsHydratedRef = useRef(false)
  const watchlistRailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setGuestMode(isGuestMode())
  }, [])

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)")
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const [wl, w] = await Promise.all([getWatchlist(), getWatched()])
      setWatchlist(wl)
      setWatched(w)
      setLoading(false)
    }
    loadData()

    const onPullRefresh = (e: Event) => {
      e.preventDefault()
      void loadData()
    }
    window.addEventListener(PULL_REFRESH_EVENT, onPullRefresh)
    return () => window.removeEventListener(PULL_REFRESH_EVENT, onPullRefresh)
  }, [])

  // Re-measure ScrollTriggers once content settles (route transition transforms
  // and async data can skew initial measurements)
  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => {
      ensureGsap().ScrollTrigger.refresh()
    }, 600)
    return () => clearTimeout(t)
  }, [loading, watched, watchlist, recommendations])

  useEffect(() => {
    const handler = () => setSearchOpen(true)
    window.addEventListener("fdfs:open-search", handler)
    return () => window.removeEventListener("fdfs:open-search", handler)
  }, [])

  const loadRecommendations = async () => {
    if (watched.length < 3) return
    setRecsLoading(true)
    try {
      const recs = await getRecommendations(watched, watchlist)
      setRecommendations(recs)
    } finally {
      setRecsLoading(false)
    }
  }

  useEffect(() => {
    if (loading || recsHydratedRef.current) return
    recsHydratedRef.current = true
    let active = true
    setRecsLoading(true)
    getUnshownRecommendations(5)
      .then((recs) => { if (active) setRecommendations(recs) })
      .finally(() => { if (active) setRecsLoading(false) })
    return () => { active = false }
  }, [loading])

  const handleRefreshRecommendations = async () => {
    if (watched.length < 3) return
    setRecsLoading(true)
    try {
      const recs = await refreshRecommendations(watched, watchlist)
      setRecommendations(recs)
    } finally {
      setRecsLoading(false)
    }
  }

  const reloadRecsAfterInteraction = async (shownId: string) => {
    await markRecommendationShown(shownId)
    setRecsLoading(true)
    try {
      const recs = await getRecommendations(watched, watchlist)
      setRecommendations(recs)
    } finally {
      setRecsLoading(false)
    }
  }

  const heroMovies =
    watchlist.length > 0 ? watchlist : watched.length > 0 ? [watched[0]] : []

  const displayedWatched = filterByMediaType(watched, mediaTypeFilter)
  const displayedWatchlist = filterByMediaType(watchlist, mediaTypeFilter)

  const handleAddToWatchlist = async (item: MediaItem) => {
    const result = await addToWatchlistDetailed(item)
    if (result.ok) {
      setWatchlist((prev) =>
        prev.some((m) => m.id === item.id && resolveMediaType(m) === resolveMediaType(item))
          ? prev
          : [item, ...prev],
      )
      return { ok: true }
    }
    return {
      ok: false,
      message: messageForAddToWatchlistFailure(result.reason),
    }
  }

  const handleAddRecommendation = async (rec: Recommendation) => {
    const movie: MediaItem = {
      id: String(rec.tmdbId),
      mediaType: "movie",
      title: rec.title,
      year: rec.year,
      language: rec.language,
      poster: rec.poster,
      backdrop: rec.backdrop || undefined,
    }
    const result = await addToWatchlistDetailed(movie)
    if (result.ok) {
      setWatchlist((prev) =>
        prev.some((m) => m.id === movie.id) ? prev : [movie, ...prev],
      )
      await reloadRecsAfterInteraction(rec.id)
    }
  }

  const scrollWatchlistRail = (dir: "left" | "right") => {
    const el = watchlistRailRef.current
    if (!el) return
    const step = el.clientWidth * 0.8
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" })
  }

  const recentlyWatchedDisplayCount = isMobile ? 6 : 12
  const isEmpty = !loading && watched.length === 0 && watchlist.length === 0

  if (loading) {
    return (
      <main
        className="relative text-white min-h-screen flex items-center justify-center"
        style={{ background: "var(--background-base)" }}
      >
        <p className="t-meta" style={{ color: "var(--text-search)" }}>
          Loading your cinema…
        </p>
      </main>
    )
  }

  return (
    <main
      className="relative text-white page-with-mobile-tabs"
      style={{ background: "var(--background-base)", minHeight: "100vh" }}
    >
      {/* ─────────────── HERO ─────────────── */}
      {isEmpty ? (
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            minHeight: isMobile ? "100svh" : "92vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? "84px 20px 56px" : "96px 48px",
            background: "var(--background-base)",
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 10,
              maxWidth: 520,
              textAlign: "center",
              padding: "0 20px",
            }}
          >
            <div
              className="t-label"
              style={{ color: "var(--accent-amber)", marginBottom: 24, opacity: 0.85 }}
            >
              First Day First Show
            </div>
            <h1 className="t-display" style={{ margin: 0, color: "var(--text-strong)" }}>
              Your cinema starts here.
            </h1>
            <p className="t-body" style={{ marginTop: 20, color: "var(--text-dim)" }}>
              Search for a film you love. We&apos;ll build your library, your
              watchlist, and recommendations as you go.
            </p>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="t-button"
              style={{
                marginTop: 32,
                color: "var(--background-base)",
                background: "rgba(255,255,255,0.92)",
                border: "none",
                borderRadius: 999,
                padding: "14px 32px",
                cursor: "pointer",
                transition: "transform 0.2s ease, opacity 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)"
                e.currentTarget.style.opacity = "0.88"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)"
                e.currentTarget.style.opacity = "1"
              }}
            >
              Search for a film
            </button>
          </div>
        </section>
      ) : (
        <HeroCarousel
          movies={heroMovies}
          isMobile={isMobile}
          sourceEyebrow={
            watchlist.length > 0 ? "From your watchlist" : "From your library"
          }
          onSearchOpen={() => setSearchOpen(true)}
        />
      )}

      {/* ─────────────── RECENTLY WATCHED — editorial broken grid ─────────────── */}
      {watched.length > 0 && (
        <section
          style={{
            position: "relative",
            padding: isMobile ? "64px 20px 88px" : "128px 56px 160px",
            background: "var(--background-base)",
            overflow: "hidden",
          }}
        >
          <span
            className="section-numeral"
            aria-hidden
            style={{ top: isMobile ? 20 : 48, right: isMobile ? -10 : 24 }}
          >
            02
          </span>

          <div style={{ marginBottom: isMobile ? 24 : 32 }}>
            <MediaTypeFilterBar value={mediaTypeFilter} onChange={setMediaTypeFilter} />
          </div>

          <SectionHeader
            index="02"
            eyebrow="The archive"
            title="Recently watched"
            isMobile={isMobile}
            action={
              watched.length > recentlyWatchedDisplayCount ? (
                <SectionLink href="/library">View your library</SectionLink>
              ) : undefined
            }
          />

          {displayedWatched.length === 0 ? (
            <p className="t-meta" style={{ color: "var(--text-dim)" }}>
              No recently watched titles match this filter.
            </p>
          ) : isMobile ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 20,
              }}
            >
              {displayedWatched.slice(0, recentlyWatchedDisplayCount).map((film, i) => (
                <div
                  key={`${film.mediaType}-${film.id}`}
                  style={{ marginTop: i % 2 === 1 ? 36 : 0 }}
                >
                  <PolaroidCard
                    film={film}
                    clipVariant={i}
                    onClick={() => router.push(mediaDetailPath(film))}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                columnGap: 28,
                rowGap: 96,
                alignItems: "start",
              }}
            >
              {displayedWatched.slice(0, recentlyWatchedDisplayCount).map((film, i) => {
                const preset = GRID_PRESETS[i % GRID_PRESETS.length]
                return (
                  <div
                    key={`${film.mediaType}-${film.id}`}
                    style={{
                      gridColumn: preset.col,
                      marginTop: preset.mt,
                    }}
                  >
                    <ParallaxY y={preset.parallax} scrub={1.5} minWidth={769}>
                      <PolaroidCard
                        film={film}
                        featured={preset.featured}
                        clipVariant={i}
                        onClick={() => router.push(mediaDetailPath(film))}
                      />
                    </ParallaxY>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ─────────────── RECOMMENDATIONS — warm tonal band ─────────────── */}
      <section
        style={{
          padding: isMobile ? "64px 20px 88px" : "128px 56px 152px",
          background: "var(--background-base)",
          borderTop: "1px solid var(--border-hairline)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <span
          className="section-numeral"
          aria-hidden
          style={{ top: isMobile ? 20 : 48, left: isMobile ? -10 : 24 }}
        >
          03
        </span>

        {/* Warm amber orb — cinema warmth */}
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            right: "10%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245,197,24,0.055) 0%, transparent 70%)",
            pointerEvents: "none",
            animation: "ambientDrift 22s ease-in-out infinite reverse",
          }}
        />

        <SectionHeader
          index="03"
          eyebrow="Curated for tonight"
          title="Picked for you"
          isMobile={isMobile}
          titleColor="var(--text-display)"
          action={
            recommendations.length > 0 && !recsLoading && !guestMode ? (
              <button
                type="button"
                onClick={() => handleRefreshRecommendations()}
                className="t-button arrow-link"
                style={{
                  color: "var(--text-emphasis)",
                  background: "transparent",
                  border: "none",
                  padding: "10px 0",
                  cursor: "pointer",
                }}
              >
                <span>Refresh</span>
                <span className="arrow-line" aria-hidden />
              </button>
            ) : undefined
          }
        />

        {recsLoading ? (
          <p className="t-meta" style={{ color: "var(--text-faint-ui)", textAlign: "center" }}>
            Finding films you&apos;ll love…
          </p>
        ) : recommendations.length === 0 && watched.length >= 3 ? (
          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              onClick={() => loadRecommendations()}
              className="t-button"
              style={{
                color: "var(--background-base)",
                background: "rgba(255,255,255,0.92)",
                border: "none",
                borderRadius: 999,
                padding: "12px 28px",
                cursor: "pointer",
              }}
            >
              Get personalized recommendations
            </button>
          </div>
        ) : recommendations.length === 0 ? (
          <p className="t-meta" style={{ color: "var(--text-dim)", textAlign: "center" }}>
            Rate three films and we&apos;ll start curating your picks.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(auto-fill, minmax(220px, 1fr))",
              gap: isMobile ? 16 : 28,
              maxWidth: 1200,
              marginLeft: "auto",
              marginRight: "auto",
              position: "relative",
            }}
          >
            {(isMobile ? recommendations.slice(0, 4) : recommendations).map(
              (rec, i) => (
                <div key={rec.id || `${rec.tmdbId}-${i}`}>
                  <RecommendationCard
                    rec={rec}
                    clipVariant={i}
                    onOpen={() => router.push(`/movie/${rec.tmdbId}`)}
                    onAdd={() => handleAddRecommendation(rec)}
                    onDismiss={() => reloadRecsAfterInteraction(rec.id)}
                  />
                </div>
              ),
            )}
          </div>
        )}
      </section>

      {/* ─────────────── WATCHLIST ─────────────── */}
      {displayedWatchlist.length > 0 && (
        <section
          style={{
            position: "relative",
            padding: isMobile ? "56px 0 72px" : "96px 0 112px",
            background: "var(--background-base)",
          }}
        >
          <div style={{ padding: isMobile ? "0 20px" : "0 56px" }}>
            <SectionHeader
              index="04"
              eyebrow="Upcoming screenings"
              title="Want to watch"
              isMobile={isMobile}
              action={
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  {!isMobile && displayedWatchlist.length > 4 && (
                    <>
                      <RailButton direction="left" onClick={() => scrollWatchlistRail("left")} />
                      <RailButton direction="right" onClick={() => scrollWatchlistRail("right")} />
                    </>
                  )}
                  <SectionLink href="/watchlist">View all</SectionLink>
                </div>
              }
            />
          </div>

          {/* Rail with edge fades */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 12,
                width: isMobile ? 40 : 80,
                zIndex: 2,
                background: "linear-gradient(to right, var(--background-base), transparent)",
                pointerEvents: "none",
              }}
            />
            <div
              ref={watchlistRailRef}
              className="scrollbar-hide"
              style={{
                display: "flex",
                gap: isMobile ? 14 : 20,
                overflowX: "auto",
                scrollSnapType: "x mandatory",
                padding: isMobile ? "4px 20px 12px" : "4px 56px 16px",
                scrollPaddingLeft: isMobile ? 20 : 56,
              }}
            >
              {displayedWatchlist.map((film) => (
                <Link
                  key={`${film.mediaType}-${film.id}`}
                  href={mediaDetailPath(film)}
                  style={{
                    flex: "0 0 auto",
                    width: isMobile ? 140 : 170,
                    scrollSnapAlign: "start",
                    textDecoration: "none",
                    display: "block",
                  }}
                >
                  <div
                    className="poster-hover"
                    style={{
                      position: "relative",
                      aspectRatio: "2 / 3",
                      overflow: "hidden",
                      borderRadius: 8,
                      boxShadow:
                        "0 2px 4px rgba(0,0,0,0.4), 0 10px 24px rgba(0,0,0,0.55), 0 28px 48px rgba(0,0,0,0.35)",
                    }}
                  >
                    <img
                      src={film.poster}
                      alt={film.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </div>
                  <div
                    className="t-title-sm"
                    style={{
                      marginTop: 10,
                      color: "var(--text-emphasis)",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {film.title}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      color: "rgba(245,197,24,0.55)",
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      fontFamily: "var(--font-body)",
                      fontWeight: 500,
                    }}
                  >
                    {formatLanguage(film.language)}
                    {film.year != null ? ` · ${film.year}` : ""}
                  </div>
                </Link>
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 12,
                width: isMobile ? 40 : 80,
                zIndex: 2,
                background: "linear-gradient(to left, var(--background-base), transparent)",
                pointerEvents: "none",
              }}
            />
          </div>
        </section>
      )}

      {/* ─────────────── FOOTER — wordmark bookend ─────────────── */}
      <footer
        style={{
          padding: isMobile ? "72px 16px 32px" : "120px 48px 48px",
          textAlign: "center",
          background: "var(--background-base)",
          borderTop: "1px solid var(--border-hairline)",
          overflow: "hidden",
        }}
      >
        <FooterWordmark
          text="FDFS"
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: "clamp(96px, 22vw, 280px)",
            lineHeight: 0.9,
            letterSpacing: "-0.04em",
            color: "var(--text-strong)",
          }}
        />
        <p
          className="t-caption"
          style={{
            margin: 0,
            marginTop: isMobile ? 28 : 40,
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            color: "var(--text-footer)",
          }}
        >
          First Day First Show
        </p>
      </footer>

      {searchOpen && (
        <MediaSearch onAdd={handleAddToWatchlist} onClose={() => setSearchOpen(false)} />
      )}
    </main>
  )
}

function RecommendationCard({
  rec,
  onOpen,
  onAdd,
  onDismiss,
  clipVariant = 0,
}: {
  rec: Recommendation
  onOpen: () => void
  onAdd: () => void
  onDismiss: () => void
  clipVariant?: number
}) {
  return (
    <article style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${rec.title}`}
        style={{
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
          width: "100%",
        }}
      >
        <ClipReveal variant={clipVariant}>
          <div
            className="poster-hover"
            style={{
              aspectRatio: "2 / 3",
              borderRadius: 10,
              overflow: "hidden",
              boxShadow:
                "0 2px 4px rgba(0,0,0,0.4), 0 10px 24px rgba(0,0,0,0.55), 0 28px 48px rgba(0,0,0,0.35)",
            }}
          >
            {rec.poster ? (
              <img
                src={rec.poster}
                alt={rec.title}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "var(--background-elevated)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "var(--text-faint-ui)", fontSize: 12 }}>No poster</span>
              </div>
            )}
          </div>
        </ClipReveal>
      </button>

      <div>
        <button
          type="button"
          onClick={onOpen}
          className="t-title"
          style={{
            display: "inline-block",
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
            color: "var(--text-emphasis)",
          }}
        >
          <span className="link-sweep">{rec.title}</span>
        </button>
        <div
          style={{
            marginTop: 4,
            color: "rgba(245,197,24,0.55)",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontFamily: "var(--font-body)",
            fontWeight: 500,
          }}
        >
          {formatLanguage(rec.language)} · {rec.year}
        </div>
      </div>

      {rec.reason && (
        <p
          className="t-caption"
          style={{
            margin: 0,
            color: "var(--text-quote)",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {rec.reason}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <button
          type="button"
          onClick={onAdd}
          className="t-button-sm"
          style={{
            flex: 1,
            color: "var(--background-base)",
            background: "rgba(255,255,255,0.9)",
            border: "none",
            borderRadius: 999,
            padding: "9px 14px",
            cursor: "pointer",
            transition: "opacity 0.2s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85" }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1" }}
        >
          Add to watchlist
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Not interested"
          className="t-button-sm"
          style={{
            color: "var(--text-search)",
            background: "transparent",
            border: "1px solid var(--border-default)",
            borderRadius: 999,
            padding: "9px 14px",
            cursor: "pointer",
            transition: "color 0.2s ease, border-color 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-emphasis)"
            e.currentTarget.style.borderColor = "var(--border-strong)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-search)"
            e.currentTarget.style.borderColor = "var(--border-default)"
          }}
        >
          Dismiss
        </button>
      </div>
    </article>
  )
}

function RailButton({
  direction,
  onClick,
}: {
  direction: "left" | "right"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? "Scroll left" : "Scroll right"}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        background: "var(--tint-base)",
        border: "1px solid var(--border-default)",
        color: "var(--text-emphasis)",
        fontSize: 18,
        lineHeight: 1,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.2s ease, border-color 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--tint-hover)"
        e.currentTarget.style.borderColor = "var(--border-strong)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--tint-base)"
        e.currentTarget.style.borderColor = "var(--border-default)"
      }}
    >
      {direction === "left" ? "‹" : "›"}
    </button>
  )
}
