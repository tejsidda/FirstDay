"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { label: "Home", href: "/" },
  { label: "Library", href: "/library" },
  { label: "Watchlist", href: "/watchlist" },
] as const

export default function TopOverlayNav() {
  const pathname = usePathname()

  return (
    <>
      {/* Gradient fade from top over hero */}
      <div
        className="pointer-events-none fixed top-0 left-0 right-0 z-40 h-24 bg-gradient-to-b from-black/80 to-transparent"
        aria-hidden
      />
      <nav className="fixed top-0 z-50 flex w-full items-center justify-between px-6 py-4 md:px-8">
        <Link
          href="/"
          className="text-lg font-semibold tracking-wide text-white"
          style={{ fontWeight: 600 }}
        >
          FDFS
        </Link>
        <div className="flex gap-1 rounded-full p-1" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
          {navItems.map(({ label, href }) => {
            const isActive = pathname === href
            return href.startsWith("http") || label === "Library" ? (
              <button
                key={label}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive ? "bg-white/10 text-white" : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                {label}
              </button>
            ) : (
              <Link
                key={label}
                href={href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive ? "bg-white/10 text-white" : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
