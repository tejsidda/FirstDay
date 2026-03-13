"use client"

import type { CSSProperties } from "react"

/**
 * Rating display 1–10 (0.5 increments).
 * Temperature & confidence: warmer + bolder = higher conviction;
 * 10 gets a soft gold glow — special but not neon.
 */

function formatRating(rating: number): string {
  if (Number.isInteger(rating)) return String(rating)
  if (Math.abs((rating % 1) - 0.5) < 0.01) return rating.toFixed(1)
  return String(rating)
}

type RatingStyle = {
  color: string
  textShadow?: string
  fontWeight: number
}

function getRatingStyle(rating: number): RatingStyle {
  // Exact 10 only — glow stays rare
  if (rating === 10) {
    return {
      color: "#F6C547",
      textShadow: "0 0 10px rgba(246, 197, 71, 0.4)",
      fontWeight: 600,
    }
  }
  if (rating >= 9) {
    return {
      color: "#B8C99D",
      fontWeight: 500,
    }
  }
  if (rating >= 7) {
    return {
      color: "#A8A398",
      fontWeight: 500,
    }
  }
  if (rating >= 5) {
    return {
      color: "#8B8D94",
      fontWeight: 400,
    }
  }
  if (rating >= 3) {
    return {
      color: "#6B7280",
      fontWeight: 400,
    }
  }
  return {
    color: "#5C5C66",
    fontWeight: 400,
  }
}

const sizeStyles: Record<"sm" | "md" | "lg", CSSProperties> = {
  sm: { fontSize: "0.875rem", lineHeight: 1.25 },
  md: { fontSize: "1rem", lineHeight: 1.5 },
  lg: { fontSize: "1.25rem", lineHeight: 1.75 },
}

type Props = {
  rating: number | null | undefined
  size?: "sm" | "md" | "lg"
}

export default function RatingDisplay({ rating, size = "md" }: Props) {
  if (rating == null || Number.isNaN(rating)) {
    return (
      <span
        style={{
          ...sizeStyles[size],
          fontStyle: "italic",
          fontWeight: 400,
          color: "rgba(255,255,255,0.28)",
          fontVariantNumeric: "tabular-nums",
        }}
        aria-hidden
      >
        —
      </span>
    )
  }

  const clamped = Math.max(1, Math.min(10, rating))
  const text = formatRating(clamped)
  const bandStyle = getRatingStyle(clamped)

  return (
    <span
      style={{
        ...sizeStyles[size],
        ...bandStyle,
        fontStyle: "italic",
        fontVariantNumeric: "tabular-nums",
      }}
      title={`Rating ${text} / 10`}
    >
      {text}
    </span>
  )
}
