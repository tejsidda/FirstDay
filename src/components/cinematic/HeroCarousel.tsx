"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import ParallaxY from "@/components/motion/ParallaxY"
import { mediaDetailPath, resolveMediaType } from "@/lib/media"
import type { MediaItem } from "@/lib/types"
import { formatLanguage } from "@/lib/tmdb"

const ROTATION_MS = 14000

function CrossfadeStack({
  id,
  duration = 1100,
  animation = "heroBackdropIn",
  className,
  children,
}: {
  id: string
  duration?: number
  animation?: string
  className?: string
  children: React.ReactNode
}) {
  const [layers, setLayers] = useState<
    { id: string; node: React.ReactNode; animate: boolean }[]
  >([{ id, node: children, animate: false }])
  const prevIdRef = useRef(id)
  const childrenRef = useRef(children)
  childrenRef.current = children

  useEffect(() => {
    if (prevIdRef.current === id) return
    prevIdRef.current = id
    setLayers((prev) => [
      ...prev.slice(-1),
      { id, node: childrenRef.current, animate: true },
    ])
    const t = setTimeout(() => {
      setLayers((prev) => prev.slice(-1))
    }, duration + 150)
    return () => clearTimeout(t)
  }, [id, duration])

  return (
    <>
      {layers.map((layer) => (
        <div
          key={layer.id}
          className={className}
          style={{
            position: "absolute",
            inset: 0,
            animation: layer.animate
              ? `${animation} ${duration}ms cubic-bezier(0.33, 1, 0.68, 1) both`
              : undefined,
          }}
        >
          {layer.node}
        </div>
      ))}
    </>
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
      aria-label={direction === "left" ? "Previous film" : "Next film"}
      className="hero-rail-btn"
    >
      {direction === "left" ? "‹" : "›"}
    </button>
  )
}

type HeroCarouselProps = {
  movies: MediaItem[]
  isMobile: boolean
  sourceEyebrow: string
  onSearchOpen: () => void
}

export default function HeroCarousel({
  movies,
  isMobile,
  sourceEyebrow,
  onSearchOpen,
}: HeroCarouselProps) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [rotationEpoch, setRotationEpoch] = useState(0)
  const [contextVisible, setContextVisible] = useState(true)
  const [posterGlow, setPosterGlow] = useState<string | null>(null)
  const isTransitioningRef = useRef(false)
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoRotateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const movie = movies[index % movies.length]
  const backdrop = movie?.backdrop || movie?.poster
  const poster = movie?.poster || movie?.backdrop
  const slideKey = movie ? `${resolveMediaType(movie)}-${movie.id}` : ""

  const openDetails = () => {
    if (!movie) return
    router.push(mediaDetailPath(movie))
  }

  const transitionSlide = (updater: (prev: number) => number) => {
    if (isTransitioningRef.current) return
    isTransitioningRef.current = true
    setContextVisible(false)
    transitionTimerRef.current = setTimeout(() => {
      setIndex(updater)
      setContextVisible(true)
      isTransitioningRef.current = false
      transitionTimerRef.current = null
    }, 320)
  }

  const clearAutoRotate = () => {
    if (autoRotateIntervalRef.current) {
      clearInterval(autoRotateIntervalRef.current)
      autoRotateIntervalRef.current = null
    }
  }

  const startAutoRotate = () => {
    clearAutoRotate()
    if (movies.length <= 1) return
    autoRotateIntervalRef.current = setInterval(() => {
      transitionSlide((prev) => (prev + 1) % movies.length)
    }, ROTATION_MS)
  }

  useEffect(() => {
    startAutoRotate()
    return () => clearAutoRotate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movies.length])

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
      }
      clearAutoRotate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const manualSlide = (dir: 1 | -1) => {
    if (movies.length <= 1) return
    transitionSlide(
      (prev) => (prev + dir + movies.length) % movies.length,
    )
    startAutoRotate()
    setRotationEpoch((e) => e + 1)
  }

  useEffect(() => {
    setPosterGlow(null)
    if (!poster || isMobile) return

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
        let r = 0
        let g = 0
        let b = 0
        let count = 0
        for (let i = 0; i < data.length; i += 20) {
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          count++
        }
        r = Math.round(r / count)
        g = Math.round(g / count)
        b = Math.round(b / count)
        if (Math.max(r, g, b) - Math.min(r, g, b) > 25) {
          setPosterGlow(`rgba(${r},${g},${b},0.28)`)
        }
      } catch {
        // CORS — skip glow
      }
    }
    img.src = poster
  }, [poster, isMobile])

  if (!movie) return null

  const metaLine = [
    formatLanguage(movie.language),
    movie.year,
    movie.runtime ? `${movie.runtime} min` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const contextBlock = (
    <div
      className="hero-context"
      style={{
        opacity: contextVisible ? 1 : 0,
        transform: contextVisible ? "translateY(0)" : "translateY(18px)",
        transition: contextVisible
          ? "opacity 0.55s cubic-bezier(0.33, 1, 0.68, 1), transform 0.55s cubic-bezier(0.33, 1, 0.68, 1)"
          : "opacity 0.28s ease, transform 0.28s ease",
      }}
    >
      <div className="t-label hero-eyebrow">
        <span>01</span>
        <span className="hero-eyebrow-line" />
        <span>{sourceEyebrow}</span>
      </div>

      <h1 className="t-display hero-title" key={slideKey}>
        {movie.title}
      </h1>

      <p className="hero-meta">{metaLine}</p>

      {movie.reviewHeadline && (
        <p className="hero-review t-body">{movie.reviewHeadline}</p>
      )}

      <div className="hero-cta-row">
        <button
          type="button"
          onClick={openDetails}
          className="t-button hero-cta-primary"
        >
          Open details
        </button>
        <button
          type="button"
          onClick={onSearchOpen}
          className="t-button hero-cta-secondary"
        >
          Search films
        </button>
      </div>

      {movies.length > 1 && (
        <div className="hero-indicator">
          {!isMobile && (
            <RailButton direction="left" onClick={() => manualSlide(-1)} />
          )}
          <span className="t-label t-tabular hero-indicator-num">
            {String((index % movies.length) + 1).padStart(2, "0")}
          </span>
          <div className="hero-indicator-track">
            <div
              key={`${index}-${rotationEpoch}`}
              className="hero-indicator-fill"
              style={{ animationDuration: `${ROTATION_MS}ms` }}
            />
          </div>
          <span className="t-label t-tabular hero-indicator-total">
            {String(movies.length).padStart(2, "0")}
          </span>
          {!isMobile && (
            <RailButton direction="right" onClick={() => manualSlide(1)} />
          )}
        </div>
      )}
    </div>
  )

  return (
    <section className="hero-canvas" data-mobile={isMobile ? "true" : "false"}>
      {/* Backdrop bleeds past the section — slow drift + crossfade */}
      {backdrop && !isMobile && (
        <div className="hero-backdrop-shell" aria-hidden>
          <ParallaxY
            y={72}
            scrub={1.5}
            start="top top"
            style={{ position: "absolute", inset: 0 }}
          >
            <CrossfadeStack
              id={slideKey}
              duration={1300}
              animation="heroBackdropIn"
            >
              <div
                className="hero-backdrop-img"
                style={{ backgroundImage: `url(${backdrop})` }}
              />
            </CrossfadeStack>
          </ParallaxY>
          <div className="hero-backdrop-scrim" />
        </div>
      )}

      {isMobile && backdrop && (
        <div className="hero-backdrop-shell hero-backdrop-shell--mobile" aria-hidden>
          <CrossfadeStack
            id={slideKey}
            duration={1000}
            animation="heroBackdropIn"
          >
            <div
              className="hero-backdrop-img"
              style={{ backgroundImage: `url(${backdrop})` }}
            />
          </CrossfadeStack>
          <div className="hero-backdrop-scrim" />
        </div>
      )}

      {/* Ghost title — oversized, partially clipped, behind everything */}
      <div className="hero-ghost-title" aria-hidden key={`ghost-${slideKey}`}>
        {movie.title}
      </div>

      <div className="hero-stage">
        {contextBlock}

        {poster && (
          <button
            type="button"
            className="hero-poster-btn"
            onClick={openDetails}
            aria-label={`Open ${movie.title}`}
          >
            {posterGlow && !isMobile && (
              <div
                className="hero-poster-glow"
                style={{ background: `radial-gradient(circle, ${posterGlow} 0%, transparent 68%)` }}
              />
            )}
            <div className="hero-poster-frame">
              <CrossfadeStack
                id={slideKey}
                duration={950}
                animation="heroPosterTranscend"
              >
                <img src={poster} alt="" className="hero-poster-img" />
              </CrossfadeStack>
            </div>
            <div className="hero-poster-shadow" aria-hidden />
          </button>
        )}
      </div>

      {!isMobile && (
        <div className="hero-scroll-hint" aria-hidden>
          <span className="t-label">Scroll</span>
          <span className="hero-scroll-line" />
        </div>
      )}
    </section>
  )
}
