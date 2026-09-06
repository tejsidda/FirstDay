import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { fetchMovieCredits, fetchMovieDetails } from "@/lib/tmdb-server"

describe("tmdb-server network resilience", () => {
  const originalToken = process.env.TMDB_TOKEN

  beforeEach(() => {
    process.env.TMDB_TOKEN = "test-token"
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env.TMDB_TOKEN = originalToken
  })

  it("returns fallbacks when TMDB credits fetch fails at the network layer", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"))

    await expect(fetchMovieCredits("969681")).resolves.toEqual({
      director: "Unknown",
      cast: [],
    })
  })

  it("returns null when TMDB movie details fetch fails at the network layer", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"))

    await expect(fetchMovieDetails("969681")).resolves.toBeNull()
  })
})
