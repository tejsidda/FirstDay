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
  backdropURL,
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
const BG = "#0c0c10"

// Directional gradient that darkens the text side, fades to show image on the other
const GRAD = {
  left:  `linear-gradient(to right, ${BG} 0%, ${BG} 40%, rgba(12,12,16,0.90) 52%, rgba(12,12,16,0.55) 66%, rgba(12,12,16,0.12) 82%, transparent 100%)`,
  right: `linear-gradient(to left,  ${BG} 0%, ${BG} 40%, rgba(12,12,16,0.90) 52%, rgba(12,12,16,0.55) 66%, rgba(12,12,16,0.12) 82%, transparent 100%)`,
  topBottom: `linear-gradient(to bottom, ${BG} 0%, transparent 11%, transparent 89%, ${BG} 100%)`,
}

type TMDBGenre = { id: number; name: string }
type TMDBMovie = {
  id: number; title: string; tagline?: string; original_language?: string
  release_date?: string; overview?: string; poster_path?: string | null
  backdrop_path?: string | null; genres?: TMDBGenre[]; runtime?: number
}
type WatchedRow = {
  id: string; tmdb_id: string; title: string; year?: number; language?: string
  poster: string; backdrop?: string | null; watched_at?: string | null
  rating?: number | string | null; review_headline?: string | null; review_body?: string | null
}

function monthYear(date?: string) {
  if (!date) return "Unknown"
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? "Unknown" : d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}
function ratingNumber(r: unknown): number | null {
  if (r == null || r === "") return null
  const n = Number(r)
  return Number.isFinite(n) ? n : null
}
function todayDateInput() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`
}
function dateInputToIso(v: string) {
  const [y, m, d] = v.split("-").map(Number)
  if (!y || !m || !d) return new Date().toISOString()
  return new Date(y, m - 1, d, 12).toISOString()
}
function PosterFallback({ title }: { title?: string }) {
  return (
    <div className="t-title-sm" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "linear-gradient(145deg,var(--background-elevated),var(--background-sunken))", color: "var(--text-faint-ui)", textAlign: "center" }}>
      {title || "No poster"}
    </div>
  )
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
  const [credits, setCredits] = useState<{ director: string; cast: string[] }>({ director: "", cast: [] })
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
  const [filmography, setFilmography] = useState<{ id: number; title: string; year: number }[]>([])
  const [loadingFilmography, setLoadingFilmography] = useState(false)
  const [keywords, setKeywords] = useState<string[]>([])
  const [castExpanded, setCastExpanded] = useState(false)
  const [backdrops, setBackdrops] = useState<string[]>([])
  const [activeBackdropIdx, setActiveBackdropIdx] = useState(0)
  const [sectionColors, setSectionColors] = useState<(string | null)[]>([null, null, null])
  const backdropsRef = useRef<string[]>([])
  backdropsRef.current = backdrops

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)")
    const update = () => setIsMobile(media.matches)
    update(); media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    if (!tmdbId) return
    let active = true
    async function loadAll() {
      setLoading(true)
      const TOKEN = process.env.NEXT_PUBLIC_TMDB_TOKEN
      const detailsRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?language=en-US`, { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } })
      const details = (await detailsRes.json()) as TMDBMovie
      if (!active) return
      setMovie(details)
      const [creds, imgs, kws] = await Promise.all([getMovieCredits(tmdbId), getMovieImages(tmdbId), getMovieKeywords(tmdbId)])
      if (!active) return
      setCredits(creds); setKeywords(kws)
      const bds = imgs.length > 0 ? imgs : details.backdrop_path ? [backdropURL(details.backdrop_path)] : []
      setBackdrops(bds)
      const { data: wd } = await supabase.from("watched").select("*").eq("tmdb_id", tmdbId).limit(1)
      if (!active) return
      const row = wd?.[0]
      if (row) { setDbRecord(row as WatchedRow); setHeadline((row as WatchedRow).review_headline || ""); setBody((row as WatchedRow).review_body || ""); setRatingValue(ratingNumber((row as WatchedRow).rating)) }
      const { data: wl } = await supabase.from("watchlist").select("id").eq("tmdb_id", tmdbId).limit(1)
      if (!active) return
      setIsWatchlisted(wl != null && wl.length > 0)
      setLoading(false)
    }
    loadAll()
    return () => { active = false }
  }, [tmdbId])

  useEffect(() => {
    if (loading || !rateOnLoad || rateOnLoadHandledRef.current || dbRecord) return
    rateOnLoadHandledRef.current = true
    queueMicrotask(() => { setRatingValue((v) => v ?? 7); setRatingOpen(true); setWatchedEarlier(true) })
  }, [loading, rateOnLoad, dbRecord])

  // Canvas dominant-color extraction per backdrop
  useEffect(() => {
    if (!backdrops.length || isMobile) return
    backdrops.forEach((src, i) => {
      const img = new Image(); img.crossOrigin = "anonymous"
      img.onload = () => {
        try {
          const c = document.createElement("canvas"); c.width = 50; c.height = 28
          const ctx = c.getContext("2d"); if (!ctx) return
          ctx.drawImage(img, 0, 0, 50, 28)
          const { data } = ctx.getImageData(0, 0, 50, 28)
          let r = 0, g = 0, b = 0, n = 0
          for (let j = 0; j < data.length; j += 16) { r += data[j]; g += data[j+1]; b += data[j+2]; n++ }
          r = Math.round(r/n); g = Math.round(g/n); b = Math.round(b/n)
          if (Math.max(r,g,b) - Math.min(r,g,b) > 18)
            setSectionColors(prev => { const x = [...prev]; x[i] = `${r},${g},${b}`; return x })
        } catch { /* CORS blocked */ }
      }
      img.src = src
    })
  }, [backdrops, isMobile])

  // Section observer — drives page-level color tint
  useEffect(() => {
    if (loading || isMobile) return
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { const idx = Number((e.target as HTMLElement).dataset.section || 0); setActiveBackdropIdx(Math.max(0, Math.min(idx, backdropsRef.current.length - 1))) } }),
      { threshold: 0.25, rootMargin: "-5% 0px -40% 0px" }
    )
    document.querySelectorAll<HTMLElement>("[data-section]").forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [loading, isMobile])

  const posterSrc = dbRecord?.poster || (movie?.poster_path ? posterURL(movie.poster_path) : "")
  const movieForDb = (): Movie | null => {
    if (!movie) return null
    return { id: String(tmdbId), title: movie.title, year: movie.release_date ? new Date(movie.release_date).getFullYear() : 0, language: formatLanguage(movie.original_language), poster: posterSrc || "", backdrop: backdrops[0] || undefined }
  }

  const handleAddWatchlist = async () => { const m = movieForDb(); if (!m) return; setBusy(true); if (await addToWatchlist(m)) setIsWatchlisted(true); setBusy(false) }
  const handleRemoveWatchlist = async () => { if (!tmdbId) return; setBusy(true); if (await removeFromWatchlist(tmdbId)) setIsWatchlisted(false); setBusy(false) }
  const handleSaveRating = async () => {
    const m = movieForDb(); if (!m || ratingValue == null) return
    setSavingRating(true); setActionError(null)
    const ok = await markAsWatched(m, ratingValue, { watchedAt: watchedEarlier ? dateInputToIso(watchedDate) : new Date().toISOString() })
    if (!ok) { setActionError("Couldn't fully save — try again."); setSavingRating(false); return }
    const { data } = await supabase.from("watched").select("*").eq("tmdb_id", tmdbId).limit(1)
    if (data?.[0]) setDbRecord(data[0] as WatchedRow)
    setIsWatchlisted(false); setRatingOpen(false); setWatchedEarlier(false); setWatchedDate(todayDateInput()); setSavingRating(false)
  }
  const handleSaveReview = async () => {
    if (!tmdbId) return; setSavingReview(true)
    if (await updateReview(tmdbId, headline, body || undefined)) { setEditingReview(false); setDbRecord(prev => prev ? { ...prev, review_headline: headline, review_body: body } : prev) }
    setSavingReview(false)
  }
  const handlePersonClick = async (name: string) => {
    if (selectedPerson === name) { setSelectedPerson(null); setFilmography([]); return }
    setSelectedPerson(name); setLoadingFilmography(true)
    setFilmography(await getPersonFilmography(name)); setLoadingFilmography(false)
  }

  const ratingNum = ratingNumber(dbRecord?.rating)
  const hasReview = Boolean(dbRecord?.review_headline || dbRecord?.review_body)
  const isWatched = Boolean(dbRecord)
  const releaseYear = movie?.release_date ? new Date(movie.release_date).getFullYear() : null
  const visibleCast = castExpanded ? credits.cast : credits.cast.slice(0, CAST_PREVIEW)
  const activeColor = sectionColors[activeBackdropIdx]
  const bd = (i: number) => backdrops[Math.min(i, backdrops.length - 1)] || backdrops[0]
  const sc = (i: number) => sectionColors[Math.min(i, sectionColors.length - 1)]

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center" style={{ background: BG }}><p className="t-meta" style={{ color: "var(--text-search)" }}>Loading…</p></main>
  }

  // Shared section shell — backdrop as background, directional gradient, top/bottom blends
  const SectionShell = ({ idx, textSide, minH = "100svh", children }: { idx: number; textSide: "left" | "right"; minH?: string; children: React.ReactNode }) => {
    const src = bd(idx); const color = sc(idx)
    return (
      <section data-section={idx} style={{ position: "relative", minHeight: minH, zIndex: 1 }}>
        {/* Backdrop image */}
        {src && (
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center", filter: "brightness(0.72) saturate(1.18)", transition: "opacity 0.6s ease" }} />
        )}
        {/* Dominant color bloom over the image side */}
        {color && (
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 80% at ${textSide === "left" ? "75%" : "25%"} 50%, rgba(${color},0.28) 0%, transparent 70%)`, pointerEvents: "none", transition: "background 1.8s ease" }} />
        )}
        {/* Directional gradient — darkens text side */}
        <div style={{ position: "absolute", inset: 0, background: GRAD[textSide], pointerEvents: "none" }} />
        {/* Top + bottom section blends */}
        <div style={{ position: "absolute", inset: 0, background: GRAD.topBottom, pointerEvents: "none" }} />
        {/* Text panel */}
        <div style={{
          position: "relative", zIndex: 2,
          width: isMobile ? "100%" : "48%",
          marginLeft: (!isMobile && textSide === "right") ? "52%" : 0,
          minHeight: minH,
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: isMobile
            ? "80px 20px 48px"
            : textSide === "left" ? "100px 40px 80px 56px" : "100px 56px 80px 40px",
        }}>
          {children}
        </div>
      </section>
    )
  }

  return (
    <main style={{ background: BG, color: "var(--text-emphasis)", position: "relative" }}>
      {/* Full-page color tint — follows active section */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: activeColor ? `rgba(${activeColor},0.06)` : "transparent", transition: "background 1.8s ease" }} />

      <TopOverlayNav onSearchClick={() => setSearchOpen(true)} />
      <BackButton />

      {/* ── Section 0: Identity — text LEFT, image RIGHT ── */}
      <SectionShell idx={0} textSide="left">
        <h1 className="t-display" style={{ margin: 0, color: "var(--text-strong)" }}>{movie?.title || "Untitled"}</h1>
        {movie?.tagline && <p className="t-title" style={{ margin: 0, marginTop: 12, color: "var(--text-dim)" }}>{movie.tagline}</p>}

        {(isWatched || isWatchlisted) && (
          <div className="t-button-sm" style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "var(--tint-base)", border: "1px solid var(--border-default)", borderRadius: 999, color: "var(--text-emphasis)", alignSelf: "flex-start" }}>
            {isWatched ? <><span>In your library</span>{ratingNum != null && <RatingDisplay rating={ratingNum} size="sm" />}</> : "On your watchlist"}
          </div>
        )}

        <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 10 }}>
          {!isWatched && !isWatchlisted && <PrimaryButton onClick={handleAddWatchlist} disabled={busy} label="Add to watchlist" />}
          {isWatchlisted && !isWatched && <SecondaryButton onClick={handleRemoveWatchlist} disabled={busy} label="Remove from watchlist" />}
          {!isWatched
            ? <PrimaryButton onClick={() => { setRatingValue(ratingValue ?? 7); setRatingOpen(true) }} disabled={busy} label="Mark as watched" variant={isWatchlisted ? "primary" : "secondary"} />
            : <><SecondaryButton onClick={() => { setRatingValue(ratingNum ?? 7); setRatingOpen(true) }} label={ratingNum != null ? "Update rating" : "Add rating"} /><SecondaryButton onClick={() => setEditingReview(true)} label={hasReview ? "Edit review" : "Write review"} /></>
          }
        </div>

        {ratingOpen && (
          <div style={{ marginTop: 20, padding: 20, background: "rgba(12,12,16,0.85)", border: "1px solid var(--border-default)", borderRadius: 12, backdropFilter: "blur(8px)", maxWidth: 440 }}>
            <div className="t-label" style={{ color: "var(--text-label)", marginBottom: 16, textAlign: "center" }}>How much applause?</div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <StandingOvationInput value={ratingValue} onChange={v => setRatingValue(v)} />
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-default)", display: "grid", gap: 10, maxWidth: 340, marginLeft: "auto", marginRight: "auto" }}>
              <label className="t-label-value" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-emphasis)", cursor: "pointer" }}>
                <input type="checkbox" checked={watchedEarlier} onChange={e => { const v = e.target.checked; setWatchedEarlier(v); if (v && !watchedDate) setWatchedDate(todayDateInput()) }} />
                I watched this earlier — log a specific date
              </label>
              {watchedEarlier && <input type="date" value={watchedDate} max={todayDateInput()} onChange={e => setWatchedDate(e.target.value)} aria-label="Watched on" className="t-label-value" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--background-elevated)", color: "var(--text-emphasis)", outline: "none" }} />}
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <PrimaryButton onClick={handleSaveRating} disabled={savingRating || ratingValue == null} label={savingRating ? "Saving…" : isWatched ? "Update rating" : "Mark as watched"} />
              <SecondaryButton onClick={() => { setRatingOpen(false); setWatchedEarlier(false); setActionError(null) }} label="Cancel" />
            </div>
            {actionError && <p className="t-caption" style={{ marginTop: 10, color: "rgba(255,180,180,0.85)", textAlign: "center" }}>{actionError}</p>}
          </div>
        )}

        <div style={{ marginTop: 36, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.08)", display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(auto-fit,minmax(110px,1fr))", gap: isMobile ? 20 : 20 }}>
          <MetaItem label="Director" value={<PersonButton name={credits.director || "Unknown"} isSelected={selectedPerson === credits.director} onClick={() => handlePersonClick(credits.director)} disabled={!credits.director} />} />
          <MetaItem label="Language" value={formatLanguage(movie?.original_language || dbRecord?.language || "") || "Unknown"} />
          <MetaItem label="Release" value={monthYear(movie?.release_date)} />
          <MetaItem label="Genre" value={movie?.genres?.[0]?.name || "N/A"} />
          {movie?.runtime ? <MetaItem label="Runtime" value={`${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`} /> : null}
        </div>

        {(movie?.genres?.length || 0) > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
            {movie!.genres!.map(g => <span key={g.id} className="t-button-sm" style={{ color: "var(--text-dim)", padding: "5px 12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999 }}>{g.name}</span>)}
          </div>
        )}
      </SectionShell>

      {/* ── Section 1: Story — image LEFT, text RIGHT ── */}
      <SectionShell idx={1} textSide="right">
        {movie?.overview && (
          <div style={{ marginBottom: 44 }}>
            <SectionLabel>Overview</SectionLabel>
            <p className="t-body" style={{ marginTop: 12, color: "var(--text-emphasis)" }}>{movie.overview}</p>
          </div>
        )}

        <div style={{ paddingTop: movie?.overview ? 36 : 0, borderTop: movie?.overview ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "150px 1fr", gap: isMobile ? 20 : 32, alignItems: "flex-start" }}>
            <div style={{ position: "relative", width: isMobile ? "min(130px,38%)" : 150, aspectRatio: "2/3", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)" }}>
              {posterSrc ? <img src={posterSrc} alt={movie?.title || "Poster"} onError={e => { e.currentTarget.style.display = "none" }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <PosterFallback title={movie?.title} />}
            </div>
            <div>
              <SectionLabel>Cast</SectionLabel>
              {credits.cast.length === 0
                ? <p className="t-meta" style={{ marginTop: 12, color: "var(--text-dim)" }}>No cast information.</p>
                : <>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "6px 14px" }}>
                      {visibleCast.map(name => <li key={name}><PersonButton name={name} isSelected={selectedPerson === name} onClick={() => handlePersonClick(name)} /></li>)}
                    </ul>
                    {credits.cast.length > CAST_PREVIEW && <button type="button" onClick={() => setCastExpanded(v => !v)} className="t-button-sm" style={{ marginTop: 10, color: "var(--text-link)", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>{castExpanded ? "Show less" : `Show all ${credits.cast.length}`}</button>}
                  </>
              }
              {selectedPerson && (
                <div style={{ marginTop: 18, padding: 16, background: "rgba(12,12,16,0.82)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, backdropFilter: "blur(8px)" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div><div className="t-label" style={{ color: "var(--text-label)" }}>Also by</div><div className="t-title-lg" style={{ marginTop: 4, color: "var(--text-strong)" }}>{selectedPerson}</div></div>
                    <button type="button" onClick={() => { setSelectedPerson(null); setFilmography([]) }} className="t-button-sm" style={{ color: "var(--text-search)", background: "transparent", border: "none", cursor: "pointer" }}>Close</button>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {loadingFilmography ? <p className="t-label-value" style={{ color: "var(--text-search)" }}>Loading…</p>
                      : filmography.length === 0 ? <p className="t-label-value" style={{ color: "var(--text-search)" }}>No other films found.</p>
                      : <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "4px 14px" }}>
                          {filmography.map(f => <li key={f.id} className="t-title-sm" style={{ color: "var(--text-emphasis)", lineHeight: 1.7 }}>{f.title}{f.year ? <span className="t-caption" style={{ marginLeft: 6, color: "var(--text-search)" }}>{f.year}</span> : null}</li>)}
                        </ul>
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionShell>

      {/* ── Section 2: Your take — text LEFT, image RIGHT ── */}
      <SectionShell idx={2} textSide="left" minH="80svh">
        {(isWatched || hasReview) && (
          <div style={{ marginBottom: keywords.length ? 44 : 0 }}>
            <SectionLabel>Your review</SectionLabel>
            {!editingReview ? (
              <>
                {hasReview
                  ? <>{dbRecord?.review_headline && <h2 className="t-sub" style={{ margin: 0, marginTop: 12, color: "var(--text-strong)" }}>{dbRecord.review_headline}</h2>}{dbRecord?.review_body && <p className="t-body-lg" style={{ marginTop: 14, color: "var(--text-emphasis)", maxWidth: 520 }}>{dbRecord.review_body}</p>}</>
                  : <p className="t-meta" style={{ marginTop: 12, color: "var(--text-dim)" }}>You haven&apos;t written a review yet.</p>
                }
              </>
            ) : (
              <div style={{ marginTop: 12, maxWidth: 520 }}>
                <input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="A line that captures it" aria-label="Review headline" className="t-sub" style={{ width: "100%", color: "var(--text-strong)", background: "transparent", border: "none", borderBottom: "1px solid var(--border-default)", padding: "8px 0", outline: "none" }} />
                <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your thoughts… (optional)" aria-label="Review body" className="t-body" style={{ width: "100%", marginTop: 14, color: "var(--text-emphasis)", background: "transparent", border: "1px solid var(--border-default)", borderRadius: 8, padding: 12, minHeight: 120, outline: "none", resize: "vertical" }} />
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <PrimaryButton onClick={handleSaveReview} disabled={savingReview} label={savingReview ? "Saving…" : "Save"} />
                  <SecondaryButton onClick={() => { setEditingReview(false); setHeadline(dbRecord?.review_headline || ""); setBody(dbRecord?.review_body || "") }} label="Cancel" />
                </div>
              </div>
            )}
          </div>
        )}

        {keywords.length > 0 && (
          <div style={{ paddingTop: isWatched || hasReview ? 36 : 0, borderTop: isWatched || hasReview ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
            <SectionLabel>Themes</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
              {keywords.slice(0, 16).map(kw => <span key={kw} className="t-caption" style={{ color: "var(--text-dim)", padding: "5px 12px", background: "var(--tint-base)", borderRadius: 999 }}>{kw}</span>)}
            </div>
          </div>
        )}

        <footer style={{ marginTop: 56, paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
          <p className="t-caption" style={{ margin: 0, fontFamily: "var(--font-display)", fontStyle: "italic", color: "var(--text-footer)" }}>
            {releaseYear ? `${movie?.title} · ${releaseYear}` : movie?.title}
          </p>
        </footer>
      </SectionShell>

      {searchOpen && <MovieSearch onAdd={async () => ({ ok: false, message: "" })} onClose={() => setSearchOpen(false)} />}
    </main>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="t-label" style={{ color: "var(--text-label)" }}>{children}</div>
}
function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><SectionLabel>{label}</SectionLabel><div className="t-title-sm" style={{ marginTop: 8, color: "var(--text-emphasis)" }}>{value}</div></div>
}
function PersonButton({ name, isSelected, onClick, disabled }: { name: string; isSelected: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="t-title-sm"
      style={{ color: isSelected ? "var(--text-strong)" : "var(--text-emphasis)", background: "transparent", border: "none", padding: 0, cursor: disabled ? "default" : "pointer", textAlign: "left", textDecoration: isSelected ? "underline" : "none", textUnderlineOffset: 4, transition: "color 0.2s ease" }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = "var(--text-inverse)" }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.color = isSelected ? "var(--text-strong)" : "var(--text-emphasis)" }}>
      {name}
    </button>
  )
}
function PrimaryButton({ onClick, disabled, label, variant = "primary" }: { onClick: () => void; disabled?: boolean; label: string; variant?: "primary" | "secondary" }) {
  const p = variant === "primary"
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="t-button"
      style={{ color: p ? "#0d0d0f" : "var(--text-emphasis)", background: p ? "rgba(255,255,255,0.92)" : "var(--tint-base)", border: p ? "1px solid rgba(255,255,255,0.85)" : "1px solid var(--border-default)", borderRadius: 999, padding: "10px 20px", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1, transition: "opacity 0.2s ease, background 0.2s ease" }}
      onMouseEnter={e => { if (!disabled && p) e.currentTarget.style.opacity = "0.88"; else if (!disabled) { e.currentTarget.style.background = "var(--tint-hover)"; e.currentTarget.style.borderColor = "var(--border-strong)" } }}
      onMouseLeave={e => { if (!disabled && p) e.currentTarget.style.opacity = "1"; else if (!disabled) { e.currentTarget.style.background = "var(--tint-base)"; e.currentTarget.style.borderColor = "var(--border-default)" } }}>
      {label}
    </button>
  )
}
function SecondaryButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return <PrimaryButton onClick={onClick} disabled={disabled} label={label} variant="secondary" />
}
