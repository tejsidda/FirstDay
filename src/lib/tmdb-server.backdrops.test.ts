import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { getMovieBackdrops } from "@/lib/tmdb-server"

describe("getMovieBackdrops", () => {
  const originalToken = process.env.TMDB_TOKEN

  beforeEach(() => {
    process.env.TMDB_TOKEN = "test-token"
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env.TMDB_TOKEN = originalToken
  })

  it("returns ranked backdrop urls when TMDB images are available", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          backdrops: [
            {
              file_path: "/small-fr.jpg",
              width: 900,
              height: 500,
              vote_average: 9,
              iso_639_1: "fr",
            },
            {
              file_path: "/large-en.jpg",
              width: 1920,
              height: 1080,
              vote_average: 4,
              iso_639_1: "en",
            },
            {
              file_path: "/large-null.jpg",
              width: 1600,
              height: 900,
              vote_average: 2,
              iso_639_1: null,
            },
          ],
        }),
        { status: 200 },
      ),
    )

    const result = await getMovieBackdrops("550")

    expect(result.fromPoster).toBe(false)
    expect(result.urls).toHaveLength(2)
    expect(result.urls[0]).toContain(encodeURIComponent("https://image.tmdb.org/t/p/w1280/large-en.jpg"))
    expect(result.urls[1]).toContain(encodeURIComponent("https://image.tmdb.org/t/p/w1280/large-null.jpg"))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/movie/550/images?include_image_language=en,null"),
      expect.any(Object),
    )
  })

  it("falls back to poster when the images request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }))

    const result = await getMovieBackdrops("550", {
      posterPath: "/poster.jpg",
      backdropPath: "/backdrop.jpg",
    })

    expect(result).toEqual({
      urls: [expect.stringContaining(encodeURIComponent("https://image.tmdb.org/t/p/w1280/poster.jpg"))],
      fromPoster: true,
    })
  })

  it("falls back to backdrop path when images are empty and no poster exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ backdrops: [] }), { status: 200 }),
    )

    const result = await getMovieBackdrops("550", {
      posterPath: null,
      backdropPath: "/backdrop.jpg",
    })

    expect(result).toEqual({
      urls: [expect.stringContaining(encodeURIComponent("https://image.tmdb.org/t/p/w1280/backdrop.jpg"))],
      fromPoster: false,
    })
  })
})
