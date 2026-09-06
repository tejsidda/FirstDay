import type { MediaItem, Recommendation } from "@/lib/types"

export const DEMO_LIBRARY_LIMIT = 20
export const DEMO_WATCHLIST_LIMIT = 5
export const DEMO_TOTAL_LIMIT = DEMO_LIBRARY_LIMIT + DEMO_WATCHLIST_LIMIT

export type DemoPortfolioSeed = {
  watched: MediaItem[]
  watchlist: MediaItem[]
  recommendations: Recommendation[]
}

export type DemoPortfolioResponse = DemoPortfolioSeed & {
  locked: boolean
  lockedAt?: string | null
}

export const DEMO_CURATOR_DRAFT_KEY = "fdfs_demo_curator_draft"

export type DemoCuratorDraft = {
  watched: MediaItem[]
  watchlist: MediaItem[]
}

export function mediaKey(id: string, mediaType: string): string {
  return `${mediaType}:${id}`
}

export function isInList(
  list: MediaItem[],
  id: string,
  mediaType: string,
): boolean {
  return list.some(
    (item) => item.id === id && item.mediaType === mediaType,
  )
}

export function readCuratorDraft(): DemoCuratorDraft {
  if (typeof localStorage === "undefined") {
    return { watched: [], watchlist: [] }
  }
  try {
    const raw = localStorage.getItem(DEMO_CURATOR_DRAFT_KEY)
    if (!raw) return { watched: [], watchlist: [] }
    const parsed = JSON.parse(raw) as DemoCuratorDraft
    return {
      watched: parsed.watched ?? [],
      watchlist: parsed.watchlist ?? [],
    }
  } catch {
    return { watched: [], watchlist: [] }
  }
}

export function writeCuratorDraft(draft: DemoCuratorDraft): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(DEMO_CURATOR_DRAFT_KEY, JSON.stringify(draft))
}

export function clearCuratorDraft(): void {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(DEMO_CURATOR_DRAFT_KEY)
}

export function canLockDemoPortfolio(draft: DemoCuratorDraft): boolean {
  return (
    draft.watched.length === DEMO_LIBRARY_LIMIT &&
    draft.watchlist.length === DEMO_WATCHLIST_LIMIT
  )
}
