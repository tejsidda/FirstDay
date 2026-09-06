import type { DemoPortfolioSeed } from "@/lib/demo-portfolio"
import { loadGuestBaseSeed } from "@/lib/guest-seed-loader"
import { resolveMediaType } from "@/lib/media"
import { getMovieDetails, getTvDetails, type MovieGenre } from "@/lib/tmdb"
import type { MediaItem, MediaType, Movie, Recommendation } from "@/lib/types"

const SESSION_DELTA_KEY = "fdfs_guest_delta"

type AddToWatchlistResult =
  | { ok: true }
  | { ok: false; reason: "already_watchlisted" | "already_watched" | "error" }

type MarkAsWatchedResult =
  | { ok: true }
  | { ok: false; reason: "error" | "watchlist_delete_failed" }

type RecommendationInsert = {
  tmdbId: string
  title: string
  year: number
  language: string
  poster: string
  backdrop?: string
  reason: string
}

type GuestSessionDelta = {
  addedWatchlist: MediaItem[]
  addedWatched: MediaItem[]
  removedWatchlistKeys: string[]
  removedWatchedKeys: string[]
  watchedOverrides: Record<string, Partial<MediaItem>>
  shownRecommendationIds: string[]
}

function defaultDelta(): GuestSessionDelta {
  return {
    addedWatchlist: [],
    addedWatched: [],
    removedWatchlistKeys: [],
    removedWatchedKeys: [],
    watchedOverrides: {},
    shownRecommendationIds: [],
  }
}

function readDelta(): GuestSessionDelta {
  if (typeof sessionStorage === "undefined") return defaultDelta()
  try {
    const raw = sessionStorage.getItem(SESSION_DELTA_KEY)
    if (!raw) return defaultDelta()
    const parsed = JSON.parse(raw) as GuestSessionDelta
    return {
      ...defaultDelta(),
      ...parsed,
      addedWatchlist: parsed.addedWatchlist ?? [],
      addedWatched: parsed.addedWatched ?? [],
      removedWatchlistKeys: parsed.removedWatchlistKeys ?? [],
      removedWatchedKeys: parsed.removedWatchedKeys ?? [],
      watchedOverrides: parsed.watchedOverrides ?? {},
      shownRecommendationIds: parsed.shownRecommendationIds ?? [],
    }
  } catch {
    return defaultDelta()
  }
}

function writeDelta(delta: GuestSessionDelta): void {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.setItem(SESSION_DELTA_KEY, JSON.stringify(delta))
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("fdfs:guest-data-changed"))
  }
}

export function mediaKey(id: string, mediaType: MediaType): string {
  return `${mediaType}:${id}`
}

function toMediaItem(item: Movie | MediaItem): MediaItem {
  return {
    ...item,
    mediaType: resolveMediaType(item),
  }
}

function applyWatchedOverride(item: MediaItem, delta: GuestSessionDelta): MediaItem {
  const key = mediaKey(item.id, item.mediaType)
  const override = delta.watchedOverrides[key]
  if (!override) return item
  return { ...item, ...override }
}

function mergeWatched(seed: DemoPortfolioSeed, delta: GuestSessionDelta): MediaItem[] {
  const removed = new Set(delta.removedWatchedKeys)
  const map = new Map<string, MediaItem>()

  for (const item of seed.watched) {
    const key = mediaKey(item.id, item.mediaType)
    if (removed.has(key)) continue
    map.set(key, applyWatchedOverride(item, delta))
  }

  for (const item of delta.addedWatched) {
    map.set(mediaKey(item.id, item.mediaType), item)
  }

  return Array.from(map.values()).sort((a, b) => {
    const aTime = a.watchedAt ? Date.parse(a.watchedAt) : 0
    const bTime = b.watchedAt ? Date.parse(b.watchedAt) : 0
    return bTime - aTime
  })
}

function mergeWatchlist(seed: DemoPortfolioSeed, delta: GuestSessionDelta): MediaItem[] {
  const removed = new Set(delta.removedWatchlistKeys)
  const watchedKeys = new Set(
    mergeWatched(seed, delta).map((item) => mediaKey(item.id, item.mediaType)),
  )
  const map = new Map<string, MediaItem>()

  for (const item of seed.watchlist) {
    const key = mediaKey(item.id, item.mediaType)
    if (removed.has(key) || watchedKeys.has(key)) continue
    map.set(key, item)
  }

  for (const item of delta.addedWatchlist) {
    const key = mediaKey(item.id, item.mediaType)
    if (watchedKeys.has(key) || removed.has(key)) continue
    map.set(key, item)
  }

  return Array.from(map.values())
}

async function resolveMetadataForMedia(item: MediaItem): Promise<{
  genres: MovieGenre[]
  runtime: number | null
  seasons: number | null
  episodes: number | null
}> {
  const mediaType = item.mediaType
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

function removeFromWatchlistDelta(
  delta: GuestSessionDelta,
  tmdbId: string,
  mediaType: MediaType,
): GuestSessionDelta {
  const key = mediaKey(tmdbId, mediaType)
  return {
    ...delta,
    removedWatchlistKeys: delta.removedWatchlistKeys.includes(key)
      ? delta.removedWatchlistKeys
      : [...delta.removedWatchlistKeys, key],
    addedWatchlist: delta.addedWatchlist.filter(
      (item) => mediaKey(item.id, item.mediaType) !== key,
    ),
  }
}

function upsertWatched(
  seed: DemoPortfolioSeed,
  delta: GuestSessionDelta,
  item: MediaItem,
): GuestSessionDelta {
  const key = mediaKey(item.id, item.mediaType)
  const inSeed = seed.watched.some(
    (entry) => mediaKey(entry.id, entry.mediaType) === key,
  )
  const addedIndex = delta.addedWatched.findIndex(
    (entry) => mediaKey(entry.id, entry.mediaType) === key,
  )

  let next = { ...delta }

  if (addedIndex >= 0) {
    const addedWatched = [...delta.addedWatched]
    addedWatched[addedIndex] = item
    next.addedWatched = addedWatched
  } else if (inSeed) {
    next.watchedOverrides = { ...delta.watchedOverrides, [key]: item }
  } else {
    next.addedWatched = [...delta.addedWatched, item]
  }

  next = removeFromWatchlistDelta(next, item.id, item.mediaType)
  return next
}

function mergeRecommendations(
  seed: DemoPortfolioSeed,
  delta: GuestSessionDelta,
): Recommendation[] {
  return seed.recommendations.map((rec) => ({
    ...rec,
    shown: delta.shownRecommendationIds.includes(rec.id),
  }))
}

export async function getWatchlist(): Promise<MediaItem[]> {
  const seed = await loadGuestBaseSeed()
  return mergeWatchlist(seed, readDelta())
}

export async function addToWatchlistDetailed(
  item: Movie | MediaItem,
): Promise<AddToWatchlistResult> {
  const seed = await loadGuestBaseSeed()
  const delta = readDelta()
  const media = toMediaItem(item)
  const key = mediaKey(media.id, media.mediaType)
  const watched = mergeWatched(seed, delta)
  if (watched.some((entry) => mediaKey(entry.id, entry.mediaType) === key)) {
    return { ok: false, reason: "already_watched" }
  }

  const watchlist = mergeWatchlist(seed, delta)
  if (watchlist.some((entry) => mediaKey(entry.id, entry.mediaType) === key)) {
    return { ok: false, reason: "already_watchlisted" }
  }

  const { genres, runtime, seasons, episodes } = await resolveMetadataForMedia(media)
  delta.addedWatchlist.push({
    ...media,
    genres,
    runtime: runtime ?? undefined,
    seasons: seasons ?? undefined,
    episodes: episodes ?? undefined,
  })
  writeDelta(delta)
  return { ok: true }
}

export async function addToWatchlist(movie: Movie | MediaItem): Promise<boolean> {
  const result = await addToWatchlistDetailed(movie)
  return result.ok
}

export async function removeFromWatchlist(
  tmdbId: string,
  mediaType: MediaType = "movie",
): Promise<boolean> {
  writeDelta(removeFromWatchlistDelta(readDelta(), tmdbId, mediaType))
  return true
}

export async function getWatched(): Promise<MediaItem[]> {
  const seed = await loadGuestBaseSeed()
  return mergeWatched(seed, readDelta())
}

export async function markAsWatchedDetailed(
  item: Movie | MediaItem,
  rating: number,
  options?: { reviewBody?: string; watchedAt?: string },
): Promise<MarkAsWatchedResult> {
  const seed = await loadGuestBaseSeed()
  const media = toMediaItem(item)
  const reviewBody = options?.reviewBody?.trim()
  const watchedAtIso = options?.watchedAt || new Date().toISOString()
  const { genres, runtime, seasons, episodes } = await resolveMetadataForMedia(media)

  const watchedItem: MediaItem = {
    ...media,
    genres,
    runtime: runtime ?? undefined,
    seasons: seasons ?? undefined,
    episodes: episodes ?? undefined,
    rating,
    reviewBody: reviewBody || undefined,
    watchedAt: watchedAtIso,
  }

  writeDelta(upsertWatched(seed, readDelta(), watchedItem))
  return { ok: true }
}

export async function markAsWatched(
  item: Movie | MediaItem,
  rating: number,
  options?: { reviewBody?: string; watchedAt?: string },
): Promise<boolean> {
  const result = await markAsWatchedDetailed(item, rating, options)
  return result.ok
}

export async function updateWatchedRating(
  tmdbId: string,
  rating: number,
  mediaType: MediaType = "movie",
): Promise<boolean> {
  const seed = await loadGuestBaseSeed()
  const delta = readDelta()
  const key = mediaKey(tmdbId, mediaType)
  const watched = mergeWatched(seed, delta)
  const existing = watched.find((item) => mediaKey(item.id, item.mediaType) === key)
  if (!existing) return false

  writeDelta(
    upsertWatched(seed, delta, {
      ...existing,
      rating,
    }),
  )
  return true
}

export async function updateReview(
  tmdbId: string,
  headline: string,
  body?: string,
  mediaType: MediaType = "movie",
): Promise<boolean> {
  const seed = await loadGuestBaseSeed()
  const delta = readDelta()
  const key = mediaKey(tmdbId, mediaType)
  const watched = mergeWatched(seed, delta)
  const existing = watched.find((item) => mediaKey(item.id, item.mediaType) === key)
  if (!existing) return false

  writeDelta(
    upsertWatched(seed, delta, {
      ...existing,
      reviewHeadline: headline,
      reviewBody: body || undefined,
    }),
  )
  return true
}

export async function getUnshownRecommendations(
  limit: number,
): Promise<Recommendation[]> {
  const seed = await loadGuestBaseSeed()
  return mergeRecommendations(seed, readDelta())
    .filter((rec) => !rec.shown)
    .slice(0, limit)
}

export async function markRecommendationShown(id: string): Promise<boolean> {
  const delta = readDelta()
  if (!delta.shownRecommendationIds.includes(id)) {
    delta.shownRecommendationIds = [...delta.shownRecommendationIds, id]
    writeDelta(delta)
  }
  return true
}

export async function getUnshownCount(): Promise<number> {
  const seed = await loadGuestBaseSeed()
  return mergeRecommendations(seed, readDelta()).filter((rec) => !rec.shown).length
}

export async function clearAndInsertRecommendations(
  _recommendations: RecommendationInsert[],
): Promise<boolean> {
  return false
}

export async function hasAnyRecommendations(): Promise<boolean> {
  const seed = await loadGuestBaseSeed()
  return seed.recommendations.length > 0
}

/** Current merged demo library + watchlist (for publishing from guest setup). */
export async function getGuestPortfolioSnapshot(): Promise<{
  watched: MediaItem[]
  watchlist: MediaItem[]
}> {
  const seed = await loadGuestBaseSeed()
  const delta = readDelta()
  return {
    watched: mergeWatched(seed, delta),
    watchlist: mergeWatchlist(seed, delta),
  }
}
