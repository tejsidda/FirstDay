import { posterURL } from "@/lib/tmdb"
import {
  fetchMovieDetails,
  fetchMovieCredits,
  fetchMovieKeywords,
  getMovieBackdrops,
} from "@/lib/tmdb-server"
import MovieDetailClient from "./MovieDetailClient"

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: tmdbId } = await params

  // All TMDB fetches run server-side — token never reaches the browser, responses cached 1h
  const [movie, credits, keywords] = await Promise.all([
    fetchMovieDetails(tmdbId),
    fetchMovieCredits(tmdbId),
    fetchMovieKeywords(tmdbId),
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
  const { urls: serverBackdrops, fromPoster: backdropFromPoster } = await getMovieBackdrops(tmdbId, {
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
  })

  return (
    <MovieDetailClient
      tmdbId={tmdbId}
      movie={movie}
      credits={credits}
      backdrops={serverBackdrops}
      backdropFromPoster={backdropFromPoster}
      keywords={keywords}
      serverPosterSrc={serverPosterSrc}
    />
  )
}
