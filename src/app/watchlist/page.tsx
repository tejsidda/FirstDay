"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  getWatchlist,
  getWatched,
  markAsWatched,
  removeFromWatchlist,
  addToWatchlist,
} from "@/lib/db"
import type { Movie } from "@/lib/types"
import { formatLanguage, getMovieDetails } from "@/lib/tmdb"
import StandingOvationInput from "@/components/StandingOvationInput"
import TopOverlayNav from "@/components/TopOverlayNav"
import MovieSearch from "@/components/MovieSearch"
import FilterChip from "@/components/FilterChip"

const DEFAULT_AMBIENT: [number, number, number] = [45, 38, 28]

function extractAmbientRgb(imageUrl: string): Promise<[number, number, number]> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = 24
      canvas.height = 24
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        img.onload = null
        img.onerror = null
        resolve(DEFAULT_AMBIENT)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      let pixels: Uint8ClampedArray
      try {
        pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      } catch {
        img.onload = null
        img.onerror = null
        resolve(DEFAULT_AMBIENT)
        return
      }
      let r = 0, g = 0, b = 0, count = 0
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 16) continue
        r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count++
      }
      if (count === 0) {
        img.onload = null
        img.onerror = null
        resolve(DEFAULT_AMBIENT)
        return
      }
      const soften = (v: number) => Math.max(20, Math.min(190, Math.round(v * 0.82 + 14)))
      img.onload = null
      img.onerror = null
      resolve([soften(r / count), soften(g / count), soften(b / count)])
    }
    img.onerror = () => {
      img.onload = null
      img.onerror = null
      resolve(DEFAULT_AMBIENT)
    }
    img.src = imageUrl
  })
}

function FilmFrame({
  film,
  isCentered,
  onClick,
}: {
  film: Movie
  isCentered: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 280,
        cursor: "pointer",
        transition: "all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        transform: isCentered ? "scale(1.15)" : "scale(0.85)",
        opacity: isCentered ? 1 : 0.35,
        filter: isCentered ? "brightness(1)" : "brightness(0.6)",
        zIndex: isCentered ? 10 : 1,
      }}
    >
      <div
        style={{
          background: "var(--background-watchlist-panel)",
          borderRadius: 4,
          padding: "12px 8px 14px 8px",
          boxShadow: isCentered
            ? "0 20px 60px rgba(19,18,17,0.8), 0 0 30px rgba(255,255,255,0.03)"
            : "0 4px 16px rgba(19,18,17,0.4)",
          transition: "box-shadow 0.5s ease",
        }}
      >
        <div style={{ aspectRatio: "2/3", overflow: "hidden", borderRadius: 2 }}>
          <img
            src={film.poster}
            alt={film.title}
            onError={(e) => {
              e.currentTarget.src = "/fallback-poster.jpg"
            }}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>

        <div
          style={{
            marginTop: 10,
            textAlign: "center",
            flexShrink: 0,
            minHeight: isCentered ? 48 : 36,
          }}
        >
          <div
            className={isCentered ? "t-title" : "t-caption"}
            style={{
              fontStyle: "italic",
              fontFamily: "var(--font-display)",
              color: isCentered
                ? "rgba(255,255,255,0.85)"
                : "rgba(255,255,255,0.3)",
              transition: "all 0.5s ease",
            }}
          >
            {film.title}
          </div>
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

const TMDB_GENRE_CACHE_KEY = "fdfs:watchlist:genre-cache:v1"

type TMDBGenre = { id: number; name: string }
type GenreCache = Record<string, { genres: TMDBGenre[] }>

function readGenreCache(): GenreCache {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.sessionStorage.getItem(TMDB_GENRE_CACHE_KEY)
    return raw ? (JSON.parse(raw) as GenreCache) : {}
  } catch {
    return {}
  }
}

function writeGenreCache(cache: GenreCache) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(TMDB_GENRE_CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore */
  }
}

async function hydrateGenreCache(
  films: Movie[],
  cache: GenreCache,
  onUpdate: (next: GenreCache) => void,
) {
  const missing = films.filter((f) => !cache[f.id])
  if (missing.length === 0) return

  const next = { ...cache }
  const batchSize = 8
  for (let i = 0; i < missing.length; i += batchSize) {
    const slice = missing.slice(i, i + batchSize)
    await Promise.all(
      slice.map(async (film) => {
        try {
          const d = await getMovieDetails(film.id)
          if (!d?.id) return
          next[film.id] = { genres: d.genres || [] }
        } catch {
          next[film.id] = { genres: [] }
        }
      }),
    )
    writeGenreCache(next)
    onUpdate({ ...next })
  }
}

function filmHasGenre(filmId: string, genre: string, cache: GenreCache) {
  return (cache[filmId]?.genres || []).some((g) => g.name === genre)
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<Movie[]>([])
  const [watched, setWatched] = useState<Movie[]>([])
  const [genreCache, setGenreCache] = useState<GenreCache>({})
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [centeredIndex, setCenteredIndex] = useState(0)
  const [ambientRgb, setAmbientRgb] = useState<[number, number, number]>(DEFAULT_AMBIENT)
  const [isSpinning, setIsSpinning] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [showReviewStep, setShowReviewStep] = useState(false)
  const [pendingRating, setPendingRating] = useState<number | null>(null)
  const [reviewText, setReviewText] = useState("")
  const [alreadyWatchedEarlier, setAlreadyWatchedEarlier] = useState(false)
  const [watchedDate, setWatchedDate] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const router = useRouter()
  const stripRef = useRef<HTMLDivElement>(null)
  const ambientCacheRef = useRef<Record<string, [number, number, number]>>({})
  const scrollTickingRef = useRef(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)")
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const [films, seen] = await Promise.all([getWatchlist(), getWatched()])
      if (!active) return
      setWatchlist(films)
      setWatched(seen)
      const cache = readGenreCache()
      setGenreCache(cache)
      setLoading(false)
      const toHydrate = [...films, ...seen.slice(0, 12)]
      const unique = Array.from(new Map(toHydrate.map((m) => [m.id, m])).values())
      hydrateGenreCache(unique, cache, (next) => {
        if (active) setGenreCache(next)
      })
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
      for (const g of genreCache[film.id]?.genres || []) {
        counts.set(g.name, (counts.get(g.name) || 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name)
  }, [watched, genreCache])

  const pickPoolIndices = useMemo(() => {
    if (!selectedGenre) {
      return watchlist.map((_, i) => i)
    }
    return watchlist
      .map((film, i) =>
        filmHasGenre(film.id, selectedGenre, genreCache) ? i : -1,
      )
      .filter((i) => i >= 0)
  }, [watchlist, selectedGenre, genreCache])

  const handleAdd = async (movie: Movie) => {
    const ok = await addToWatchlist(movie)
    if (ok) {
      const fresh = await getWatchlist()
      setWatchlist(fresh)
      hydrateGenreCache([movie], readGenreCache(), setGenreCache)
      return { ok: true }
    }
    return { ok: false, message: "Already on your watchlist." }
  }

  // Extract ambient color when centered film changes
  useEffect(() => {
    if (watchlist.length === 0) return
    const film = watchlist[centeredIndex]
    if (!film) return

    const cached = ambientCacheRef.current[film.id]
    if (cached) {
      setAmbientRgb(cached)
      return
    }

    let cancelled = false
    extractAmbientRgb(film.poster).then((rgb) => {
      if (cancelled) return
      ambientCacheRef.current[film.id] = rgb
      setAmbientRgb(rgb)
    })
    return () => { cancelled = true }
  }, [centeredIndex, watchlist])

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
        const next = prev + direction
        if (next < 0 || next >= watchlist.length) return prev
        syncStripToIndex(next, watchlist.length, { setState: false })
        return next
      })
    },
    [watchlist.length, syncStripToIndex]
  )

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
      const success = await markAsWatched(film, rating, {
        reviewBody,
        watchedAt,
      })
      if (!success) {
        setActionError(
          "We saved your rating but couldn't remove this from the watchlist. Try again, or check your library — the watched entry is there.",
        )
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

  const ambientColor = `rgba(${ambientRgb[0]},${ambientRgb[1]},${ambientRgb[2]},0.25)`

  if (loading) {
    return (
      <main
        style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          background: "var(--background-watchlist)",
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
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "var(--background-watchlist)",
      }}
    >
      <style>{`
        .film-strip::-webkit-scrollbar { display: none; }
        .no-snap { scroll-snap-type: none !important; }
      `}</style>

      {/* Ambient background */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, ${ambientColor} 0%, var(--background-watchlist) 70%)`,
          transition: "background 1.2s ease-in-out",
          zIndex: 0,
        }}
      />

      <TopOverlayNav onSearchClick={() => setSearchOpen(true)} />

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
        <>
          {/* Genre pick + spin */}
          <div
            style={{
              position: "absolute",
              top: isMobile ? 72 : 80,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 30,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              width: "min(640px, calc(100vw - 32px))",
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
            {selectedGenre != null && pickPoolIndices.length === 0 && (
              <p
                className="t-caption"
                style={{ margin: 0, color: "rgba(255,180,180,0.7)" }}
              >
                Nothing on your watchlist matches {selectedGenre} yet.
              </p>
            )}
          </div>

          {/* The film strip — vertically centered */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              transform: "translateY(-50%)",
              zIndex: 10,
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
                paddingTop: 64,
                paddingBottom: 100,
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
                    onClick={() => router.push(`/movie/${film.id}`)}
                  />
                </div>
              ))}
            </div>

            <SprocketRow />
          </div>

          {/* Left / right strip navigation */}
          {watchlist.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous film"
                disabled={centeredIndex <= 0}
                onClick={() => scrollStrip(-1)}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 16,
                  transform: "translateY(-50%)",
                  zIndex: 25,
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background:
                    centeredIndex <= 0
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(255,255,255,0.06)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color:
                    centeredIndex <= 0
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.5)",
                  cursor: centeredIndex <= 0 ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (centeredIndex <= 0) return
                  e.currentTarget.style.background = "rgba(255,255,255,0.12)"
                  e.currentTarget.style.color = "rgba(255,255,255,0.9)"
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"
                }}
                onMouseLeave={(e) => {
                  if (centeredIndex <= 0) return
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
                disabled={centeredIndex >= watchlist.length - 1}
                onClick={() => scrollStrip(1)}
                style={{
                  position: "absolute",
                  top: "50%",
                  right: 16,
                  transform: "translateY(-50%)",
                  zIndex: 25,
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background:
                    centeredIndex >= watchlist.length - 1
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(255,255,255,0.06)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color:
                    centeredIndex >= watchlist.length - 1
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.5)",
                  cursor:
                    centeredIndex >= watchlist.length - 1
                      ? "default"
                      : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (centeredIndex >= watchlist.length - 1) return
                  e.currentTarget.style.background = "rgba(255,255,255,0.12)"
                  e.currentTarget.style.color = "rgba(255,255,255,0.9)"
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"
                }}
                onMouseLeave={(e) => {
                  if (centeredIndex >= watchlist.length - 1) return
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
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: CARD_WIDTH + 40,
              height: 500,
              border: "1px solid rgba(255,255,255,0.035)",
              borderRadius: 8,
              pointerEvents: "none",
              zIndex: 5,
            }}
          />

          {/* Centered film actions: mark watched + remove */}
          {watchlist[centeredIndex] && (
            <div
              style={{
                position: "absolute",
                bottom: 50,
                left: "50%",
                transform: "translateX(-50%)",
                textAlign: "center",
                zIndex: 15,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div className="t-label" style={{ color: "rgba(255,255,255,0.2)" }}>
                {centeredIndex + 1} of {watchlist.length}
              </div>
              {!showRating && watchlist[centeredIndex] && (
                <div
                  className="t-caption"
                  style={{ color: "rgba(255,255,255,0.38)", marginTop: 4 }}
                >
                  {formatLanguage(watchlist[centeredIndex].language)}
                  {watchlist[centeredIndex].year != null
                    ? ` · ${watchlist[centeredIndex].year}`
                    : ""}
                </div>
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
                      bottom: "max(100px, calc(24px + env(safe-area-inset-bottom, 0px)))",
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
                      bottom: "max(100px, calc(24px + env(safe-area-inset-bottom, 0px)))",
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
            </div>
          )}
        </>
      )}

      {searchOpen && (
        <MovieSearch onAdd={handleAdd} onClose={() => setSearchOpen(false)} />
      )}
    </main>
  )
}
