"use client"

import { useRef, useState, useEffect } from "react"
import { Movie } from "@/lib/types"
import MoviePosterCard from "./MoviePosterCard"

export default function PosterRail({
  title,
  subtitle,
  movies,
  showRating,
}: {
  title: string
  subtitle?: string
  movies: Movie[]
  showRating?: boolean
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
    <section className="relative mt-16 px-8">
      <div className="mb-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white" style={{ fontWeight: 600 }}>
          {title}
        </h2>
        {subtitle != null && (
          <p className="mt-0.5 text-sm text-white/35">{subtitle}</p>
        )}
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.08] text-white shadow-lg transition-all duration-200 hover:bg-white/12 hover:scale-110"
            aria-label="Scroll left"
          >
            <span className="text-lg leading-none">‹</span>
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.08] text-white shadow-lg transition-all duration-200 hover:bg-white/12 hover:scale-110"
            aria-label="Scroll right"
          >
            <span className="text-lg leading-none">›</span>
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
        >
          {movies.map((m) => (
            <div key={m.id} className="min-w-[155px] max-w-[155px] shrink-0">
              <MoviePosterCard movie={m} size="large" showRating={showRating} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
