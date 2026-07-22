import type { MediaItem, Movie, Recommendation } from "@/lib/types"

export function makeMovie(overrides: Partial<Movie> = {}): MediaItem {
  return {
    id: "1",
    mediaType: "movie",
    title: "First Film",
    year: 2024,
    language: "en",
    poster: "https://example.com/poster.jpg",
    backdrop: "https://example.com/backdrop.jpg",
    runtime: 120,
    ...overrides,
  }
}

export function makeRecommendation(
  overrides: Partial<Recommendation> = {},
): Recommendation {
  return {
    id: "rec-1",
    tmdbId: 101,
    title: "Recommended Film",
    year: 2023,
    language: "en",
    poster: "https://example.com/rec-poster.jpg",
    backdrop: "https://example.com/rec-backdrop.jpg",
    reason: "Because you liked similar films.",
    shown: false,
    addedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  }
}
