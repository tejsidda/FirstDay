import { supabase } from "./supabase"
import { Movie } from "./types"

// Convert a Supabase row to the app's Movie type
function rowToMovie(row: any): Movie {
  return {
    id: row.tmdb_id,
    title: row.title,
    year: row.year,
    language: row.language,
    poster: row.poster,
    backdrop: row.backdrop || undefined,
    rating: row.rating || undefined,
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

export async function addToWatchlist(movie: Movie): Promise<boolean> {
  // Check for duplicates
  const { data: existing } = await supabase
    .from("watchlist")
    .select("id")
    .eq("tmdb_id", movie.id)
    .limit(1)
  if (existing && existing.length > 0) return false

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
    return false
  }
  return true
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

export async function markAsWatched(movie: Movie, rating: number): Promise<boolean> {
  // Check for duplicates
  const { data: existing } = await supabase
    .from("watched")
    .select("id")
    .eq("tmdb_id", movie.id)
    .limit(1)

  if (existing && existing.length > 0) return false

  // Insert into watched table
  const { error: insertError } = await supabase.from("watched").insert({
    tmdb_id: movie.id,
    title: movie.title,
    year: movie.year,
    language: movie.language,
    poster: movie.poster,
    backdrop: movie.backdrop || null,
    rating,
  })
  if (insertError) {
    console.error("Error marking as watched:", insertError.message)
    return false
  }
  // Remove from watchlist (if it was there)
  await supabase.from("watchlist").delete().eq("tmdb_id", movie.id)
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
