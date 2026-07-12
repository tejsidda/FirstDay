"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  getWatchlist,
  getWatched,
  markAsWatchedDetailed,
  messageForMarkWatchedFailure,
  removeFromWatchlist,
  addToWatchlistDetailed,
  messageForAddToWatchlistFailure,
} from "@/lib/db"
import type { Movie } from "@/lib/types"
import { formatLanguage } from "@/lib/tmdb"
import StandingOvationInput from "@/components/StandingOvationInput"
import MovieSearch from "@/components/MovieSearch"
import FilterChip from "@/components/FilterChip"
import { MOBILE_TAB_BAR_INSET, useIsMobile } from "@/hooks/useIsMobile"

function FilmFrame({
  film,
  isCentered,
  onPosterClick,
  onTitleClick,
}: {
  film: Movie
  isCentered: boolean
  onPosterClick: () => void
  onTitleClick: () => void
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        width: 280,
        transition: "all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        transform: isCentered ? "scale(1.15)" : "scale(0.85)",
        opacity: isCentered ? 1 : 0.35,
        filter: isCentered ? "brightness(1)" : "brightness(0.6)",
        zIndex: isCentered ? 10 : 1,
      }}
    >
      <div
        style={{
          background: "var(--background-base)",
          borderRadius: 4,
          padding: "12px 8px 14px 8px",
          boxShadow: isCentered
            ? "0 20px 60px rgba(19,18,17,0.8), 0 0 30px rgba(255,255,255,0.03)"
            : "0 4px 16px rgba(19,18,17,0.4)",
          transition: "box-shadow 0.5s ease",
        }}
      >
        <button
          type="button"
          aria-label={`Open ${film.title}`}
          onClick={(e) => {
            e.stopPropagation()
            onPosterClick()
          }}
          style={{
            display: "block",
            width: "100%",
            padding: 0,
            border: "none",
            background: "none",
            cursor: "pointer",
            borderRadius: 2,
          }}
        >
          <div style={{ aspectRatio: "2/3", overflow: "hidden", borderRadius: 2 }}>
            <img
              src={film.poster}
              alt=""
              onError={(e) => {
                e.currentTarget.src = "/fallback-poster.jpg"
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                pointerEvents: "none",
              }}
            />
          </div>
        </button>

        <div
          style={{
            marginTop: 10,
            textAlign: "center",
            flexShrink: 0,
            minHeight: isCentered ? 48 : 36,
          }}
        >
          <button
            type="button"
            className={isCentered ? "t-title" : "t-caption"}
            aria-label={`Copy title: ${film.title}`}
            title="Copy title"
            onClick={(e) => {
              e.stopPropagation()
              onTitleClick()
            }}
            style={{
              fontStyle: "italic",
              fontFamily: "var(--font-display)",
              color: isCentered
                ? "rgba(255,255,255,0.85)"
                : "rgba(255,255,255,0.3)",
              transition: "all 0.5s ease",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "copy",
              width: "100%",
            }}
          >
            {film.title}
          </button>
          {isCentered && (
            <div
              className="t-caption"
              style={{
                color: "rgba(255,255,255,0.45)",
                marginTop: 6,
                transition: "opacity 0.3s ease",
              }}
            >
              {formatLanguage(film.language)}
              {film.year != null ? ` · ${film.year}` : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SprocketRow() {
  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        paddingLeft: 10,
        overflow: "hidden",
        height: 10,
      }}
    >
      {Array.from({ length: 200 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 7,
            borderRadius: 1.5,
            background: "rgba(255,255,255,0.035)",
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}

const CARD_WIDTH = 280
const CARD_GAP = 20
const CARD_TOTAL = CARD_WIDTH + CARD_GAP

function filmHasGenre(film: Movie, genre: string) {
  return (film.genres || []).some((g) => g.name === genre)
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<Movie[]>([])
  const [watched, setWatched] = useState<Movie[]>([])
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handler = () => setSearchOpen(true)
    window.addEventListener("fdfs:open-search", handler)
    return () => window.removeEventListener("fdfs:open-search", handler)
  }, [])
  const [centeredIndex, setCenteredIndex] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [showReviewStep, setShowReviewStep] = useState(false)
  const [pendingRating, setPendingRating] = useState<number | null>(null)
  const [reviewText, setReviewText] = useState("")
  const [alreadyWatchedEarlier, setAlreadyWatchedEarlier] = useState(false)
  const [watchedDate, setWatchedDate] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copyHint, setCopyHint] = useState<string | null>(null)
  const router = useRouter()
  const stripRef = useRef<HTMLDivElement>(null)
  const scrollTickingRef = useRef(false)
  const copyHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const [films, seen] = await Promise.all([getWatchlist(), getWatched()])
      if (!active) return
      setWatchlist(films)
      setWatched(seen)
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const suggestedGenres = useMemo(() => {
    const recent = [...watched]
      .filter((w) => w.watchedAt)
      .sort(
        (a, b) =>
          new Date(b.watchedAt!).getTime() - new Date(a.watchedAt!).getTime(),
      )
      .slice(0, 12)

    const counts = new Map<string, number>()
    for (const film of recent) {
      for (const g of film.genres || []) {
        counts.set(g.name, (counts.get(g.name) || 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name)
  }, [watched])

  const pickPoolIndices = useMemo(() => {
    if (!selectedGenre) {
      return watchlist.map((_, i) => i)
    }
    return watchlist
      .map((film, i) => (filmHasGenre(film, selectedGenre) ? i : -1))
      .filter((i) => i >= 0)
  }, [watchlist, selectedGenre])

  const modalBottom = isMobile
    ? `calc(${MOBILE_TAB_BAR_INSET} + 16px)`
    : "max(100px, calc(24px + env(safe-area-inset-bottom, 0px)))"

  const navTopPad = isMobile ? 56 : 72

  const handleAdd = async (movie: Movie) => {
    const result = await addToWatchlistDetailed(movie)
    if (result.ok) {
      const fresh = await getWatchlist()
      setWatchlist(fresh)
      return { ok: true }
    }
    return {
      ok: false,
      message: messageForAddToWatchlistFailure(result.reason),
    }
  }

  useEffect(() => {
    setShowRating(false)
    setShowReviewStep(false)
    setPendingRating(null)
    setReviewText("")
    setAlreadyWatchedEarlier(false)
    setWatchedDate("")
  }, [centeredIndex])

  const getTodayDateInput = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const dateInputToIso = (value: string) => {
    const [year, month, day] = value.split("-").map(Number)
    if (!year || !month || !day) return new Date().toISOString()
    return new Date(year, month - 1, day, 12, 0, 0).toISOString()
  }

  const syncStripToIndex = useCallback(
    (index: number, length: number, options?: { setState?: boolean }) => {
    if (!stripRef.current || length <= 0) return
    const idx = Math.max(0, Math.min(index, length - 1))
    stripRef.current.scrollTo({ left: idx * CARD_TOTAL, behavior: "smooth" })
    if (options?.setState !== false) setCenteredIndex(idx)
  }, []
  )

  const scrollStrip = useCallback(
    (direction: -1 | 1) => {
      if (watchlist.length <= 1) return
      setCenteredIndex((prev) => {
        const pool =
          selectedGenre && pickPoolIndices.length > 0
            ? pickPoolIndices
            : watchlist.map((_, i) => i)
        const pos = pool.indexOf(prev)
        if (pos < 0) {
          const fallback = pool[0]
          syncStripToIndex(fallback, watchlist.length, { setState: false })
          return fallback
        }
        const nextPos = pos + direction
        if (nextPos < 0 || nextPos >= pool.length) return prev
        const next = pool[nextPos]
        syncStripToIndex(next, watchlist.length, { setState: false })
        return next
      })
    },
    [watchlist.length, selectedGenre, pickPoolIndices, syncStripToIndex]
  )

  // Keep the centered poster in sync when a genre filter is active
  useEffect(() => {
    if (!selectedGenre || pickPoolIndices.length === 0) return
    if (pickPoolIndices.includes(centeredIndex)) return
    syncStripToIndex(pickPoolIndices[0], watchlist.length)
  }, [selectedGenre, pickPoolIndices, centeredIndex, watchlist.length, syncStripToIndex])

  const showCopyHint = useCallback((message: string) => {
    setCopyHint(message)
    if (copyHintTimerRef.current) clearTimeout(copyHintTimerRef.current)
    copyHintTimerRef.current = setTimeout(() => setCopyHint(null), 2000)
  }, [])

  const copyFilmTitle = useCallback(
    async (film: Movie) => {
      try {
        await navigator.clipboard.writeText(film.title)
        showCopyHint(`Copied “${film.title}”`)
        return
      } catch {
        /* fallback below */
      }
      try {
        const ta = document.createElement("textarea")
        ta.value = film.title
        ta.style.position = "fixed"
        ta.style.left = "-9999px"
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
        showCopyHint(`Copied “${film.title}”`)
      } catch {
        showCopyHint("Couldn’t copy — try again")
      }
    },
    [showCopyHint],
  )

  const openFilmPage = useCallback(
    (index: number) => {
      const film = watchlist[index]
      if (!film) return
      router.push(`/movie/${film.id}`)
    },
    [watchlist, router],
  )

  useEffect(() => {
    return () => {
      if (copyHintTimerRef.current) clearTimeout(copyHintTimerRef.current)
    }
  }, [])

  // Keyboard: Left/Right arrows move the strip one film at a time
  useEffect(() => {
    if (watchlist.length <= 1) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
      const t = e.target as HTMLElement
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable
      ) {
        return
      }
      e.preventDefault()
      if (e.key === "ArrowLeft") scrollStrip(-1)
      else scrollStrip(1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [watchlist.length, scrollStrip])

  const handleMarkWatched = async (
    film: Movie,
    rating: number,
    reviewBody?: string,
    watchedAt?: string
  ) => {
    if (actionLoading) return
    setActionLoading(true)
    setActionError(null)
    try {
      const result = await markAsWatchedDetailed(film, rating, {
        reviewBody,
        watchedAt,
      })
      if (!result.ok) {
        setActionError(messageForMarkWatchedFailure(result.reason))
        return
      }
      // Refetch from DB rather than trusting optimistic state
      const fresh = await getWatchlist()
      setWatchlist(fresh)
      if (fresh.length === 0) {
        setCenteredIndex(0)
      } else {
        const nextIndex =
          centeredIndex >= fresh.length
            ? fresh.length - 1
            : Math.min(centeredIndex, fresh.length - 1)
        syncStripToIndex(nextIndex, fresh.length)
      }
      setShowRating(false)
      setShowReviewStep(false)
      setPendingRating(null)
      setReviewText("")
      setAlreadyWatchedEarlier(false)
      setWatchedDate("")
    } finally {
      setActionLoading(false)
    }
  }

  const handleRatingSelected = (rating: number) => {
    setPendingRating(rating)
    setShowRating(false)
    setShowReviewStep(true)
    setReviewText("")
    setAlreadyWatchedEarlier(false)
    setWatchedDate(getTodayDateInput())
  }

  const submitWatchedFlow = (skipReview: boolean) => {
    const film = watchlist[centeredIndex]
    if (!film || pendingRating == null) return
    const watchedAt = alreadyWatchedEarlier && watchedDate
      ? dateInputToIso(watchedDate)
      : new Date().toISOString()
    const reviewBody = skipReview ? undefined : reviewText
    handleMarkWatched(film, pendingRating, reviewBody, watchedAt)
  }

  const handleRemove = async (film: Movie) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      const success = await removeFromWatchlist(film.id)
      if (success) {
        const updated = watchlist.filter((m) => m.id !== film.id)
        if (updated.length === 0) {
          setWatchlist([])
          setCenteredIndex(0)
          return
        }
        setWatchlist(updated)
        const nextIndex =
          centeredIndex >= updated.length && updated.length > 0
            ? updated.length - 1
            : Math.min(centeredIndex, Math.max(0, updated.length - 1))
        syncStripToIndex(nextIndex, updated.length)
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleStripScroll = useCallback(() => {
    if (isSpinning || !stripRef.current) return
    if (scrollTickingRef.current) return
    scrollTickingRef.current = true
    requestAnimationFrame(() => {
      const el = stripRef.current
      if (!el) {
        scrollTickingRef.current = false
        return
      }
      const scrollLeft = el.scrollLeft
      const index = Math.floor((scrollLeft + CARD_TOTAL / 2) / CARD_TOTAL)
      const clamped = Math.max(0, Math.min(index, watchlist.length - 1))
      setCenteredIndex((prev) => (prev === clamped ? prev : clamped))
      scrollTickingRef.current = false
    })
  }, [isSpinning, watchlist.length])

  const handleSpin = useCallback(() => {
    if (isSpinning || watchlist.length === 0 || !stripRef.current) return

    const pool =
      pickPoolIndices.length > 0
        ? pickPoolIndices
        : watchlist.map((_, i) => i)

    if (pool.length === 0) return

    setIsSpinning(true)

    const randomIndex = pool[Math.floor(Math.random() * pool.length)]
    const targetScroll = randomIndex * CARD_TOTAL
    const startScroll = stripRef.current.scrollLeft
    const totalDistance = watchlist.length * CARD_TOTAL * 2 + targetScroll
    const duration = 3000
    const startTime = Date.now()
    const strip = stripRef.current

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)

      if (strip) {
        const raw = startScroll + eased * totalDistance
        const wrapped = raw % (watchlist.length * CARD_TOTAL)
        strip.scrollLeft = wrapped
      }

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        if (strip) {
          strip.scrollTo({ left: targetScroll, behavior: "smooth" })
        }
        setCenteredIndex(randomIndex)
        setTimeout(() => setIsSpinning(false), 500)
      }
    }

    requestAnimationFrame(animate)
  }, [isSpinning, watchlist.length, pickPoolIndices])

  if (loading) {
    return (
      <main
        style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          background: "var(--background-base)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p className="t-meta" style={{ color: "rgba(255,255,255,0.25)" }}>
          Threading the reel...
        </p>
      </main>
    )
  }

  return (
    <main
      className="page-with-mobile-tabs"
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "var(--background-base)",
        display: watchlist.length > 0 ? "flex" : "block",
        flexDirection: watchlist.length > 0 ? "column" : undefined,
      }}
    >
      <style>{`
        .film-strip::-webkit-scrollbar { display: none; }
        .no-snap { scroll-snap-type: none !important; }
      `}</style>

      {/* Flat canvas — poster color handled locally on cards, not global ambient */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--background-base)",
          zIndex: 0,
        }}
      />


      {watchlist.length === 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <p className="t-sub" style={{ color: "rgba(255,255,255,0.4)" }}>
            The reel is empty.
          </p>
          <p
            className="t-meta"
            style={{ color: "rgba(255,255,255,0.2)", marginTop: 8 }}
          >
            Search for a film and add it to your watchlist.
          </p>
        </div>
      ) : (
        <div
          style={{
            position: "relative",
            zIndex: 10,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            paddingTop: navTopPad,
          }}
        >
          {/* Genre filters — fixed row, no overlap with reel */}
          <section
            aria-label="Genre filters"
            style={{
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              width: "min(640px, calc(100vw - 32px))",
              margin: "0 auto",
              padding: "8px 16px 4px",
            }}
          >
            {suggestedGenres.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  justifyContent: "center",
                }}
              >
                <FilterChip
                  label="All"
                  active={selectedGenre === null}
                  onClick={() => setSelectedGenre(null)}
                />
                {suggestedGenres.map((genre) => (
                  <FilterChip
                    key={genre}
                    label={genre}
                    active={selectedGenre === genre}
                    onClick={() =>
                      setSelectedGenre((prev) =>
                        prev === genre ? null : genre,
                      )
                    }
                  />
                ))}
              </div>
            )}
            <p
              className="t-caption"
              style={{
                margin: 0,
                textAlign: "center",
                color: "rgba(255,255,255,0.35)",
                maxWidth: 420,
              }}
            >
              {suggestedGenres.length > 0
                ? "Genres from your recent watches — pick one, then spin the reel."
                : "Rate a few films and we’ll suggest genres from what you’ve been watching."}
            </p>
            {selectedGenre != null && pickPoolIndices.length === 0 && (
              <p
                className="t-caption"
                style={{ margin: 0, color: "rgba(255,180,180,0.7)" }}
              >
                Nothing on your watchlist matches {selectedGenre} yet.
              </p>
            )}
          </section>

          {/* Film reel — fills space between genre bar and action dock */}
          <section
            aria-label="Watchlist reel"
            style={{
              flex: 1,
              minHeight: 0,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <SprocketRow />

            <div
              ref={stripRef}
              className={`film-strip ${isSpinning ? "no-snap" : ""}`}
              onScroll={handleStripScroll}
              style={{
                display: "flex",
                alignItems: "center",
                gap: CARD_GAP,
                overflowX: "auto",
                overflowY: "hidden",
                paddingLeft: `calc(50vw - ${CARD_WIDTH / 2}px)`,
                paddingRight: `calc(50vw - ${CARD_WIDTH / 2}px)`,
                paddingTop: 24,
                paddingBottom: 32,
                scrollBehavior: isSpinning ? "auto" : "smooth",
                scrollSnapType: isSpinning ? "none" : "x mandatory",
                scrollbarWidth: "none",
                msOverflowStyle: "none" as const,
              }}
            >
              {watchlist.map((film, i) => (
                <div key={film.id} style={{ scrollSnapAlign: "center" }}>
                  <FilmFrame
                    film={film}
                    isCentered={i === centeredIndex}
                    onPosterClick={() => openFilmPage(i)}
                    onTitleClick={() => copyFilmTitle(film)}
                  />
                </div>
              ))}
            </div>

            <SprocketRow />

          {/* Left / right strip navigation */}
          {watchlist.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous film"
                disabled={
                  selectedGenre && pickPoolIndices.length > 0
                    ? pickPoolIndices.indexOf(centeredIndex) <= 0
                    : centeredIndex <= 0
                }
                onClick={() => scrollStrip(-1)}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 16,
                  margin: "auto 0",
                  zIndex: 25,
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background:
                    (selectedGenre && pickPoolIndices.length > 0
                      ? pickPoolIndices.indexOf(centeredIndex) <= 0
                      : centeredIndex <= 0)
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(255,255,255,0.06)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color:
                    (selectedGenre && pickPoolIndices.length > 0
                      ? pickPoolIndices.indexOf(centeredIndex) <= 0
                      : centeredIndex <= 0)
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.5)",
                  cursor:
                    (selectedGenre && pickPoolIndices.length > 0
                      ? pickPoolIndices.indexOf(centeredIndex) <= 0
                      : centeredIndex <= 0)
                      ? "default"
                      : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  const atStart =
                    selectedGenre && pickPoolIndices.length > 0
                      ? pickPoolIndices.indexOf(centeredIndex) <= 0
                      : centeredIndex <= 0
                  if (atStart) return
                  e.currentTarget.style.background = "rgba(255,255,255,0.12)"
                  e.currentTarget.style.color = "rgba(255,255,255,0.9)"
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"
                }}
                onMouseLeave={(e) => {
                  const atStart =
                    selectedGenre && pickPoolIndices.length > 0
                      ? pickPoolIndices.indexOf(centeredIndex) <= 0
                      : centeredIndex <= 0
                  if (atStart) return
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)"
                  e.currentTarget.style.color = "rgba(255,255,255,0.5)"
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Next film"
                disabled={
                  selectedGenre && pickPoolIndices.length > 0
                    ? pickPoolIndices.indexOf(centeredIndex) >=
                      pickPoolIndices.length - 1
                    : centeredIndex >= watchlist.length - 1
                }
                onClick={() => scrollStrip(1)}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  right: 16,
                  margin: "auto 0",
                  zIndex: 25,
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background:
                    (selectedGenre && pickPoolIndices.length > 0
                      ? pickPoolIndices.indexOf(centeredIndex) >=
                        pickPoolIndices.length - 1
                      : centeredIndex >= watchlist.length - 1)
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(255,255,255,0.06)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color:
                    (selectedGenre && pickPoolIndices.length > 0
                      ? pickPoolIndices.indexOf(centeredIndex) >=
                        pickPoolIndices.length - 1
                      : centeredIndex >= watchlist.length - 1)
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.5)",
                  cursor:
                    (selectedGenre && pickPoolIndices.length > 0
                      ? pickPoolIndices.indexOf(centeredIndex) >=
                        pickPoolIndices.length - 1
                      : centeredIndex >= watchlist.length - 1)
                      ? "default"
                      : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  const atEnd =
                    selectedGenre && pickPoolIndices.length > 0
                      ? pickPoolIndices.indexOf(centeredIndex) >=
                        pickPoolIndices.length - 1
                      : centeredIndex >= watchlist.length - 1
                  if (atEnd) return
                  e.currentTarget.style.background = "rgba(255,255,255,0.12)"
                  e.currentTarget.style.color = "rgba(255,255,255,0.9)"
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"
                }}
                onMouseLeave={(e) => {
                  const atEnd =
                    selectedGenre && pickPoolIndices.length > 0
                      ? pickPoolIndices.indexOf(centeredIndex) >=
                        pickPoolIndices.length - 1
                      : centeredIndex >= watchlist.length - 1
                  if (atEnd) return
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)"
                  e.currentTarget.style.color = "rgba(255,255,255,0.5)"
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </>
          )}

            {/* Center frame indicator */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                zIndex: 5,
              }}
            >
              <div
                style={{
                  width: CARD_WIDTH + 40,
                  height: "min(480px, 72%)",
                  border: "1px solid rgba(255,255,255,0.035)",
                  borderRadius: 8,
                }}
              />
            </div>
          </section>

          {/* Action dock — below reel, never on top of posters */}
          {watchlist[centeredIndex] && (
            <section
              aria-label="Film actions"
              style={{
                flexShrink: 0,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: isMobile ? "8px 16px 4px" : "12px 16px 20px",
              }}
            >
              <button
                type="button"
                onClick={handleSpin}
                disabled={
                  isSpinning ||
                  (selectedGenre != null && pickPoolIndices.length === 0)
                }
                className="t-button"
                style={{
                  color:
                    isSpinning ||
                    (selectedGenre != null && pickPoolIndices.length === 0)
                      ? "rgba(255,255,255,0.35)"
                      : "var(--background-base)",
                  background:
                    isSpinning ||
                    (selectedGenre != null && pickPoolIndices.length === 0)
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 999,
                  padding: "12px 28px",
                  cursor:
                    isSpinning ||
                    (selectedGenre != null && pickPoolIndices.length === 0)
                      ? "default"
                      : "pointer",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  transition: "all 0.3s ease",
                }}
              >
                {isSpinning
                  ? "Finding your film…"
                  : selectedGenre
                    ? `Pick a ${selectedGenre} film`
                    : "Pick something for tonight"}
              </button>

              <div className="t-label" style={{ color: "rgba(255,255,255,0.2)" }}>
                {centeredIndex + 1} of {watchlist.length}
              </div>
              {!showRating && !showReviewStep && (
                <p
                  className="t-caption"
                  style={{
                    margin: 0,
                    color: "rgba(255,255,255,0.28)",
                    maxWidth: 320,
                  }}
                >
                  Tap title to copy · tap poster to open
                </p>
              )}

              {!showRating && !actionLoading && (
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPendingRating(null)
                      setShowReviewStep(false)
                      setShowRating(true)
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.06)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.5)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.12)"
                      e.currentTarget.style.color = "rgba(255,255,255,0.8)"
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)"
                      e.currentTarget.style.color = "rgba(255,255,255,0.5)"
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"
                    }}
                    title="Mark as watched"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(watchlist[centeredIndex])
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.3)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,100,100,0.08)"
                      e.currentTarget.style.color = "rgba(255,150,150,0.6)"
                      e.currentTarget.style.borderColor = "rgba(255,100,100,0.15)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)"
                      e.currentTarget.style.color = "rgba(255,255,255,0.3)"
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"
                    }}
                    title="Remove from watchlist"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}

              {showRating && !actionLoading && (
                <>
                  <div
                    role="presentation"
                    aria-hidden
                    onClick={() => setShowRating(false)}
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 34,
                      background: "rgba(8,8,10,0.72)",
                      backdropFilter: "blur(6px)",
                      WebkitBackdropFilter: "blur(6px)",
                    }}
                  />
                  <div
                    role="dialog"
                    aria-label="Rate this film"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "fixed",
                      left: "50%",
                      bottom: modalBottom,
                      transform: "translateX(-50%)",
                      zIndex: 36,
                      width: "min(440px, calc(100vw - 32px))",
                      padding: "22px 24px 20px",
                      borderRadius: 14,
                      background: "rgba(24,24,26,0.96)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
                    }}
                  >
                    <div
                      className="t-title-sm"
                      style={{
                        color: "rgba(255,255,255,0.75)",
                        textAlign: "center",
                        marginBottom: 14,
                      }}
                    >
                      {watchlist[centeredIndex]?.title}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 14,
                      }}
                    >
                      <div style={{ width: "100%", maxWidth: 400 }}>
                        <StandingOvationInput
                          value={pendingRating}
                          onChange={(r) => {
                            handleRatingSelected(r)
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowRating(false)
                          setPendingRating(null)
                        }}
                        className="t-button-sm"
                        style={{
                          color: "rgba(255,255,255,0.35)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "4px 8px",
                        }}
                      >
                        cancel
                      </button>
                    </div>
                  </div>
                </>
              )}

              {showReviewStep && !actionLoading && (
                <>
                  <div
                    role="presentation"
                    aria-hidden
                    onClick={() => {
                      setShowReviewStep(false)
                      setPendingRating(null)
                    }}
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 34,
                      background: "rgba(8,8,10,0.72)",
                      backdropFilter: "blur(6px)",
                      WebkitBackdropFilter: "blur(6px)",
                    }}
                  />
                  <div
                    role="dialog"
                    aria-label="Add optional review"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "fixed",
                      left: "50%",
                      bottom: modalBottom,
                      transform: "translateX(-50%)",
                      zIndex: 36,
                      width: "min(520px, calc(100vw - 32px))",
                      padding: "22px 24px 20px",
                      borderRadius: 14,
                      background: "rgba(24,24,26,0.96)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
                    }}
                  >
                    <div
                      className="t-title-sm"
                      style={{
                        color: "rgba(255,255,255,0.75)",
                        textAlign: "center",
                        marginBottom: 14,
                      }}
                    >
                      {watchlist[centeredIndex]?.title}
                      {pendingRating != null ? ` · ${pendingRating}/10` : ""}
                    </div>

                    <div style={{ display: "grid", gap: 12 }}>
                      <label
                        className="t-label"
                        style={{ color: "rgba(255,255,255,0.45)" }}
                      >
                        Optional review
                      </label>
                      <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="Write a quick thought... (optional)"
                        rows={4}
                        className="t-body"
                        style={{
                          width: "100%",
                          resize: "vertical",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(255,255,255,0.04)",
                          color: "rgba(255,255,255,0.86)",
                          padding: "10px 12px",
                          outline: "none",
                        }}
                      />

                      <label
                        className="t-label-value"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          color: "rgba(255,255,255,0.62)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={alreadyWatchedEarlier}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setAlreadyWatchedEarlier(checked)
                            if (checked && !watchedDate) setWatchedDate(getTodayDateInput())
                          }}
                        />
                        Already watched earlier?
                      </label>

                      {alreadyWatchedEarlier && (
                        <div style={{ display: "grid", gap: 6 }}>
                          <label
                            className="t-label"
                            style={{ color: "rgba(255,255,255,0.45)" }}
                          >
                            Watched on
                          </label>
                          <input
                            type="date"
                            value={watchedDate}
                            max={getTodayDateInput()}
                            onChange={(e) => setWatchedDate(e.target.value)}
                            className="t-label-value"
                            style={{
                              borderRadius: 10,
                              border: "1px solid rgba(255,255,255,0.12)",
                              background: "rgba(255,255,255,0.04)",
                              color: "rgba(255,255,255,0.86)",
                              padding: "10px 12px",
                              outline: "none",
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowReviewStep(false)
                          setPendingRating(null)
                        }}
                        className="t-button-sm"
                        style={{
                          color: "rgba(255,255,255,0.35)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "6px 8px",
                        }}
                      >
                        cancel
                      </button>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            submitWatchedFlow(true)
                          }}
                          className="t-button-sm"
                          style={{
                            color: "rgba(255,255,255,0.7)",
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.14)",
                            borderRadius: 8,
                            padding: "8px 12px",
                            cursor: "pointer",
                          }}
                        >
                          Skip review
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            submitWatchedFlow(false)
                          }}
                          className="t-button-sm"
                          style={{
                            color: "rgba(20,20,22,0.9)",
                            background: "rgba(255,255,255,0.9)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: 8,
                            padding: "8px 12px",
                            cursor: "pointer",
                          }}
                        >
                          Save watched entry
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {actionLoading && (
                <p
                  className="t-meta"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  Updating...
                </p>
              )}

              {copyHint && !actionLoading && (
                <p
                  className="t-caption"
                  style={{
                    color: "rgba(180,220,180,0.85)",
                    maxWidth: 360,
                  }}
                >
                  {copyHint}
                </p>
              )}

              {actionError && !actionLoading && (
                <p
                  className="t-caption"
                  style={{
                    color: "rgba(255,180,180,0.75)",
                    maxWidth: 360,
                  }}
                >
                  {actionError}
                </p>
              )}
            </section>
          )}
        </div>
      )}

      {searchOpen && (
        <MovieSearch onAdd={handleAdd} onClose={() => setSearchOpen(false)} />
      )}
    </main>
  )
}
