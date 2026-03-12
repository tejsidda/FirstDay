"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getMovieCredits, getMovieImages, getPersonFilmography, getMovieKeywords, posterURL } from "@/lib/tmdb"
import { updateReview } from "@/lib/db"

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

function defaultHeadlineForRating(rating?: number, isWatchlisted?: boolean) {
  if (rating === 5) return "A MASTERPIECE"
  if (rating === 4) return "WORTH EVERY MINUTE"
  if (rating === 3) return "IT HAD ITS MOMENTS"
  if (rating === 2) return "NOT QUITE THERE"
  if (rating === 1) return "NOT FOR ME"
  if (isWatchlisted) return "ON YOUR WATCHLIST"
  return ""
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
    const handleScroll = () => {
      const scrollY = window.scrollY
      const fadeStart = 0
      const fadeEnd = window.innerHeight * 0.7
      const progress = Math.min(Math.max((scrollY - fadeStart) / (fadeEnd - fadeStart), 0), 1)
      setHeroOpacity(1 - progress)
      setHeroScale(1 - progress * 0.05)
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

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

  const ratingStars =
    typeof dbRecord?.rating === "number"
      ? "★".repeat(Math.max(0, Math.min(5, dbRecord.rating)))
      : null

  const posterSrc =
    dbRecord?.poster ||
    (movie?.poster_path ? posterURL(movie.poster_path) : images.posters[0] || "")

  const g0 = images.backdrops[0] || posterSrc
  const g1 = images.backdrops[1] || posterSrc
  const g2 = images.backdrops[2] || posterSrc

  const queueHeroMotion = (x: number, y: number, active: boolean) => {
    latestMotionRef.current = { x, y, active }
    if (motionRafRef.current != null) return
    motionRafRef.current = requestAnimationFrame(() => {
      setHeroMotion(latestMotionRef.current)
      motionRafRef.current = null
    })
  }

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
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
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#0C0C10" }}>
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
        background: "#0C0C10",
        color: "rgba(255,255,255,0.85)",
        fontFamily: 'Georgia, "Times New Roman", serif',
        scrollBehavior: "smooth",
      }}
    >
      <style>{`
        .person-btn:hover { color: rgba(255,255,255,0.65) !important; }
      `}</style>
      <div style={{ position: "relative" }}>
      {/* Hero — final structured backdrop grid */}
      <section
        className="relative w-full overflow-hidden"
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 1,
          marginBottom: 0,
          background: "#0C0C10",
          opacity: heroOpacity,
          transform: `scale(${heroScale})`,
          transition: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "center top",
            willChange: "opacity, transform",
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
                  <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                <img src={images.backdrops[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ gridColumn: "2", gridRow: "1", overflow: "hidden" }}>
                <img src={images.backdrops[1]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ gridColumn: "2", gridRow: "2", overflow: "hidden" }}>
                <img src={images.backdrops[2]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                  <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
              background: "rgba(12,12,16,0.2)",
              zIndex: 2,
              pointerEvents: "none",
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
                mixBlendMode: "difference",
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
          background: "#0C0C10",
          boxShadow: "0 -20px 60px rgba(12,12,16,0.9)",
          paddingTop: 80,
          borderRadius: "24px 24px 0 0",
        }}
      >

      {/* Section 2: Title + Metadata + Genres */}
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

        <div className="flex flex-wrap" style={{ gap: 0, marginTop: 28 }}>
          <div className="min-w-[140px] flex-1">
            <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 9, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
              Director
            </div>
            <button
              className="person-btn"
              onClick={() => handlePersonClick(credits.director)}
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
              <div style={{ color: "#f5c518", fontSize: 14, marginTop: 8 }}>
                {"★".repeat(Math.max(0, Math.min(5, dbRecord.rating)))}
                {"☆".repeat(5 - Math.max(0, Math.min(5, dbRecord.rating)))}
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

      {/* Section 3: Review section */}
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

      {/* Keywords */}
      {keywords.length > 0 && (
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
      )}

      {/* Section 4: Poster + Cast + Filmography */}
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
              style={{ width: 220, borderRadius: 6, boxShadow: '0 8px 32px rgba(12,12,16,0.5)' }}
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
            opacity: 1,
            transition: 'opacity 0.3s ease',
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
