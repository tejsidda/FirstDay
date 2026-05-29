import { getMovieDetails, getMovieCredits, getMovieImages, getMovieKeywords, posterURL, backdropURL } from "@/lib/tmdb"
import MovieDetailClient from "./MovieDetailClient"

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: tmdbId } = await params

  // All TMDB fetches run server-side — token never reaches the browser, responses cached 1h
  const [movie, credits, backdrops, keywords] = await Promise.all([
    getMovieDetails(tmdbId),
    getMovieCredits(tmdbId),
    getMovieImages(tmdbId),
    getMovieKeywords(tmdbId),
  ])

  // Fallback if movie not found
  if (!movie) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#0c0c10" }}>
        <p className="t-meta" style={{ color: "var(--text-search)" }}>Movie not found.</p>
      </main>
    )
  }

  const serverPosterSrc = movie.poster_path ? posterURL(movie.poster_path) : ""
  const serverBackdrops = backdrops.length > 0
    ? backdrops
    : movie.backdrop_path ? [backdropURL(movie.backdrop_path)] : []

  return (
    <MovieDetailClient
      tmdbId={tmdbId}
      movie={movie}
      credits={credits}
      backdrops={serverBackdrops}
      keywords={keywords}
      serverPosterSrc={serverPosterSrc}
    />
  )
}
