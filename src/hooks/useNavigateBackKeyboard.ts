"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { navigateBack } from "@/components/BackButton"

/**
 * Alt+← (Windows) / browser-style back shortcut when not typing in a field.
 * Modals that use Escape (e.g. MovieSearch) should call stopPropagation on keydown.
 */
export function useNavigateBackKeyboard(enabled = true) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent) => {
      const isBackShortcut = e.altKey && e.key === "ArrowLeft"

      if (!isBackShortcut) return

      const t = e.target as HTMLElement
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT" ||
        t.isContentEditable
      ) {
        return
      }

      e.preventDefault()
      navigateBack(router)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, router])
}
