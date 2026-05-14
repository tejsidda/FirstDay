"use client"

import { useEffect, useRef, useState } from "react"
import type { MouseEvent as ReactMouseEvent } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getMovieCredits, getMovieImages, getPersonFilmography, getMovieKeywords, posterURL } from "@/lib/tmdb"
import { updateReview } from "@/lib/db"
import RatingDisplay from "@/components/RatingDisplay"

const LANG_MAP: Record<string, string> = {
  ml: "Malayalam", ko: "Korean", te: "Telugu", ta: "Tamil",
  hi: "Hindi", ja: "Japanese", en: "English", fr: "French",
  es: "Spanish", de: "German", it: "Italian", zh: "Chinese",
  pt: "Portuguese", ru: "Russian", ar: "Arabic", th: "Thai",
  kn: "Kannada", bn: "Bengali", mr: "Marathi", pa: "Punjabi",
}

function monthYear(date?: string) {
  if (!date) return "Unknown"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "Unknown"
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

/** 1–10 scale headlines (bands include .5) */
function defaultHeadlineForRating(rating?: number | null, isWatchlisted?: boolean) {
  if (rating == null || Number.isNaN(rating)) {
    if (isWatchlisted) return "ON YOUR WATCHLIST"
    return ""
  }
  const r = Math.max(1, Math.min(10, rating))
  if (r >= 9) return "A MASTERPIECE"
  if (r >= 7) return "WORTH EVERY MINUTE"
  if (r >= 5) return "IT HAD ITS MOMENTS"
  if (r >= 3) return "NOT QUITE THERE"
  return "NOT FOR ME"
}

const useFadeInOnScroll = (offset = 100) => {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handle = () => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      if (rect.top < window.innerHeight - offset) {
        setVisible(true)
      }
    }
    window.addEventListener("scroll", handle, { passive: true })
    handle()
    return () => window.removeEventListener("scroll", handle)
  }, [offset])

  return { ref, visible }
}

export default function MovieDetailPage() {
  const params = useParams()
  const tmdbParam = params.id as string | string[] | undefined
  const tmdbId = Array.isArray(tmdbParam) ? tmdbParam[0] : tmdbParam || ""
  const router = useRouter()

  const [movie, setMovie] = useState<any>(null)
  const [credits, setCredits] = useState<{ director: string; cast: string[] }>({
    director: "",
    cast: [],
  })
  const [images, setImages] = useState<{ backdrops: string[]; posters: string[] }>({
    backdrops: [],
    posters: [],
  })
  const [dbRecord, setDbRecord] = useState<any>(null)
  const [isWatchlisted, setIsWatchlisted] = useState(false)
  const [loading, setLoading] = useState(true)

  const [headline, setHeadline] = useState("")
  const [body, setBody] = useState("")
  const [editingReview, setEditingReview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
  const [filmography, setFilmography] = useState<{ id: number; title: string; year: number }[]>([])
  const [loadingFilmography, setLoadingFilmography] = useState(false)
  const [keywords, setKeywords] = useState<string[]>([])
  const [heroOpacity, setHeroOpacity] = useState(1)
  const [heroScale, setHeroScale] = useState(1)
  const [heroMotion, setHeroMotion] = useState({ x: 0, y: 0, active: false })
  const motionRafRef = useRef<number | null>(null)
  const latestMotionRef = useRef({ x: 0, y: 0, active: false })
  const [smoothScroll, setSmoothScroll] = useState(0)
  const scrollRef = useRef(0)
  const smoothRafRef = useRef<number | null>(null)
  const lastSmoothEmitRef = useRef(0)

  useEffect(() => {
    if (!tmdbId) return

    async function loadAll() {
      setLoading(true)

      const TOKEN = process.env.NEXT_PUBLIC_TMDB_TOKEN
      const detailsRes = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}?language=en-US`,
        {
          headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        }
      )
      const details = await detailsRes.json()
      setMovie(details)

      const [creds, imgs, kws] = await Promise.all([
        getMovieCredits(tmdbId),
        getMovieImages(tmdbId),
        getMovieKeywords(tmdbId),
      ])
      setCredits(creds)
      setKeywords(kws)

      const uniqueBackdrops = imgs.backdrops.filter(
        (url: string, index: number, arr: string[]) => arr.indexOf(url) === index
      )
      const supplemented = [...uniqueBackdrops]
      while (supplemented.length < 3) {
        if (details?.poster_path) {
          supplemented.push(posterURL(details.poster_path))
        } else if (imgs.posters[0]) {
          supplemented.push(imgs.posters[0])
        } else {
          break
        }
      }
      setImages({ ...imgs, backdrops: supplemented.slice(0, 4) })

      const { data: watchedData } = await supabase
        .from("watched")
        .select("*")
        .eq("tmdb_id", tmdbId)
        .limit(1)
      if (watchedData && watchedData.length > 0) {
        setDbRecord(watchedData[0])
        setHeadline(watchedData[0].review_headline || "")
        setBody(watchedData[0].review_body || "")
      }

      const { data: wlData } = await supabase
        .from("watchlist")
        .select("id")
        .eq("tmdb_id", tmdbId)
        .limit(1)
      setIsWatchlisted(wlData != null && wlData.length > 0)

      setLoading(false)
    }

    loadAll()
  }, [tmdbId])

  useEffect(() => {
    return () => {
      if (smoothRafRef.current != null) cancelAnimationFrame(smoothRafRef.current)
    }
  }, [])

  // Smoothed scroll driver (single rAF loop)
  useEffect(() => {
    const update = () => {
      scrollRef.current += (window.scrollY - scrollRef.current) * 0.08
      const next = scrollRef.current
      if (Math.abs(next - lastSmoothEmitRef.current) > 0.25) {
        lastSmoothEmitRef.current = next
        setSmoothScroll(next)
      }
      smoothRafRef.current = requestAnimationFrame(update)
    }
    update()
    return () => {
      if (smoothRafRef.current != null) cancelAnimationFrame(smoothRafRef.current)
    }
  }, [])

  // Scroll-driven hero dissolve (uses smoothed scroll)
  useEffect(() => {
    const vh = window.innerHeight
    const progress = Math.min(smoothScroll / (vh * 0.9), 1)
    const nextOpacity = 1 - progress * 1.05
    const nextScale = 1 - progress * 0.08
    setHeroOpacity(Math.max(0, nextOpacity))
    setHeroScale(Math.max(0.9, nextScale))
  }, [smoothScroll])

  useEffect(() => {
    return () => {
      if (motionRafRef.current != null) {
        cancelAnimationFrame(motionRafRef.current)
      }
    }
  }, [])

  const handleSaveReview = async () => {
    if (!tmdbId) return
    setSaving(true)
    const success = await updateReview(tmdbId, headline, body || undefined)
    if (success) {
      setEditingReview(false)
      setDbRecord((prev: any) =>
        prev ? { ...prev, review_headline: headline, review_body: body } : prev
      )
    }
    setSaving(false)
  }

  const handlePersonClick = async (name: string) => {
    if (selectedPerson === name) {
      setSelectedPerson(null)
      setFilmography([])
      return
    }
    setSelectedPerson(name)
    setLoadingFilmography(true)
    const films = await getPersonFilmography(name)
    setFilmography(films)
    setLoadingFilmography(false)
  }

  const displayHeadline =
    (dbRecord?.review_headline as string | undefined) ||
    defaultHeadlineForRating(dbRecord?.rating, isWatchlisted)


  const posterSrc =
    dbRecord?.poster ||
    (movie?.poster_path ? posterURL(movie.poster_path) : images.posters[0] || "")

  const g0 = images.backdrops[0] || posterSrc
  const g1 = images.backdrops[1] || posterSrc
  const g2 = images.backdrops[2] || posterSrc

  const depth = 1 - heroOpacity
  const contentLift = Math.min(smoothScroll / 500, 1)
  const posterBaseTransform = `
    perspective(800px)
    rotateY(${heroMotion.x * 6}deg)
    rotateX(${heroMotion.y * -6}deg)
    translateY(${(1 - heroOpacity) * 10}px)
  `

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.opacity = "0.3"
  }

  const buttonMicro = {
    onMouseDown: (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = "scale(0.96)"
    },
    onMouseUp: (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = "scale(1)"
    },
    onMouseEnter: (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = "scale(1.04)"
    },
    onMouseLeave: (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = "scale(1)"
    },
  }

  const metaFade = useFadeInOnScroll(120)
  const reviewFade = useFadeInOnScroll(140)
  const keywordsFade = useFadeInOnScroll(160)
  const castFade = useFadeInOnScroll(160)

  const queueHeroMotion = (x: number, y: number, active: boolean) => {
    latestMotionRef.current = { x, y, active }
    if (motionRafRef.current != null) return
    motionRafRef.current = requestAnimationFrame(() => {
      setHeroMotion(latestMotionRef.current)
      motionRafRef.current = null
    })
  }

  const handleHeroMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
    const ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
    queueHeroMotion(Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, ny)), true)
  }

  const handleHeroMouseLeave = () => {
    queueHeroMotion(0, 0, false)
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--background-movie)" }}>
        <p style={{ color: "rgba(255,255,255,0.3)", fontStyle: "italic", fontFamily: 'Georgia, "Times New Roman", serif' }}>
          Loading...
        </p>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen"
      style={{
        background: "var(--background-movie)",
        color: "rgba(255,255,255,0.85)",
        fontFamily: 'Georgia, "Times New Roman", serif',
        scrollBehavior: "smooth",
      }}
    >
      <style>{`
        .person-btn:hover { color: rgba(255,255,255,0.65) !important; }
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0px);
          }
        }
        .no-jank { transform: translateZ(0); }
      `}</style>
      <div style={{ position: "relative" }}>
      {/* Hero — final structured backdrop grid */}
      <section
        className="relative w-full overflow-hidden"
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 1,
          marginBottom: 0,
          background: "var(--background-movie)",
          opacity: heroOpacity,
          transition: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "center top",
            willChange: "opacity, transform",
            transform: `
              scale(${heroScale + 0.03 * depth})
              translate3d(${heroMotion.x * 25 * (1 + depth)}px, ${heroMotion.y * 15 * (1 + depth)}px, 0)
            `,
            transition: "transform 600ms cubic-bezier(0.22, 1, 0.36, 1)",
            filter: `blur(${(1 - heroOpacity) * 8}px) brightness(${1 - (1 - heroOpacity) * 0.2})`,
          }}
        >
          {images.backdrops.length >= 4 ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr",
                gridTemplateRows: "1.1fr 1fr",
                gap: 4,
                zIndex: 1,
              }}
            >
              {images.backdrops.slice(0, 4).map((src, i) => (
                <div key={i} style={{ overflow: "hidden" }}>
                  <img
                    src={src}
                    alt=""
                    onError={handleImgError}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          ) : images.backdrops.length === 3 ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: "1fr 1fr",
                gap: 4,
                padding: 0,
                zIndex: 1,
              }}
            >
              <div style={{ gridColumn: "1", gridRow: "1 / 3", overflow: "hidden" }}>
                <img
                  src={images.backdrops[0]}
                  alt=""
                  onError={handleImgError}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div style={{ gridColumn: "2", gridRow: "1", overflow: "hidden" }}>
                <img
                  src={images.backdrops[1]}
                  alt=""
                  onError={handleImgError}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div style={{ gridColumn: "2", gridRow: "2", overflow: "hidden" }}>
                <img
                  src={images.backdrops[2]}
                  alt=""
                  onError={handleImgError}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            </div>
          ) : images.backdrops.length === 2 ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr",
                gridTemplateRows: "1fr",
                gap: 4,
                zIndex: 1,
              }}
            >
              {images.backdrops.slice(0, 2).map((src, i) => (
                <div key={i} style={{ overflow: "hidden" }}>
                  <img
                    src={src}
                    alt=""
                    onError={handleImgError}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                position: "absolute",
                inset: -50,
                backgroundImage: `url(${posterSrc})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(30px) brightness(0.5)",
                transform: "scale(1.3)",
                zIndex: 1,
              }}
            />
          )}

          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, rgba(12,12,16,0.2), rgba(12,12,16,0.85))",
              zIndex: 2,
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle at center, transparent 40%, rgba(12,12,16,0.6))",
              zIndex: 3,
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 48px",
              pointerEvents: "none",
            }}
          >
            <h1
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: "clamp(50px, 11vw, 140px)",
                fontWeight: 700,
                fontStyle: "italic",
                color: "rgba(255,255,255,0.92)",
                letterSpacing: "-0.04em",
                lineHeight: 0.9,
                textAlign: "center",
                textTransform: "uppercase",
                mixBlendMode: "overlay",
                opacity: heroOpacity,
                transform: `
                  translateY(${(1 - heroOpacity) * -40}px)
                  scale(${1 + (1 - heroOpacity) * 0.05})
                `,
                transition: "transform 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 600ms cubic-bezier(0.22, 1, 0.36, 1)",
                textShadow: "0 0 80px rgba(12,12,16,0.5), 0 0 40px rgba(12,12,16,0.3)",
                WebkitTextStroke: "1px rgba(255,255,255,0.15)",
              }}
            >
              {movie?.title || "Untitled"}
            </h1>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            opacity: heroOpacity,
          }}
        >
          <div
            style={{
              width: 1,
              height: 28,
              background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.25))",
            }}
          />
          <span
            style={{
              fontFamily: "-apple-system, sans-serif",
              fontSize: 8,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.25)",
            }}
          >
            Scroll
          </span>
        </div>

        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          {...buttonMicro}
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            zIndex: 50,
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "rgba(12,12,16,0.5)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "white",
            fontSize: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ←
        </button>
      </section>
      <div
        style={{
          position: "relative",
          zIndex: 30,
          background: "var(--background-movie)",
          boxShadow: "0 -20px 60px rgba(12,12,16,0.9)",
          paddingTop: 80,
          borderRadius: "24px 24px 0 0",
          transform: `translateY(${(1 - contentLift) * 40}px)`,
          opacity: contentLift,
          transition: "transform 700ms cubic-bezier(0.22,1,0.36,1), opacity 700ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >

      {/* Section 2: Title + Metadata + Genres */}
      <div
        ref={metaFade.ref}
        style={{
          opacity: metaFade.visible ? 1 : 0,
          transform: metaFade.visible ? "translateY(0px)" : "translateY(20px)",
          transition: "all 600ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div style={{ maxWidth: 900, marginTop: 0, marginBottom: 0, marginLeft: "auto", marginRight: "auto", padding: "0 48px" }}>
        <h1
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 44,
            fontWeight: 400,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.9)",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            marginTop: 0,
            position: "relative",
            zIndex: 10,
            transform: `translate3d(${heroMotion.x * 5}px, ${heroMotion.y * 4}px, 0)`,
            transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            textShadow: "0 4px 30px rgba(12,12,16,0.6)",
          }}
        >
          {movie?.title || "Untitled"}
        </h1>

        {movie?.tagline && (
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.4)",
              fontStyle: "italic",
              marginTop: 12,
              textAlign: "center",
            }}
          >
            {movie.tagline}
          </p>
        )}

        <div className="flex flex-wrap" style={{ gap: 0, marginTop: 28 }}>
          <div className="min-w-[140px] flex-1">
            <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 9, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
              Director
            </div>
            <button
              className="person-btn"
              onClick={() => handlePersonClick(credits.director)}
              {...buttonMicro}
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: 14,
                fontWeight: 400,
                color: selectedPerson === credits.director ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                marginTop: 8,
                transition: 'color 0.2s ease',
                display: 'block',
              }}
            >
              {credits.director || "Unknown"}
            </button>
          </div>
          <div className="min-w-[140px] flex-1">
            <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 9, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
              Language
            </div>
            <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 14, fontWeight: 400, color: "rgba(255,255,255,0.7)", marginTop: 8 }}>
              {LANG_MAP[movie?.original_language] || movie?.original_language || dbRecord?.language || "Unknown"}
            </div>
          </div>
          <div className="min-w-[140px] flex-1">
            <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 9, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
              Release
            </div>
            <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 14, fontWeight: 400, color: "rgba(255,255,255,0.7)", marginTop: 8 }}>
              {monthYear(movie?.release_date)}
            </div>
          </div>
          <div className="min-w-[140px] flex-1">
            <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 9, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
              Genre
            </div>
            <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 14, fontWeight: 400, color: "rgba(255,255,255,0.7)", marginTop: 8 }}>
              {movie?.genres?.[0]?.name || "N/A"}
            </div>
          </div>
          <div className="min-w-[140px] flex-1">
            <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 9, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
              Rating
            </div>
            {typeof dbRecord?.rating === "number" ? (
              <div style={{ marginTop: 8 }}>
                <RatingDisplay rating={dbRecord.rating} size="md" />
              </div>
            ) : (
              <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 14, fontWeight: 400, color: "rgba(255,255,255,0.5)", marginTop: 8, fontStyle: "italic" }}>
                Not rated
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap" style={{ gap: 8, marginTop: 16 }}>
          {(movie?.genres || []).map((genre: any) => (
            <span
              key={genre.id}
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
                padding: "5px 14px",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 999,
              }}
            >
              {genre.name}
            </span>
          ))}
        </div>
      </div>
      </div>

      {/* Section 3: Review section */}
      <div
        ref={reviewFade.ref}
        style={{
          opacity: reviewFade.visible ? 1 : 0,
          transform: reviewFade.visible ? "translateY(0px)" : "translateY(20px)",
          transition: "all 600ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 1,
            background: "rgba(255,255,255,0.08)",
            margin: "40px auto 24px",
          }}
        />
        <div style={{ maxWidth: 900, marginLeft: "auto", marginRight: "auto", padding: "0 48px", marginTop: 48 }}>
        {!editingReview ? (
          <>
            {displayHeadline && (
              <h2
                style={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontSize: 36,
                  fontWeight: 400,
                  fontStyle: "italic",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.3,
                }}
              >
                {displayHeadline}
              </h2>
            )}

            {(dbRecord?.review_body || body) && (
              <p
                style={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontSize: 15,
                  fontWeight: 400,
                  color: "rgba(255,255,255,0.4)",
                  lineHeight: 1.8,
                  marginTop: 20,
                  maxWidth: 600,
                }}
              >
                {dbRecord?.review_body || body}
              </p>
            )}

            {dbRecord ? (
              <button
                type="button"
                onClick={() => setEditingReview(true)}
                {...buttonMicro}
                style={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontSize: 13,
                  fontStyle: "italic",
                  color: "rgba(255,255,255,0.2)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  marginTop: 16,
                  transition: "color 0.3s ease",
                }}
              >
                {dbRecord?.review_headline ? "Edit review" : "Write a review"}
              </button>
            ) : (
              <p
                style={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontSize: 13,
                  fontStyle: "italic",
                  color: "rgba(255,255,255,0.22)",
                  marginTop: 16,
                }}
              >
                Mark this movie as watched to write your review.
              </p>
            )}
          </>
        ) : (
          <div>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="How did it make you feel?"
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: 28,
                fontWeight: 400,
                fontStyle: "italic",
                color: "rgba(255,255,255,0.8)",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                width: "100%",
                paddingBottom: 8,
                outline: "none",
              }}
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your thoughts... (optional)"
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: 15,
                fontWeight: 400,
                color: "rgba(255,255,255,0.5)",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                width: "100%",
                marginTop: 20,
                paddingBottom: 8,
                minHeight: 100,
                outline: "none",
                resize: "vertical",
                lineHeight: 1.8,
              }}
            />
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button
                type="button"
                onClick={handleSaveReview}
                disabled={saving}
                {...buttonMicro}
                style={{
                  fontFamily: "-apple-system, sans-serif",
                  fontSize: 12,
                  padding: "8px 20px",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 6,
                  background: "transparent",
                  color: "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingReview(false)
                  setHeadline(dbRecord?.review_headline || "")
                  setBody(dbRecord?.review_body || "")
                }}
                {...buttonMicro}
                style={{
                  fontFamily: "-apple-system, sans-serif",
                  fontSize: 12,
                  padding: "8px 20px",
                  border: "none",
                  background: "transparent",
                  color: "rgba(255,255,255,0.3)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Keywords */}
      {keywords.length > 0 && (
        <div
          ref={keywordsFade.ref}
          style={{
            opacity: keywordsFade.visible ? 1 : 0,
            transform: keywordsFade.visible ? "translateY(0px)" : "translateY(20px)",
            transition: "all 600ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <div style={{
            maxWidth: 900,
            marginLeft: 'auto',
            marginRight: 'auto',
            paddingLeft: 48,
            paddingRight: 48,
            marginTop: 40,
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px' }}>
              {keywords.slice(0, 12).map((keyword, i) => (
                <span key={i} style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: 11,
                  fontStyle: 'italic',
                  color: `rgba(255,255,255,${0.15 + (i % 3) * 0.05})`,
                  letterSpacing: '0.02em',
                }}>
                  {keyword}{i < Math.min(keywords.length, 12) - 1 ? ' ·' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Poster + Cast + Filmography */}
      <div
        ref={castFade.ref}
        style={{
          opacity: castFade.visible ? 1 : 0,
          transform: castFade.visible ? "translateY(0px)" : "translateY(20px)",
          transition: "all 600ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div style={{
          maxWidth: 1100,
          marginLeft: 'auto',
          marginRight: 'auto',
          paddingLeft: 48,
          paddingRight: 48,
          marginTop: 48,
          display: 'flex',
          gap: 40,
          alignItems: 'flex-start',
        }}>
        {/* Poster */}
        <div style={{ flexShrink: 0 }}>
          {posterSrc ? (
            <img
              src={posterSrc}
              alt={movie?.title || "Poster"}
              onError={handleImgError}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = (e.clientX - rect.left) / rect.width - 0.5
                const y = (e.clientY - rect.top) / rect.height - 0.5

                e.currentTarget.style.transform = `
                  perspective(800px)
                  rotateY(${x * 6}deg)
                  rotateX(${y * -6}deg)
                  scale(1.02)
                `
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = posterBaseTransform
              }}
              style={{
                width: 220,
                borderRadius: 6,
                boxShadow: '0 8px 32px rgba(12,12,16,0.5)',
                transition: "transform 200ms ease",
                transform: posterBaseTransform,
              }}
            />
          ) : null}
        </div>

        {/* Cast */}
        <div style={{ minWidth: 180 }}>
          <div style={{
            fontFamily: '-apple-system, sans-serif',
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.25)',
            marginBottom: 12,
          }}>
            Cast
          </div>

          {credits.cast.map((name: string, i: number) => (
            <button
              key={i}
              className="person-btn"
              onClick={() => handlePersonClick(name)}
              {...buttonMicro}
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: 14,
                fontWeight: 400,
                color: selectedPerson === name ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'color 0.2s ease',
                display: 'block',
                lineHeight: 2.2,
              }}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Filmography panel */}
        {selectedPerson && (
          <div style={{
            flex: 1,
            paddingLeft: 32,
            borderLeft: '1px solid rgba(255,255,255,0.05)',
            minHeight: 200,
            transform: selectedPerson ? "translateY(0px)" : "translateY(10px)",
            opacity: selectedPerson ? 1 : 0,
            transition: "all 0.4s cubic-bezier(0.22,1,0.36,1)",
          }}>
            <div style={{
              fontFamily: '-apple-system, sans-serif',
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.25)',
              marginBottom: 4,
            }}>
              Also by
            </div>
            <div style={{
              fontFamily: 'Georgia, serif',
              fontSize: 16,
              fontWeight: 400,
              fontStyle: 'italic',
              color: 'rgba(255,255,255,0.7)',
              marginBottom: 20,
            }}>
              {selectedPerson}
            </div>

            {loadingFilmography ? (
              <div style={{
                fontFamily: 'Georgia, serif',
                fontSize: 12,
                fontStyle: 'italic',
                color: 'rgba(255,255,255,0.2)',
              }}>
                Loading...
              </div>
            ) : (
              filmography.map((film, i) => (
                <div key={i} style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: 13,
                  fontWeight: 400,
                  color: 'rgba(255,255,255,0.4)',
                  lineHeight: 2,
                }}>
                  {film.title}
                  <span style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.2)',
                    marginLeft: 8,
                  }}>
                    {film.year || ''}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
        </div>
      </div>

      {/* Section 5: TMDB Description */}
      <div
        style={{
          maxWidth: 550,
          marginTop: 0,
          marginBottom: 0,
          marginLeft: "auto",
          marginRight: "auto",
          padding: "64px 48px 120px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 30,
            height: 1,
            background: "rgba(255,255,255,0.05)",
            marginTop: 0,
            marginBottom: 28,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        />
        <p
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 14,
            fontWeight: 400,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.25)",
            lineHeight: 1.8,
          }}
        >
          {movie?.overview || "No official description available."}
        </p>
      </div>
      </div>
      </div>
    </main>
  )
}
