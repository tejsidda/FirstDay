"use client"

import { useEffect, useState } from "react"

export const MOBILE_BREAKPOINT_PX = 768

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT_PX) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [breakpoint])

  return isMobile
}

/** Bottom inset when the fixed mobile tab bar is visible */
export const MOBILE_TAB_BAR_INSET =
  "calc(64px + env(safe-area-inset-bottom, 0px))"
