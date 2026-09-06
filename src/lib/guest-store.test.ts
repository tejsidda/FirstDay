import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetGuestSeedCache } from "@/lib/guest-seed-loader"
import {
  addToWatchlistDetailed,
  getWatchlist,
  getWatched,
  markAsWatchedDetailed,
  mediaKey,
  removeFromWatchlist,
} from "@/lib/guest-store"
import type { MediaItem } from "@/lib/types"

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn(),
  },
}))

vi.mock("@/lib/tmdb", () => ({
  getMovieDetails: vi.fn().mockResolvedValue({
    genres: [{ id: 18, name: "Drama" }],
    runtime: 120,
  }),
  getTvDetails: vi.fn().mockResolvedValue({
    genres: [{ id: 18, name: "Drama" }],
    runtime: 60,
    seasons: 1,
    episodes: 8,
  }),
}))

const SESSION_DELTA_KEY = "fdfs_guest_delta"

const sampleMovie: MediaItem = {
  id: "999001",
  mediaType: "movie",
  title: "Demo Added Film",
  year: 2024,
  language: "en",
  poster: "https://example.com/poster.jpg",
  genres: [{ id: 18, name: "Drama" }],
  runtime: 110,
}

const seedWatchlistItem: MediaItem = {
  id: "238",
  mediaType: "movie",
  title: "The Godfather",
  year: 1972,
  language: "en",
  poster: "https://example.com/gf.jpg",
}

beforeEach(() => {
  sessionStorage.clear()
  resetGuestSeedCache()
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
    }),
  )
})

describe("guest-store merge logic", () => {
  it("starts empty when no locked portfolio exists", async () => {
    const watched = await getWatched()
    const watchlist = await getWatchlist()

    expect(watched).toEqual([])
    expect(watchlist).toEqual([])
  })

  it("adds session-only watchlist entries", async () => {
    const result = await addToWatchlistDetailed(sampleMovie)
    expect(result).toEqual({ ok: true })

    const watchlist = await getWatchlist()
    expect(watchlist.some((item) => item.id === sampleMovie.id)).toBe(true)
  })

  it("moves a watchlist title to watched and removes it from watchlist", async () => {
    await addToWatchlistDetailed(seedWatchlistItem)
    const result = await markAsWatchedDetailed(seedWatchlistItem, 8)
    expect(result).toEqual({ ok: true })

    const watchlist = await getWatchlist()
    const watched = await getWatched()

    expect(
      watchlist.some(
        (item) =>
          mediaKey(item.id, item.mediaType) ===
          mediaKey(seedWatchlistItem.id, seedWatchlistItem.mediaType),
      ),
    ).toBe(false)
    expect(
      watched.some(
        (item) =>
          mediaKey(item.id, item.mediaType) ===
            mediaKey(seedWatchlistItem.id, seedWatchlistItem.mediaType) &&
          item.rating === 8,
      ),
    ).toBe(true)
  })

  it("removes watchlist entries via session overlay", async () => {
    await addToWatchlistDetailed(seedWatchlistItem)
    await removeFromWatchlist(seedWatchlistItem.id, seedWatchlistItem.mediaType)

    const watchlist = await getWatchlist()
    expect(
      watchlist.some(
        (item) =>
          mediaKey(item.id, item.mediaType) ===
          mediaKey(seedWatchlistItem.id, seedWatchlistItem.mediaType),
      ),
    ).toBe(false)

    const raw = sessionStorage.getItem(SESSION_DELTA_KEY)
    expect(raw).toContain(seedWatchlistItem.id)
  })
})

describe("db guest delegation", () => {
  it("routes getWatched to guest store when guest cookie is set", async () => {
    document.cookie = "fdfs_guest=1; path=/"
    const { getWatched: dbGetWatched } = await import("@/lib/db")
    const watched = await dbGetWatched()
    expect(watched).toEqual([])
    document.cookie = "fdfs_guest=; path=/; max-age=0"
  })
})
