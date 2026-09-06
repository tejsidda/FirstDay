"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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
import { getPersonFilmography, formatLanguage } from "@/lib/tmdb"
import type { MediaItem, Movie } from "@/lib/types"
import RatingDisplay from "@/components/RatingDisplay"
import StandingOvationInput from "@/components/StandingOvationInput"
import MediaSearch from "@/components/MediaSearch"
import { ensureGsap, prefersReducedMotion } from "@/components/motion/gsapSetup"
import { useIsMobile, MOBILE_TAB_BAR_INSET } from "@/hooks/useIsMobile"
import {
  backdropSide,
  dateInputToIso,
  monthYear,
  ratingNumber,
  todayDateInput,
} from "./movieDetailUtils"

const CAST_PREVIEW = 12
const BG = "#141414"
const SAVE_FLASH_MS = 1200

type TMDBMovie = {
  id: number
  title: string
  tagline?: string
  original_language?: string
  release_date?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  genres?: { id: number; name: string }[]
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

function mediaItemToWatchedRow(item: MediaItem): WatchedRow {
  return {
    id: item.id,
    tmdb_id: item.id,
    title: item.title,
    year: item.year,
    language: item.language,
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
  movie: TMDBMovie
  credits: { director: string; cast: string[] }
  backdrops: string[]
  backdropFromPoster?: boolean
  keywords: string[]
  serverPosterSrc: string
}

type SaveFlash = "watchlist-add" | "watchlist-remove" | "rating" | "review" | null

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
        background: "var(--background-elevated)",
        color: "var(--text-faint-ui)",
        textAlign: "center",
      }}
    >
      {title || "No poster"}
    </div>
  )
}

function BackdropStage({
  backdrops,
  revealed,
  posterFallback,
  isMobile = false,
  initialSide = "right",
}: {
  backdrops: string[]
  revealed: boolean
  posterFallback: boolean
  isMobile?: boolean
  initialSide?: "left" | "right" | "center"
}) {
  if (!backdrops.length) return null

  return (
    <aside
      className={`movie-cinematic-stage${isMobile ? " movie-cinematic-stage--mobile" : ""}`}
      data-revealed={revealed ? "true" : "false"}
      aria-hidden
    >
      <div className="movie-cinematic-frame" data-side={initialSide}>
        {backdrops.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt=""
            className="movie-cinematic-backdrop-img"
            data-poster={posterFallback ? "true" : "false"}
            draggable={false}
          />
        ))}
      </div>
      <div className="movie-cinematic-stage-scrim" />
    </aside>
  )
}

function ScrollPanel({
  panelIdx,
  align,
  isMobile,
  children,
}: {
  panelIdx: number
  align: "left" | "right"
  isMobile: boolean
  children: ReactNode
}) {
  return (
    <article
      data-panel={panelIdx}
      className={`movie-cinematic-panel movie-cinematic-panel--${align}${isMobile ? " movie-cinematic-panel--mobile" : ""}`}
    >
      <div
        className="movie-cinematic-panel__content"
        data-chapter-intro={panelIdx > 0 ? "true" : undefined}
      >
        {children}
      </div>
    </article>
  )
}

function ActionSkeleton() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, minHeight: 44 }}>
      <div className="movie-action-skeleton" style={{ width: 132 }} aria-hidden />
      <div className="movie-action-skeleton" style={{ width: 118 }} aria-hidden />
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="t-label" style={{ color: "var(--text-label)" }}>{children}</div>
}

function MetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="t-title-sm" style={{ marginTop: 8, color: "var(--text-emphasis)" }}>
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
          e.currentTarget.style.color = isSelected ? "var(--text-strong)" : "var(--text-emphasis)"
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
  savedLabel,
  variant = "primary",
  savedFlash = false,
  compact = false,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  savedLabel?: string
  variant?: "primary" | "secondary"
  savedFlash?: boolean
  compact?: boolean
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
        padding: compact ? "8px 14px" : "10px 20px",
        fontSize: compact ? undefined : undefined,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !savedFlash ? 0.55 : 1,
        transition: savedFlash
          ? undefined
          : "opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease, transform 0.2s ease",
        flex: compact ? "1 1 auto" : undefined,
        minWidth: compact ? 0 : undefined,
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        if (disabled || savedFlash) return
        if (p) e.currentTarget.style.opacity = "0.88"
        else {
          e.currentTarget.style.background = "var(--tint-hover)"
          e.currentTarget.style.borderColor = "var(--border-strong)"
        }
      }}
      onMouseLeave={(e) => {
        if (disabled || savedFlash) return
        if (p) e.currentTarget.style.opacity = "1"
        else {
          e.currentTarget.style.background = "var(--tint-base)"
          e.currentTarget.style.borderColor = "var(--border-default)"
        }
      }}
    >
      {display}
    </button>
  )
}

function SecondaryButton(props: Omit<Parameters<typeof PrimaryButton>[0], "variant">) {
  return <PrimaryButton {...props} variant="secondary" />
}

export default function MovieDetailClient({
  tmdbId,
  movie,
  credits,
  backdrops,
  backdropFromPoster = false,
  keywords,
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
  const [showStickyBar, setShowStickyBar] = useState(false)
  const rateOnLoadHandledRef = useRef(false)
  const actionAnchorRef = useRef<HTMLDivElement>(null)
  const yourTakeRef = useRef<HTMLDivElement>(null)
  const saveFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
  const [filmography, setFilmography] = useState<{ id: number; title: string; year: number }[]>([])
  const [loadingFilmography, setLoadingFilmography] = useState(false)
  const [castExpanded, setCastExpanded] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const cinematicRef = useRef<HTMLDivElement>(null)

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
      const row = watched.find((item) => item.id === tmdbId && item.mediaType === "movie")
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
        watchlist.some((item) => item.id === tmdbId && item.mediaType === "movie"),
      )
      setUserLoading(false)
    }
    loadUserData()
    return () => {
      active = false
    }
  }, [tmdbId])

  useEffect(() => {
    if (!userLoading) {
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)))
      return () => cancelAnimationFrame(id)
    }
  }, [userLoading])

  useLayoutEffect(() => {
    const root = cinematicRef.current
    if (!root || !revealed || userLoading || !backdrops.length) return

    const frame = root.querySelector<HTMLElement>(".movie-cinematic-frame")
    const imgs = root.querySelectorAll<HTMLImageElement>(".movie-cinematic-backdrop-img")
    const panels = root.querySelectorAll<HTMLElement>("[data-panel]")
    if (!imgs.length || !panels.length) return

    const scrubStart = isMobile ? "top 90%" : "top 85%"
    const scrubEnd = isMobile ? "top 52%" : "top 48%"

    if (prefersReducedMotion()) {
      imgs.forEach((img, i) => {
        img.style.opacity = i === 0 ? "1" : "0"
      })
      panels.forEach((panel, i) => {
        const content = panel.querySelector<HTMLElement>(".movie-cinematic-panel__content")
        if (!content) return
        content.style.opacity = "1"
        content.style.transform = "none"
        if (frame && i > 0) frame.setAttribute("data-side", backdropSide(i, isMobile))
      })
      if (frame) frame.setAttribute("data-side", backdropSide(0, isMobile))
      return
    }

    const { gsap } = ensureGsap()
    const ctx = gsap.context(() => {
      gsap.set(imgs, { opacity: 0 })
      gsap.set(imgs[0], { opacity: 1 })

      panels.forEach((panel, i) => {
        const content = panel.querySelector<HTMLElement>(".movie-cinematic-panel__content")
        if (!content) return
        if (i === 0) {
          gsap.set(content, { opacity: 1, y: 0 })
        } else {
          gsap.set(content, { opacity: 0, y: 18 })
        }
      })

      for (let i = 0; i < imgs.length - 1; i++) {
        const nextPanel = panels[i + 1]
        if (!nextPanel) break

        const nextContent = nextPanel.querySelector<HTMLElement>(".movie-cinematic-panel__content")
        const fromSide = backdropSide(i, isMobile)
        const toSide = backdropSide(i + 1, isMobile)

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: nextPanel,
            start: scrubStart,
            end: scrubEnd,
            scrub: 0.5,
            onUpdate(self) {
              if (!frame || isMobile) return
              frame.setAttribute("data-side", self.progress > 0.88 ? toSide : fromSide)
            },
          },
        })

        tl.to(imgs[i], { opacity: 0, ease: "none", duration: 1 }, 0)
        tl.to(imgs[i + 1], { opacity: 1, ease: "none", duration: 1 }, 0)
        if (nextContent) {
          tl.to(nextContent, { opacity: 1, y: 0, ease: "power2.out", duration: 1 }, 0)
        }
      }
    }, root)

    return () => ctx.revert()
  }, [revealed, userLoading, backdrops, isMobile])

  useEffect(() => {
    if (userLoading || !rateOnLoad || rateOnLoadHandledRef.current || dbRecord) return
    rateOnLoadHandledRef.current = true
    queueMicrotask(() => {
      setRatingValue((v) => v ?? 7)
      setRatingOpen(true)
      setWatchedEarlier(true)
    })
  }, [userLoading, rateOnLoad, dbRecord])

  useEffect(() => {
    if (userLoading) return
    const el = actionAnchorRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting && !ratingOpen),
      { threshold: 0, rootMargin: "-8px 0px 0px 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [userLoading, ratingOpen])

  const posterSrc = dbRecord?.poster || serverPosterSrc

  const movieForDb = (): MediaItem => ({
    id: String(tmdbId),
    mediaType: "movie",
    title: movie.title,
    year: movie.release_date ? new Date(movie.release_date).getFullYear() : 0,
    language: formatLanguage(movie.original_language),
    poster: posterSrc || "",
    backdrop: backdrops[0] || undefined,
  })

  const handleAddWatchlist = async () => {
    setBusy(true)
    setActionError(null)
    const result = await addToWatchlistDetailed(movieForDb())
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
      if (item.id === tmdbId && item.mediaType === "movie") setIsWatchlisted(true)
      return { ok: true }
    }
    return {
      ok: false,
      message: messageForAddToWatchlistFailure(result.reason),
    }
  }

  const handleRemoveWatchlist = async () => {
    setBusy(true)
    if (await removeFromWatchlist(tmdbId, "movie")) {
      setIsWatchlisted(false)
      triggerSaveFlash("watchlist-remove")
    }
    setBusy(false)
  }

  const handleSaveRating = async () => {
    if (ratingValue == null) return
    setSavingRating(true)
    setActionError(null)
    const result = await markAsWatchedDetailed(movieForDb(), ratingValue, {
      watchedAt: watchedEarlier ? dateInputToIso(watchedDate) : new Date().toISOString(),
    })
    if (!result.ok) {
      setActionError(messageForMarkWatchedFailure(result.reason))
      setSavingRating(false)
      return
    }
    const watched = await getWatched()
    const row = watched.find((item) => item.id === tmdbId && item.mediaType === "movie")
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
    if (await updateReview(tmdbId, headline, body || undefined, "movie")) {
      setEditingReview(false)
      setDbRecord((prev) =>
        prev ? { ...prev, review_headline: headline, review_body: body } : prev
      )
      triggerSaveFlash("review")
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
    setFilmography(await getPersonFilmography(name))
    setLoadingFilmography(false)
  }

  const ratingNum = ratingNumber(dbRecord?.rating)
  const hasReview = Boolean(dbRecord?.review_headline || dbRecord?.review_body)
  const isWatched = Boolean(dbRecord)
  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : null
  const visibleCast = castExpanded ? credits.cast : credits.cast.slice(0, CAST_PREVIEW)

  const openRating = () => {
    setRatingValue(ratingValue ?? ratingNum ?? 7)
    setRatingOpen(true)
  }

  const openReviewEditor = () => {
    setEditingReview(true)
    requestAnimationFrame(() => {
      yourTakeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  const actionButtons = (compact = false) => {
    if (userLoading) return <ActionSkeleton />

    return (
      <>
        {!isWatched && !isWatchlisted && (
          <PrimaryButton
            compact={compact}
            onClick={handleAddWatchlist}
            disabled={busy}
            label="Add to watchlist"
            savedFlash={saveFlash === "watchlist-add"}
            savedLabel="Added"
          />
        )}
        {isWatchlisted && !isWatched && (
          <SecondaryButton
            compact={compact}
            onClick={handleRemoveWatchlist}
            disabled={busy}
            label="Remove"
            savedFlash={saveFlash === "watchlist-remove"}
            savedLabel="Removed"
          />
        )}
        {!isWatched ? (
          <PrimaryButton
            compact={compact}
            onClick={openRating}
            disabled={busy}
            label="Mark watched"
            variant={isWatchlisted ? "primary" : "secondary"}
            savedFlash={saveFlash === "rating" && !ratingOpen}
            savedLabel="Saved"
          />
        ) : compact ? (
          <>
            <SecondaryButton
              compact
              onClick={openRating}
              label={ratingNum != null ? "Change rating" : "Add rating"}
              savedFlash={saveFlash === "rating" && !ratingOpen}
              savedLabel="Saved"
            />
            {!hasReview && !editingReview && (
              <SecondaryButton compact onClick={openReviewEditor} label="Write review" />
            )}
            {hasReview && !editingReview && (
              <SecondaryButton compact onClick={openReviewEditor} label="Edit review" />
            )}
          </>
        ) : null}
      </>
    )
  }

  const ratingPanel = (
    <div
      className="movie-rating-panel-in"
      style={{
        padding: 20,
        background: "rgba(12,12,16,0.85)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="t-label" style={{ color: "var(--text-label)", marginBottom: 16, textAlign: "center" }}>
        How much applause?
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <StandingOvationInput value={ratingValue} onChange={(v) => setRatingValue(v)} />
      </div>
      <div
        style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: "1px solid var(--border-default)",
          display: "grid",
          gap: 10,
          maxWidth: 340,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <label
          className="t-label-value"
          style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-emphasis)", cursor: "pointer" }}
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
      <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <PrimaryButton
          onClick={handleSaveRating}
          disabled={savingRating || ratingValue == null}
          label={savingRating ? "Saving…" : isWatched ? "Update rating" : "Mark as watched"}
          savedFlash={saveFlash === "rating"}
          savedLabel="Saved"
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
        <p className="t-caption" style={{ marginTop: 10, color: "rgba(255,180,180,0.85)", textAlign: "center" }}>
          {actionError}
        </p>
      )}
    </div>
  )

  const changeRatingLink = (
    <button
      type="button"
      onClick={openRating}
      className="t-button-sm"
      style={{
        marginTop: 10,
        padding: 0,
        border: "none",
        background: "transparent",
        color: "var(--text-link)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--text-link-hover)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--text-link)"
      }}
    >
      {ratingNum != null ? "Change rating" : "Add rating"}
    </button>
  )

  const yourTakeSection = isWatched && !userLoading && (
    <div
      ref={yourTakeRef}
      id="your-take"
      className="movie-panel-in"
      style={{
        marginTop: 28,
        paddingTop: 28,
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <SectionLabel>Your take</SectionLabel>

      <div style={{ marginTop: 14 }}>
        {ratingNum != null ? (
          <>
            <RatingDisplay rating={ratingNum} size="lg" showLabel />
            {!ratingOpen && changeRatingLink}
          </>
        ) : (
          <PrimaryButton onClick={openRating} label="Add your applause" />
        )}
      </div>

      {ratingOpen && (
        <div style={{ marginTop: 16, maxWidth: 440 }}>{ratingPanel}</div>
      )}

      {editingReview ? (
        <div
          style={{
            marginTop: 20,
            padding: 20,
            maxWidth: 520,
            background: "rgba(12,12,16,0.72)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            backdropFilter: "blur(10px)",
          }}
        >
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
            placeholder="What stayed with you? A scene, a feeling, why it mattered…"
            aria-label="Review body"
            className="t-body"
            style={{
              width: "100%",
              marginTop: 14,
              color: "var(--text-emphasis)",
              background: "var(--background-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              padding: 12,
              minHeight: 140,
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
      ) : hasReview ? (
        <div
          style={{
            marginTop: 20,
            padding: 20,
            maxWidth: 520,
            background: "rgba(12,12,16,0.45)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={openReviewEditor}
            className="t-button-sm"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              padding: 0,
              border: "none",
              background: "transparent",
              color: "var(--text-link)",
              cursor: "pointer",
            }}
          >
            Edit
          </button>
          {dbRecord?.review_headline && (
            <h2 className="t-sub" style={{ margin: 0, color: "var(--text-strong)" }}>
              {dbRecord.review_headline}
            </h2>
          )}
          {dbRecord?.review_body && (
            <p
              className="t-body-lg"
              style={{
                marginTop: dbRecord?.review_headline ? 14 : 0,
                marginBottom: 0,
                color: "var(--text-emphasis)",
              }}
            >
              {dbRecord.review_body}
            </p>
          )}
        </div>
      ) : (
        <div
          style={{
            marginTop: 20,
            padding: "24px 20px",
            maxWidth: 520,
            background: "rgba(12,12,16,0.5)",
            border: "1px dashed rgba(255,255,255,0.14)",
            borderRadius: 12,
            textAlign: "center",
          }}
        >
          <p className="t-title-sm" style={{ margin: 0, color: "var(--text-secondary)" }}>
            Capture what stuck with you
          </p>
          <p className="t-meta" style={{ margin: "8px 0 0", color: "var(--text-dim)" }}>
            A headline and a few lines — your diary, not a critic&apos;s essay.
          </p>
          <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
            <PrimaryButton onClick={openReviewEditor} label="Start writing" />
          </div>
        </div>
      )}
    </div>
  )

  const filmographyPanel = selectedPerson && (
    <div
      className="movie-panel-in"
      style={{
        marginTop: 18,
        padding: 16,
        background: "rgba(12,12,16,0.82)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="t-label" style={{ color: "var(--text-label)" }}>
            Also by
          </div>
          <div className="t-title-lg" style={{ marginTop: 4, color: "var(--text-strong)" }}>
            {selectedPerson}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedPerson(null)
            setFilmography([])
          }}
          className="t-button-sm"
          style={{ color: "var(--text-search)", background: "transparent", border: "none", cursor: "pointer" }}
        >
          Close
        </button>
      </div>
      <div style={{ marginTop: 12 }}>
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
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              gap: "4px 14px",
            }}
          >
            {filmography.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/movie/${f.id}`}
                  className="t-title-sm"
                  style={{
                    color: "var(--text-emphasis)",
                    lineHeight: 1.7,
                    textDecoration: "none",
                    transition: "color 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--text-inverse)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-emphasis)"
                  }}
                >
                  {f.title}
                  {f.year ? (
                    <span className="t-caption" style={{ marginLeft: 6, color: "var(--text-search)" }}>
                      {f.year}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )

  return (
    <main
      className={isMobile ? "page-with-mobile-tabs" : undefined}
      style={{
        background: BG,
        color: "var(--text-emphasis)",
        position: "relative",
        paddingBottom: showStickyBar && isMobile ? MOBILE_TAB_BAR_INSET : undefined,
      }}
    >
      <div ref={cinematicRef} className="movie-cinematic" data-mobile={isMobile ? "true" : "false"}>
        {backdrops.length > 0 && (
          <BackdropStage
            backdrops={backdrops}
            revealed={revealed}
            posterFallback={backdropFromPoster}
            isMobile={isMobile}
            initialSide={backdropSide(0, isMobile)}
          />
        )}

        <div className="movie-cinematic-track">
          <ScrollPanel panelIdx={0} align="left" isMobile={isMobile}>
        <h1 className="t-display" style={{ margin: 0, color: "var(--text-strong)" }}>
          {movie.title}
        </h1>
        {movie.tagline && (
          <p className="t-title" style={{ margin: 0, marginTop: 12, color: "var(--text-dim)" }}>
            {movie.tagline}
          </p>
        )}

        {isWatchlisted && !isWatched && !userLoading && (
          <div
            className="t-button-sm mobile-stagger-in"
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
              alignSelf: "flex-start",
            }}
          >
            On your watchlist
          </div>
        )}

        <div ref={actionAnchorRef}>
          {!isWatched && (
            <>
              <div
                style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 10, minHeight: 44 }}
              >
                {actionButtons()}
              </div>
              {ratingOpen && (
                <div style={{ marginTop: 20, maxWidth: 440 }}>{ratingPanel}</div>
              )}
            </>
          )}
          {yourTakeSection}
        </div>

        <div
          style={{
            marginTop: 36,
            paddingTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(auto-fit,minmax(110px,1fr))",
            gap: 20,
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
          <MetaItem label="Language" value={formatLanguage(movie.original_language || "") || "Unknown"} />
          <MetaItem label="Release" value={monthYear(movie.release_date)} />
          <MetaItem label="Genre" value={movie.genres?.[0]?.name || "N/A"} />
          {movie.runtime ? (
            <MetaItem label="Runtime" value={`${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`} />
          ) : null}
        </div>

        {(movie.genres?.length || 0) > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
            {movie.genres!.map((g) => (
              <span
                key={g.id}
                className="t-button-sm"
                style={{
                  color: "var(--text-dim)",
                  padding: "5px 12px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 999,
                }}
              >
                {g.name}
              </span>
            ))}
          </div>
        )}
          </ScrollPanel>

          <ScrollPanel panelIdx={1} align="right" isMobile={isMobile}>
        {movie.overview && (
          <div style={{ marginBottom: 44 }}>
            <SectionLabel>Overview</SectionLabel>
            <p className="t-body" style={{ marginTop: 12, color: "var(--text-emphasis)" }}>
              {movie.overview}
            </p>
          </div>
        )}

        <div style={{ paddingTop: movie.overview ? 36 : 0, borderTop: movie.overview ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "150px 1fr",
              gap: isMobile ? 20 : 32,
              alignItems: "flex-start",
            }}
          >
            {!isMobile && (
              <div
                style={{
                  position: "relative",
                  width: 150,
                  aspectRatio: "2/3",
                  borderRadius: 10,
                  overflow: "hidden",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
                }}
              >
                {posterSrc ? (
                  <img
                    src={posterSrc}
                    alt={movie.title}
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <PosterFallback title={movie.title} />
                )}
              </div>
            )}
            <div>
              <SectionLabel>Cast</SectionLabel>
              {credits.cast.length === 0 ? (
                <p className="t-meta" style={{ marginTop: 12, color: "var(--text-dim)" }}>
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
                      gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                      gap: "6px 14px",
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
                        marginTop: 10,
                        color: "var(--text-link)",
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                      }}
                    >
                      {castExpanded ? "Show less" : `Show all ${credits.cast.length}`}
                    </button>
                  )}
                </>
              )}
              {filmographyPanel}
            </div>
          </div>
        </div>
          </ScrollPanel>

          <ScrollPanel panelIdx={2} align="left" isMobile={isMobile}>
        {keywords.length > 0 && (
          <div>
            <SectionLabel>Themes</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
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
          </div>
        )}

        <footer style={{ marginTop: 56, paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
          <p
            className="t-caption"
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              color: "var(--text-footer)",
            }}
          >
            {releaseYear ? `${movie.title} · ${releaseYear}` : movie.title}
          </p>
        </footer>
          </ScrollPanel>
        </div>
      </div>

      {showStickyBar && !ratingOpen && (
        <div className="movie-sticky-actions" role="region" aria-label="Quick actions">
          <div className="movie-sticky-actions-inner">{actionButtons(true)}</div>
        </div>
      )}

      {searchOpen && (
        <MediaSearch onAdd={handleSearchAdd} onClose={() => setSearchOpen(false)} />
      )}
    </main>
  )
}
