import { MediaItem } from "@/lib/types"
import { resolveMediaType } from "@/lib/media"
import MoviePosterCard from "./MoviePosterCard"

/**
 * Horizontal scroll rail of movie posters (e.g. watchlist or "recently watched").
 *
 * Change these to customize:
 * - title: section heading (e.g. "My Watchlist"); edit the string where the component is used.
 * - movies: array of Movie; pass your list from parent (e.g. WATCHLIST from mock or API).
 * - cardSize: "large" | "small" — use "small" for denser rails, "large" for hero-style rows.
 *
 * Used on the home page via PosterRail (which adds subtitle and optional rating). This component
 * is the low-level rail; for a rail with title + subtitle + showRating, use PosterRail instead.
 */
export default function WatchlistRail({
  title,
  movies,
  cardSize = "large",
}: {
  title: string
  movies: MediaItem[]
  cardSize?: "large" | "small"
}) {
  return (
    <section className="mt-12">
      {/* Change text-lg / font-medium / text-white/90 to restyle the section title. */}
      <h2 className="mb-4 text-lg font-medium text-white/90">{title}</h2>
      <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-2">
        {movies.map((movie) => (
          <MoviePosterCard
            key={`${resolveMediaType(movie)}-${movie.id}`}
            movie={{ ...movie, mediaType: resolveMediaType(movie) }}
            size={cardSize}
          />
        ))}
      </div>
    </section>
  )
}
