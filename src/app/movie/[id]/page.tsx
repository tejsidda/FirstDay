"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  getMovieCredits,
  getMovieImages,
  getPersonFilmography,
  getMovieKeywords,
  posterURL,
  formatLanguage,
} from "@/lib/tmdb"
import {
  addToWatchlist,
  removeFromWatchlist,
  markAsWatched,
  updateReview,
} from "@/lib/db"
import type { Movie } from "@/lib/types"
import RatingDisplay from "@/components/RatingDisplay"
import StandingOvationInput from "@/components/StandingOvationInput"
import TopOverlayNav from "@/components/TopOverlayNav"
import MovieSearch from "@/components/MovieSearch"
import BackButton from "@/components/BackButton"

const CAST_PREVIEW = 12

type TMDBGenre = { id: number; name: string }
type TMDBMovie = {
  id: number
  title: string
  tagline?: string
  original_language?: string
  release_date?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  genres?: TMDBGenre[]
  runtime?: number
}

type WatchedRow = {
  id: string
  tmdb_id: string
  title: string
  year?: number
  language?: string
  poster: string
  backdrop?: string | null
  watched_at?: string | null
  rating?: number | string | null
  review_headline?: string | null
  review_body?: string | null
}

function monthYear(date?: string) {
  if (!date) return "Unknown"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "Unknown"
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function ratingNumber(r: unknown): number | null {
  if (r == null || r === "") return null
  const n = Number(r)
  return Number.isFinite(n) ? n : null
}

function PosterFallback({ title }: { title?: string }) {
  return (
    <div
      className="t-title-sm"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background:
          "linear-gradient(145deg, var(--background-elevated), var(--background-sunken))",
        color: "var(--text-faint-ui)",
        textAlign: "center",
      }}
    >
      {title || "No poster"}
    </div>
  )
}

function todayDateInput() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function dateInputToIso(value: string) {
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return new Date().toISOString()
  return new Date(y, m - 1, d, 12, 0, 0).toISOString()
}

export default function MovieDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const tmdbParam = params.id as string | string[] | undefined
  const tmdbId = Array.isArray(tmdbParam) ? tmdbParam[0] : tmdbParam || ""
  const rateOnLoad = searchParams?.get("rate") === "1"

  const [isMobile, setIsMobile] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [movie, setMovie] = useState<TMDBMovie | null>(null)
  const [credits, setCredits] = useState<{ director: string; cast: string[] }>({
    director: "",
    cast: [],
  })
  const [backdrop, setBackdrop] = useState<string | null>(null)
  const [dbRecord, setDbRecord] = useState<WatchedRow | null>(null)
  const [isWatchlisted, setIsWatchlisted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [headline, setHeadline] = useState("")
  const [body, setBody] = useState("")
  const [editingReview, setEditingReview] = useState(false)
  const [savingReview, setSavingReview] = useState(false)

  const [ratingOpen, setRatingOpen] = useState(false)
  const [ratingValue, setRatingValue] = useState<number | null>(null)
  const [savingRating, setSavingRating] = useState(false)
  const [watchedEarlier, setWatchedEarlier] = useState(false)
  const [watchedDate, setWatchedDate] = useState(todayDateInput())
  const [actionError, setActionError] = useState<string | null>(null)
  const rateOnLoadHandledRef = useRef(false)

  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
  const [filmography, setFilmography] = useState<
    { id: number; title: string; year: number }[]
  >([])
  const [loadingFilmography, setLoadingFilmography] = useState(false)

  const [keywords, setKeywords] = useState<string[]>([])
  const [castExpanded, setCastExpanded] = useState(false)
  const [heroScrollProgress, setHeroScrollProgress] = useState(0)

  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)")
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    let active = true
    const onScroll = () => {
      if (!active) return
      const vh = window.innerHeight || 1
      const y = window.scrollY
      const p = Math.min(Math.max(y / (vh * 0.8), 0), 1)
      setHeroScrollProgress(p)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      active = false
      window.removeEventListener("scroll", onScroll)
    }
  }, [])

  useEffect(() => {
    if (!tmdbId) return
    let active = true

    async function loadAll() {
      setLoading(true)

      const TOKEN = process.env.NEXT_PUBLIC_TMDB_TOKEN
      const detailsRes = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}?language=en-US`,
        {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      )
      const details = (await detailsRes.json()) as TMDBMovie
      if (!active) return
      setMovie(details)

      const [creds, imgs, kws] = await Promise.all([
        getMovieCredits(tmdbId),
        getMovieImages(tmdbId),
        getMovieKeywords(tmdbId),
      ])
      if (!active) return

      setCredits(creds)
      setKeywords(kws)
      setBackdrop(imgs.backdrops[0] || null)

      const { data: watchedData } = await supabase
        .from("watched")
        .select("*")
        .eq("tmdb_id", tmdbId)
        .limit(1)
      if (!active) return
      const row = watchedData && watchedData[0]
      if (row) {
        setDbRecord(row as WatchedRow)
        setHeadline((row as WatchedRow).review_headline || "")
        setBody((row as WatchedRow).review_body || "")
        setRatingValue(ratingNumber((row as WatchedRow).rating))
      }

      const { data: wlData } = await supabase
        .from("watchlist")
        .select("id")
        .eq("tmdb_id", tmdbId)
        .limit(1)
      if (!active) return
      setIsWatchlisted(wlData != null && wlData.length > 0)

      setLoading(false)
    }

    loadAll()
    return () => {
      active = false
    }
  }, [tmdbId])

  // Auto-open the rating panel when ?rate=1 is present (from search "Already watched")
  useEffect(() => {
    if (loading) return
    if (!rateOnLoad) return
    if (rateOnLoadHandledRef.current) return
    if (dbRecord) return
    rateOnLoadHandledRef.current = true
    // Defer to the next tick so the lint rule's "no setState in effect body" is satisfied,
    // and we still react to the query param after data has loaded.
    queueMicrotask(() => {
      setRatingValue((v) => v ?? 7)
      setRatingOpen(true)
      setWatchedEarlier(true)
    })
  }, [loading, rateOnLoad, dbRecord])

  const posterSrc =
    dbRecord?.poster ||
    (movie?.poster_path ? posterURL(movie.poster_path) : "")

  const heroSrc = backdrop || posterSrc

  const movieForDb = (): Movie | null => {
    if (!movie) return null
    return {
      id: String(tmdbId),
      title: movie.title,
      year: movie.release_date
        ? new Date(movie.release_date).getFullYear()
        : 0,
      language: formatLanguage(movie.original_language),
      poster: posterSrc || "",
      backdrop: backdrop || undefined,
    }
  }

  const handleAddWatchlist = async () => {
    const m = movieForDb()
    if (!m) return
    setBusy(true)
    const ok = await addToWatchlist(m)
    if (ok) setIsWatchlisted(true)
    setBusy(false)
  }

  const handleRemoveWatchlist = async () => {
    if (!tmdbId) return
    setBusy(true)
    const ok = await removeFromWatchlist(tmdbId)
    if (ok) setIsWatchlisted(false)
    setBusy(false)
  }

  const handleSaveRating = async () => {
    const m = movieForDb()
    if (!m || ratingValue == null) return
    setSavingRating(true)
    setActionError(null)
    const watchedAtIso = watchedEarlier
      ? dateInputToIso(watchedDate)
      : new Date().toISOString()
    const ok = await markAsWatched(m, ratingValue, {
      watchedAt: watchedAtIso,
    })
    if (!ok) {
      setActionError(
        "Couldn't fully save — try again. If this keeps happening, check your library and watchlist for duplicates.",
      )
      setSavingRating(false)
      return
    }
    const { data: watchedData } = await supabase
      .from("watched")
      .select("*")
      .eq("tmdb_id", tmdbId)
      .limit(1)
    if (watchedData && watchedData[0]) {
      setDbRecord(watchedData[0] as WatchedRow)
    }
    setIsWatchlisted(false)
    setRatingOpen(false)
    setWatchedEarlier(false)
    setWatchedDate(todayDateInput())
    setSavingRating(false)
  }

  const handleSaveReview = async () => {
    if (!tmdbId) return
    setSavingReview(true)
    const ok = await updateReview(tmdbId, headline, body || undefined)
    if (ok) {
      setEditingReview(false)
      setDbRecord((prev) =>
        prev
          ? { ...prev, review_headline: headline, review_body: body }
          : prev,
      )
    }
    setSavingReview(false)
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

  const ratingNum = ratingNumber(dbRecord?.rating)
  const hasReview = Boolean(dbRecord?.review_headline || dbRecord?.review_body)
  const isWatched = Boolean(dbRecord)
  const releaseYear = movie?.release_date
    ? new Date(movie.release_date).getFullYear()
    : null

  const visibleCast = castExpanded
    ? credits.cast
    : credits.cast.slice(0, CAST_PREVIEW)

  if (loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background-movie)" }}
      >
        <p className="t-meta" style={{ color: "var(--text-search)" }}>
          Loading…
        </p>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen"
      style={{
        background: "var(--background-movie)",
        color: "var(--text-emphasis)",
      }}
    >
      <TopOverlayNav onSearchClick={() => setSearchOpen(true)} />
      <BackButton />

      {/* ── Hero ── */}
      <section
        ref={heroRef}
        style={{
          position: "relative",
          height: isMobile ? "60vh" : "75vh",
          minHeight: 420,
          overflow: "hidden",
        }}
      >
        {heroSrc ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${heroSrc})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "brightness(0.55) saturate(1.1)",
              opacity: 1 - heroScrollProgress * 0.4,
              transform: `scale(${1 + heroScrollProgress * 0.04})`,
              transition: "opacity 0.2s linear, transform 0.2s linear",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(145deg, var(--background-elevated), var(--background-sunken))",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, transparent 0%, transparent 40%, var(--background-movie) 100%)",
          }}
        />
      </section>

      {/* ── Content ── */}
      <div
        style={{
          position: "relative",
          marginTop: isMobile ? -60 : -120,
          background: "var(--background-movie)",
          paddingBottom: isMobile ? 80 : 120,
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            padding: isMobile ? "0 20px" : "0 56px",
          }}
        >
          {/* ── Title ── */}
          <header style={{ paddingTop: isMobile ? 24 : 32 }}>
            <h1
              className="t-display"
              style={{ margin: 0, color: "var(--text-strong)" }}
            >
              {movie?.title || "Untitled"}
            </h1>
            {movie?.tagline && (
              <p
                className="t-title"
                style={{ margin: 0, marginTop: 12, color: "var(--text-dim)" }}
              >
                {movie.tagline}
              </p>
            )}

            {/* Status badge */}
            {(isWatched || isWatchlisted) && (
              <div
                className="t-button-sm"
                style={{
                  marginTop: 18,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  background: "var(--tint-base)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 999,
                  color: "var(--text-emphasis)",
                }}
              >
                {isWatched ? (
                  <>
                    <span>In your library</span>
                    {ratingNum != null && (
                      <RatingDisplay rating={ratingNum} size="sm" />
                    )}
                  </>
                ) : (
                  "On your watchlist"
                )}
              </div>
            )}
          </header>

          {/* ── Action bar ── */}
          <div
            style={{
              marginTop: 24,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {!isWatched && !isWatchlisted && (
              <PrimaryButton
                onClick={handleAddWatchlist}
                disabled={busy}
                label="Add to watchlist"
              />
            )}
            {isWatchlisted && !isWatched && (
              <SecondaryButton
                onClick={handleRemoveWatchlist}
                disabled={busy}
                label="Remove from watchlist"
              />
            )}
            {!isWatched ? (
              <PrimaryButton
                onClick={() => {
                  setRatingValue(ratingValue ?? 7)
                  setRatingOpen(true)
                }}
                disabled={busy}
                label="Mark as watched"
                variant={isWatchlisted ? "primary" : "secondary"}
              />
            ) : (
              <>
                <SecondaryButton
                  onClick={() => {
                    setRatingValue(ratingNum ?? 7)
                    setRatingOpen(true)
                  }}
                  label={ratingNum != null ? "Update rating" : "Add rating"}
                />
                <SecondaryButton
                  onClick={() => setEditingReview(true)}
                  label={hasReview ? "Edit review" : "Write review"}
                />
              </>
            )}
          </div>

          {/* ── Rating panel ── */}
          {ratingOpen && (
            <div
              style={{
                marginTop: 20,
                padding: isMobile ? 16 : 24,
                background: "var(--tint-base)",
                border: "1px solid var(--border-default)",
                borderRadius: 12,
              }}
            >
              <div
                className="t-label"
                style={{
                  color: "var(--text-label)",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                How much applause?
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <StandingOvationInput
                  value={ratingValue}
                  onChange={(v) => setRatingValue(v)}
                />
              </div>
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 18,
                  borderTop: "1px solid var(--border-default)",
                  display: "grid",
                  gap: 12,
                  maxWidth: 380,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                <label
                  className="t-label-value"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--text-emphasis)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={watchedEarlier}
                    onChange={(e) => {
                      const v = e.target.checked
                      setWatchedEarlier(v)
                      if (v && !watchedDate) setWatchedDate(todayDateInput())
                    }}
                  />
                  I watched this earlier — log a specific date
                </label>
                {watchedEarlier && (
                  <input
                    type="date"
                    value={watchedDate}
                    max={todayDateInput()}
                    onChange={(e) => setWatchedDate(e.target.value)}
                    aria-label="Watched on"
                    className="t-label-value"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-default)",
                      background: "var(--background-elevated)",
                      color: "var(--text-emphasis)",
                      outline: "none",
                    }}
                  />
                )}
              </div>

              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  gap: 10,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <PrimaryButton
                  onClick={handleSaveRating}
                  disabled={savingRating || ratingValue == null}
                  label={
                    savingRating
                      ? "Saving…"
                      : isWatched
                        ? "Update rating"
                        : "Mark as watched"
                  }
                />
                <SecondaryButton
                  onClick={() => {
                    setRatingOpen(false)
                    setWatchedEarlier(false)
                    setActionError(null)
                  }}
                  label="Cancel"
                />
              </div>

              {actionError && (
                <p
                  className="t-caption"
                  style={{
                    marginTop: 12,
                    color: "rgba(255,180,180,0.85)",
                    textAlign: "center",
                  }}
                >
                  {actionError}
                </p>
              )}
            </div>
          )}

          {/* ── Meta row ── */}
          <div
            style={{
              marginTop: 36,
              paddingTop: 24,
              borderTop: "1px solid var(--border-default)",
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(auto-fit, minmax(140px, 1fr))",
              gap: isMobile ? 20 : 28,
            }}
          >
            <MetaItem
              label="Director"
              value={
                <PersonButton
                  name={credits.director || "Unknown"}
                  isSelected={selectedPerson === credits.director}
                  onClick={() => handlePersonClick(credits.director)}
                  disabled={!credits.director}
                />
              }
            />
            <MetaItem
              label="Language"
              value={
                formatLanguage(
                  movie?.original_language || dbRecord?.language || "",
                ) || "Unknown"
              }
            />
            <MetaItem label="Release" value={monthYear(movie?.release_date)} />
            <MetaItem
              label="Genre"
              value={movie?.genres?.[0]?.name || "N/A"}
            />
            {movie?.runtime ? (
              <MetaItem
                label="Runtime"
                value={`${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`}
              />
            ) : null}
          </div>

          {(movie?.genres?.length || 0) > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 24,
              }}
            >
              {movie!.genres!.map((g) => (
                <span
                  key={g.id}
                  className="t-button-sm"
                  style={{
                    color: "var(--text-dim)",
                    padding: "5px 12px",
                    border: "1px solid var(--border-default)",
                    borderRadius: 999,
                  }}
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {/* ── Review ── */}
          {(isWatched || hasReview) && (
            <section
              style={{
                marginTop: 56,
                paddingTop: 40,
                borderTop: "1px solid var(--border-default)",
              }}
            >
              <SectionLabel>Your review</SectionLabel>
              {!editingReview ? (
                <>
                  {hasReview ? (
                    <>
                      {dbRecord?.review_headline && (
                        <h2
                          className="t-sub"
                          style={{
                            margin: 0,
                            marginTop: 12,
                            color: "var(--text-strong)",
                          }}
                        >
                          {dbRecord.review_headline}
                        </h2>
                      )}
                      {dbRecord?.review_body && (
                        <p
                          className="t-body-lg"
                          style={{
                            marginTop: 16,
                            color: "var(--text-emphasis)",
                            maxWidth: 640,
                          }}
                        >
                          {dbRecord.review_body}
                        </p>
                      )}
                    </>
                  ) : (
                    <p
                      className="t-meta"
                      style={{ marginTop: 12, color: "var(--text-dim)" }}
                    >
                      You haven&apos;t written a review yet.
                    </p>
                  )}
                </>
              ) : (
                <div style={{ marginTop: 12, maxWidth: 640 }}>
                  <input
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="A line that captures it"
                    aria-label="Review headline"
                    className="t-sub"
                    style={{
                      width: "100%",
                      color: "var(--text-strong)",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--border-default)",
                      padding: "8px 0",
                      outline: "none",
                    }}
                  />
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your thoughts… (optional)"
                    aria-label="Review body"
                    className="t-body"
                    style={{
                      width: "100%",
                      marginTop: 16,
                      color: "var(--text-emphasis)",
                      background: "transparent",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      padding: 12,
                      minHeight: 120,
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <PrimaryButton
                      onClick={handleSaveReview}
                      disabled={savingReview}
                      label={savingReview ? "Saving…" : "Save"}
                    />
                    <SecondaryButton
                      onClick={() => {
                        setEditingReview(false)
                        setHeadline(dbRecord?.review_headline || "")
                        setBody(dbRecord?.review_body || "")
                      }}
                      label="Cancel"
                    />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Overview ── */}
          {movie?.overview && (
            <section
              style={{
                marginTop: 56,
                paddingTop: 40,
                borderTop: "1px solid var(--border-default)",
              }}
            >
              <SectionLabel>Overview</SectionLabel>
              <p
                className="t-body"
                style={{
                  marginTop: 12,
                  color: "var(--text-emphasis)",
                  maxWidth: 720,
                }}
              >
                {movie.overview}
              </p>
            </section>
          )}

          {/* ── Cast + Poster ── */}
          <section
            style={{
              marginTop: 56,
              paddingTop: 40,
              borderTop: "1px solid var(--border-default)",
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "200px 1fr",
              gap: isMobile ? 32 : 48,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                position: "relative",
                width: isMobile ? "min(180px, 50%)" : 200,
                aspectRatio: "2 / 3",
                borderRadius: 10,
                overflow: "hidden",
                boxShadow: "0 8px 32px var(--shadow-poster)",
              }}
            >
              {posterSrc ? (
                <img
                  src={posterSrc}
                  alt={movie?.title || "Poster"}
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <PosterFallback title={movie?.title} />
              )}
            </div>

            <div>
              <SectionLabel>Cast</SectionLabel>
              {credits.cast.length === 0 ? (
                <p
                  className="t-meta"
                  style={{ marginTop: 12, color: "var(--text-dim)" }}
                >
                  No cast information.
                </p>
              ) : (
                <>
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      marginTop: 12,
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "1fr"
                        : "repeat(2, minmax(0, 1fr))",
                      gap: "6px 24px",
                    }}
                  >
                    {visibleCast.map((name) => (
                      <li key={name}>
                        <PersonButton
                          name={name}
                          isSelected={selectedPerson === name}
                          onClick={() => handlePersonClick(name)}
                        />
                      </li>
                    ))}
                  </ul>
                  {credits.cast.length > CAST_PREVIEW && (
                    <button
                      type="button"
                      onClick={() => setCastExpanded((v) => !v)}
                      className="t-button-sm"
                      style={{
                        marginTop: 16,
                        color: "var(--text-link)",
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                      }}
                    >
                      {castExpanded
                        ? "Show less"
                        : `Show all ${credits.cast.length}`}
                    </button>
                  )}
                </>
              )}

              {selectedPerson && (
                <div
                  style={{
                    marginTop: 28,
                    padding: 20,
                    background: "var(--tint-base)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div className="t-label" style={{ color: "var(--text-label)" }}>
                        Also by
                      </div>
                      <div
                        className="t-title-lg"
                        style={{ marginTop: 4, color: "var(--text-strong)" }}
                      >
                        {selectedPerson}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPerson(null)
                        setFilmography([])
                      }}
                      aria-label="Close"
                      className="t-button-sm"
                      style={{
                        color: "var(--text-search)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Close
                    </button>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    {loadingFilmography ? (
                      <p className="t-label-value" style={{ color: "var(--text-search)" }}>
                        Loading…
                      </p>
                    ) : filmography.length === 0 ? (
                      <p className="t-label-value" style={{ color: "var(--text-search)" }}>
                        No other films found.
                      </p>
                    ) : (
                      <ul
                        style={{
                          listStyle: "none",
                          padding: 0,
                          margin: 0,
                          display: "grid",
                          gridTemplateColumns: isMobile
                            ? "1fr"
                            : "repeat(2, minmax(0, 1fr))",
                          gap: "4px 24px",
                        }}
                      >
                        {filmography.map((f) => (
                          <li
                            key={f.id}
                            className="t-title-sm"
                            style={{
                              color: "var(--text-emphasis)",
                              lineHeight: 1.7,
                            }}
                          >
                            {f.title}
                            {f.year ? (
                              <span
                                className="t-caption"
                                style={{
                                  marginLeft: 8,
                                  color: "var(--text-search)",
                                }}
                              >
                                {f.year}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Keywords ── */}
          {keywords.length > 0 && (
            <section
              style={{
                marginTop: 56,
                paddingTop: 40,
                borderTop: "1px solid var(--border-default)",
              }}
            >
              <SectionLabel>Themes</SectionLabel>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 16,
                }}
              >
                {keywords.slice(0, 16).map((kw) => (
                  <span
                    key={kw}
                    className="t-caption"
                    style={{
                      color: "var(--text-dim)",
                      padding: "5px 12px",
                      background: "var(--tint-base)",
                      borderRadius: 999,
                    }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* ── Footer ── */}
          <footer
            style={{
              marginTop: 80,
              paddingTop: 40,
              borderTop: "1px solid var(--border-default)",
              textAlign: "center",
            }}
          >
            <p
              className="t-caption"
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                color: "var(--text-footer)",
              }}
            >
              {releaseYear ? `${movie?.title} · ${releaseYear}` : movie?.title}
            </p>
          </footer>
        </div>
      </div>

      {searchOpen && (
        <MovieSearch
          onAdd={async () => ({ ok: false, message: "" })}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </main>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="t-label" style={{ color: "var(--text-label)" }}>
      {children}
    </div>
  )
}

function MetaItem({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div
        className="t-title-sm"
        style={{
          marginTop: 8,
          color: "var(--text-emphasis)",
        }}
      >
        {value}
      </div>
    </div>
  )
}

function PersonButton({
  name,
  isSelected,
  onClick,
  disabled,
}: {
  name: string
  isSelected: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="t-title-sm"
      style={{
        color: isSelected ? "var(--text-strong)" : "var(--text-emphasis)",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: disabled ? "default" : "pointer",
        textAlign: "left",
        textDecoration: isSelected ? "underline" : "none",
        textUnderlineOffset: 4,
        transition: "color 0.2s ease",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.color = "var(--text-inverse)"
      }}
      onMouseLeave={(e) => {
        if (!disabled)
          e.currentTarget.style.color = isSelected
            ? "var(--text-strong)"
            : "var(--text-emphasis)"
      }}
    >
      {name}
    </button>
  )
}

function PrimaryButton({
  onClick,
  disabled,
  label,
  variant = "primary",
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  variant?: "primary" | "secondary"
}) {
  const primary = variant === "primary"
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="t-button"
      style={{
        color: primary ? "var(--text-inverse)" : "var(--text-emphasis)",
        background: primary ? "var(--text-strong)" : "var(--tint-base)",
        border: primary
          ? "1px solid var(--text-strong)"
          : "1px solid var(--border-default)",
        borderRadius: 999,
        padding: "10px 20px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "opacity 0.2s ease, background 0.2s ease",
      }}
      onMouseEnter={(e) => {
        if (!disabled && !primary) {
          e.currentTarget.style.background = "var(--tint-hover)"
          e.currentTarget.style.borderColor = "var(--border-strong)"
        } else if (!disabled) {
          e.currentTarget.style.opacity = "0.9"
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !primary) {
          e.currentTarget.style.background = "var(--tint-base)"
          e.currentTarget.style.borderColor = "var(--border-default)"
        } else if (!disabled) {
          e.currentTarget.style.opacity = "1"
        }
      }}
    >
      {label}
    </button>
  )
}

function SecondaryButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
}) {
  return <PrimaryButton onClick={onClick} disabled={disabled} label={label} variant="secondary" />
}
