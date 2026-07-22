import { posterURL } from "@/lib/tmdb"
import {
  fetchTvDetails,
  fetchTvCredits,
  getTvBackdrops,
} from "@/lib/tmdb-server"
import TvDetailClient from "./TvDetailClient"

export default async function TvDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: tmdbId } = await params

  const [show, credits] = await Promise.all([
    fetchTvDetails(tmdbId),
    fetchTvCredits(tmdbId),
  ])

  if (!show) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background-base)" }}
      >
        <p className="t-meta" style={{ color: "var(--text-search)" }}>
          TV show not found.
        </p>
      </main>
    )
  }

  const serverPosterSrc = show.poster_path ? posterURL(show.poster_path) : ""
  const { urls: serverBackdrops, fromPoster: backdropFromPoster } = await getTvBackdrops(tmdbId, {
    posterPath: show.poster_path,
    backdropPath: show.backdrop_path,
  })

  return (
    <TvDetailClient
      tmdbId={tmdbId}
      show={show}
      credits={credits}
      backdrops={serverBackdrops}
      backdropFromPoster={backdropFromPoster}
      serverPosterSrc={serverPosterSrc}
    />
  )
}
