"use client"

import Image from "next/image"
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const itemClass = (href?: string) => {
    const isActive = href != null && pathname === href
    return [
      "text-[13px] font-normal transition-colors duration-300",
      isActive ? "text-white/90" : "text-white/55 hover:text-white/90",
    ].join(" ")
  }

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
      <div className="flex w-full items-center justify-between px-12 py-4">
        <Link
          href="/home"
          className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-white/90"
          aria-label="FDFS Home"
        >
          <Image
            src="/images/Black%20Simple%20Personal%20Logo.png"
            alt="FDFS logo"
            width={32}
            height={32}
            priority
          />
        </Link>
        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={onSearchClick}
            className={`${itemClass()} inline-flex items-center justify-center`}
            aria-label="Search"
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
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.65" y1="16.65" x2="21" y2="21" />
            </svg>
          </button>
          <Link href="/home" className={itemClass("/home")}>
            Home
          </Link>
          <Link href="/library" className={itemClass("/library")}>
            Library
          </Link>
          <Link href="/watchlist" className={itemClass("/watchlist")}>
            Watchlist
          </Link>
        </div>
      </div>
    </div>
  )
}
