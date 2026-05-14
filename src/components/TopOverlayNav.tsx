"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

export default function TopOverlayNav({
  onSearchClick,
}: {
  onSearchClick?: () => void
}) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)")
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  /** Active uses the same base brightness as inactive; selection is indicated by weight/underline only. */
  const itemClass = (href?: string) => {
    const isActive = href != null && pathname === href
    return [
      `${isMobile ? "text-[13px]" : "text-[14px]"} font-normal tracking-wide transition-colors`,
      `duration-300 [transition-timing-function:var(--ease-productive)]`,
      "text-[color:var(--text-secondary)] hover:text-[color:var(--text-inverse)]",
      isActive ? "underline decoration-[color:var(--border-hover)] underline-offset-[6px]" : "",
    ].join(" ")
  }

  const iconWrapClass =
    "inline-flex items-center justify-center text-[color:var(--text-secondary)] hover:text-[color:var(--text-inverse)] transition-colors duration-300 [transition-timing-function:var(--ease-productive)] p-1 -m-1 rounded-md hover:bg-[color:var(--tint-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--border-muted)]"

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        backgroundColor: scrolled ? "rgba(13,13,15,0.9)" : "rgba(13,13,15,0)",
        backdropFilter: scrolled ? "blur(12px)" : "blur(0px)",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "blur(0px)",
        transition: "background-color 400ms ease-out, backdrop-filter 400ms ease-out, -webkit-backdrop-filter 400ms ease-out",
      }}
    >
      <div className={`flex w-full items-center justify-between ${isMobile ? "px-4 py-3" : "px-12 py-4"}`}>
        <Link
          href="/home"
          className={`${isMobile ? "text-[14px]" : "text-[15px]"} font-semibold tracking-[0.14em] text-[color:var(--text-primary)] transition-colors duration-300 [transition-timing-function:var(--ease-productive)] hover:text-[color:var(--text-inverse)]`}
          aria-label="FDFS Home"
        >
          FDFS
        </Link>
        <div className={`flex items-center ${isMobile ? "gap-5" : "gap-9"}`}>
          <button
            type="button"
            onClick={onSearchClick}
            className={iconWrapClass}
            aria-label="Search"
          >
            <svg
              width={isMobile ? 22 : 24}
              height={isMobile ? 22 : 24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.65" y1="16.65" x2="21" y2="21" />
            </svg>
          </button>
          <Link href="/home" className={`${itemClass("/home")} inline-flex items-center gap-2`}>
            <svg
              width={isMobile ? 20 : 22}
              height={isMobile ? 20 : 22}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 opacity-90"
              aria-hidden
            >
              <path d="M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
            </svg>
            <span>Home</span>
          </Link>
          <Link href="/library" className={`${itemClass("/library")} inline-flex items-center gap-2`}>
            <svg
              width={isMobile ? 20 : 22}
              height={isMobile ? 20 : 22}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 opacity-90"
              aria-hidden
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <path d="M8 7h8M8 11h8" />
            </svg>
            <span>Library</span>
          </Link>
          <Link href="/watchlist" className={`${itemClass("/watchlist")} inline-flex items-center gap-2`}>
            <svg
              width={isMobile ? 20 : 22}
              height={isMobile ? 20 : 22}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 opacity-90"
              aria-hidden
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M7 8h10M7 12h6" />
            </svg>
            <span>Watchlist</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
