"use client"

import Link from "next/link"
import { useState } from "react"
import { Movie } from "@/lib/types"

type Size = "large" | "small"

const sizeClasses = {
  large: {
    card: "min-w-[180px] w-[180px]",
    poster: "aspect-[2/3] rounded-[10px]",
    title: "text-base",
  },
  small: {
    card: "min-w-[140px] w-[140px]",
    poster: "aspect-[2/3] rounded-[10px]",
    title: "text-sm",
  },
}

export default function MoviePosterCard({
  movie,
  size = "large",
  showRating,
}: {
  movie: Movie & { rating?: number }
  size?: Size
  showRating?: boolean
}) {
  const s = sizeClasses[size]
  const isGradient = movie.poster.startsWith("linear-gradient")
  const [loaded, setLoaded] = useState(isGradient)
  const hasRating = showRating && movie.rating != null

  return (
    <Link
      href={`/movie/${movie.id}`}
      className={`${s.card} group block text-left`}
    >
      <div
        className={`${s.poster} relative overflow-hidden bg-black/40`}
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
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

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-transform duration-200 hover:scale-110"
            aria-label="Play"
            onClick={(e) => e.preventDefault()}
          >
            <span className="text-sm">▶</span>
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition-transform duration-200 hover:scale-110"
            aria-label="Add to list"
            onClick={(e) => e.preventDefault()}
          >
            <span className="text-sm">+</span>
          </button>
        </div>

        {hasRating && (
          <div className="absolute left-2 top-2 flex items-center gap-0.5 rounded bg-black/50 px-1.5 py-0.5 text-amber-400">
            <span className="text-xs font-medium">★</span>
            <span className="text-xs font-medium">{movie.rating}</span>
          </div>
        )}
      </div>

      <h3
        className={`${s.title} mt-2 line-clamp-2 text-white`}
        style={{ fontWeight: 500 }}
      >
        {movie.title}
      </h3>
      <span className="mt-1 inline-block rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/50">
        {movie.language}
      </span>
      {movie.year != null && (
        <p className="mt-0.5 text-xs text-white/35">{movie.year}</p>
      )}
    </Link>
  )
}
