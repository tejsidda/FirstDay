"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import MobileTabBar from "@/components/MobileTabBar"
import { useIsMobile } from "@/hooks/useIsMobile"

const DESKTOP_LINKS = [
  {
    href: "/home",
    label: "Home",
    icon: (
      <path d="M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
    ),
  },
  {
    href: "/library",
    label: "Library",
    icon: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M8 7h8M8 11h8" />
      </>
    ),
  },
  {
    href: "/watchlist",
    label: "Watchlist",
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
    icon: (
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    ),
  },
] as const

export default function TopOverlayNav({
  onSearchClick,
}: {
  onSearchClick?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
  const [scrolled, setScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const onScroll = () => setScrolled(window.scrollY > 50)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const itemClass = (href: string) => {
    const isActive = pathname === href
    return [
      "text-[14px] font-normal tracking-wide transition-colors",
      "duration-300 [transition-timing-function:var(--ease-productive)]",
      "text-[color:var(--text-secondary)] hover:text-[color:var(--text-inverse)]",
      isActive
        ? "underline decoration-[color:var(--border-hover)] underline-offset-[6px]"
        : "",
    ].join(" ")
  }

  const iconWrapClass =
    "inline-flex items-center justify-center min-w-[44px] min-h-[44px] text-[color:var(--text-secondary)] hover:text-[color:var(--text-inverse)] transition-all duration-300 [transition-timing-function:var(--ease-productive)] rounded-xl hover:bg-[color:var(--tint-subtle)] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--border-muted)]"

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace("/landing")
  }

  const showBarBg = isMobile || scrolled

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 ${mounted && isMobile ? "mobile-top-bar-enter" : ""}`}
        style={{
          backgroundColor: showBarBg ? "rgba(13,13,15,0.94)" : "rgba(13,13,15,0)",
          backdropFilter: showBarBg ? "blur(16px)" : "blur(0px)",
          WebkitBackdropFilter: showBarBg ? "blur(16px)" : "blur(0px)",
          borderBottom: isMobile
            ? "1px solid var(--border-hairline)"
            : scrolled
              ? "1px solid transparent"
              : "1px solid transparent",
          transition:
            "background-color 400ms ease-out, backdrop-filter 400ms ease-out, -webkit-backdrop-filter 400ms ease-out",
        }}
      >
        <div
          className={`flex w-full items-center justify-between ${isMobile ? "px-3 py-2" : "px-12 py-4"}`}
        >
          <Link
            href="/home"
            className={`${isMobile ? "text-[15px] min-h-[44px] inline-flex items-center px-2" : "text-[15px]"} font-semibold tracking-[0.14em] text-[color:var(--text-primary)] transition-colors duration-300 [transition-timing-function:var(--ease-productive)] hover:text-[color:var(--text-inverse)] active:scale-[0.98]`}
            aria-label="FDFS Home"
          >
            FDFS
          </Link>

          {isMobile ? (
            <button
              type="button"
              onClick={onSearchClick}
              className={iconWrapClass}
              aria-label="Search films"
            >
              <svg
                width={24}
                height={24}
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
          ) : (
            <nav
              className="flex items-center gap-9"
              aria-label="Main"
            >
              <button
                type="button"
                onClick={onSearchClick}
                className={iconWrapClass}
                aria-label="Search"
              >
                <svg
                  width={24}
                  height={24}
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
              <button
                type="button"
                onClick={handleSignOut}
                className="text-[14px] font-normal tracking-wide text-[color:var(--text-secondary)] transition-colors duration-300 [transition-timing-function:var(--ease-productive)] hover:text-[color:var(--text-inverse)]"
              >
                Sign out
              </button>
              {DESKTOP_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${itemClass(link.href)} inline-flex items-center gap-2`}
                >
                  <svg
                    width={22}
                    height={22}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 opacity-90"
                    aria-hidden
                  >
                    {link.icon}
                  </svg>
                  <span>{link.label}</span>
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      <MobileTabBar />
    </>
  )
}
