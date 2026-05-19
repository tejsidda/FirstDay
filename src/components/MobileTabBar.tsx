"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"

const HIDDEN_PREFIXES = ["/landing", "/auth/", "/test"]

const TABS = [
  {
    href: "/home",
    label: "Home",
    match: (p: string) => p === "/home",
    icon: (
      <path d="M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
    ),
  },
  {
    href: "/library",
    label: "Library",
    match: (p: string) => p === "/library",
    icon: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </>
    ),
  },
  {
    href: "/watchlist",
    label: "Watchlist",
    match: (p: string) => p === "/watchlist",
    icon: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M7 8h10M7 12h6" />
      </>
    ),
  },
  {
    href: "/wrapped",
    label: "Wrapped",
    match: (p: string) => p === "/wrapped",
    icon: (
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    ),
  },
] as const

export default function MobileTabBar() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const railRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  const hidden = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))

  const activeIndex = TABS.findIndex((t) => t.match(pathname))

  const measureIndicator = () => {
    const rail = railRef.current
    if (!rail) return
    const activeEl = rail.querySelector<HTMLElement>('[data-tab-active="true"]')
    if (!activeEl) {
      setIndicator((s) => ({ ...s, ready: false }))
      return
    }
    const railBox = rail.getBoundingClientRect()
    const tabBox = activeEl.getBoundingClientRect()
    setIndicator({
      left: tabBox.left - railBox.left,
      width: tabBox.width,
      ready: true,
    })
  }

  useLayoutEffect(() => {
    if (!isMobile || hidden) return
    measureIndicator()
  }, [pathname, isMobile, hidden, activeIndex])

  useEffect(() => {
    if (!isMobile || hidden) return
    const onResize = () => measureIndicator()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [isMobile, hidden, activeIndex])

  if (!isMobile || hidden) return null

  return (
    <nav
      className="mobile-tab-bar"
      aria-label="Main"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "rgba(13, 13, 15, 0.94)",
        borderTop: "1px solid var(--border-default)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <div
        ref={railRef}
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
          alignItems: "stretch",
          minHeight: 64,
          padding: "6px 8px 8px",
        }}
      >
        {indicator.ready && (
          <div
            className="mobile-tab-indicator"
            aria-hidden
            style={{
              position: "absolute",
              top: 6,
              left: indicator.left,
              width: indicator.width,
              height: 52,
              borderRadius: 14,
              background: "var(--tint-active)",
              border: "1px solid var(--border-muted)",
              transition:
                "left 0.32s var(--ease-productive), width 0.32s var(--ease-productive)",
              pointerEvents: "none",
            }}
          />
        )}

        {TABS.map((tab, i) => {
          const isActive = i === activeIndex
          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-tab-active={isActive ? "true" : undefined}
              className="mobile-tab-item"
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "8px 4px",
                textDecoration: "none",
                color: isActive
                  ? "var(--text-primary)"
                  : "var(--text-muted)",
                transition: "color 0.25s var(--ease-productive)",
              }}
            >
              <svg
                width={22}
                height={22}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={isActive ? 2.25 : 1.85}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isActive ? "mobile-tab-icon-active" : undefined}
                aria-hidden
              >
                {tab.icon}
              </svg>
              <span
                className="t-caption"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
