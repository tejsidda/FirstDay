"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { MediaTypeFilter } from "@/lib/types"
import { buildPathWithMediaTypeFilter, parseMediaTypeFilter } from "@/lib/mediaTypeNav"

const OPTIONS: { value: MediaTypeFilter; label: string }[] = [
  { value: "all", label: "Both" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
]

export default function MediaTypeNavToggle() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const value = parseMediaTypeFilter(searchParams.get("type"))

  const setValue = (next: MediaTypeFilter) => {
    router.replace(
      buildPathWithMediaTypeFilter(pathname, next, searchParams.toString()),
      { scroll: false },
    )
  }

  return (
    <div
      role="group"
      aria-label="Show movies, TV, or both"
      className="flex items-center gap-1 rounded-full p-1"
      style={{
        background: "var(--tint-base)",
        border: "1px solid var(--border-default)",
      }}
    >
      {OPTIONS.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => setValue(option.value)}
            className="t-button-sm rounded-full px-2.5 py-1.5 transition-colors sm:px-3"
            style={{
              color: active ? "var(--background-base)" : "var(--text-emphasis)",
              background: active ? "rgba(255, 255, 255, 0.92)" : "transparent",
              border: active ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid transparent",
              whiteSpace: "nowrap",
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
