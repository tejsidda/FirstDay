"use client"

import Link from "next/link"
import { useState } from "react"
import { Movie } from "@/lib/types"

type Size = "large" | "small"

const sizeClasses = {
  large: {
    card: "min-w-[160px] w-[160px]",
    poster: "aspect-[2/3] rounded-[12px]",
    title: "text-[14px]",
  },
  small: {
    card: "min-w-[140px] w-[140px]",
    poster: "aspect-[2/3] rounded-[12px]",
    title: "text-[13px]",
  },
}

export default function MoviePosterCard({
  movie,
  size = "large",
  showRating,
  onMarkWatched,
  onRemove,
}: {
  movie: Movie & { rating?: number }
  size?: Size
  showRating?: boolean
  onMarkWatched?: (movie: Movie, rating: number) => void
  onRemove?: (movie: Movie) => void
}) {
  const s = sizeClasses[size]
  const isGradient = movie.poster.startsWith("linear-gradient")
  const [loaded, setLoaded] = useState(true)
  const [showRatingPicker, setShowRatingPicker] = useState(false)
  const hasRating = showRating && movie.rating != null

  return (
    <Link
      href={`/movie/${movie.id}`}
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
                      background: "rgba(255,255,255,0.15)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                    aria-label="Mark as watched"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowRatingPicker(true)
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                      background: "rgba(255,255,255,0.08)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                    aria-label="Remove from watchlist"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onRemove(movie)
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ) : (
              /* Rating picker — shows after clicking checkmark */
              <div className="relative z-10 flex flex-col items-center gap-2">
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "Georgia, serif" }}>
                  Rate this film
                </p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onMarkWatched?.(movie, star)
                        setShowRatingPicker(false)
                      }}
                      className="transition-transform duration-150 hover:scale-125"
                      style={{
                        fontSize: 22,
                        color: "#f5c518",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "2px 3px",
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
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
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-[6px] bg-black/60 px-2 py-1 text-[11px] backdrop-blur-[4px]">
            <span className="font-medium" style={{ color: "#f5c518" }}>
              ★
            </span>
            <span className="font-medium" style={{ color: "#f5c518" }}>
              {movie.rating}
            </span>
          </div>
        )}
      </div>

      <h3
        className={`${s.title} mt-2.5 line-clamp-1 font-medium text-white/85`}
      >
        {movie.title}
      </h3>
      <p className="mt-1 text-[12px] text-white/35">
        {movie.language}
        {movie.year != null ? ` · ${movie.year}` : ""}
      </p>
    </Link>
  )
}
