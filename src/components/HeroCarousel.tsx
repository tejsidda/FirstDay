"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Movie } from "@/lib/types"

const ROTATION_INTERVAL_MS = 3000
const POSTER_TRANSITION_MS = 800
const TEXT_FADEOUT_MS = 300

export default function HeroCarousel({ movies }: { movies: Movie[] }) {
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

  if (n === 0 || !currentMovie) {
    return (
      <section className="relative h-[85vh] w-full overflow-hidden bg-black" />
    )
  }

  const posterStyle = (movie: Movie) =>
    movie.poster.startsWith("linear-gradient")
      ? { background: movie.poster }
      : { backgroundImage: `url(${movie.poster})` }

  return (
    <section
      className="relative h-[85vh] w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Poster layers — crossfade */}
      <div className="absolute inset-0">
        {fromMovie && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              ...posterStyle(fromMovie),
              opacity: transitionActive ? 0 : 1,
              transition: `opacity ${POSTER_TRANSITION_MS}ms ease-in-out`,
            }}
          />
        )}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            ...posterStyle(currentMovie),
            opacity: transitionFrom !== null ? (transitionActive ? 1 : 0) : 1,
            transition: `opacity ${POSTER_TRANSITION_MS}ms ease-in-out`,
          }}
        />
      </div>

      {/* Gradient overlays */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

      {/* Content — text fades on swap */}
      <div className="relative z-10 flex h-full flex-col items-start justify-end px-8 pb-24 md:px-16">
        {n > 0 && (() => {
          const movieForText = movies[textIndex]
          if (!movieForText) return null
          return (
            <div
              className="max-w-xl"
              style={{
                opacity: textVisible ? 1 : 0,
                transition: `opacity ${TEXT_FADEOUT_MS}ms ease-in-out`,
              }}
            >
              <span
                className="mb-3 inline-block rounded px-3 py-1 text-xs font-semibold tracking-wide text-black"
                style={{ backgroundColor: "#f59e0b" }}
              >
                #{textIndex + 1} on your watchlist
              </span>
              <h1
                className="text-4xl font-extrabold tracking-tight text-white drop-shadow-lg md:text-5xl"
                style={{ fontWeight: 800 }}
              >
                {movieForText.title}
              </h1>
              <p className="mt-1 text-sm text-white/50">
                {movieForText.language} · {movieForText.year}
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  className="rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-black transition-transform duration-200 ease-out hover:scale-105 hover:bg-white/95"
                >
                  ▶ Watch
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-[12px] transition-transform duration-200 ease-out hover:scale-105 hover:bg-white/15"
                >
                  Remove
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Pill indicators — bottom center */}
      {n > 1 && (
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
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
                  backgroundColor: isActive ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.3)",
                }}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={isActive ? "true" : undefined}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
