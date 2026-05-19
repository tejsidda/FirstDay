"use client"

import { useEffect, useRef, useState } from "react"
import HeroCarousel from "@/components/HeroCarousel"
import PosterRail from "@/components/PosterRail"
import TopOverlayNav from "@/components/TopOverlayNav"
import MovieSearch from "@/components/MovieSearch"
import { getWatchlist, getWatched, addToWatchlist, markAsWatched, removeFromWatchlist } from "@/lib/db"
import { PULL_REFRESH_EVENT } from "@/lib/pullToRefresh"
import { Movie } from "@/lib/types"

const AMBIENT_FALLBACK: Record<string, [number, number, number]> = {
  "1": [60, 80, 55],   // Kumbalangi - earthy green
  "2": [45, 65, 58],   // Parasite - muted teal
  "3": [90, 55, 25],   // RRR - warm brown/orange
}

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
        resolve(DEFAULT_AMBIENT)
        return
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data

      let r = 0
      let g = 0
      let b = 0
      let count = 0

      for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3]
        if (alpha < 16) continue
        r += pixels[i]
        g += pixels[i + 1]
        b += pixels[i + 2]
        count += 1
      }

      if (count === 0) {
        resolve(DEFAULT_AMBIENT)
        return
      }

      const soften = (v: number) => Math.max(20, Math.min(190, Math.round(v * 0.82 + 14)))
      resolve([soften(r / count), soften(g / count), soften(b / count)])
    }
    img.onerror = () => resolve(DEFAULT_AMBIENT)
    img.src = imageUrl
  })
}

export default function HomeContent() {
  const [watchlist, setWatchlist] = useState<Movie[]>([])
  const [watched, setWatched] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [currentMovieId, setCurrentMovieId] = useState<string>("")
  const [ambientRgb, setAmbientRgb] = useState<[number, number, number]>(DEFAULT_AMBIENT)
  const ambientCacheRef = useRef<Record<string, [number, number, number]>>({})

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const [w, r] = await Promise.all([getWatchlist(), getWatched()])
      setWatchlist(w)
      setWatched(r)
      if (w.length > 0) setCurrentMovieId((prev) => prev || w[0].id)
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

  useEffect(() => {
    const current = watchlist.find((m) => String(m.id) === currentMovieId)
    if (!current) return

    const movieId = String(current.id)
    const fallback = AMBIENT_FALLBACK[movieId] ?? DEFAULT_AMBIENT
    const cached = ambientCacheRef.current[movieId]
    if (cached != null) {
      setAmbientRgb(cached)
      return
    }

    let cancelled = false
    setAmbientRgb(fallback)

    void extractAmbientRgb(current.poster).then((rgb) => {
      if (cancelled) return
      ambientCacheRef.current[movieId] = rgb
      setAmbientRgb(rgb)
    })

    return () => {
      cancelled = true
    }
  }, [currentMovieId, watchlist])

  const handleAddToWatchlist = async (movie: Movie) => {
    const success = await addToWatchlist(movie)
    if (success) {
      setWatchlist(prev => [movie, ...prev])
    }
  }

  const handleMarkAsWatched = async (movie: Movie, rating: number) => {
    const success = await markAsWatched(movie, rating)
    if (success) {
      // Remove from watchlist state
      setWatchlist(prev => prev.filter(m => m.id !== movie.id))
      // Add to watched state with rating
      setWatched(prev => [{ ...movie, rating }, ...prev])
    }
  }

  const handleRemoveFromWatchlist = async (movie: Movie) => {
    const success = await removeFromWatchlist(movie.id)
    if (success) {
      setWatchlist(prev => prev.filter(m => m.id !== movie.id))
    }
  }

  if (loading) {
    return (
      <main
        className="relative text-white min-h-screen flex items-center justify-center"
        style={{ background: "#080808" }}
      >
        <p style={{
          color: "rgba(255,255,255,0.3)",
          fontStyle: "italic",
          fontFamily: "Georgia, serif",
          fontSize: 16,
        }}>
          Loading your diary...
        </p>
      </main>
    )
  }

  return (
    <main
      className="relative text-white min-h-screen"
      style={{ background: "#080808" }}
    >
      {/* Ambient gradient 1 */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundColor: `rgba(${ambientRgb[0]}, ${ambientRgb[1]}, ${ambientRgb[2]}, 0.26)`,
          transition: "background-color 1400ms ease-in-out",
        }}
      />

      {/* Ambient gradient 2 */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            `radial-gradient(125% 95% at 50% 8%, rgba(${ambientRgb[0]}, ${ambientRgb[1]}, ${ambientRgb[2]}, 0.28) 0%, rgba(8,8,8,0) 62%)`,
          transition: "background 1400ms ease-in-out",
        }}
      />

      {/* Ambient gradient 3 */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            `radial-gradient(95% 80% at 24% 62%, rgba(${ambientRgb[0]}, ${ambientRgb[1]}, ${ambientRgb[2]}, 0.14) 0%, rgba(8,8,8,0) 68%), radial-gradient(88% 75% at 78% 72%, rgba(${ambientRgb[0]}, ${ambientRgb[1]}, ${ambientRgb[2]}, 0.12) 0%, rgba(8,8,8,0) 70%)`,
          transition: "background 1400ms ease-in-out",
        }}
      />

      {/* Cinematic vignette */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.38) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        <TopOverlayNav onSearchClick={() => setSearchOpen(true)} />
        <HeroCarousel
          movies={watchlist}
          onMovieChange={setCurrentMovieId}
          onMarkWatched={(movie) => handleMarkAsWatched(movie, 5)}
        />

        {/* First rail — overlaps into hero bottom */}
        <div style={{ marginTop: -100, position: "relative", zIndex: 20 }}>
          <PosterRail
            title="recently watched"
            subtitle="your film journal"
            movies={watched}
            showRating
          />
        </div>

        {/* Second rail — normal spacing below first */}
        <div style={{ marginTop: 48 }}>
          <PosterRail
            title="want to watch"
            subtitle="saved for a good night"
            movies={watchlist}
            onMarkWatched={handleMarkAsWatched}
            onRemove={handleRemoveFromWatchlist}
          />
        </div>

        {/* Bottom padding */}
        <div style={{ height: 80 }} />

        {searchOpen && (
          <MovieSearch
            onAdd={handleAddToWatchlist}
            onClose={() => setSearchOpen(false)}
          />
        )}
      </div>
    </main>
  )
}