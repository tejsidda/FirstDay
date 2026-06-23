"use client"

import { useEffect, useState } from "react"
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
  collapsible = false,
  collapseAfter = 96,
}: {
  style?: React.CSSProperties
  /** Shrink to icon-only after scrolling past `collapseAfter` px */
  collapsible?: boolean
  collapseAfter?: number
}) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!collapsible) {
      setCollapsed(false)
      return
    }
    const onScroll = () => setCollapsed(window.scrollY > collapseAfter)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [collapsible, collapseAfter])

  const expanded = !collapsible || !collapsed
  const iconSize = expanded ? 16 : 18

  return (
    <button
      type="button"
      onClick={() => navigateBack(router)}
      aria-label="Go back"
      className={`t-button-sm${collapsible ? " back-btn-collapsible" : ""}${collapsed ? " back-btn-collapsed" : ""}`}
      style={{
        position: "fixed",
        top: isMobile ? 56 : 72,
        left: isMobile ? 12 : 24,
        zIndex: 45,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: expanded ? 6 : 0,
        padding: expanded
          ? isMobile
            ? "10px 14px"
            : "10px 16px"
          : "10px",
        width: expanded ? "auto" : 44,
        height: 44,
        minHeight: 44,
        minWidth: 44,
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
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{ flexShrink: 0 }}
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span className="back-btn-label">Back</span>
    </button>
  )
}
