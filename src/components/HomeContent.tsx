"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import Link from "next/link"
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
import { formatLanguage } from "@/lib/tmdb"
import RatingDisplay from "@/components/RatingDisplay"

const HERO_ROTATION_MS = 14000
const TYPING_INTERVAL_MS = 50

function PolaroidCard({
  film,
  onClick,
  featured = false,
}: {
  film: Movie
  onClick: () => void
  featured?: boolean
}) {
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
        transition: "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-8px) scale(1.02)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) scale(1)"
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "2 / 3",
          overflow: "hidden",
          borderRadius: featured ? 12 : 8,
          boxShadow:
            "0 2px 4px rgba(0,0,0,0.4), 0 10px 24px rgba(0,0,0,0.55), 0 28px 48px rgba(0,0,0,0.35)",
          transition: "box-shadow 0.3s ease",
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
      className="t-button"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        color: "var(--text-emphasis)",
        textDecoration: "none",
        background: "var(--tint-base)",
        border: "1px solid var(--border-default)",
        borderRadius: 999,
        padding: "10px 20px",
        transition: "color 0.2s ease, border-color 0.2s ease, background 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--text-inverse)"
        e.currentTarget.style.borderColor = "var(--border-strong)"
        e.currentTarget.style.background = "var(--tint-hover)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--text-emphasis)"
        e.currentTarget.style.borderColor = "var(--border-default)"
        e.currentTarget.style.background = "var(--tint-base)"
      }}
    >
      {children}
    </Link>
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
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [recsLoading, setRecsLoading] = useState(false)
  const [heroVisualOpacity, setHeroVisualOpacity] = useState(1)
  const [posterTilt, setPosterTilt] = useState({ x: 0, y: 0 })
  const [posterGlow, setPosterGlow] = useState<string | null>(null)
  const [magnetXY, setMagnetXY] = useState({ x: 0, y: 0 })
  const router = useRouter()
  const heroAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recsHydratedRef = useRef(false)
  const watchlistRailRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const magnetBtnRef = useRef<HTMLButtonElement>(null)
  const isNearMagnetRef = useRef(false)

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

  // Scroll-reveal via IntersectionObserver
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]")
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible")
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [watched, watchlist, recommendations])

  // Parallax scroll on hero backdrop
  useEffect(() => {
    const handleScroll = () => {
      if (backdropRef.current && !isMobile) {
        const y = window.scrollY * 0.28
        backdropRef.current.style.transform = `scale(1.14) translateY(${y}px)`
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isMobile])

  // Magnetic pull on the "Open details" CTA button
  useEffect(() => {
    if (isMobile) return
    const handleMouseMove = (e: MouseEvent) => {
      if (!magnetBtnRef.current) return
      const rect = magnetBtnRef.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const pullRadius = 90
      if (dist < pullRadius) {
        isNearMagnetRef.current = true
        const strength = (1 - dist / pullRadius) * 0.38
        setMagnetXY({ x: dx * strength, y: dy * strength })
      } else if (isNearMagnetRef.current) {
        isNearMagnetRef.current = false
        setMagnetXY({ x: 0, y: 0 })
      }
    }
    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [isMobile])

  // Extract dominant color from hero poster for the background glow
  useEffect(() => {
    setPosterGlow(null)
    const src = watchlist.length > 0
      ? (watchlist[heroIndex % watchlist.length]?.poster)
      : watched[0]?.poster
    if (!src || isMobile) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = 50
        canvas.height = 75
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.drawImage(img, 0, 0, 50, 75)
        const { data } = ctx.getImageData(0, 0, 50, 75)
        let r = 0, g = 0, b = 0, count = 0
        for (let i = 0; i < data.length; i += 20) {
          r += data[i]; g += data[i + 1]; b += data[i + 2]; count++
        }
        r = Math.round(r / count)
        g = Math.round(g / count)
        b = Math.round(b / count)
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        if (max - min > 25) {
          setPosterGlow(`rgba(${r},${g},${b},0.22)`)
        }
      } catch {
        // CORS block — silently skip
      }
    }
    img.src = src
  }, [heroIndex, watchlist, watched, isMobile])

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
      }, 800)
    }, HERO_ROTATION_MS)
    return () => {
      clearInterval(interval)
      if (heroAdvanceTimerRef.current) clearTimeout(heroAdvanceTimerRef.current)
    }
  }, [watchlist.length])

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
        setTimeout(() => setIntroComplete(true), 400)
      }
    }, TYPING_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [heroMovie?.id])

  const handleAddToWatchlist = async (movie: Movie) => {
    const alreadyInLibrary = watched.some((m) => m.id === movie.id)
    if (alreadyInLibrary) {
      return { ok: false, message: "Already in your library — pick another one?" }
    }
    const success = await addToWatchlist(movie)
    if (success) {
      setWatchlist((prev) => [movie, ...prev])
      return { ok: true }
    }
    return { ok: false, message: "Already on your watchlist." }
  }

  const handleAddRecommendation = async (rec: Recommendation) => {
    const movie: Movie = {
      id: String(rec.tmdbId),
      title: rec.title,
      year: rec.year,
      language: rec.language,
      poster: rec.poster,
      backdrop: rec.backdrop || undefined,
    }
    const success = await addToWatchlist(movie)
    if (success) setWatchlist((prev) => [movie, ...prev])
    await reloadRecsAfterInteraction(rec.id)
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
        style={{ background: "var(--background-raised)" }}
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
      style={{ background: "var(--background-raised)", minHeight: "100vh" }}
    >
      <style>{`
        @keyframes blink { 50% { border-color: transparent; } }
      `}</style>

      <TopOverlayNav onSearchClick={() => setSearchOpen(true)} />

      {/* ─────────────── HERO ─────────────── */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          ...(isMobile
            ? {
                minHeight: "100svh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "84px 20px 56px",
                background:
                  "linear-gradient(180deg, var(--background-raised) 0%, var(--background-mid) 45%, var(--background-raised) 100%)",
              }
            : {
                height: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }),
        }}
      >
        {/* Animated ambient orb */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "50%",
            width: 600,
            height: 600,
            transform: "translateX(-50%)",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.075) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
            animation: "ambientDrift 18s ease-in-out infinite",
          }}
        />

        {/* Hero backdrop — parallax via backdropRef */}
        {!isMobile && heroMovie && (
          <div
            ref={backdropRef}
            style={{
              position: "absolute",
              inset: -100,
              backgroundImage: `url(${heroBackdrop})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "saturate(1.15) brightness(0.42)",
              transform: "scale(1.14)",
              opacity: heroVisualOpacity,
              transition: "opacity 0.9s cubic-bezier(0.33, 1, 0.68, 1)",
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: isMobile
              ? "radial-gradient(ellipse 90% 60% at 50% 20%, var(--tint-ghost) 0%, transparent 55%)"
              : "radial-gradient(ellipse at center, var(--vignette-soft) 0%, var(--vignette-deep) 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Empty-state hero */}
        {isEmpty ? (
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
        ) : (
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
              className="t-label"
              style={{
                color: "var(--accent-amber)",
                opacity: 0.85,
                marginBottom: isMobile ? 20 : 28,
                letterSpacing: "0.18em",
              }}
            >
              {watchlist.length > 0 ? "From your watchlist" : "From your library"}
            </div>

            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                opacity: heroVisualOpacity,
                transition: "opacity 0.9s cubic-bezier(0.33, 1, 0.68, 1)",
              }}
            >
              {/* Poster with color-matched glow behind it */}
              {heroMovie && (heroPoster || heroBackdrop) && (
                <div
                  style={{
                    position: "relative",
                    display: "inline-block",
                    marginBottom: isMobile ? 22 : 26,
                  }}
                >
                  {/* Glow div — color extracted from poster via canvas */}
                  {posterGlow && !isMobile && (
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "200%",
                        height: "200%",
                        background: `radial-gradient(circle, ${posterGlow} 0%, transparent 65%)`,
                        filter: "blur(52px)",
                        pointerEvents: "none",
                        zIndex: 0,
                        transition: "background 2s ease",
                      }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(`/movie/${heroMovie.id}`)}
                    onMouseMove={(e) => {
                      if (isMobile) return
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = ((e.clientY - rect.top) / rect.height - 0.5) * -10
                      const y = ((e.clientX - rect.left) / rect.width - 0.5) * 10
                      setPosterTilt({ x, y })
                    }}
                    onMouseLeave={() => setPosterTilt({ x: 0, y: 0 })}
                    style={{
                      position: "relative",
                      zIndex: 1,
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      borderRadius: 12,
                      overflow: "hidden",
                      width: isMobile ? "min(200px, 48vw)" : "min(280px, 24vw)",
                      flexShrink: 0,
                      boxShadow: "0 28px 56px var(--shadow-deep), 0 0 0 1px var(--border-default)",
                      transform: isMobile
                        ? "none"
                        : `perspective(900px) rotateX(${posterTilt.x}deg) rotateY(${posterTilt.y}deg)`,
                      transition:
                        posterTilt.x === 0 && posterTilt.y === 0
                          ? "transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
                          : "transform 0.12s ease-out",
                    }}
                    aria-label={`Open ${heroMovie.title}`}
                  >
                    <div style={{ position: "relative", aspectRatio: "2 / 3", width: "100%" }}>
                      <img
                        src={heroPoster || heroBackdrop || ""}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    </div>
                  </button>
                </div>
              )}

              {heroMovie && (
                <h1
                  className="t-display"
                  style={{
                    margin: 0,
                    maxWidth: 720,
                    color: "var(--text-strong)",
                    textShadow: "0 2px 14px var(--scrim-title)",
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
              )}

              {/* Hero metadata — uppercase, gold tint */}
              <p
                style={{
                  color: "rgba(245,197,24,0.55)",
                  marginTop: isMobile ? 14 : 18,
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-body)",
                  fontWeight: 500,
                  opacity: introComplete ? 1 : 0,
                  transform: introComplete ? "translateY(0)" : "translateY(8px)",
                  transition: "opacity 0.6s ease, transform 0.6s ease",
                }}
              >
                {heroMovie
                  ? `${formatLanguage(heroMovie.language)} · ${heroMovie.year}`
                  : ""}
              </p>

              {/* Primary CTA row */}
              {heroMovie && (
                <div
                  style={{
                    marginTop: isMobile ? 24 : 32,
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    justifyContent: "center",
                    opacity: introComplete ? 1 : 0,
                    transform: introComplete ? "translateY(0)" : "translateY(8px)",
                    transition: "opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s",
                  }}
                >
                  {/* Magnetic "Open details" — dark text on white, readable */}
                  <button
                    ref={magnetBtnRef}
                    type="button"
                    onClick={() => router.push(`/movie/${heroMovie.id}`)}
                    className="t-button"
                    style={{
                      color: "#0d0d0f",
                      background: "rgba(255,255,255,0.92)",
                      border: "none",
                      borderRadius: 999,
                      padding: "12px 28px",
                      cursor: "pointer",
                      transform: `translate(${magnetXY.x}px, ${magnetXY.y}px)`,
                      transition:
                        magnetXY.x !== 0 || magnetXY.y !== 0
                          ? "transform 0.1s ease-out, opacity 0.2s ease"
                          : "transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.88"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1"
                    }}
                  >
                    Open details
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    className="t-button"
                    style={{
                      color: "var(--text-emphasis)",
                      background: "transparent",
                      border: "1px solid var(--border-default)",
                      borderRadius: 999,
                      padding: "12px 24px",
                      cursor: "pointer",
                      transition: "color 0.2s ease, border-color 0.2s ease, background 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-strong)"
                      e.currentTarget.style.background = "var(--tint-hover)"
                      e.currentTarget.style.color = "var(--text-inverse)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-default)"
                      e.currentTarget.style.background = "transparent"
                      e.currentTarget.style.color = "var(--text-emphasis)"
                    }}
                  >
                    Search films
                  </button>
                </div>
              )}

              {isMobile && watchlist.length > 1 && (
                <p className="t-label" style={{ color: "var(--text-search)", marginTop: 20 }}>
                  {(heroIndex % watchlist.length) + 1} / {watchlist.length}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ─────────────── RECENTLY WATCHED ─────────────── */}
      {watched.length > 0 && (
        <section
          style={{
            position: "relative",
            padding: isMobile ? "56px 20px 80px" : "96px 56px 120px",
            background: "var(--background-raised)",
          }}
        >
          <div
            data-reveal
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 24,
              marginBottom: isMobile ? 28 : 40,
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: 560 }}>
              <h2 className="t-heading" style={{ margin: 0, color: "var(--text-strong)" }}>
                Recently watched
              </h2>
              <p className="t-meta" style={{ margin: 0, marginTop: 10, color: "var(--text-dim)" }}>
                The nights you&apos;ve already spent at the movies.
              </p>
            </div>
            {watched.length > recentlyWatchedDisplayCount && (
              <SectionLink href="/library">View your library →</SectionLink>
            )}
          </div>

          {/* Broken grid — first card spans 2 cols on desktop (featured) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(auto-fill, minmax(160px, 1fr))",
              gap: isMobile ? 20 : 28,
            }}
          >
            {watched.slice(0, recentlyWatchedDisplayCount).map((film, i) => (
              <div
                key={film.id}
                data-reveal
                style={{
                  "--reveal-i": i,
                  ...(i === 0 && !isMobile ? { gridColumn: "span 2" } : {}),
                } as CSSProperties}
              >
                <PolaroidCard
                  film={film}
                  onClick={() => router.push(`/movie/${film.id}`)}
                  featured={i === 0 && !isMobile}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─────────────── RECOMMENDATIONS ─────────────── */}
      <section
        style={{
          padding: isMobile ? "56px 20px 72px" : "96px 56px 112px",
          background: "var(--background-sunken)",
          position: "relative",
          overflow: "hidden",
        }}
      >
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

        <div
          data-reveal
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 24,
            marginBottom: isMobile ? 28 : 40,
            flexWrap: "wrap",
            position: "relative",
          }}
        >
          <div style={{ maxWidth: 560 }}>
            <h2 className="t-heading" style={{ margin: 0, color: "var(--text-display)" }}>
              Picked for you
            </h2>
            <p className="t-meta" style={{ margin: 0, marginTop: 10, color: "var(--text-dim)" }}>
              Based on the films you&apos;ve rated.
            </p>
          </div>
          {recommendations.length > 0 && !recsLoading && (
            <button
              type="button"
              onClick={() => handleRefreshRecommendations()}
              className="t-button"
              style={{
                color: "var(--text-emphasis)",
                background: "var(--tint-base)",
                border: "1px solid var(--border-default)",
                borderRadius: 999,
                padding: "10px 20px",
                cursor: "pointer",
                transition: "color 0.2s ease, border-color 0.2s ease, background 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-inverse)"
                e.currentTarget.style.borderColor = "var(--border-strong)"
                e.currentTarget.style.background = "var(--tint-hover)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-emphasis)"
                e.currentTarget.style.borderColor = "var(--border-default)"
                e.currentTarget.style.background = "var(--tint-base)"
              }}
            >
              Refresh
            </button>
          )}
        </div>

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
                <div
                  key={rec.id || `${rec.tmdbId}-${i}`}
                  data-reveal
                  style={{ "--reveal-i": i } as CSSProperties}
                >
                  <RecommendationCard
                    rec={rec}
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
      {watchlist.length > 0 && (
        <section
          style={{
            position: "relative",
            padding: isMobile ? "56px 0 72px" : "96px 0 112px",
            background: "var(--background-raised)",
          }}
        >
          <div
            data-reveal
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 24,
              marginBottom: isMobile ? 28 : 40,
              flexWrap: "wrap",
              padding: isMobile ? "0 20px" : "0 56px",
            }}
          >
            <div style={{ maxWidth: 560 }}>
              <h2 className="t-heading" style={{ margin: 0, color: "var(--text-strong)" }}>
                Want to watch
              </h2>
              <p className="t-meta" style={{ margin: 0, marginTop: 10, color: "var(--text-dim)" }}>
                Your upcoming screenings.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!isMobile && watchlist.length > 4 && (
                <>
                  <RailButton direction="left" onClick={() => scrollWatchlistRail("left")} />
                  <RailButton direction="right" onClick={() => scrollWatchlistRail("right")} />
                </>
              )}
              <SectionLink href="/watchlist">View all →</SectionLink>
            </div>
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
                background: "linear-gradient(to right, var(--background-raised), transparent)",
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
              {watchlist.map((film) => (
                <Link
                  key={film.id}
                  href={`/movie/${film.id}`}
                  style={{
                    flex: "0 0 auto",
                    width: isMobile ? 140 : 170,
                    scrollSnapAlign: "start",
                    textDecoration: "none",
                    display: "block",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "2 / 3",
                      overflow: "hidden",
                      borderRadius: 8,
                      boxShadow:
                        "0 2px 4px rgba(0,0,0,0.4), 0 10px 24px rgba(0,0,0,0.55), 0 28px 48px rgba(0,0,0,0.35)",
                      transition: "transform 0.25s ease, box-shadow 0.25s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-5px) scale(1.02)"
                      e.currentTarget.style.boxShadow =
                        "0 4px 8px rgba(0,0,0,0.5), 0 16px 40px rgba(0,0,0,0.65), 0 40px 64px rgba(0,0,0,0.45)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0) scale(1)"
                      e.currentTarget.style.boxShadow =
                        "0 2px 4px rgba(0,0,0,0.4), 0 10px 24px rgba(0,0,0,0.55), 0 28px 48px rgba(0,0,0,0.35)"
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
                background: "linear-gradient(to left, var(--background-raised), transparent)",
                pointerEvents: "none",
              }}
            />
          </div>
        </section>
      )}

      {/* ─────────────── FOOTER ─────────────── */}
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
          className="t-caption"
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            color: "var(--text-footer)",
          }}
        >
          First Day First Show
        </p>
      </footer>

      {searchOpen && (
        <MovieSearch onAdd={handleAddToWatchlist} onClose={() => setSearchOpen(false)} />
      )}
    </main>
  )
}

function RecommendationCard({
  rec,
  onOpen,
  onAdd,
  onDismiss,
}: {
  rec: Recommendation
  onOpen: () => void
  onAdd: () => void
  onDismiss: () => void
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
        <div
          style={{
            aspectRatio: "2 / 3",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow:
              "0 2px 4px rgba(0,0,0,0.4), 0 10px 24px rgba(0,0,0,0.55), 0 28px 48px rgba(0,0,0,0.35)",
            transition: "transform 0.25s ease, box-shadow 0.25s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-5px) scale(1.02)"
            e.currentTarget.style.boxShadow =
              "0 4px 8px rgba(0,0,0,0.5), 0 16px 40px rgba(0,0,0,0.65), 0 40px 64px rgba(0,0,0,0.45)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)"
            e.currentTarget.style.boxShadow =
              "0 2px 4px rgba(0,0,0,0.4), 0 10px 24px rgba(0,0,0,0.55), 0 28px 48px rgba(0,0,0,0.35)"
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
                background:
                  "linear-gradient(145deg, var(--background-elevated), var(--background-sunken))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: "var(--text-faint-ui)", fontSize: 12 }}>No poster</span>
            </div>
          )}
        </div>
      </button>

      <div>
        <button
          type="button"
          onClick={onOpen}
          className="t-title"
          style={{
            display: "block",
            width: "100%",
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
            color: "var(--text-emphasis)",
          }}
        >
          {rec.title}
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
