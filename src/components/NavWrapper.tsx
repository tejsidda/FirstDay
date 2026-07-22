"use client"

import { Suspense } from "react"
import { usePathname } from "next/navigation"
import TopOverlayNav from "@/components/TopOverlayNav"

// Pages that have their own nav or no nav at all
const NO_NAV = ["/landing", "/auth/callback"]

export default function NavWrapper() {
  const pathname = usePathname()
  if (NO_NAV.includes(pathname)) return null
  return (
    <Suspense fallback={null}>
      <TopOverlayNav
        onSearchClick={() =>
          window.dispatchEvent(new CustomEvent("fdfs:open-search"))
        }
      />
    </Suspense>
  )
}
