"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import TopOverlayNav from "@/components/TopOverlayNav"
import MovieSearch from "@/components/MovieSearch"
import {
  getWatchlist,
  getWatched,
  addToWatchlist,
  markRecommendationShown,
  getUnshownRecommendations,
} from "@/lib/db"
import { getRecommendations, refreshRecommendations } from "@/lib/recommend"
import { Movie, type Recommendation } from "@/lib/types"
import RatingDisplay from "@/components/RatingDisplay"

function PolaroidCard({
  film,
  rotation,
  offsetX,
  offsetY,
  onClick,
}: {
  film: Movie
  rotation: number
  offsetX: number
  offsetY: number
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        cursor: "pointer",
        transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        transform: hovered
          ? "rotate(0deg) translateY(-12px) scale(1.05)"
          : `rotate(${rotation}deg) translateX(${offsetX}px) translateY(${offsetY}px)`,
        zIndex: hovered ? 20 : 1,
        position: "relative",
      }}
    >
      <div
        style={{
          background: hovered
            ? "var(--tint-surface-hover)"
            : "var(--tint-ghost)",
          padding: "10px 10px 16px 10px",
          borderRadius: 4,
          boxShadow: hovered
            ? "0 20px 50px var(--shadow-card), 0 0 1px var(--border-subtle)"
            : "0 4px 16px var(--shadow-float)",
          transition: "all 0.4s ease",
        }}
      >
        <div
          style={{
            position: "relative",
            aspectRatio: "2/3",
            overflow: "hidden",
            borderRadius: 2,
          }}
        >
          <img
            src={film.poster}
            alt={film.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />

          {/* Bottom gradient to ensure text contrast on any poster */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, var(--scrim-hero), var(--scrim-mid), transparent 55%)",
              opacity: hovered ? 1 : 0.9,
              transition: "opacity 0.3s ease",
              pointerEvents: "none",
            }}
          />

          {/* Title + rating — bottom-right on poster */}
          <div
            style={{
              position: "absolute",
              left: 10,
              right: 10,
              bottom: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              textAlign: "right",
            }}
          >
            <div
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 13,
                fontStyle: "italic",
                color: hovered
                  ? "var(--text-inverse)"
                  : "var(--text-strong)",
                textShadow:
                  "0 2px 6px var(--scrim-edge), 0 0 12px var(--scrim-blur)",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                transition: "color 0.35s ease",
              }}
            >
              {film.title}
            </div>
            {film.rating != null && (
              <div
                style={{
                  marginTop: 2,
                  opacity: hovered ? 1 : 0.9,
                  transition: "opacity 0.3s ease",
                }}
              >
                <RatingDisplay rating={film.rating} size="sm" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HomeContent() {
  const [watchlist, setWatchlist] = useState<Movie[]>([])
  const [watched, setWatched] = useState<Movie[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [heroIndex, setHeroIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [titleRevealed, setTitleRevealed] = useState(0)
  const [introComplete, setIntroComplete] = useState(false)
  const [titleHovered, setTitleHovered] = useState(false)
  const [creditsPaused, setCreditsPaused] = useState(false)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [recsLoading, setRecsLoading] = useState(false)
  const [heroVisualOpacity, setHeroVisualOpacity] = useState(1)
  const [pastHeroFold, setPastHeroFold] = useState(false)
  const router = useRouter()
  const heroAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ambientCacheRef = useRef<Record<string, [number, number, number]>>({})
  const recsHydratedRef = useRef(false)

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
      .then((recs) => {
        if (!active) return
        setRecommendations(recs)
      })
      .finally(() => {
        if (!active) return
        setRecsLoading(false)
      })

    return () => {
      active = false
    }
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

  /** After marking one shown, reload up to 5 unshown (no API if enough remain in batch). */
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

  const heroMovie =
    watchlist.length > 0
      ? watchlist[heroIndex % watchlist.length]
      : watched[0] || null

  const heroBackdrop = heroMovie?.backdrop || heroMovie?.poster
  const heroPoster = heroMovie?.poster

  useEffect(() => {
    if (watchlist.length <= 1) return
    const interval = setInterval(() => {
      setHeroVisualOpacity(0)
      heroAdvanceTimerRef.current = setTimeout(() => {
        setHeroIndex((prev) => (prev + 1) % watchlist.length)
        setHeroVisualOpacity(1)
        heroAdvanceTimerRef.current = null
      }, 1000)
    }, 10000)
    return () => {
      clearInterval(interval)
      if (heroAdvanceTimerRef.current) clearTimeout(heroAdvanceTimerRef.current)
    }
  }, [watchlist.length])

  useEffect(() => {
    const onScroll = () => setPastHeroFold(window.scrollY > 80)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Typing effect for hero title
  useEffect(() => {
    if (!heroMovie) return
    const title = heroMovie.title
    let i = 0
    setTitleRevealed(0)
    setIntroComplete(false)
    const interval = setInterval(() => {
      i++
      setTitleRevealed(i)
      if (i >= title.length) {
        clearInterval(interval)
        setTimeout(() => setIntroComplete(true), 800)
      }
    }, 95)
    return () => clearInterval(interval)
  }, [heroMovie?.id])

  const handleAddToWatchlist = async (movie: Movie) => {
    const alreadyInLibrary = watched.some((m) => m.id === movie.id)
    if (alreadyInLibrary) {
      return {
        ok: false,
        message: "Already in your library — pick another one?",
      }
    }
    const success = await addToWatchlist(movie)
    if (success) {
      setWatchlist((prev) => [movie, ...prev])
      return { ok: true }
    }
    return {
      ok: false,
      message: "Already on your watchlist.",
    }
  }

  const recentlyWatchedDisplayCount = isMobile ? 6 : 12

  const polaroidStyles = useMemo(() => {
    const n = Math.min(recentlyWatchedDisplayCount, watched.length)
    if (n === 0) return []
    if (isMobile) {
      return Array.from({ length: n }, () => ({
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
      }))
    }
    return watched.slice(0, n).map(() => ({
      rotation: (Math.random() - 0.5) * 16,
      offsetX: (Math.random() - 0.5) * 30,
      offsetY: (Math.random() - 0.5) * 20,
    }))
  }, [isMobile, watched.length, recentlyWatchedDisplayCount])

  if (loading) {
    return (
      <main
        className="relative text-white min-h-screen flex items-center justify-center"
        style={{ background: "var(--background-raised)" }}
      >
        <p
          style={{
            color: "var(--text-search)",
            fontStyle: "italic",
            fontFamily: "Georgia, serif",
            fontSize: 16,
          }}
        >
          Loading your cinema...
        </p>
      </main>
    )
  }

  return (
    <main
      className="relative text-white"
      style={{ background: "var(--background-raised)", minHeight: "100vh" }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes blink {
          50% { border-color: transparent; }
        }
        @keyframes creditsScroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>

      <TopOverlayNav onSearchClick={() => setSearchOpen(true)} />

      {/* Ambient orb */}
      <div style={{
        position: 'fixed',
        top: '20%',
        left: '50%',
        width: 600,
        height: 600,
        transform: 'translateX(-50%)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--ambient-orb) 0%, transparent 70%)',
        animation: 'ambientDrift 25s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Section 1: The Opening — desktop: cinematic backdrop; mobile: poster + typography (no wide backdrop crop) */}
      <section
        style={{
          position: "relative",
          ...(isMobile
            ? {
                minHeight: "100svh",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "72px 20px 48px",
                background:
                  "linear-gradient(180deg, var(--background-raised) 0%, var(--background-mid) 45%, var(--background-raised) 100%)",
              }
            : {
                height: "100vh",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }),
        }}
      >
        {!isMobile && heroMovie && (
          <div
            style={{
              position: "absolute",
              inset: -100,
              backgroundImage: `url(${heroBackdrop})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "saturate(1.15) brightness(0.55)",
              transform: "scale(1.08)",
              opacity: heroVisualOpacity,
              transition: "opacity 1.1s cubic-bezier(0.33, 1, 0.68, 1)",
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            ...(isMobile
              ? {
                  background:
                    "radial-gradient(ellipse 90% 60% at 50% 20%, var(--tint-ghost) 0%, transparent 55%)",
                  pointerEvents: "none",
                }
              : {
                  background:
                    "radial-gradient(ellipse at center, var(--vignette-soft) 0%, var(--vignette-deep) 100%)",
                }),
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 10,
            textAlign: "center",
            padding: isMobile ? "0" : "0 48px",
            width: "100%",
            maxWidth: isMobile ? 420 : "none",
            marginLeft: "auto",
            marginRight: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: isMobile ? 11 : 13,
              fontStyle: "italic",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--text-label)",
              marginBottom: isMobile ? 20 : 28,
            }}
          >
            First Day First Show
          </div>

          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              opacity: heroVisualOpacity,
              transition: "opacity 1.1s cubic-bezier(0.33, 1, 0.68, 1)",
            }}
          >
          {heroMovie && (heroPoster || heroBackdrop) && (
            <button
              type="button"
              onClick={() => router.push(`/movie/${heroMovie.id}`)}
              style={{
                marginBottom: isMobile ? 22 : 26,
                padding: 0,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                borderRadius: 12,
                overflow: "hidden",
                width: isMobile ? "min(200px, 48vw)" : "min(300px, 26vw)",
                flexShrink: 0,
                boxShadow:
                  "0 28px 56px var(--shadow-deep), 0 0 0 1px var(--border-default)",
                position: "relative",
              }}
              aria-label={`Open ${heroMovie.title}`}
            >
              <div
                style={{
                  position: "relative",
                  aspectRatio: "2 / 3",
                  width: "100%",
                }}
              >
                <img
                  src={heroPoster || heroBackdrop || ""}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to top, var(--scrim-deep), var(--scrim-fade), transparent 52%)",
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 12,
                    right: 12,
                    bottom: 12,
                    display: "flex",
                    justifyContent: "flex-end",
                    textAlign: "right",
                  }}
                >
                  <h1
                    onMouseEnter={() => setTitleHovered(true)}
                    onMouseLeave={() => setTitleHovered(false)}
                    style={{
                      margin: 0,
                      maxWidth: "100%",
                      fontFamily: 'Georgia, "Times New Roman", serif',
                      fontSize: isMobile
                        ? "clamp(16px, 4.5vw, 24px)"
                        : "clamp(20px, 2.2vw, 32px)",
                      fontWeight: 400,
                      fontStyle: "italic",
                      color: titleHovered
                        ? "var(--text-inverse)"
                        : "var(--text-strong)",
                      letterSpacing: "-0.02em",
                      lineHeight: 1.15,
                      cursor: "pointer",
                      textShadow:
                        "0 2px 14px var(--scrim-title), 0 0 1px var(--scrim-edge)",
                      transition: "color 0.35s ease",
                    }}
                  >
                    {heroMovie.title.slice(0, titleRevealed)}
                    <span
                      style={{
                        borderRight:
                          titleRevealed < heroMovie.title.length
                            ? "2px solid var(--cursor-line)"
                            : "none",
                        animation: "blink 0.8s step-end infinite",
                        marginLeft: 3,
                      }}
                    />
                  </h1>
                </div>
              </div>
            </button>
          )}

          <p
            style={{
              fontFamily: "Georgia, serif",
              fontSize: isMobile ? 15 : 17,
              fontStyle: "italic",
              color: "var(--text-dim)",
              marginTop: isMobile ? 6 : 8,
              opacity: introComplete ? 1 : 0,
              transform: introComplete ? "translateY(0)" : "translateY(10px)",
              transition: "opacity 0.85s ease, transform 0.85s ease",
            }}
          >
            {heroMovie
              ? `${heroMovie.language} · ${heroMovie.year} · from your watchlist`
              : ""}
          </p>
          {heroMovie && introComplete && !pastHeroFold && (
            <p
              style={{
                fontFamily: "-apple-system, sans-serif",
                fontSize: isMobile ? 11 : 12,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: titleHovered
                  ? "var(--text-hint-hover)"
                  : "var(--text-hint)",
                marginTop: 14,
                transition: "color 0.35s ease",
              }}
            >
              {isMobile
                ? "Tap poster or title to open"
                : "Click title to open movie page"}
            </p>
          )}

          {isMobile && watchlist.length > 1 && (
            <p
              style={{
                fontFamily: "-apple-system, sans-serif",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--text-search)",
                marginTop: 16,
              }}
            >
              {(heroIndex % watchlist.length) + 1} / {watchlist.length} on your
              watchlist
            </p>
          )}
          </div>

          <div
            style={{
              position: isMobile ? "relative" : "absolute",
              bottom: isMobile ? undefined : -120,
              left: isMobile ? undefined : "50%",
              transform: isMobile ? undefined : "translateX(-50%)",
              marginTop: isMobile ? 28 : undefined,
              opacity: introComplete ? 1 : 0,
              transition: "opacity 1s ease 0.5s",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 1,
                height: 30,
                background:
                  "linear-gradient(to bottom, transparent, var(--glow-line))",
              }}
            />
            <span
              style={{
                fontFamily: "-apple-system, sans-serif",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--text-ghost)",
              }}
            >
              Your cinema awaits
            </span>
          </div>
        </div>
      </section>

      {/* Section 2: Recently Watched — Polaroid Desk */}
      {watched.length > 0 && (
        <section
          style={{
            position: "relative",
            padding: isMobile ? "56px 20px 80px" : "96px 56px 120px",
            background: "var(--background-raised)",
            minHeight: isMobile ? "auto" : watched.length > 6 ? "80vh" : "auto",
          }}
        >
          <div style={{ marginBottom: isMobile ? 36 : 56, maxWidth: 560 }}>
            <h2
              style={{
                fontFamily: "Georgia, serif",
                fontSize: isMobile ? 28 : 36,
                fontWeight: 400,
                fontStyle: "italic",
                color: "var(--text-strong)",
                letterSpacing: "-0.01em",
              }}
            >
              Recently watched
            </h2>
            <p
              style={{
                fontFamily: "Georgia, serif",
                fontSize: isMobile ? 15 : 17,
                fontStyle: "italic",
                color: "var(--text-faint)",
                marginTop: 14,
                lineHeight: 1.55,
              }}
            >
              The nights you&apos;ve already spent at the movies.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(auto-fill, minmax(180px, 1fr))",
              gap: isMobile ? 20 : 36,
              maxWidth: 1200,
            }}
          >
            {watched
              .slice(0, recentlyWatchedDisplayCount)
              .map((film, i) => (
              <PolaroidCard
                key={film.id}
                film={film}
                rotation={polaroidStyles[i]?.rotation || 0}
                offsetX={polaroidStyles[i]?.offsetX || 0}
                offsetY={polaroidStyles[i]?.offsetY || 0}
                onClick={() => router.push(`/movie/${film.id}`)}
              />
            ))}
          </div>

          {watched.length > recentlyWatchedDisplayCount && (
            <div style={{ marginTop: 56, textAlign: "center" }}>
              <a
                href="/library"
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: isMobile ? 15 : 17,
                  fontStyle: "italic",
                  color: "var(--text-link)",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--border-hover)",
                  paddingBottom: 4,
                  transition: "color 0.3s ease, border-color 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-link-hover)"
                  e.currentTarget.style.borderBottomColor =
                    "var(--border-accent)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-link)"
                  e.currentTarget.style.borderBottomColor =
                    "var(--border-hover)"
                }}
              >
                view your full library →
              </a>
            </div>
          )}
        </section>
      )}

      {/* Recommendations — Supabase-backed batch; 5 slots, dismiss/add marks shown */}
      {(
        <section
          style={{
            padding: isMobile ? "56px 20px 72px" : "96px 56px 112px",
            background: "var(--background-sunken)",
            position: "relative",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 56 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 20,
                flexWrap: "wrap",
              }}
            >
              <h2
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: isMobile ? 30 : 38,
                  fontWeight: 400,
                  fontStyle: "italic",
                  color: "var(--text-display)",
                  margin: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                picked for you
              </h2>
              {recommendations.length > 0 && !recsLoading && (
                <button
                  type="button"
                  onClick={() => handleRefreshRecommendations()}
                  style={{
                    fontFamily: "-apple-system, sans-serif",
                    fontSize: 12,
                    color: "var(--text-link)",
                    background: "var(--tint-base)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    padding: "8px 14px",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    transition: "color 0.3s ease, border-color 0.3s ease, background 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--text-emphasis)"
                    e.currentTarget.style.borderColor = "var(--border-focus)"
                    e.currentTarget.style.background = "var(--tint-hover)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-link)"
                    e.currentTarget.style.borderColor = "var(--border-default)"
                    e.currentTarget.style.background = "var(--tint-base)"
                  }}
                >
                  Refresh recommendations
                </button>
              )}
            </div>
            <p
              style={{
                fontFamily: "Georgia, serif",
                fontSize: isMobile ? 15 : 17,
                fontStyle: "italic",
                color: "var(--text-faint)",
                marginTop: 14,
                lineHeight: 1.5,
              }}
            >
              based on your taste
            </p>
          </div>

          {recommendations.length === 0 && !recsLoading && (
            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                onClick={() => loadRecommendations()}
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 15,
                  fontStyle: "italic",
                  color: "var(--text-button)",
                  background: "var(--tint-base)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 999,
                  padding: "14px 32px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-button-hover)"
                  e.currentTarget.style.borderColor = "var(--border-strong)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-button)"
                  e.currentTarget.style.borderColor = "var(--border-default)"
                }}
              >
                Get personalized recommendations
              </button>
            </div>
          )}

          {recsLoading ? (
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 14,
                  fontStyle: "italic",
                  color: "var(--text-faint-ui)",
                }}
              >
                Finding films you&apos;ll love...
              </p>
            </div>
          ) : recommendations.length > 0 ? (
            <div
              style={{
                display: "flex",
                  gap: isMobile ? 16 : 32,
                justifyContent: "center",
                flexWrap: "wrap",
                maxWidth: 1100,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {(isMobile
                ? recommendations.slice(0, 4)
                : recommendations
              ).map((rec, i) => (
                <div
                  key={rec.id || `${rec.tmdbId}-${i}`}
                  style={{
                    position: "relative",
                    width: isMobile ? 160 : 180,
                    transition: "transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-8px)"
                    const t = e.currentTarget.querySelector(
                      "[data-rec-title]",
                    ) as HTMLElement | null
                    if (t) {
                      t.style.color = "var(--text-inverse)"
                      t.style.transition = "color 0.35s ease"
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)"
                    const t = e.currentTarget.querySelector(
                      "[data-rec-title]",
                    ) as HTMLElement | null
                    if (t) t.style.color = "var(--text-emphasis)"
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      reloadRecsAfterInteraction(rec.id)
                    }}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      zIndex: 2,
                      fontFamily: "-apple-system, sans-serif",
                      fontSize: isMobile ? 8 : 9,
                      color: "var(--text-badge)",
                      background: "var(--panel-overlay)",
                      border: "1px solid var(--border-muted)",
                      borderRadius: 4,
                      padding: "4px 8px",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Not interested
                  </button>
                  <div
                    onClick={async () => {
                      const movie: Movie = {
                        id: String(rec.tmdbId),
                        title: rec.title,
                        year: rec.year,
                        language: rec.language,
                        poster: rec.poster,
                        backdrop: rec.backdrop || undefined,
                      }
                      const success = await addToWatchlist(movie)
                      if (success) {
                        setWatchlist((prev) => [movie, ...prev])
                        await reloadRecsAfterInteraction(rec.id)
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  >
                  <div
                    style={{
                      aspectRatio: "2/3",
                      borderRadius: 8,
                      overflow: "hidden",
                      boxShadow: "0 8px 24px var(--shadow-poster)",
                      marginBottom: 12,
                    }}
                  >
                    {rec.poster ? (
                      <img
                        src={rec.poster}
                        alt={rec.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background:
                            "linear-gradient(145deg, var(--background-elevated), var(--background-sunken))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--text-faint-ui)",
                            fontSize: 12,
                          }}
                        >
                          No poster
                        </span>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: isMobile ? 15 : 16,
                      fontWeight: 400,
                      fontStyle: "italic",
                      color: "var(--text-emphasis)",
                      lineHeight: 1.35,
                      transition: "color 0.35s ease",
                    }}
                    data-rec-title
                  >
                    {rec.title}
                  </div>
                  <div
                    style={{
                      fontFamily: "-apple-system, sans-serif",
                      fontSize: 11,
                      color: "var(--text-search)",
                      marginTop: 4,
                    }}
                  >
                    {rec.language} · {rec.year}
                  </div>
                  <div
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: 11,
                      fontStyle: "italic",
                      color: "var(--text-quote)",
                      marginTop: 8,
                      lineHeight: 1.5,
                    }}
                  >
                    &ldquo;{rec.reason}&rdquo;
                  </div>
                  <div
                    style={{
                      fontFamily: "-apple-system, sans-serif",
                      fontSize: 9,
                      color: "var(--text-micro)",
                      marginTop: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Click to add to watchlist
                  </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      )}

      {/* Section 3: Want to Watch — End Credits Scroll */}
      {watchlist.length > 0 && (
        <section
          style={{
            position: "relative",
            padding: isMobile ? "56px 0 48px" : "80px 0 64px",
            background: "var(--background-raised)",
            overflow: "hidden",
            minHeight: "60vh",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: isMobile ? 48 : 56 }}>
            <h2
              style={{
                fontFamily: "Georgia, serif",
                fontSize: isMobile ? 28 : 36,
                fontWeight: 400,
                fontStyle: "italic",
                color: "var(--text-strong)",
                letterSpacing: "-0.01em",
              }}
            >
              want to watch
            </h2>
            <p
              style={{
                fontFamily: "Georgia, serif",
                fontSize: isMobile ? 15 : 17,
                fontStyle: "italic",
                color: "var(--text-faint)",
                marginTop: 14,
                lineHeight: 1.55,
              }}
            >
              your upcoming screenings
            </p>
          </div>

          <div
            style={{
              position: "absolute",
              top: 100,
              left: 0,
              right: 0,
              height: 80,
              background: "linear-gradient(to bottom, var(--background-raised), transparent)",
              zIndex: 5,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 80,
              background: "linear-gradient(to top, var(--background-raised), transparent)",
              zIndex: 5,
              pointerEvents: "none",
            }}
          />

          <div
            onMouseEnter={() => setCreditsPaused(true)}
            onMouseLeave={() => setCreditsPaused(false)}
            style={{
              height: 400,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                animationName: "creditsScroll",
                animationDuration: `${Math.max(watchlist.length * 9, 36)}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationPlayState: creditsPaused ? "paused" : "running",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {[...watchlist, ...watchlist].map((film, i) => (
                <a
                  key={`${film.id}-${i}`}
                  href={`/movie/${film.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    padding: isMobile ? "16px 20px" : "20px 56px",
                    textDecoration: "none",
                    transition: "background 0.35s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--tint-row)"
                    const t = e.currentTarget.querySelector(
                      "[data-credit-title]",
                    ) as HTMLElement | null
                    if (t) {
                      t.style.color = "var(--text-row-hover)"
                      t.style.transition = "color 0.35s ease"
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent"
                    const t = e.currentTarget.querySelector(
                      "[data-credit-title]",
                    ) as HTMLElement | null
                    if (t) t.style.color = "var(--text-subdued)"
                  }}
                >
                  <img
                    src={film.poster}
                    alt=""
                    style={{
                      width: 40,
                      height: 60,
                      objectFit: "cover",
                      borderRadius: 3,
                      flexShrink: 0,
                    }}
                  />
                  <div
                    data-credit-title
                    style={{
                      flex: 1,
                      fontFamily: "Georgia, serif",
                      fontSize: isMobile ? 16 : 19,
                      fontWeight: 400,
                      fontStyle: "italic",
                      color: "var(--text-subdued)",
                      transition: "color 0.35s ease",
                    }}
                  >
                    {film.title}
                  </div>
                  <div
                    style={{
                      fontFamily: "-apple-system, sans-serif",
                      fontSize: isMobile ? 10 : 11,
                      color: "var(--text-caption)",
                      letterSpacing: "0.08em",
                      flexShrink: 0,
                    }}
                  >
                    {film.language} · {film.year}
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
              marginTop: 40,
              position: "relative",
              zIndex: 10,
            }}
          >
            <a
              href="/watchlist"
              style={{
                fontFamily: "Georgia, serif",
                fontSize: isMobile ? 15 : 17,
                fontStyle: "italic",
                color: "var(--text-link)",
                textDecoration: "none",
                borderBottom: "1px solid var(--border-hover)",
                paddingBottom: 4,
                transition: "color 0.3s ease, border-color 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-link-hover)"
                e.currentTarget.style.borderBottomColor =
                  "var(--border-accent)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-link)"
                e.currentTarget.style.borderBottomColor =
                  "var(--border-hover)"
              }}
            >
              view the full reel →
            </a>
          </div>
        </section>
      )}

      {/* Section 4: Search */}
      <section
        style={{
          padding: isMobile ? "48px 16px" : "80px 48px",
          textAlign: "center",
          background: "var(--background-raised)",
        }}
      >
        <p
          style={{
            fontFamily: "Georgia, serif",
            fontSize: isMobile ? 18 : 20,
            fontStyle: "italic",
            color: "var(--text-lede)",
            marginBottom: 24,
          }}
        >
          Looking for something?
        </p>

        <button
          onClick={() => setSearchOpen(true)}
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 15,
            fontStyle: "italic",
            color: "var(--text-search)",
            background: "var(--tint-ghost)",
            border: "1px solid var(--tint-base)",
            borderRadius: 999,
            padding: isMobile ? "12px 20px" : "14px 40px",
            cursor: "pointer",
            transition: "all 0.3s ease",
            minWidth: isMobile ? 0 : 300,
            width: isMobile ? "100%" : "auto",
            maxWidth: isMobile ? 360 : "none",
            textAlign: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-strong)"
            e.currentTarget.style.color = "var(--text-search-hover)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--tint-base)"
            e.currentTarget.style.color = "var(--text-search)"
          }}
        >
          Search for a film...
        </button>
      </section>

      {/* Section 5: Footer */}
      <footer
        style={{
          padding: isMobile ? "44px 16px 28px" : "60px 48px 40px",
          textAlign: "center",
          background: "var(--background-raised)",
        }}
      >
        <div
          style={{
            width: 30,
            height: 1,
            background: "var(--tint-row)",
            margin: "0 auto 24px",
          }}
        />
        <p
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 12,
            fontStyle: "italic",
            color: "var(--text-footer)",
          }}
        >
          First Day First Show
        </p>
      </footer>

      {searchOpen && (
        <MovieSearch
          onAdd={handleAddToWatchlist}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </main>
  )
}
