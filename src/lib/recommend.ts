import { Movie } from "./types"
import {
  getUnshownRecommendations,
  clearAndInsertRecommendations,
  type RecommendationInsert,
} from "./db"

const ANTHROPIC_PROXY = "/api/recommend"

const DISPLAY_COUNT = 5
const API_BATCH = 25

/** API response shape before DB insert */
type ApiRecommendation = {
  tmdbId: string
  title: string
  year: number
  language: string
  poster: string
  backdrop?: string
  reason: string
}

async function fetchFromApi(
  watched: Movie[],
  watchlist: Movie[]
): Promise<ApiRecommendation[]> {
  const res = await fetch(ANTHROPIC_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ watched, watchlist }),
  })
  if (!res.ok) {
    console.error("Recommendation API error:", res.status)
    return []
  }
  const data = await res.json()
  return data.recommendations || []
}

function apiToInsert(rec: ApiRecommendation): RecommendationInsert {
  return {
    tmdbId: String(rec.tmdbId),
    title: rec.title,
    year: rec.year,
    language: rec.language,
    poster: rec.poster || "",
    backdrop: rec.backdrop || "",
    reason: rec.reason || "",
  }
}

/**
 * Returns up to 5 unshown recommendations.
 * Uses DB first; if fewer than 5 unshown, calls API for 25, stores, then returns first 5.
 */
export async function getRecommendations(
  watched: Movie[],
  watchlist: Movie[]
) {
  if (watched.length < 3) return []

  let unshown = await getUnshownRecommendations(DISPLAY_COUNT)
  if (unshown.length >= DISPLAY_COUNT) {
    return unshown
  }

  const apiRecs = await fetchFromApi(watched, watchlist)
  if (apiRecs.length === 0) {
    return unshown
  }

  const inserts = apiRecs.map(apiToInsert)
  const ok = await clearAndInsertRecommendations(inserts)
  if (!ok) return unshown

  unshown = await getUnshownRecommendations(DISPLAY_COUNT)
  return unshown
}

/**
 * Force API call: clear table, fetch 25, store, return first 5 unshown.
 */
export async function refreshRecommendations(
  watched: Movie[],
  watchlist: Movie[]
) {
  if (watched.length < 3) return []

  const apiRecs = await fetchFromApi(watched, watchlist)
  if (apiRecs.length === 0) return []

  const inserts = apiRecs.map(apiToInsert)
  const ok = await clearAndInsertRecommendations(inserts)
  if (!ok) return []

  return getUnshownRecommendations(DISPLAY_COUNT)
}
