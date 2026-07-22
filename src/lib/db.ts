import { supabase } from "./supabase/client"
import { getMovieDetails, getTvDetails, type MovieGenre } from "./tmdb"
import { resolveMediaType } from "./media"
import { MediaItem, MediaType, Movie, type Recommendation } from "./types"

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user.id
}

type MediaRow = {
  tmdb_id: string
  media_type?: string | null
  title: string
  year: number
  language: string
  poster: string
  backdrop: string | null
  genres?: unknown
  runtime?: number | null
  seasons?: number | null
  episodes?: number | null
  watched_at?: string | null
  rating?: number | string | null
  review_headline?: string | null
  review_body?: string | null
}

function parseGenres(raw: unknown): MovieGenre[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.filter(
      (g): g is MovieGenre =>
        g != null && typeof g === "object" && "name" in g && typeof (g as MovieGenre).name === "string"
    )
  }
  if (typeof raw === "string") {
    try {
      return parseGenres(JSON.parse(raw))
    } catch {
      return []
    }
  }
  return []
}

function parseMediaType(raw: string | null | undefined): MediaType {
  return raw === "tv" ? "tv" : "movie"
}

async function resolveMetadataForMedia(item: MediaItem): Promise<{
  genres: MovieGenre[]
  runtime: number | null
  seasons: number | null
  episodes: number | null
}> {
  const mediaType = resolveMediaType(item)
  const hasGenres = (item.genres?.length ?? 0) > 0
  const hasRuntime = item.runtime != null && item.runtime > 0
  const hasSeasons = item.seasons != null && item.seasons > 0
  const hasEpisodes = item.episodes != null && item.episodes > 0

  if (mediaType === "movie" && hasGenres && hasRuntime) {
    return {
      genres: item.genres!,
      runtime: item.runtime!,
      seasons: null,
      episodes: null,
    }
  }

  if (mediaType === "tv" && hasGenres && hasSeasons && hasEpisodes) {
    return {
      genres: item.genres!,
      runtime: hasRuntime ? item.runtime! : null,
      seasons: item.seasons!,
      episodes: item.episodes!,
    }
  }

  if (mediaType === "tv") {
    const details = await getTvDetails(item.id)
    return {
      genres: hasGenres ? item.genres! : (details?.genres ?? []),
      runtime: hasRuntime ? item.runtime! : (details?.runtime ?? null),
      seasons: hasSeasons ? item.seasons! : (details?.seasons ?? null),
      episodes: hasEpisodes ? item.episodes! : (details?.episodes ?? null),
    }
  }

  const details = await getMovieDetails(item.id)
  return {
    genres: hasGenres ? item.genres! : (details?.genres ?? []),
    runtime: hasRuntime ? item.runtime! : (details?.runtime ?? null),
    seasons: null,
    episodes: null,
  }
}

function toMediaItem(item: Movie | MediaItem): MediaItem {
  return {
    ...item,
    mediaType: resolveMediaType(item),
  }
}

function rowToMediaItem(row: MediaRow): MediaItem {
  return {
    id: row.tmdb_id,
    mediaType: parseMediaType(row.media_type),
    title: row.title,
    year: row.year,
    language: row.language,
    poster: row.poster,
    backdrop: row.backdrop || undefined,
    genres: parseGenres(row.genres),
    runtime: row.runtime ?? undefined,
    seasons: row.seasons ?? undefined,
    episodes: row.episodes ?? undefined,
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

export async function getWatchlist(): Promise<MediaItem[]> {
  const { data, error } = await supabase
    .from("watchlist")
    .select("*")
    .order("added_at", { ascending: false })
  if (error) {
    console.error("Error loading watchlist:", error.message)
    return []
  }
  return (data || []).map(rowToMediaItem)
}

export type AddToWatchlistResult =
  | { ok: true }
  | { ok: false; reason: "already_watchlisted" | "already_watched" | "error" }

export function messageForAddToWatchlistFailure(
  reason: "already_watchlisted" | "already_watched" | "error",
): string {
  switch (reason) {
    case "already_watchlisted":
      return "Already on your watchlist."
    case "already_watched":
      return "Already in your library — pick another one?"
    case "error":
      return "Couldn't add to watchlist — try again."
  }
}

export async function addToWatchlistDetailed(
  item: Movie | MediaItem,
): Promise<AddToWatchlistResult> {
  const media = toMediaItem(item)
  const mediaType = media.mediaType

  const { data: alreadyWatched } = await supabase
    .from("watched")
    .select("id")
    .eq("tmdb_id", media.id)
    .eq("media_type", mediaType)
    .limit(1)
  if (alreadyWatched && alreadyWatched.length > 0) {
    return { ok: false, reason: "already_watched" }
  }

  const { data: existing } = await supabase
    .from("watchlist")
    .select("id")
    .eq("tmdb_id", media.id)
    .eq("media_type", mediaType)
    .limit(1)
  if (existing && existing.length > 0) {
    return { ok: false, reason: "already_watchlisted" }
  }

  const userId = await getCurrentUserId()
  if (!userId) return { ok: false, reason: "error" }

  const { genres, runtime, seasons, episodes } = await resolveMetadataForMedia(media)

  const { error } = await supabase.from("watchlist").insert({
    user_id: userId,
    tmdb_id: media.id,
    media_type: mediaType,
    title: media.title,
    year: media.year,
    language: media.language,
    poster: media.poster,
    backdrop: media.backdrop || null,
    genres,
    runtime,
    seasons,
    episodes,
  })
  if (error) {
    console.error("Error adding to watchlist:", error.message)
    return { ok: false, reason: "error" }
  }
  return { ok: true }
}

export async function addToWatchlist(movie: Movie | MediaItem): Promise<boolean> {
  const r = await addToWatchlistDetailed(movie)
  return r.ok
}

export async function removeFromWatchlist(
  tmdbId: string,
  mediaType: MediaType = "movie",
): Promise<boolean> {
  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType)
  if (error) {
    console.error("Error removing from watchlist:", error.message)
    return false
  }
  return true
}

// ---- WATCHED ----

export async function getWatched(): Promise<MediaItem[]> {
  const { data, error } = await supabase
    .from("watched")
    .select("*")
    .order("watched_at", { ascending: false })
  if (error) {
    console.error("Error loading watched:", error.message)
    return []
  }
  return (data || []).map(rowToMediaItem)
}

export type MarkAsWatchedResult =
  | { ok: true }
  | { ok: false; reason: "error" | "watchlist_delete_failed" }

export function messageForMarkWatchedFailure(
  reason: "error" | "watchlist_delete_failed",
): string {
  switch (reason) {
    case "watchlist_delete_failed":
      return "We saved your rating but couldn't remove this from the watchlist. Try again, or check your library — the watched entry is there."
    case "error":
      return "Couldn't save your rating — try again."
  }
}

export async function markAsWatchedDetailed(
  item: Movie | MediaItem,
  rating: number,
  options?: { reviewBody?: string; watchedAt?: string },
): Promise<MarkAsWatchedResult> {
  const media = toMediaItem(item)
  const mediaType = media.mediaType
  const reviewBody = options?.reviewBody?.trim()
  const watchedAtIso = options?.watchedAt || new Date().toISOString()

  const { data: existing } = await supabase
    .from("watched")
    .select("id")
    .eq("tmdb_id", media.id)
    .eq("media_type", mediaType)
    .limit(1)

  if (existing && existing.length > 0) {
    const { error: updateError } = await supabase
      .from("watched")
      .update({
        rating,
        review_body: reviewBody || null,
        watched_at: watchedAtIso,
      })
      .eq("tmdb_id", media.id)
      .eq("media_type", mediaType)
    if (updateError) {
      console.error("Error updating watched entry:", updateError.message)
      return { ok: false, reason: "error" }
    }
    if (!(await deleteFromWatchlistVerified(media.id, mediaType))) {
      return { ok: false, reason: "watchlist_delete_failed" }
    }
    return { ok: true }
  }

  const userId = await getCurrentUserId()
  if (!userId) return { ok: false, reason: "error" }

  const { genres, runtime, seasons, episodes } = await resolveMetadataForMedia(media)

  const { error: insertError } = await supabase.from("watched").insert({
    user_id: userId,
    tmdb_id: media.id,
    media_type: mediaType,
    title: media.title,
    year: media.year,
    language: media.language,
    poster: media.poster,
    backdrop: media.backdrop || null,
    genres,
    runtime,
    seasons,
    episodes,
    rating,
    review_body: reviewBody || null,
    watched_at: watchedAtIso,
  })
  if (insertError) {
    console.error("Error marking as watched:", insertError.message)
    return { ok: false, reason: "error" }
  }
  if (!(await deleteFromWatchlistVerified(media.id, mediaType))) {
    return { ok: false, reason: "watchlist_delete_failed" }
  }
  return { ok: true }
}

export async function markAsWatched(
  item: Movie | MediaItem,
  rating: number,
  options?: { reviewBody?: string; watchedAt?: string },
): Promise<boolean> {
  const r = await markAsWatchedDetailed(item, rating, options)
  return r.ok
}

async function deleteFromWatchlistVerified(
  tmdbId: string,
  mediaType: MediaType = "movie",
): Promise<boolean> {
  const { error: delError } = await supabase
    .from("watchlist")
    .delete()
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType)
  if (delError) {
    console.error("Watchlist delete failed:", delError.message)
    return false
  }
  const { data: stillThere, error: verifyError } = await supabase
    .from("watchlist")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType)
    .limit(1)
  if (verifyError) {
    console.error("Watchlist verify failed:", verifyError.message)
    return false
  }
  if (stillThere && stillThere.length > 0) {
    console.error(
      "Watchlist row persists after delete (RLS or trigger?):",
      tmdbId,
      mediaType,
    )
    return false
  }
  return true
}

export async function updateWatchedRating(
  tmdbId: string,
  rating: number,
  mediaType: MediaType = "movie",
): Promise<boolean> {
  const { error } = await supabase
    .from("watched")
    .update({ rating })
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType)
  if (error) {
    console.error("Error updating rating:", error.message)
    return false
  }
  return true
}

export async function updateReview(
  tmdbId: string,
  headline: string,
  body?: string,
  mediaType: MediaType = "movie",
): Promise<boolean> {
  const { error } = await supabase
    .from("watched")
    .update({
      review_headline: headline,
      review_body: body || null,
    })
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType)

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
  const { error: delError } = await supabase
    .from("recommendations")
    .delete()
    .gte("added_at", "1970-01-01T00:00:00Z")
  if (delError) {
    console.error("Error clearing recommendations:", delError.message)
    return false
  }

  if (recommendations.length === 0) return true

  const userId = await getCurrentUserId()
  if (!userId) return false

  const rows = recommendations.map((r) => ({
    user_id: userId,
    tmdb_id: String(r.tmdbId),
    media_type: "movie" as const,
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
