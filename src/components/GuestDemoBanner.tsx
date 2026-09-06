"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import {
  DEMO_LIBRARY_LIMIT,
  DEMO_WATCHLIST_LIMIT,
} from "@/lib/demo-portfolio"
import { exitGuestMode, isGuestMode } from "@/lib/guest-mode"
import { resetGuestSeedCache } from "@/lib/guest-seed-loader"
import { getGuestPortfolioSnapshot } from "@/lib/guest-store"

export default function GuestDemoBanner() {
  const [guest, setGuest] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [libraryCount, setLibraryCount] = useState(0)
  const [watchlistCount, setWatchlistCount] = useState(0)
  const [publishing, setPublishing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [published, setPublished] = useState(false)

  const refreshCounts = useCallback(async () => {
    if (!isGuestMode()) return
    const { watched, watchlist } = await getGuestPortfolioSnapshot()
    setLibraryCount(watched.length)
    setWatchlistCount(watchlist.length)
  }, [])

  useEffect(() => {
    setGuest(isGuestMode())
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSignedIn(Boolean(user))
    })
    refreshCounts()

    const onChange = () => {
      refreshCounts()
    }
    window.addEventListener("fdfs:guest-data-changed", onChange)
    return () => window.removeEventListener("fdfs:guest-data-changed", onChange)
  }, [refreshCounts])

  const handlePublish = async () => {
    setMessage(null)
    const { watched, watchlist } = await getGuestPortfolioSnapshot()
    if (
      watched.length !== DEMO_LIBRARY_LIMIT ||
      watchlist.length !== DEMO_WATCHLIST_LIMIT
    ) {
      setMessage(
        `Need ${DEMO_LIBRARY_LIMIT} library and ${DEMO_WATCHLIST_LIMIT} watchlist titles before publishing.`,
      )
      return
    }

    setPublishing(true)
    try {
      const res = await fetch("/api/demo-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watched, watchlist }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error ?? "Could not publish demo.")
        return
      }
      resetGuestSeedCache()
      setPublished(true)
      setMessage("Demo published — visitors will see this set.")
    } catch {
      setMessage("Could not publish demo.")
    } finally {
      setPublishing(false)
    }
  }

  const handleExitSetup = () => {
    exitGuestMode()
    resetGuestSeedCache()
    window.location.href = "/home"
  }

  if (!guest) return null

  const canPublish =
    libraryCount === DEMO_LIBRARY_LIMIT && watchlistCount === DEMO_WATCHLIST_LIMIT

  return (
    <div
      className="fixed left-0 right-0 z-[49] border-b border-[rgba(212,175,55,0.15)] bg-[rgba(20,16,10,0.92)] px-4 py-2 text-center backdrop-blur-md"
      style={{ top: "var(--fdfs-guest-banner-offset, 64px)" }}
    >
      {signedIn ? (
        <p className="text-[12px] text-[rgba(255,255,255,0.55)]">
          Demo setup — library {libraryCount}/{DEMO_LIBRARY_LIMIT}, watchlist{" "}
          {watchlistCount}/{DEMO_WATCHLIST_LIMIT}. Add titles via search, then publish for
          visitors.{" "}
          {!published && (
            <button
              type="button"
              disabled={!canPublish || publishing}
              onClick={handlePublish}
              className="text-[rgba(212,175,55,0.85)] underline underline-offset-2 disabled:opacity-40"
            >
              {publishing ? "Publishing…" : "Publish demo"}
            </button>
          )}
          {" · "}
          <button
            type="button"
            onClick={handleExitSetup}
            className="text-[rgba(212,175,55,0.75)] underline underline-offset-2"
          >
            Exit setup
          </button>
        </p>
      ) : (
        <p className="text-[12px] text-[rgba(255,255,255,0.55)]">
          Demo mode — try the app freely; your changes won&apos;t be saved.{" "}
          <Link
            href="/landing"
            className="text-[rgba(212,175,55,0.75)] underline underline-offset-2 transition-colors hover:text-[rgba(212,175,55,0.95)]"
          >
            Sign in
          </Link>{" "}
          for your own diary.
        </p>
      )}
      {message && (
        <p className="mt-1 text-[11px] text-[rgba(212,175,55,0.7)]">{message}</p>
      )}
    </div>
  )
}
