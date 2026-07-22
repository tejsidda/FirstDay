import type { MediaTypeFilter } from "./types"

export function parseMediaTypeFilter(value: string | null | undefined): MediaTypeFilter {
  if (value === "movie" || value === "tv") return value
  return "all"
}

export function mediaTypeFilterToParam(filter: MediaTypeFilter): string | null {
  return filter === "all" ? null : filter
}

export function buildPathWithMediaTypeFilter(
  pathname: string,
  filter: MediaTypeFilter,
  currentSearch = "",
): string {
  const params = new URLSearchParams(currentSearch)
  const param = mediaTypeFilterToParam(filter)
  if (param) params.set("type", param)
  else params.delete("type")
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export const MEDIA_TYPE_NAV_PATHS = ["/library", "/watchlist"] as const

export function showsMediaTypeNav(pathname: string): boolean {
  return MEDIA_TYPE_NAV_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
