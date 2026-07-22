"use client"

import FilterChip from "@/components/FilterChip"
import type { MediaTypeFilter } from "@/lib/types"

const OPTIONS: { value: MediaTypeFilter; label: string }[] = [
  { value: "all", label: "Both" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
]

export default function MediaTypeFilterBar({
  value,
  onChange,
}: {
  value: MediaTypeFilter
  onChange: (value: MediaTypeFilter) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => (
        <FilterChip
          key={option.value}
          label={option.label}
          active={value === option.value}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  )
}
