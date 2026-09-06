import { describe, expect, it } from "vitest"
import {
  canLockDemoPortfolio,
  DEMO_LIBRARY_LIMIT,
  DEMO_WATCHLIST_LIMIT,
} from "@/lib/demo-portfolio"
import type { MediaItem } from "@/lib/types"

const sample = (id: string): MediaItem => ({
  id,
  mediaType: "movie",
  title: `Film ${id}`,
  year: 2020,
  language: "en",
  poster: "https://example.com/p.jpg",
})

describe("demo-portfolio", () => {
  it("requires exactly 20 library and 5 watchlist titles to lock", () => {
    expect(
      canLockDemoPortfolio({
        watched: Array.from({ length: DEMO_LIBRARY_LIMIT }, (_, i) =>
          sample(String(i)),
        ),
        watchlist: Array.from({ length: DEMO_WATCHLIST_LIMIT }, (_, i) =>
          sample(`w${i}`),
        ),
      }),
    ).toBe(true)

    expect(
      canLockDemoPortfolio({
        watched: Array.from({ length: DEMO_LIBRARY_LIMIT - 1 }, (_, i) =>
          sample(String(i)),
        ),
        watchlist: Array.from({ length: DEMO_WATCHLIST_LIMIT }, (_, i) =>
          sample(`w${i}`),
        ),
      }),
    ).toBe(false)
  })
})
