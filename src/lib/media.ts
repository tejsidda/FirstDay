import type { MediaItem, MediaType, MediaTypeFilter } from "./types"

export function resolveMediaType(item: { mediaType?: MediaType }): MediaType {
  return item.mediaType ?? "movie"
}

export function mediaDetailPath(item: Pick<MediaItem, "id" | "mediaType">): string {
  return resolveMediaType(item) === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`
}

export function filterByMediaType<T extends { mediaType?: MediaType }>(
  items: T[],
  filter: MediaTypeFilter,
): T[] {
  if (filter === "all") return items
  return items.filter((item) => resolveMediaType(item) === filter)
}

export function asMediaItem(item: MovieLike): MediaItem {
  return {
    ...item,
    mediaType: resolveMediaType(item),
  }
}

type MovieLike = Omit<MediaItem, "mediaType"> & { mediaType?: MediaType }
