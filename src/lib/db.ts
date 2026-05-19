import { supabase } from "./supabase"
import { Movie, type Recommendation } from "./types"

type MovieRow = {
  tmdb_id: string
  title: string
  year: number
  language: string
  poster: string
  backdrop: string | null
  watched_at?: string | null
  rating?: number | string | null
  review_headline?: string | null
  review_body?: string | null
}

// Convert a Supabase row to the app's Movie type
function rowToMovie(row: MovieRow): Movie {
  return {
    id: row.tmdb_id,
    title: row.title,
    year: row.year,
    language: row.language,
    poster: row.poster,
    backdrop: row.backdrop || undefined,
    watchedAt: row.watched_at || undefined,
    rating:
      row.rating != null && row.rating !== ""
        ? Number(row.rating)
        : undefined,
    reviewHeadline: row.review_headline || undefined,
    reviewBody: row.review_body || undefined,
  }
}

// ---- WATCHLIST ----

export async function getWatchlist(): Promise<Movie[]> {
  const { data, error } = await supabase
    .from("watchlist")
    .select("*")
    .order("added_at", { ascending: false })
  if (error) {
    console.error("Error loading watchlist:", error.message)
    return []
  }
  return (data || []).map(rowToMovie)
}

export type AddToWatchlistResult =
  | { ok: true }
  | { ok: false; reason: "already_watchlisted" | "already_watched" | "error" }

/**
 * Adds to watchlist. Blocks if the film is already in `watched` (use the movie page
 * to rewatch + re-rate instead) or already on the watchlist.
 */
export async function addToWatchlistDetailed(
  movie: Movie,
): Promise<AddToWatchlistResult> {
  const { data: alreadyWatched } = await supabase
    .from("watched")
    .select("id")
    .eq("tmdb_id", movie.id)
    .limit(1)
  if (alreadyWatched && alreadyWatched.length > 0) {
    return { ok: false, reason: "already_watched" }
  }

  const { data: existing } = await supabase
    .from("watchlist")
    .select("id")
    .eq("tmdb_id", movie.id)
    .limit(1)
  if (existing && existing.length > 0) {
    return { ok: false, reason: "already_watchlisted" }
  }

  const { error } = await supabase.from("watchlist").insert({
    tmdb_id: movie.id,
    title: movie.title,
    year: movie.year,
    language: movie.language,
    poster: movie.poster,
    backdrop: movie.backdrop || null,
  })
  if (error) {
    console.error("Error adding to watchlist:", error.message)
    return { ok: false, reason: "error" }
  }
  return { ok: true }
}

/** Legacy boolean API. Prefer `addToWatchlistDetailed`. */
export async function addToWatchlist(movie: Movie): Promise<boolean> {
  const r = await addToWatchlistDetailed(movie)
  return r.ok
}

export async function removeFromWatchlist(tmdbId: string): Promise<boolean> {
  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("tmdb_id", tmdbId)
  if (error) {
    console.error("Error removing from watchlist:", error.message)
    return false
  }
  return true
}

// ---- WATCHED ----

export async function getWatched(): Promise<Movie[]> {
  const { data, error } = await supabase
    .from("watched")
    .select("*")
    .order("watched_at", { ascending: false })
  if (error) {
    console.error("Error loading watched:", error.message)
    return []
  }
  return (data || []).map(rowToMovie)
}

/** rating: 1–10, supports 0.5 (e.g. 7.5) */
export async function markAsWatched(
  movie: Movie,
  rating: number,
  options?: { reviewBody?: string; watchedAt?: string }
): Promise<boolean> {
  const reviewBody = options?.reviewBody?.trim()
  const watchedAtIso = options?.watchedAt || new Date().toISOString()

  // Check for duplicates
  const { data: existing } = await supabase
    .from("watched")
    .select("id")
    .eq("tmdb_id", movie.id)
    .limit(1)

  if (existing && existing.length > 0) {
    const { error: updateError } = await supabase
      .from("watched")
      .update({
        rating,
        review_body: reviewBody || null,
        watched_at: watchedAtIso,
      })
      .eq("tmdb_id", movie.id)
    if (updateError) {
      console.error("Error updating watched movie:", updateError.message)
      return false
    }
    if (!(await deleteFromWatchlistVerified(movie.id))) {
      return false
    }
    return true
  }

  // Insert into watched table
  const { error: insertError } = await supabase.from("watched").insert({
    tmdb_id: movie.id,
    title: movie.title,
    year: movie.year,
    language: movie.language,
    poster: movie.poster,
    backdrop: movie.backdrop || null,
    rating,
    review_body: reviewBody || null,
    watched_at: watchedAtIso,
  })
  if (insertError) {
    console.error("Error marking as watched:", insertError.message)
    return false
  }
  if (!(await deleteFromWatchlistVerified(movie.id))) {
    return false
  }
  return true
}

/**
 * Deletes watchlist row(s) for tmdbId and verifies the row is actually gone.
 * Returns false only if a row still exists after the delete (silent RLS
 * no-ops, trigger blocks, or actual DB errors). Returns true if the row is
 * gone — including the case where it was never there in the first place.
 */
async function deleteFromWatchlistVerified(tmdbId: string): Promise<boolean> {
  const { error: delError } = await supabase
    .from("watchlist")
    .delete()
    .eq("tmdb_id", tmdbId)
  if (delError) {
    console.error("Watchlist delete failed:", delError.message)
    return false
  }
  const { data: stillThere, error: verifyError } = await supabase
    .from("watchlist")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .limit(1)
  if (verifyError) {
    console.error("Watchlist verify failed:", verifyError.message)
    return false
  }
  if (stillThere && stillThere.length > 0) {
    console.error(
      "Watchlist row persists after delete (RLS or trigger?):",
      tmdbId,
    )
    return false
  }
  return true
}

/** Update rating for an already-watched film (e.g. 7 → 7.5) */
export async function updateWatchedRating(
  tmdbId: string,
  rating: number
): Promise<boolean> {
  const { error } = await supabase
    .from("watched")
    .update({ rating })
    .eq("tmdb_id", tmdbId)
  if (error) {
    console.error("Error updating rating:", error.message)
    return false
  }
  return true
}

export async function updateReview(
  tmdbId: string,
  headline: string,
  body?: string
): Promise<boolean> {
  const { error } = await supabase
    .from("watched")
    .update({
      review_headline: headline,
      review_body: body || null,
    })
    .eq("tmdb_id", tmdbId)

  if (error) {
    console.error("Error updating review:", error.message)
    return false
  }
  return true
}

// ---- RECOMMENDATIONS (AI batch, shown/dismiss tracking) ----

function rowToRecommendation(row: {
  id: string
  tmdb_id: string
  title: string
  year: number
  language: string
  poster: string
  backdrop: string | null
  reason: string
  shown: boolean
  added_at: string
}): Recommendation {
  const tmdbNum = parseInt(String(row.tmdb_id), 10)
  return {
    id: row.id,
    tmdbId: Number.isNaN(tmdbNum) ? 0 : tmdbNum,
    title: row.title,
    year: row.year ?? 0,
    language: row.language ?? "",
    poster: row.poster ?? "",
    backdrop: row.backdrop ?? "",
    reason: row.reason ?? "",
    shown: row.shown ?? false,
    addedAt: row.added_at,
  }
}

export async function getUnshownRecommendations(
  limit: number
): Promise<Recommendation[]> {
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .eq("shown", false)
    .order("added_at", { ascending: true })
    .limit(limit)
  if (error) {
    console.error("Error loading unshown recommendations:", error.message)
    return []
  }
  return (data || []).map(rowToRecommendation)
}

export async function markRecommendationShown(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("recommendations")
    .update({ shown: true })
    .eq("id", id)
  if (error) {
    console.error("Error marking recommendation shown:", error.message)
    return false
  }
  return true
}

export async function getUnshownCount(): Promise<number> {
  const { count, error } = await supabase
    .from("recommendations")
    .select("*", { count: "exact", head: true })
    .eq("shown", false)
  if (error) {
    console.error("Error counting unshown recommendations:", error.message)
    return 0
  }
  return count ?? 0
}

/** API-shaped item before DB insert (no id/shown/addedAt) */
export type RecommendationInsert = {
  tmdbId: string
  title: string
  year: number
  language: string
  poster: string
  backdrop?: string
  reason: string
}

export async function clearAndInsertRecommendations(
  recommendations: RecommendationInsert[]
): Promise<boolean> {
  // Delete all rows (added_at is always set by default)
  const { error: delError } = await supabase
    .from("recommendations")
    .delete()
    .gte("added_at", "1970-01-01T00:00:00Z")
  if (delError) {
    console.error("Error clearing recommendations:", delError.message)
    return false
  }

  if (recommendations.length === 0) return true

  const rows = recommendations.map((r) => ({
    tmdb_id: String(r.tmdbId),
    title: r.title,
    year: r.year,
    language: r.language,
    poster: r.poster || "",
    backdrop: r.backdrop || "",
    reason: r.reason || "",
    shown: false,
  }))

  const { error: insError } = await supabase.from("recommendations").insert(rows)
  if (insError) {
    console.error("Error inserting recommendations:", insError.message)
    return false
  }
  return true
}

export async function hasAnyRecommendations(): Promise<boolean> {
  const { data, error } = await supabase
    .from("recommendations")
    .select("id")
    .limit(1)
  if (error) {
    console.error("Error checking recommendations:", error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}
