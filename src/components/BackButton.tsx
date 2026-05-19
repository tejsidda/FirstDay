"use client"

import { useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/useIsMobile"

/** Returns to the previous in-app route, or home if there is no history. */
export function navigateBack(router: ReturnType<typeof useRouter>) {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back()
  } else {
    router.push("/home")
  }
}

export default function BackButton({
  style,
}: {
  style?: React.CSSProperties
}) {
  const router = useRouter()
  const isMobile = useIsMobile()

  return (
    <button
      type="button"
      onClick={() => navigateBack(router)}
      aria-label="Go back"
      className="t-button-sm"
      style={{
        position: "fixed",
        top: isMobile ? 56 : 72,
        left: isMobile ? 12 : 24,
        zIndex: 45,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: isMobile ? "10px 12px" : "8px 14px",
        minHeight: 44,
        borderRadius: 999,
        border: "1px solid var(--border-default)",
        background: "var(--tint-base)",
        color: "var(--text-emphasis)",
        cursor: "pointer",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--text-inverse)"
        e.currentTarget.style.background = "var(--tint-hover)"
        e.currentTarget.style.borderColor = "var(--border-strong)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--text-emphasis)"
        e.currentTarget.style.background = "var(--tint-base)"
        e.currentTarget.style.borderColor = "var(--border-default)"
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back
    </button>
  )
}
