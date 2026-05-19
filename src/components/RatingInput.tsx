"use client"

import { useCallback, useState } from "react"

type Props = {
  value: number | null
  onChange: (rating: number) => void
}

const WHOLE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function isHalf(r: number) {
  return Math.abs(r % 1 - 0.5) < 0.01
}

function wholePart(r: number) {
  return isHalf(r) ? Math.floor(r) : Math.round(r)
}

/**
 * 1–10 pills + optional +0.5 toggle. Min 44px touch targets, compact row.
 */
export default function RatingInput({ value, onChange }: Props) {
  const [selectedWhole, setSelectedWhole] = useState<number | null>(() =>
    value != null ? wholePart(value) : null
  )

  const current = value ?? null
  const displayWhole = current != null ? wholePart(current) : selectedWhole
  const hasHalf = current != null && isHalf(current)

  const selectWhole = useCallback(
    (n: number) => {
      setSelectedWhole(n)
      onChange(n)
    },
    [onChange]
  )

  const toggleHalf = useCallback(() => {
    if (displayWhole == null) return
    if (hasHalf) onChange(displayWhole)
    else onChange(displayWhole + 0.5)
  }, [displayWhole, hasHalf, onChange])

  const displayText =
    current == null ? "—" : isHalf(current) ? `${current}` : `${current}`

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-1.5">
        {WHOLE.map((n) => {
          const isSelected = displayWhole === n
          return (
            <div key={n} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => selectWhole(n)}
                className="min-h-[44px] min-w-[44px] rounded-full border transition-all duration-200 ease-out"
                style={{
                  borderColor: isSelected
                    ? "var(--border-focus)"
                    : "var(--border-subtle)",
                  background: isSelected
                    ? "var(--tint-active)"
                    : "var(--tint-inset)",
                  color: isSelected
                    ? "var(--text-body)"
                    : "var(--text-lede)",
                }}
                aria-pressed={isSelected}
                aria-label={`Rate ${n}`}
              >
                {n}
              </button>
              {isSelected && (
                <button
                  type="button"
                  onClick={toggleHalf}
                  className="min-h-[32px] min-w-[44px] rounded-md border text-xs italic transition-all duration-200"
                  style={{
                    borderColor: hasHalf
                      ? "rgba(94, 234, 212, 0.35)"
                      : "var(--border-default)",
                    background: hasHalf
                      ? "rgba(94, 234, 212, 0.12)"
                      : "var(--tint-ghost)",
                    color: hasHalf
                      ? "rgba(94, 234, 212, 0.85)"
                      : "var(--text-badge)",
                  }}
                  aria-pressed={hasHalf}
                  aria-label={hasHalf ? "Use whole number" : "Add half point"}
                >
                  {hasHalf ? `${n}` : "+.5"}
                </button>
              )}
            </div>
          )
        })}
      </div>
      <p className="t-meta t-tabular text-white/50">
        {current != null ? `Currently: ${displayText}` : "Select a rating"}
      </p>
    </div>
  )
}
