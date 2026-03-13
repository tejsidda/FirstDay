"use client"

import { useCallback, useEffect, useState, type CSSProperties } from "react"

type Props = {
  value: number | null
  onChange: (rating: number) => void
}

const NUM_FIGURES = 12

function getMoodText(rating: number | null): string {
  if (rating == null) return "How much applause?"
  if (rating <= 2) return "Walked out early"
  if (rating <= 4) return "Polite silence"
  if (rating <= 6) return "Scattered applause"
  if (rating <= 8) return "Solid applause"
  if (rating < 9.5) return "Roaring approval"
  if (rating < 10) return "On their feet"
  return "A standing ovation"
}

/** Figure i stands when rating crosses its threshold (1 → 10 left to right) */
function isStanding(index: number, rating: number): boolean {
  const t = (index / (NUM_FIGURES - 1)) * 9 + 1
  return rating >= t - 0.01
}

/** Arms up when standing and rating >= 9 */
function isCheering(index: number, rating: number): boolean {
  return isStanding(index, rating) && rating >= 9
}

function formatRating(r: number): string {
  if (Number.isInteger(r)) return String(r)
  if (Math.abs((r % 1) - 0.5) < 0.01) return r.toFixed(1)
  return String(r)
}

function heroStyle(rating: number): CSSProperties {
  if (rating === 10) {
    return {
      color: "#F6C547",
      textShadow: "0 0 14px rgba(246, 197, 71, 0.45)",
      fontWeight: 600,
    }
  }
  if (rating >= 9) return { color: "#B8C99D", fontWeight: 500 }
  if (rating >= 7) return { color: "#A8A398", fontWeight: 500 }
  if (rating >= 5) return { color: "#8B8D94", fontWeight: 400 }
  if (rating >= 3) return { color: "#6B7280", fontWeight: 400 }
  return { color: "#5C5C66", fontWeight: 400 }
}

/**
 * Single audience silhouette: seated (low) vs standing (tall) vs cheering (arms up).
 */
function AudienceFigure({
  standing,
  cheer,
  delayMs,
}: {
  standing: boolean
  cheer: boolean
  delayMs: number
}) {
  const warm = standing ? "rgba(200, 190, 175, 0.85)" : "rgba(90, 92, 98, 0.5)"
  const warmer = cheer ? "rgba(246, 197, 71, 0.55)" : warm

  return (
    <div
      className="flex flex-col items-center justify-end overflow-hidden"
      style={{
        width: 22,
        height: 44,
        transition: "opacity 0.35s ease",
        transitionDelay: `${delayMs}ms`,
      }}
    >
      <svg
        viewBox="0 0 24 48"
        width="100%"
        height="100%"
        style={{
          display: "block",
          transition: "transform 0.4s cubic-bezier(0.34, 1.2, 0.64, 1)",
          transitionDelay: `${delayMs}ms`,
          transform: standing ? "translateY(0)" : "translateY(8px)",
        }}
        aria-hidden
      >
        {/* head */}
        <circle cx="12" cy="7" r="4.5" fill={standing ? warmer : warm} />
        {cheer ? (
          <>
            {/* standing body */}
            <path
              d="M12 13 L10 38 L14 38 L12 13"
              fill={warmer}
              opacity={0.95}
            />
            {/* arms up */}
            <path
              d="M12 16 L6 8 M12 16 L18 8"
              stroke={warmer}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </>
        ) : standing ? (
          <path
            d="M12 13 L9 38 L15 38 Z"
            fill={warm}
            opacity={0.9}
          />
        ) : (
          /* seated hunched */
          <path
            d="M6 14 Q12 20 18 14 L17 36 L7 36 Z"
            fill={warm}
            opacity={0.75}
          />
        )}
      </svg>
    </div>
  )
}

export default function StandingOvationInput({ value, onChange }: Props) {
  const initial = value != null ? Math.max(1, Math.min(10, value)) : 5
  const [internal, setInternal] = useState(initial)

  useEffect(() => {
    if (value != null) {
      setInternal(Math.max(1, Math.min(10, value)))
    }
  }, [value])

  const commit = useCallback(
    (r: number) => {
      const clamped = Math.round(r * 2) / 2
      const v = Math.max(1, Math.min(10, clamped))
      setInternal(v)
      onChange(v)
    },
    [onChange]
  )

  const onSliderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInternal(parseFloat(e.target.value))
  }

  const onSliderPointerUp = () => {
    commit(internal)
  }

  const onAudienceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    const r = 1 + ratio * 9
    commit(r)
  }

  const mood = getMoodText(internal)
  const hero = heroStyle(internal)

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3 px-2">
      {/* Big live number */}
      <div
        className="tabular-nums"
        style={{
          fontSize: "2.75rem",
          lineHeight: 1.1,
          fontStyle: "italic",
          fontFamily: 'Georgia, "Times New Roman", serif',
          ...hero,
        }}
      >
        {formatRating(internal)}
      </div>

      {/* Mood line */}
      <p
        className="text-center text-sm italic"
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          color: "rgba(255,255,255,0.45)",
          minHeight: "1.25em",
        }}
      >
        {mood}
      </p>

      {/* Audience row — tap to set */}
      <div
        role="slider"
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={internal}
        aria-label="Applause level"
        className="flex cursor-pointer items-end justify-center gap-0.5 rounded-lg px-2 py-2"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.35), rgba(255,255,255,0.03))",
          border: "1px solid rgba(255,255,255,0.06)",
          minHeight: 56,
        }}
        onClick={onAudienceClick}
      >
        {Array.from({ length: NUM_FIGURES }, (_, i) => (
          <AudienceFigure
            key={i}
            standing={isStanding(i, internal)}
            cheer={isCheering(i, internal)}
            delayMs={i * 25}
          />
        ))}
      </div>

      {/* Slider — large touch target */}
      <div className="relative w-full pt-1">
        <input
          type="range"
          min={1}
          max={10}
          step={0.5}
          value={internal}
          onInput={onSliderInput}
          onChange={onSliderInput}
          onPointerUp={onSliderPointerUp}
          onMouseUp={onSliderPointerUp}
          onTouchEnd={onSliderPointerUp}
          className="ovation-slider h-11 w-full cursor-pointer"
          aria-label="Drag to set rating"
        />
        <p
          className="mt-1 text-center text-[10px] uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.25)" }}
        >
          Drag — more standing, more love
        </p>
      </div>

    </div>
  )
}
