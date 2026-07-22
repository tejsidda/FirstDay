"use client"

import Link from "next/link"
import { useState } from "react"
import { MediaItem } from "@/lib/types"
import { mediaDetailPath, resolveMediaType } from "@/lib/media"
import { formatLanguage } from "@/lib/tmdb"
import RatingDisplay from "@/components/RatingDisplay"
import StandingOvationInput from "@/components/StandingOvationInput"

type Size = "large" | "small"

const sizeClasses = {
  large: {
    card: "min-w-[160px] w-[160px]",
    poster: "aspect-[2/3] rounded-[12px]",
  },
  small: {
    card: "min-w-[140px] w-[140px]",
    poster: "aspect-[2/3] rounded-[12px]",
  },
}

export default function MoviePosterCard({
  movie,
  size = "large",
  showRating,
  showTypeBadge = false,
  onMarkWatched,
  onRemove,
}: {
  movie: MediaItem & { rating?: number | null }
  size?: Size
  showRating?: boolean
  showTypeBadge?: boolean
  onMarkWatched?: (movie: MediaItem, rating: number) => void
  onRemove?: (movie: MediaItem) => void
}) {
  const s = sizeClasses[size]
  const isGradient = movie.poster.startsWith("linear-gradient")
  const [loaded, setLoaded] = useState(true)
  const [showRatingPicker, setShowRatingPicker] = useState(false)
  const hasRating = showRating && movie.rating != null

  const isTv = resolveMediaType(movie) === "tv"

  return (
    <Link
      href={mediaDetailPath(movie)}
      className={`${s.card} group block text-left`}
      onMouseLeave={() => setShowRatingPicker(false)}
    >
      <div
        className={`${s.poster} relative overflow-hidden bg-black/40 shadow-[0_4px_16px_rgba(0,0,0,0.5),0_1px_4px_rgba(0,0,0,0.4)] border border-white/5 transition-all group-hover:-translate-y-2 group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.7),0_8px_16px_rgba(0,0,0,0.5)] group-hover:border-white/10`}
        style={{
          transition:
            "all 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-300 ease-out group-hover:scale-105"
          style={
            isGradient
              ? { background: movie.poster }
              : {
                  backgroundImage: `url(${movie.poster})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
          }
          onLoad={() => setLoaded(true)}
        />

        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
          </div>
        )}

        {/* Hover overlay — only show if there are actions available */}
        {(onMarkWatched || onRemove) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)",
              }}
            />

            {!showRatingPicker ? (
              <div className="relative z-10 flex items-center gap-3">
                {/* Mark as watched button */}
                {onMarkWatched && (
                  <button
                    type="button"
                    className="flex items-center justify-center rounded-full transition-transform duration-200 hover:scale-110"
                    style={{
                      width: 44,
                      height: 44,
                      background: "var(--glass-highlight)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid var(--glass-border)",
                    }}
                    aria-label="Mark as watched"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowRatingPicker(true)
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-display)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                )}

                {/* Remove button */}
                {onRemove && (
                  <button
                    type="button"
                    className="flex items-center justify-center rounded-full transition-transform duration-200 hover:scale-110"
                    style={{
                      width: 44,
                      height: 44,
                      background: "var(--tint-hover)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid var(--border-default)",
                    }}
                    aria-label="Remove from watchlist"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onRemove(movie)
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ) : (
              <div
                className="relative z-10 flex max-w-[min(100%,360px)] flex-col items-center gap-2 px-2"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="t-label" style={{ color: "var(--text-button)" }}>
                  Standing ovation?
                </p>
                <StandingOvationInput
                  value={null}
                  onChange={(r) => {
                    onMarkWatched?.(movie, r)
                    setShowRatingPicker(false)
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* If no actions, show the existing simple hover overlay for watched films */}
        {!onMarkWatched && !onRemove && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
              }}
            />
          </div>
        )}

        {hasRating && (
          <div className="absolute left-2 top-2 rounded-[6px] bg-black/60 px-2 py-1 backdrop-blur-[4px]">
            <RatingDisplay rating={movie.rating!} size="sm" />
          </div>
        )}

        {showTypeBadge && isTv && (
          <div
            className="absolute right-2 top-2 rounded-[6px] px-2 py-1 backdrop-blur-[4px]"
            style={{ background: "rgba(0,0,0,0.65)" }}
          >
            <span className="t-caption" style={{ color: "var(--text-button)" }}>
              Series
            </span>
          </div>
        )}
      </div>

      <h3 className="t-title-sm mt-2.5 line-clamp-1 text-white/85">
        {movie.title}
      </h3>
      <p className="t-caption mt-1 text-white/35">
        {formatLanguage(movie.language)}
        {movie.year != null ? ` · ${movie.year}` : ""}
      </p>
    </Link>
  )
}
