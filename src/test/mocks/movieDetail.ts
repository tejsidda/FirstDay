import type { ComponentProps } from "react"
import type MovieDetailClient from "@/app/movie/[id]/MovieDetailClient"

type MovieDetailProps = ComponentProps<typeof MovieDetailClient>

const sampleMovie: MovieDetailProps["movie"] = {
  id: 550,
  title: "Fight Club",
  tagline: "Mischief. Mayhem. Soap.",
  original_language: "en",
  release_date: "1999-10-15",
  overview: "An insomniac office worker and a soap maker form an underground fight club.",
  poster_path: "/poster.jpg",
  backdrop_path: "/backdrop.jpg",
  genres: [
    { id: 18, name: "Drama" },
    { id: 53, name: "Thriller" },
  ],
  runtime: 139,
}

export function makeMovieDetailProps(
  overrides: Partial<MovieDetailProps> = {},
): MovieDetailProps {
  return {
    tmdbId: "550",
    movie: sampleMovie,
    credits: {
      director: "David Fincher",
      cast: ["Brad Pitt", "Edward Norton", "Helena Bonham Carter"],
    },
    backdrops: [
      "https://example.com/backdrop-1.jpg",
      "https://example.com/backdrop-2.jpg",
      "https://example.com/backdrop-3.jpg",
    ],
    backdropFromPoster: false,
    keywords: ["rebellion", "identity"],
    serverPosterSrc: "https://example.com/poster.jpg",
    ...overrides,
  }
}
