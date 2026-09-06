import type { MediaItem, Recommendation } from "@/lib/types"

/** Fallback when no locked portfolio exists in Supabase. Starts empty — you fill demo via the app. */
export const DEMO_SEED = {
  watched: [] satisfies MediaItem[],
  watchlist: [] satisfies MediaItem[],
  recommendations: [] satisfies Recommendation[],
}
