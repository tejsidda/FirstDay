"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { MediaTypeFilter } from "@/lib/types"
import { buildPathWithMediaTypeFilter, parseMediaTypeFilter } from "@/lib/mediaTypeNav"

export function useMediaTypeFilterFromUrl(): {
  mediaTypeFilter: MediaTypeFilter
  setMediaTypeFilter: (filter: MediaTypeFilter) => void
} {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const mediaTypeFilter = parseMediaTypeFilter(searchParams.get("type"))

  const setMediaTypeFilter = (filter: MediaTypeFilter) => {
    router.replace(
      buildPathWithMediaTypeFilter(pathname, filter, searchParams.toString()),
      { scroll: false },
    )
  }

  return { mediaTypeFilter, setMediaTypeFilter }
}
