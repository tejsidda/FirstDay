"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Movie } from "@/lib/types"

const ROTATION_INTERVAL_MS = 3000
const POSTER_TRANSITION_MS = 800
const TEXT_FADEOUT_MS = 300

export default function HeroCarousel({
  movies,
  onMovieChange,
  onMarkWatched,
}: {
  movies: Movie[]
  onMovieChange?: (movieId: string) => void
  onMarkWatched?: (movie: Movie) => void
}) {
  const [displayIndex, setDisplayIndex] = useState(0)
  const [transitionFrom, setTransitionFrom] = useState<number | null>(null)
  const [transitionActive, setTransitionActive] = useState(false)
  const [textIndex, setTextIndex] = useState(0)
  const [textVisible, setTextVisible] = useState(true)
  const [isPaused, setIsPaused] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const n = movies.length
  const currentMovie = n > 0 ? movies[displayIndex] : null
  const fromMovie = transitionFrom !== null && n > 0 ? movies[transitionFrom] : null

  const goTo = useCallback(
    (nextIndex: number) => {
      if (n <= 1) return
      const next = ((nextIndex % n) + n) % n
      if (next === displayIndex && transitionFrom === null) return

      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current)
        clearTimerRef.current = null
      }

      setTransitionFrom(displayIndex)
      setDisplayIndex(next)
      setTransitionActive(false)

      setTextVisible(false)
      if (textTimerRef.current) clearTimeout(textTimerRef.current)
      textTimerRef.current = setTimeout(() => {
        setTextIndex(next)
        setTextVisible(true)
        textTimerRef.current = null
      }, TEXT_FADEOUT_MS)
    },
    [n, displayIndex, transitionFrom]
  )

  // Start poster opacity transition on next frame
  useEffect(() => {
    if (transitionFrom === null) return
    const raf = requestAnimationFrame(() => {
      setTransitionActive(true)
    })
    return () => cancelAnimationFrame(raf)
  }, [transitionFrom])

  // Clear transition state after poster transition ends
  useEffect(() => {
    if (transitionFrom === null) return
    clearTimerRef.current = setTimeout(() => {
      setTransitionFrom(null)
      setTransitionActive(false)
      clearTimerRef.current = null
    }, POSTER_TRANSITION_MS)
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
    }
  }, [transitionFrom])

  // Auto-rotation (only when not paused and not mid-transition)
  useEffect(() => {
    if (n <= 1 || isPaused || transitionFrom !== null) return
    timerRef.current = setTimeout(() => {
      goTo(displayIndex + 1)
      timerRef.current = null
    }, ROTATION_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [n, isPaused, displayIndex, transitionFrom, goTo])

  // Notify parent when current movie changes
  useEffect(() => {
    if (movies[displayIndex]) {
      onMovieChange?.(String(movies[displayIndex].id))
    }
  }, [displayIndex, movies, onMovieChange])

  if (n === 0 || !currentMovie) {
    return (
      <section className="w-full">
        <div
          className="relative w-full overflow-hidden bg-black"
          style={{ height: "70vh" }}
        />
      </section>
    )
  }

  const extendedBlurStyle = (movie: Movie) => ({
    position: "absolute" as const,
    top: -100,
    left: -100,
    right: -100,
    bottom: -100,
    backgroundImage: `url(${movie.poster})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: "blur(50px) saturate(1.8) brightness(0.8)",
    transform: "scale(2.0)",
  })

  return (
    <section className="w-full">
      <div
        className="relative w-full overflow-hidden"
        style={{ height: "70vh" }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Blurred background — extends beyond container for full coverage */}
        {fromMovie && (
          <div
            style={{
              ...extendedBlurStyle(fromMovie),
              opacity: transitionActive ? 0 : 1,
              transition: `opacity ${POSTER_TRANSITION_MS}ms ease-in-out`,
            }}
          />
        )}
        <div
          style={{
            ...extendedBlurStyle(currentMovie),
            opacity: transitionFrom !== null ? (transitionActive ? 1 : 0) : 1,
            transition: `opacity ${POSTER_TRANSITION_MS}ms ease-in-out`,
          }}
        />

        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, #080808 0%, rgba(8,8,8,0.6) 20%, rgba(8,8,8,0.2) 45%, rgba(8,8,8,0.05) 75%, rgba(8,8,8,0.15) 100%)",
            zIndex: 1,
          }}
        />
        {/* Top scrim for cleaner nav readability (Netflix-like) */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[2]"
          style={{
            height: 130,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 45%, transparent 100%)",
          }}
        />
        {/* Foreground content: sharp poster + text */}
        {n > 0 && (() => {
          const movieForText = movies[textIndex]
          if (!movieForText) return null
          return (
            <div
              className="absolute inset-x-0 bottom-0 z-10 flex items-end gap-7"
              style={{
                paddingLeft: 48,
                paddingTop: 0,
                paddingBottom: 140,
                paddingRight: 48,
                opacity: textVisible ? 1 : 0,
                transition: `opacity ${TEXT_FADEOUT_MS}ms ease-in-out`,
              }}
            >
              {/* Sharp poster on the left */}
              <div className="shrink-0">
                <div
                  className="overflow-hidden rounded-[10px]"
                  style={{
                    width: 180,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                  }}
                >
                  <img
                    src={movieForText.poster}
                    alt={movieForText.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              {/* Text content */}
              <div className="max-w-[380px] pb-1">
                <div
                  className="text-[10px] uppercase"
                  style={{
                    letterSpacing: "0.15em",
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  From your watchlist
                </div>
                <h1
                  className="mt-1.5 text-[44px] font-bold leading-[1] text-white"
                  style={{
                    letterSpacing: "-0.02em",
                    textShadow: "0 12px 40px rgba(0,0,0,0.55)",
                  }}
                >
                  {movieForText.title}
                </h1>
                <p
                  className="mt-2 text-[13px]"
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    maxWidth: 360,
                    lineHeight: 1.45,
                  }}
                >
                  A story that stays with you long after the credits roll.
                </p>
                <p
                  className="mt-1.5 text-[13px]"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  {movieForText.language} · {movieForText.year}
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    className="rounded-lg border border-white/20 bg-white/10 px-6 py-2.5 text-[13px] font-medium text-white backdrop-blur-[8px] transition-colors duration-200 hover:bg-white/20"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (movieForText) onMarkWatched?.(movieForText)
                    }}
                  >
                    Mark as Watched
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/50 transition-colors duration-200 hover:text-white/80"
                  >
                    Details ›
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Pill indicators — bottom right */}
        {n > 1 && (
          <div
            className="absolute z-10 flex items-center gap-1.5"
            style={{ right: 48, bottom: 140 }}
          >
            {movies.map((_, i) => {
              const isActive = i === displayIndex
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  className="rounded-full transition-all duration-300 ease-in-out"
                  style={{
                    height: 4,
                    width: isActive ? 24 : 8,
                    backgroundColor: isActive
                      ? "rgba(255,255,255,1)"
                      : "rgba(255,255,255,0.3)",
                  }}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={isActive ? "true" : undefined}
                />
              )
            })}
          </div>
        )}
      </div>

    </section>
  )
}
