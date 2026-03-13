"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getWatched } from "@/lib/db"
import type { Movie } from "@/lib/types"
import RatingDisplay from "@/components/RatingDisplay"

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

  const scale = hovered ? 1.04 : isNeighbor ? 1.01 : 1
  const z = hovered ? 12 : isNeighbor ? 1 : 0

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
        boxShadow: hovered ? "0 12px 36px rgba(10,12,18,0.5)" : "none",
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
            ? "linear-gradient(to top, rgba(10,12,18,0.85) 0%, rgba(10,12,18,0.3) 40%, transparent 70%)"
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

        {film.rating != null && (
          <div
            style={{
              opacity: hovered ? 1 : 0,
              transform: hovered ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.3s ease 0.1s, transform 0.3s ease 0.1s",
              marginTop: 4,
            }}
          >
            <RatingDisplay rating={film.rating} size="sm" />
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
  const gridRef = useRef<HTMLDivElement>(null)

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

  // Dense poster mosaic masked to digit shape via canvas destination-in (no tainted canvas — proxy same-origin)
  useEffect(() => {
    if (watched.length === 0) {
      setCollageUrl(null)
      return
    }

    const count = watched.length
    const CELL = 52
    const GAP = 3
    const STEP = CELL + GAP
    const W = 1800
    const H = 640
    const canvas = document.createElement("canvas")
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Slight gutter between tiles (2–4px effective via GAP)
    ctx.fillStyle = "#121419"
    ctx.fillRect(0, 0, W, H)

    const cols = Math.ceil(W / STEP)
    const rows = Math.ceil(H / STEP)

    // Same-origin proxy so drawImage doesn't taint canvas (toDataURL works)
    const proxied = (posterUrl: string) =>
      `/api/poster-proxy?url=${encodeURIComponent(posterUrl)}`

    const loadImage = (src: string): Promise<HTMLImageElement | null> =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = proxied(src)
      })

    let cancelled = false
    ;(async () => {
      const loaded = await Promise.all(watched.map((f) => loadImage(f.poster)))
      if (cancelled) return
      const images = loaded.filter((img): img is HTMLImageElement => img != null)
      if (images.length === 0) return

      // Dense grid: every cell filled, cycle posters
      let idx = 0
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * STEP
          const y = row * STEP
          const img = images[idx % images.length]
          idx++
          const iw = img.naturalWidth || img.width
          const ih = img.naturalHeight || img.height
          ctx.save()
          ctx.beginPath()
          ctx.rect(x, y, CELL, CELL)
          ctx.clip()
          const scale = Math.max(CELL / iw, CELL / ih)
          const dw = iw * scale
          const dh = ih * scale
          ctx.drawImage(
            img,
            0,
            0,
            iw,
            ih,
            x + (CELL - dw) / 2,
            y + (CELL - dh) / 2,
            dw,
            dh
          )
          ctx.restore()
        }
      }

      // Mask: keep poster pixels only where text is (destination-in = dest kept where source opaque)
      ctx.save()
      ctx.globalCompositeOperation = "destination-in"
      ctx.fillStyle = "#fff"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.font = `italic 900 ${Math.min(H * 0.92, 520)}px Georgia, "Times New Roman", serif`
      ctx.fillText(String(count), W / 2, H / 2 + H * 0.02)
      ctx.restore()

      if (!cancelled) {
        // PNG preserves transparency outside glyphs so page bg shows through
        setCollageUrl(canvas.toDataURL("image/png"))
      }
    })()

    return () => {
      cancelled = true
    }
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
        // Subtle tilt only — was ±3deg, now ~±0.9deg max
        setTilt({
          x: ((e.clientY - centerY) / centerY) * -0.9,
          y: ((e.clientX - centerX) / centerX) * 0.9,
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

  const languages = [
    "All",
    ...Array.from(new Set(watched.map((m) => m.language).filter(Boolean))).sort(),
  ]

  if (loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#121419" }}
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

  return (
    <main className="min-h-screen" style={{ background: "#121419" }}>
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

      {/* Cool-toned ambient gradient */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(80,100,180,0.03) 0%, transparent 60%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />


      <div
        style={{
          paddingTop: 100,
          paddingBottom: 40,
          textAlign: "center",
          background: "#121419",
        }}
      >
        {/* Mosaic is pre-masked in canvas (destination-in); display as image — no background-clip */}
        {collageUrl ? (
          <img
            src={collageUrl}
            alt={`${watched.length} films`}
            style={{
              display: "block",
              margin: "0 auto",
              maxWidth: "min(95vw, 900px)",
              width: "auto",
              height: "auto",
              imageRendering: "auto",
              filter: "saturate(1.1) contrast(1.06)",
            }}
          />
        ) : (
          <div
            style={{
              display: "inline-block",
              fontSize: "clamp(160px, 28vw, 300px)",
              fontWeight: 900,
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontStyle: "italic",
              lineHeight: 0.85,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {watched.length}
          </div>
        )}

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
            "linear-gradient(to bottom, #121419 0%, #121419 60%, transparent 100%)",
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
                  ? "1px solid rgba(255,255,255,0.15)"
                  : "1px solid transparent",
              borderRadius: 999,
              background:
                selectedLanguage === lang
                  ? "rgba(255,255,255,0.06)"
                  : "transparent",
              cursor: "pointer",
              transition: "all 0.35s ease-out",
            }}
          >
            {lang}
          </button>
        ))}
      </div>

      {/* Light depth — high perspective + small rotate = barely there 3D */}
      <div
        style={{
          perspective: "3200px",
          perspectiveOrigin: "50% 45%",
        }}
      >
        <div
          style={{
            position: "relative",
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: "transform 0.35s ease-out",
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
              const parallaxOffset =
                row % 2 === 0 ? scrollY * 0.006 : scrollY * -0.006

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
        </div>
      </div>

      <div
        style={{
          padding: "80px 0",
          textAlign: "center",
          background: "#121419",
        }}
      >
        <p
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 13,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.12)",
          }}
        >
          The reel keeps rolling.
        </p>
      </div>
    </main>
  )
}
