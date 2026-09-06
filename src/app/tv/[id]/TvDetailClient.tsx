"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { formatLanguage } from "@/lib/tmdb"
import {
  addToWatchlistDetailed,
  messageForAddToWatchlistFailure,
  markAsWatchedDetailed,
  messageForMarkWatchedFailure,
  removeFromWatchlist,
  updateReview,
  getWatched,
  getWatchlist,
} from "@/lib/db"
import type { MediaItem } from "@/lib/types"
import RatingDisplay from "@/components/RatingDisplay"
import StandingOvationInput from "@/components/StandingOvationInput"
import MediaSearch from "@/components/MediaSearch"
import { useIsMobile } from "@/hooks/useIsMobile"
import {
  dateInputToIso,
  monthYear,
  ratingNumber,
  todayDateInput,
} from "@/app/movie/[id]/movieDetailUtils"

const BG = "#141414"
const SAVE_FLASH_MS = 1200
const CAST_PREVIEW = 12

type TMDBTvShow = {
  id: number
  name: string
  tagline?: string
  original_language?: string
  first_air_date?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  genres?: { id: number; name: string }[]
  episode_run_time?: number[] | null
  number_of_seasons?: number | null
  number_of_episodes?: number | null
  status?: string | null
}

type WatchedRow = {
  id: string
  tmdb_id: string
  title: string
  poster: string
  backdrop?: string | null
  watched_at?: string | null
  rating?: number | string | null
  review_headline?: string | null
  review_body?: string | null
}

function mediaItemToWatchedRow(item: MediaItem): WatchedRow {
  return {
    id: item.id,
    tmdb_id: item.id,
    title: item.title,
    poster: item.poster,
    backdrop: item.backdrop ?? null,
    watched_at: item.watchedAt ?? null,
    rating: item.rating ?? null,
    review_headline: item.reviewHeadline ?? null,
    review_body: item.reviewBody ?? null,
  }
}

type Props = {
  tmdbId: string
  show: TMDBTvShow
  credits: { creators: string[]; cast: string[] }
  backdrops: string[]
  backdropFromPoster?: boolean
  serverPosterSrc: string
}

type SaveFlash = "watchlist-add" | "watchlist-remove" | "rating" | "review" | null

function PrimaryButton({
  onClick,
  disabled,
  label,
  savedLabel,
  variant = "primary",
  savedFlash = false,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  savedLabel?: string
  variant?: "primary" | "secondary"
  savedFlash?: boolean
}) {
  const p = variant === "primary"
  const display = savedFlash ? savedLabel ?? "Saved" : label
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`t-button${savedFlash ? " movie-btn-saved" : ""}`}
      style={{
        color: savedFlash ? undefined : p ? "#0d0d0f" : "var(--text-emphasis)",
        background: savedFlash ? undefined : p ? "rgba(255,255,255,0.92)" : "var(--tint-base)",
        border: savedFlash ? undefined : p ? "1px solid rgba(255,255,255,0.85)" : "1px solid var(--border-default)",
        borderRadius: 999,
        padding: "10px 20px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !savedFlash ? 0.55 : 1,
      }}
    >
      {display}
    </button>
  )
}

function SecondaryButton(props: Omit<Parameters<typeof PrimaryButton>[0], "variant">) {
  return <PrimaryButton {...props} variant="secondary" />
}

export default function TvDetailClient({
  tmdbId,
  show,
  credits,
  backdrops,
  serverPosterSrc,
}: Props) {
  const searchParams = useSearchParams()
  const rateOnLoad = searchParams?.get("rate") === "1"
  const isMobile = useIsMobile()

  const [searchOpen, setSearchOpen] = useState(false)
  const [dbRecord, setDbRecord] = useState<WatchedRow | null>(null)
  const [isWatchlisted, setIsWatchlisted] = useState(false)
  const [userLoading, setUserLoading] = useState(true)
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
  const [saveFlash, setSaveFlash] = useState<SaveFlash>(null)
  const [castExpanded, setCastExpanded] = useState(false)
  const rateOnLoadHandledRef = useRef(false)
  const saveFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerSaveFlash = useCallback((key: NonNullable<SaveFlash>) => {
    if (saveFlashTimerRef.current) clearTimeout(saveFlashTimerRef.current)
    setSaveFlash(key)
    saveFlashTimerRef.current = setTimeout(() => {
      setSaveFlash(null)
      saveFlashTimerRef.current = null
    }, SAVE_FLASH_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (saveFlashTimerRef.current) clearTimeout(saveFlashTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const handler = () => setSearchOpen(true)
    window.addEventListener("fdfs:open-search", handler)
    return () => window.removeEventListener("fdfs:open-search", handler)
  }, [])

  useEffect(() => {
    let active = true
    async function loadUserData() {
      setUserLoading(true)
      const [watched, watchlist] = await Promise.all([getWatched(), getWatchlist()])
      if (!active) return
      const row = watched.find((item) => item.id === tmdbId && item.mediaType === "tv")
      if (row) {
        const watchedRow = mediaItemToWatchedRow(row)
        setDbRecord(watchedRow)
        setHeadline(watchedRow.review_headline || "")
        setBody(watchedRow.review_body || "")
        setRatingValue(ratingNumber(watchedRow.rating))
      } else {
        setDbRecord(null)
      }
      setIsWatchlisted(
        watchlist.some((item) => item.id === tmdbId && item.mediaType === "tv"),
      )
      setUserLoading(false)
    }
    loadUserData()
    return () => {
      active = false
    }
  }, [tmdbId])

  useEffect(() => {
    if (userLoading || !rateOnLoad || rateOnLoadHandledRef.current || dbRecord) return
    rateOnLoadHandledRef.current = true
    queueMicrotask(() => {
      setRatingValue((v) => v ?? 7)
      setRatingOpen(true)
      setWatchedEarlier(true)
    })
  }, [userLoading, rateOnLoad, dbRecord])

  const posterSrc = dbRecord?.poster || serverPosterSrc
  const episodeRuntime = show.episode_run_time?.[0]

  const showForDb = (): MediaItem => ({
    id: String(tmdbId),
    mediaType: "tv",
    title: show.name,
    year: show.first_air_date ? new Date(show.first_air_date).getFullYear() : 0,
    language: formatLanguage(show.original_language),
    poster: posterSrc || "",
    backdrop: backdrops[0] || undefined,
    genres: show.genres,
    runtime: episodeRuntime ?? null,
    seasons: show.number_of_seasons ?? undefined,
    episodes: show.number_of_episodes ?? undefined,
    status: show.status ?? undefined,
  })

  const handleAddWatchlist = async () => {
    setBusy(true)
    setActionError(null)
    const result = await addToWatchlistDetailed(showForDb())
    if (result.ok) {
      setIsWatchlisted(true)
      triggerSaveFlash("watchlist-add")
    } else {
      setActionError(messageForAddToWatchlistFailure(result.reason))
    }
    setBusy(false)
  }

  const handleSearchAdd = async (item: MediaItem) => {
    const result = await addToWatchlistDetailed(item)
    if (result.ok) {
      if (item.id === tmdbId && item.mediaType === "tv") setIsWatchlisted(true)
      return { ok: true }
    }
    return {
      ok: false,
      message: messageForAddToWatchlistFailure(result.reason),
    }
  }

  const handleRemoveWatchlist = async () => {
    setBusy(true)
    if (await removeFromWatchlist(tmdbId, "tv")) {
      setIsWatchlisted(false)
      triggerSaveFlash("watchlist-remove")
    }
    setBusy(false)
  }

  const handleSaveRating = async () => {
    if (ratingValue == null) return
    setSavingRating(true)
    setActionError(null)
    const result = await markAsWatchedDetailed(showForDb(), ratingValue, {
      watchedAt: watchedEarlier ? dateInputToIso(watchedDate) : new Date().toISOString(),
    })
    if (!result.ok) {
      setActionError(messageForMarkWatchedFailure(result.reason))
      setSavingRating(false)
      return
    }
    const watched = await getWatched()
    const row = watched.find((item) => item.id === tmdbId && item.mediaType === "tv")
    if (row) setDbRecord(mediaItemToWatchedRow(row))
    setIsWatchlisted(false)
    setRatingOpen(false)
    setWatchedEarlier(false)
    setWatchedDate(todayDateInput())
    setSavingRating(false)
    triggerSaveFlash("rating")
  }

  const handleSaveReview = async () => {
    setSavingReview(true)
    if (await updateReview(tmdbId, headline, body || undefined, "tv")) {
      setEditingReview(false)
      setDbRecord((prev) =>
        prev ? { ...prev, review_headline: headline, review_body: body } : prev
      )
      triggerSaveFlash("review")
    }
    setSavingReview(false)
  }

  const ratingNum = ratingNumber(dbRecord?.rating)
  const hasReview = Boolean(dbRecord?.review_headline || dbRecord?.review_body)
  const isWatched = Boolean(dbRecord)
  const visibleCast = castExpanded ? credits.cast : credits.cast.slice(0, CAST_PREVIEW)
  const creatorsLabel = credits.creators.join(", ") || "Unknown"

  const openRating = () => {
    setRatingValue(ratingValue ?? ratingNum ?? 7)
    setRatingOpen(true)
  }

  const backdropSrc = backdrops[0]

  return (
    <main
      className={isMobile ? "page-with-mobile-tabs" : undefined}
      style={{ background: BG, color: "var(--text-emphasis)", minHeight: "100vh" }}
    >
      {backdropSrc && (
        <div style={{ position: "relative", height: isMobile ? 220 : 320, overflow: "hidden" }}>
          <img
            src={backdropSrc}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, #141414 0%, transparent 60%)",
            }}
          />
        </div>
      )}

      <div style={{ maxWidth: 920, margin: "0 auto", padding: isMobile ? "24px 20px 48px" : "32px 40px 64px" }}>
        <div style={{ display: "flex", gap: 24, flexDirection: isMobile ? "column" : "row" }}>
          {!isMobile && posterSrc && (
            <div
              style={{
                width: 180,
                flexShrink: 0,
                aspectRatio: "2/3",
                borderRadius: 10,
                overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              }}
            >
              <img src={posterSrc} alt={show.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="t-label" style={{ color: "var(--text-label)", marginBottom: 8 }}>
              TV Series
            </p>
            <h1 className="t-display" style={{ margin: 0, color: "var(--text-strong)" }}>
              {show.name}
            </h1>
            {show.tagline && (
              <p className="t-title" style={{ marginTop: 12, color: "var(--text-dim)" }}>
                {show.tagline}
              </p>
            )}

            {isWatchlisted && !isWatched && !userLoading && (
              <div
                className="t-button-sm"
                style={{
                  marginTop: 18,
                  display: "inline-flex",
                  padding: "6px 12px",
                  background: "var(--tint-base)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 999,
                }}
              >
                On your watchlist
              </div>
            )}

            {!userLoading && !isWatched && (
              <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 10 }}>
                {!isWatchlisted && (
                  <PrimaryButton
                    onClick={handleAddWatchlist}
                    disabled={busy}
                    label="Add to watchlist"
                    savedFlash={saveFlash === "watchlist-add"}
                    savedLabel="Added"
                  />
                )}
                {isWatchlisted && (
                  <SecondaryButton
                    onClick={handleRemoveWatchlist}
                    disabled={busy}
                    label="Remove"
                    savedFlash={saveFlash === "watchlist-remove"}
                    savedLabel="Removed"
                  />
                )}
                <PrimaryButton
                  onClick={openRating}
                  disabled={busy}
                  label="Mark watched"
                  variant={isWatchlisted ? "primary" : "secondary"}
                />
              </div>
            )}

            {ratingOpen && (
              <div
                style={{
                  marginTop: 20,
                  padding: 20,
                  maxWidth: 440,
                  background: "rgba(12,12,16,0.85)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 12,
                }}
              >
                <div className="t-label" style={{ color: "var(--text-label)", marginBottom: 16, textAlign: "center" }}>
                  How much applause?
                </div>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <StandingOvationInput value={ratingValue} onChange={(v) => setRatingValue(v)} />
                </div>
                <label className="t-label-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={watchedEarlier}
                    onChange={(e) => {
                      setWatchedEarlier(e.target.checked)
                      if (e.target.checked && !watchedDate) setWatchedDate(todayDateInput())
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
                    className="t-label-value"
                    style={{
                      width: "100%",
                      marginTop: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-default)",
                      background: "var(--background-elevated)",
                      color: "var(--text-emphasis)",
                    }}
                  />
                )}
                <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "center" }}>
                  <PrimaryButton
                    onClick={handleSaveRating}
                    disabled={savingRating || ratingValue == null}
                    label={savingRating ? "Saving…" : isWatched ? "Update rating" : "Mark as watched"}
                    savedFlash={saveFlash === "rating"}
                    savedLabel="Saved"
                  />
                  <SecondaryButton onClick={() => setRatingOpen(false)} label="Cancel" />
                </div>
                {actionError && (
                  <p className="t-caption" style={{ marginTop: 10, color: "rgba(255,180,180,0.85)", textAlign: "center" }}>
                    {actionError}
                  </p>
                )}
              </div>
            )}

            <div
              style={{
                marginTop: 32,
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(auto-fit,minmax(110px,1fr))",
                gap: 20,
              }}
            >
              <div>
                <div className="t-label" style={{ color: "var(--text-label)" }}>Created by</div>
                <div className="t-title-sm" style={{ marginTop: 8 }}>{creatorsLabel}</div>
              </div>
              <div>
                <div className="t-label" style={{ color: "var(--text-label)" }}>Language</div>
                <div className="t-title-sm" style={{ marginTop: 8 }}>
                  {formatLanguage(show.original_language || "") || "Unknown"}
                </div>
              </div>
              <div>
                <div className="t-label" style={{ color: "var(--text-label)" }}>First aired</div>
                <div className="t-title-sm" style={{ marginTop: 8 }}>{monthYear(show.first_air_date)}</div>
              </div>
              {show.number_of_seasons != null && (
                <div>
                  <div className="t-label" style={{ color: "var(--text-label)" }}>Seasons</div>
                  <div className="t-title-sm" style={{ marginTop: 8 }}>{show.number_of_seasons}</div>
                </div>
              )}
              {show.number_of_episodes != null && (
                <div>
                  <div className="t-label" style={{ color: "var(--text-label)" }}>Episodes</div>
                  <div className="t-title-sm" style={{ marginTop: 8 }}>{show.number_of_episodes}</div>
                </div>
              )}
              {show.status && (
                <div>
                  <div className="t-label" style={{ color: "var(--text-label)" }}>Status</div>
                  <div className="t-title-sm" style={{ marginTop: 8 }}>{show.status}</div>
                </div>
              )}
              {episodeRuntime ? (
                <div>
                  <div className="t-label" style={{ color: "var(--text-label)" }}>Episode length</div>
                  <div className="t-title-sm" style={{ marginTop: 8 }}>{episodeRuntime}m</div>
                </div>
              ) : null}
            </div>

            {isWatched && !userLoading && (
              <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="t-label" style={{ color: "var(--text-label)" }}>Your take</div>
                <div style={{ marginTop: 14 }}>
                  {ratingNum != null ? (
                    <>
                      <RatingDisplay rating={ratingNum} size="lg" showLabel />
                      {!ratingOpen && (
                        <button
                          type="button"
                          onClick={openRating}
                          className="t-button-sm"
                          style={{ marginTop: 10, background: "transparent", border: "none", color: "var(--text-link)", cursor: "pointer" }}
                        >
                          Change rating
                        </button>
                      )}
                    </>
                  ) : (
                    <PrimaryButton onClick={openRating} label="Add your applause" />
                  )}
                </div>

                {hasReview ? (
                  <div style={{ marginTop: 20 }}>
                    {dbRecord?.review_headline && (
                      <p className="t-sub" style={{ color: "var(--text-strong)" }}>{dbRecord.review_headline}</p>
                    )}
                    {dbRecord?.review_body && (
                      <p className="t-body" style={{ marginTop: 8, color: "var(--text-emphasis)" }}>{dbRecord.review_body}</p>
                    )}
                    {!editingReview && (
                      <SecondaryButton
                        onClick={() => setEditingReview(true)}
                        label="Edit review"
                        savedFlash={saveFlash === "review"}
                        savedLabel="Saved"
                      />
                    )}
                  </div>
                ) : !editingReview ? (
                  <div style={{ marginTop: 16 }}>
                    <SecondaryButton onClick={() => setEditingReview(true)} label="Write review" />
                  </div>
                ) : null}

                {editingReview && (
                  <div style={{ marginTop: 20, maxWidth: 520 }}>
                    <input
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="A line that captures it"
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
                      placeholder="What stayed with you?"
                      className="t-body"
                      style={{
                        width: "100%",
                        marginTop: 14,
                        color: "var(--text-emphasis)",
                        background: "var(--background-elevated)",
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
                        label={savingReview ? "Saving…" : "Save review"}
                        savedFlash={saveFlash === "review"}
                        savedLabel="Saved"
                      />
                      <SecondaryButton onClick={() => setEditingReview(false)} label="Cancel" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {show.overview && (
              <div style={{ marginTop: 32 }}>
                <div className="t-label" style={{ color: "var(--text-label)" }}>Overview</div>
                <p className="t-body" style={{ marginTop: 12 }}>{show.overview}</p>
              </div>
            )}

            {credits.cast.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div className="t-label" style={{ color: "var(--text-label)" }}>Cast</div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                    gap: "6px 14px",
                  }}
                >
                  {visibleCast.map((name) => (
                    <li key={name} className="t-title-sm">{name}</li>
                  ))}
                </ul>
                {credits.cast.length > CAST_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setCastExpanded((v) => !v)}
                    className="t-button-sm"
                    style={{ marginTop: 12, background: "transparent", border: "none", color: "var(--text-link)", cursor: "pointer" }}
                  >
                    {castExpanded ? "Show less" : `Show all ${credits.cast.length}`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {searchOpen && <MediaSearch onAdd={handleSearchAdd} onClose={() => setSearchOpen(false)} />}
    </main>
  )
}
