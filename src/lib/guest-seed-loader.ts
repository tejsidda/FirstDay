import { DEMO_SEED } from "@/data/demo-seed"
import type { DemoPortfolioSeed } from "@/lib/demo-portfolio"

let cachedSeed: DemoPortfolioSeed | null = null
let seedPromise: Promise<DemoPortfolioSeed> | null = null

export function resetGuestSeedCache(): void {
  cachedSeed = null
  seedPromise = null
}

export async function loadGuestBaseSeed(): Promise<DemoPortfolioSeed> {
  if (cachedSeed) return cachedSeed
  if (!seedPromise) {
    seedPromise = fetch("/api/demo-seed")
      .then(async (res) => {
        if (!res.ok) return DEMO_SEED
        const data = await res.json()
        if (data.locked && Array.isArray(data.watched)) {
          return {
            watched: data.watched,
            watchlist: data.watchlist ?? [],
            recommendations: data.recommendations?.length
              ? data.recommendations
              : DEMO_SEED.recommendations,
          }
        }
        return DEMO_SEED
      })
      .catch(() => DEMO_SEED)
      .then((seed) => {
        cachedSeed = seed
        return seed
      })
  }
  return seedPromise
}
