"use client"

import { useRef, useState, useEffect } from "react"
import { Movie } from "@/lib/types"
import MoviePosterCard from "./MoviePosterCard"

export default function PosterRail({
  title,
  subtitle,
  movies,
  showRating,
  onMarkWatched,
  onRemove,
}: {
  title: string
  subtitle?: string
  movies: Movie[]
  showRating?: boolean
  onMarkWatched?: (movie: Movie, rating: number) => void
  onRemove?: (movie: Movie) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollState()
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    el.addEventListener("scroll", updateScrollState)
    return () => {
      ro.disconnect()
      el.removeEventListener("scroll", updateScrollState)
    }
  }, [movies])

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current
    if (!el) return
    const step = el.clientWidth * 0.8
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" })
  }

  return (
    <section className="relative px-12">
      <div className="mb-4 flex items-start justify-between gap-6">
        <div>
          <h2
            style={{ 
              fontSize: 20, 
              fontWeight: 600, 
              color: "var(--text-body)",
              fontFamily: "Georgia, serif",
              position: "relative",
              zIndex: 5,
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              style={{
                fontSize: 13, 
                color: "var(--text-quote)", 
                fontStyle: "italic",
                marginTop: 4,
                fontFamily: "Georgia, serif",
                position: "relative",
                zIndex: 5,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        <span
          style={{
            fontSize: 12, 
            color: "var(--text-search)",
            position: "relative",
            zIndex: 5,
          }}
        >
          See all ›
        </span>
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            className="absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white shadow-lg transition-all duration-200 hover:bg-white/15"
            style={{ left: -18 }}
            aria-label="Scroll left"
          >
            <span className="text-lg leading-none">‹</span>
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            className="absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white shadow-lg transition-all duration-200 hover:bg-white/15"
            style={{ right: -18 }}
            aria-label="Scroll right"
          >
            <span className="text-lg leading-none">›</span>
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-4"
          style={{ paddingRight: 16 }}
        >
          {movies.map((m, i) => (
            <div
              key={`${m.id}-${i}`}
              className="min-w-[160px] max-w-[160px] shrink-0"
            >
              <MoviePosterCard
                movie={m}
                size="large"
                showRating={showRating}
                onMarkWatched={onMarkWatched}
                onRemove={onRemove}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
