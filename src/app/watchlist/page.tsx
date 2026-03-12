"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getWatchlist } from "@/lib/db"
import type { Movie } from "@/lib/types"

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
      if (!ctx) { resolve(DEFAULT_AMBIENT); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let r = 0, g = 0, b = 0, count = 0
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 16) continue
        r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count++
      }
      if (count === 0) { resolve(DEFAULT_AMBIENT); return }
      const soften = (v: number) => Math.max(20, Math.min(190, Math.round(v * 0.82 + 14)))
      resolve([soften(r / count), soften(g / count), soften(b / count)])
    }
    img.onerror = () => resolve(DEFAULT_AMBIENT)
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
        opacity: isCentered ? 1 : 0.4,
        filter: isCentered ? "brightness(1)" : "brightness(0.6)",
        zIndex: isCentered ? 10 : 1,
      }}
    >
      <div
        style={{
          background: "#111",
          borderRadius: 4,
          padding: "12px 8px",
          boxShadow: isCentered
            ? "0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(255,255,255,0.03)"
            : "0 4px 16px rgba(0,0,0,0.4)",
          transition: "box-shadow 0.5s ease",
        }}
      >
        <div style={{ aspectRatio: "2/3", overflow: "hidden", borderRadius: 2 }}>
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
        </div>

        <div style={{ marginTop: 10, textAlign: "center" }}>
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: isCentered ? 15 : 11,
              fontWeight: 400,
              fontStyle: "italic",
              color: isCentered
                ? "rgba(255,255,255,0.85)"
                : "rgba(255,255,255,0.3)",
              transition: "all 0.5s ease",
              lineHeight: 1.3,
            }}
          >
            {film.title}
          </div>
          {isCentered && (
            <div
              style={{
                fontFamily: "-apple-system, sans-serif",
                fontSize: 10,
                color: "rgba(255,255,255,0.35)",
                marginTop: 4,
                transition: "opacity 0.3s ease",
              }}
            >
              {film.language} · {film.year}
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
            background: "rgba(255,255,255,0.04)",
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

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [centeredIndex, setCenteredIndex] = useState(0)
  const [ambientRgb, setAmbientRgb] = useState<[number, number, number]>(DEFAULT_AMBIENT)
  const [isSpinning, setIsSpinning] = useState(false)
  const router = useRouter()
  const stripRef = useRef<HTMLDivElement>(null)
  const ambientCacheRef = useRef<Record<string, [number, number, number]>>({})

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const films = await getWatchlist()
      if (!active) return
      setWatchlist(films)
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

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

  const handleStripScroll = useCallback(() => {
    if (!stripRef.current) return
    const scrollLeft = stripRef.current.scrollLeft
    const index = Math.round(scrollLeft / CARD_TOTAL)
    const clamped = Math.max(0, Math.min(index, watchlist.length - 1))
    if (clamped !== centeredIndex) {
      setCenteredIndex(clamped)
    }
  }, [watchlist.length, centeredIndex])

  const handleSpin = useCallback(() => {
    if (isSpinning || watchlist.length === 0 || !stripRef.current) return
    setIsSpinning(true)

    const randomIndex = Math.floor(Math.random() * watchlist.length)
    const targetScroll = randomIndex * CARD_TOTAL
    const startScroll = stripRef.current.scrollLeft
    const totalDistance = watchlist.length * CARD_TOTAL * 2 + targetScroll
    const duration = 3000
    const startTime = Date.now()
    const strip = stripRef.current
    const maxScroll = (watchlist.length - 1) * CARD_TOTAL

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)

      if (strip) {
        const raw = startScroll + eased * totalDistance
        const wrapped = maxScroll > 0 ? raw % maxScroll : 0
        strip.scrollLeft = wrapped
      }

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        if (strip) {
          strip.scrollTo({ left: targetScroll, behavior: "smooth" })
        }
        setTimeout(() => setIsSpinning(false), 500)
      }
    }

    requestAnimationFrame(animate)
  }, [isSpinning, watchlist.length])

  const ambientColor = `rgba(${ambientRgb[0]},${ambientRgb[1]},${ambientRgb[2]},0.3)`

  if (loading) {
    return (
      <main
        style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          background: "#080808",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 16,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.3)",
          }}
        >
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
        background: "#080808",
      }}
    >
      <style>{`
        .film-strip::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Ambient background */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, ${ambientColor} 0%, #080808 70%)`,
          transition: "background 1s ease-in-out",
          zIndex: 0,
        }}
      />

      {/* FDFS logo */}
      <Link
        href="/home"
        style={{
          position: "absolute",
          top: 20,
          left: 24,
          zIndex: 50,
          fontFamily: "-apple-system, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: "rgba(255,255,255,0.4)",
          textDecoration: "none",
          letterSpacing: "0.1em",
        }}
      >
        FDFS
      </Link>

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
          <p
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 22,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            The reel is empty.
          </p>
          <p
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 14,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.2)",
              marginTop: 8,
            }}
          >
            Search for a film and add it to your watchlist.
          </p>
        </div>
      ) : (
        <>
          {/* Spin button */}
          <button
            onClick={handleSpin}
            disabled={isSpinning}
            style={{
              position: "absolute",
              top: 40,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 30,
              fontFamily: "Georgia, serif",
              fontSize: 14,
              fontStyle: "italic",
              fontWeight: 400,
              color: isSpinning
                ? "rgba(255,255,255,0.3)"
                : "rgba(255,255,255,0.6)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 999,
              padding: "12px 32px",
              cursor: isSpinning ? "default" : "pointer",
              backdropFilter: "blur(8px)",
              transition: "all 0.3s ease",
              letterSpacing: "0.03em",
            }}
            onMouseEnter={(e) => {
              if (!isSpinning) {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"
                e.currentTarget.style.color = "rgba(255,255,255,0.85)"
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"
              e.currentTarget.style.color = isSpinning
                ? "rgba(255,255,255,0.3)"
                : "rgba(255,255,255,0.6)"
            }}
          >
            {isSpinning
              ? "Finding your film..."
              : "What should I watch tonight?"}
          </button>

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
              className="film-strip"
              onScroll={handleStripScroll}
              style={{
                display: "flex",
                alignItems: "center",
                gap: CARD_GAP,
                overflowX: "auto",
                overflowY: "hidden",
                paddingLeft: `calc(50vw - ${CARD_WIDTH / 2}px)`,
                paddingRight: `calc(50vw - ${CARD_WIDTH / 2}px)`,
                paddingTop: 8,
                paddingBottom: 8,
                scrollBehavior: isSpinning ? "auto" : "smooth",
                scrollSnapType: isSpinning ? "none" : "x mandatory",
                scrollbarWidth: "none",
                msOverflowStyle: "none" as any,
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

          {/* Center frame indicator */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: CARD_WIDTH + 40,
              height: 500,
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 8,
              pointerEvents: "none",
              zIndex: 5,
            }}
          />

          {/* Film counter */}
          <div
            style={{
              position: "absolute",
              bottom: 40,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 15,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 11,
                fontStyle: "italic",
                color: "rgba(255,255,255,0.2)",
                letterSpacing: "0.05em",
              }}
            >
              {centeredIndex + 1} of {watchlist.length}
            </div>
          </div>
        </>
      )}
    </main>
  )
}
