"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getWatched } from "@/lib/db"
import type { Movie } from "@/lib/types"

function WallPoster({
  film,
  isFiltered,
  isNeighbor,
  onClick,
  onHover,
  onLeave,
  parallaxOffset,
}: {
  film: Movie
  isFiltered: boolean
  isNeighbor: boolean
  onClick: () => void
  onHover: () => void
  onLeave: () => void
  parallaxOffset: number
}) {
  const [hovered, setHovered] = useState(false)

  const scale = hovered ? 1.08 : isNeighbor ? 1.02 : 1
  const z = hovered ? 30 : isNeighbor ? 2 : 1

  let filterVal = "brightness(1)"
  if (isFiltered) filterVal = "brightness(0.15) saturate(0)"
  else if (isNeighbor && !hovered) filterVal = "brightness(1.05)"

  return (
    <div
      onMouseEnter={() => { setHovered(true); onHover() }}
      onMouseLeave={() => { setHovered(false); onLeave() }}
      onClick={onClick}
      style={{
        position: "relative",
        aspectRatio: "2/3",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        transform: `scale(${scale}) translateX(${parallaxOffset}px)`,
        zIndex: z,
        boxShadow: hovered ? "0 20px 60px rgba(0,0,0,0.8)" : "none",
        filter: filterVal,
      }}
    >
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

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: hovered
            ? "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)"
            : "transparent",
          transition: "background 0.3s ease",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 14,
        }}
      >
        <div
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 14,
            fontWeight: 400,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.9)",
            opacity: hovered ? 1 : 0,
            transform: hovered ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.3s ease, transform 0.3s ease",
            lineHeight: 1.3,
          }}
        >
          {film.title}
        </div>

        <div
          style={{
            fontFamily: "-apple-system, sans-serif",
            fontSize: 10,
            color: "rgba(255,255,255,0.4)",
            opacity: hovered ? 1 : 0,
            transform: hovered ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.3s ease 0.05s, transform 0.3s ease 0.05s",
            marginTop: 4,
          }}
        >
          {film.language} · {film.year}
        </div>

        {film.rating && (
          <div
            style={{
              color: "#f5c518",
              fontSize: 10,
              opacity: hovered ? 1 : 0,
              transform: hovered ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.3s ease 0.1s, transform 0.3s ease 0.1s",
              marginTop: 4,
            }}
          >
            {"★".repeat(film.rating)}
            {"☆".repeat(5 - film.rating)}
          </div>
        )}

        {film.reviewHeadline && (
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 9,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.3)",
              opacity: hovered ? 1 : 0,
              transform: hovered ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.3s ease 0.15s, transform 0.3s ease 0.15s",
              marginTop: 6,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {film.reviewHeadline}
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          border: hovered
            ? "1px solid rgba(255,255,255,0.15)"
            : "1px solid transparent",
          transition: "border-color 0.3s ease",
          pointerEvents: "none",
        }}
      />
    </div>
  )
}

export default function LibraryPage() {
  const [watched, setWatched] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLanguage, setSelectedLanguage] = useState("All")
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [columns, setColumns] = useState(10)
  const [scrollY, setScrollY] = useState(0)
  const [collageUrl, setCollageUrl] = useState<string | null>(null)
  const router = useRouter()
  const wallRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const spotlightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const films = await getWatched()
      if (!active) return
      setWatched(films)
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  // Poster collage for the header number
  useEffect(() => {
    if (watched.length === 0) return

    const canvas = document.createElement("canvas")
    const cols = Math.ceil(Math.sqrt(watched.length))
    const rows = Math.ceil(watched.length / cols)
    const thumbSize = 80
    canvas.width = cols * thumbSize
    canvas.height = rows * thumbSize
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#080808"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    let loaded = 0
    const total = Math.min(watched.length, cols * rows)

    watched.slice(0, total).forEach((film, i) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const col = i % cols
        const row = Math.floor(i / cols)
        ctx.drawImage(img, col * thumbSize, row * thumbSize, thumbSize, thumbSize * 1.5)
        loaded++
        if (loaded === total) {
          setCollageUrl(canvas.toDataURL("image/jpeg", 0.85))
        }
      }
      img.onerror = () => {
        loaded++
        if (loaded === total) {
          setCollageUrl(canvas.toDataURL("image/jpeg", 0.85))
        }
      }
      img.src = film.poster
    })
  }, [watched])

  // Column count for neighbor ripple calculation
  useEffect(() => {
    const calculateColumns = () => {
      if (!gridRef.current) return
      const width = gridRef.current.offsetWidth
      setColumns(Math.max(1, Math.floor(width / 140)))
    }
    calculateColumns()
    window.addEventListener("resize", calculateColumns)
    return () => window.removeEventListener("resize", calculateColumns)
  }, [])

  // 3D tilt — tracks global mouse relative to viewport center
  useEffect(() => {
    let rafId: number | null = null
    const handleGlobalMouse = (e: MouseEvent) => {
      if (rafId != null) return
      rafId = requestAnimationFrame(() => {
        const centerX = window.innerWidth / 2
        const centerY = window.innerHeight / 2
        setTilt({
          x: ((e.clientY - centerY) / centerY) * -3,
          y: ((e.clientX - centerX) / centerX) * 3,
        })
        rafId = null
      })
    }
    window.addEventListener("mousemove", handleGlobalMouse)
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouse)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [])

  // Scroll parallax
  useEffect(() => {
    let rafId: number | null = null
    const handleScroll = () => {
      if (rafId != null) return
      rafId = requestAnimationFrame(() => {
        setScrollY(window.scrollY)
        rafId = null
      })
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [])

  // Spotlight — updates CSS custom properties directly to avoid re-renders
  const handleWallMouseMove = useCallback((e: React.MouseEvent) => {
    if (!spotlightRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    spotlightRef.current.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`)
    spotlightRef.current.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`)
  }, [])

  const languages = [
    "All",
    ...Array.from(new Set(watched.map((m) => m.language).filter(Boolean))).sort(),
  ]

  if (loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#080808" }}
      >
        <p
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 16,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.3)",
          }}
        >
          Loading your wall...
        </p>
      </main>
    )
  }

  const showSpotlight = selectedLanguage === "All"

  return (
    <main className="min-h-screen" style={{ background: "#080808" }}>
      <Link
        href="/home"
        style={{
          position: "fixed",
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

      <style>{`
        @keyframes posterDrift {
          0% { background-position: 0% 0%; }
          50% { background-position: 100% 100%; }
          100% { background-position: 0% 0%; }
        }
      `}</style>

      <div
        style={{
          paddingTop: 100,
          paddingBottom: 40,
          textAlign: "center",
          background: "#080808",
        }}
      >
        <div
          style={{
            display: "inline-block",
            fontSize: "clamp(160px, 28vw, 300px)",
            fontWeight: 900,
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontStyle: "italic",
            lineHeight: 0.85,
            WebkitTextFillColor: collageUrl ? "transparent" : undefined,
            WebkitBackgroundClip: collageUrl ? "text" : undefined,
            backgroundClip: collageUrl ? "text" : undefined,
            backgroundImage: collageUrl ? `url(${collageUrl})` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            color: collageUrl ? "transparent" : "rgba(255,255,255,0.5)",
            filter: collageUrl ? "saturate(1.2) contrast(1.05)" : "none",
            animation: collageUrl ? "posterDrift 20s ease-in-out infinite" : "none",
          }}
        >
          {watched.length}
        </div>

        <p
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 16,
            fontWeight: 400,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.35)",
            marginTop: 16,
            letterSpacing: "0.02em",
          }}
        >
          films. Every one meant something.
        </p>
      </div>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          display: "flex",
          justifyContent: "center",
          gap: 6,
          padding: "16px 0",
          background:
            "linear-gradient(to bottom, #080808 0%, #080808 60%, transparent 100%)",
        }}
      >
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => setSelectedLanguage(prev => prev === lang ? "All" : lang)}
            style={{
              fontFamily: "-apple-system, sans-serif",
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color:
                selectedLanguage === lang
                  ? "rgba(255,255,255,0.85)"
                  : "rgba(255,255,255,0.3)",
              padding: "6px 14px",
              border:
                selectedLanguage === lang
                  ? "1px solid rgba(255,255,255,0.2)"
                  : "1px solid transparent",
              borderRadius: 999,
              background:
                selectedLanguage === lang
                  ? "rgba(255,255,255,0.06)"
                  : "transparent",
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
          >
            {lang}
          </button>
        ))}
      </div>

      {/* 3D perspective wrapper */}
      <div style={{ perspective: "1200px", perspectiveOrigin: "50% 50%" }}>
        <div
          ref={wallRef}
          onMouseMove={handleWallMouseMove}
          style={{
            position: "relative",
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: "transform 0.15s ease-out",
            transformStyle: "preserve-3d",
          }}
        >
          <div
            ref={gridRef}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 0,
              width: "100%",
            }}
          >
            {watched.map((film, i) => {
              const row = Math.floor(i / columns)
              const parallaxOffset = row % 2 === 0 ? scrollY * 0.02 : scrollY * -0.02

              const isNeighbor =
                hoveredIndex !== null &&
                hoveredIndex !== i &&
                (i === hoveredIndex - 1 ||
                  i === hoveredIndex + 1 ||
                  i === hoveredIndex - columns ||
                  i === hoveredIndex + columns)

              return (
                <WallPoster
                  key={film.id}
                  film={film}
                  isFiltered={
                    selectedLanguage !== "All" &&
                    film.language !== selectedLanguage
                  }
                  isNeighbor={isNeighbor}
                  onHover={() => setHoveredIndex(i)}
                  onLeave={() => setHoveredIndex(null)}
                  onClick={() => router.push(`/movie/${film.id}`)}
                  parallaxOffset={parallaxOffset}
                />
              )
            })}
          </div>

          {/* Spotlight overlay */}
          {showSpotlight && (
            <div
              ref={spotlightRef}
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle 250px at var(--mouse-x, 50%) var(--mouse-y, 50%), transparent 0%, rgba(0,0,0,0.55) 100%)",
                pointerEvents: "none",
                zIndex: 20,
              }}
            />
          )}
        </div>
      </div>

      <div
        style={{
          padding: "80px 0",
          textAlign: "center",
          background: "#080808",
        }}
      >
        <p
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 13,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.15)",
          }}
        >
          The reel keeps rolling.
        </p>
      </div>
    </main>
  )
}
