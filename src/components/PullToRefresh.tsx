"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { dispatchPullRefresh } from "@/lib/pullToRefresh"

const THRESHOLD = 72
const MAX_PULL = 110
const DISABLED_PREFIXES = ["/landing", "/auth/"]

export default function PullToRefresh() {
  const pathname = usePathname()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const pullRef = useRef(0)
  const trackingRef = useRef(false)
  const startYRef = useRef(0)

  const disabled = DISABLED_PREFIXES.some((p) => pathname.startsWith(p))
  const progress = Math.min(1, pull / THRESHOLD)
  const visible = pull > 8 || refreshing

  useEffect(() => {
    if (disabled) return

    const mq = window.matchMedia("(max-width: 768px)")
    if (!mq.matches) return

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing || window.scrollY > 2) return
      const target = e.target as HTMLElement
      if (target.closest("[data-ptr-ignore]")) return
      startYRef.current = e.touches[0].clientY
      trackingRef.current = true
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!trackingRef.current || refreshing) return
      if (window.scrollY > 2) {
        trackingRef.current = false
        pullRef.current = 0
        setPull(0)
        return
      }
      const dy = e.touches[0].clientY - startYRef.current
      if (dy > 0) {
        const next = Math.min(dy * 0.45, MAX_PULL)
        pullRef.current = next
        setPull(next)
      } else {
        pullRef.current = 0
        setPull(0)
      }
    }

    const end = () => {
      if (!trackingRef.current) return
      trackingRef.current = false
      const distance = pullRef.current
      pullRef.current = 0
      setPull(0)

      if (distance >= THRESHOLD && !refreshing) {
        setRefreshing(true)
        dispatchPullRefresh()
        window.setTimeout(() => setRefreshing(false), 1200)
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", end, { passive: true })
    window.addEventListener("touchcancel", end, { passive: true })

    return () => {
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", end)
      window.removeEventListener("touchcancel", end)
    }
  }, [disabled, refreshing])

  if (disabled) return null

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 55,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        transform: `translateY(${visible ? Math.max(0, pull - 20) : -48}px)`,
        opacity: visible ? Math.max(0.35, progress) : 0,
        transition: pull > 0 ? "none" : "opacity 0.25s ease, transform 0.25s ease",
      }}
    >
      <div
        style={{
          marginTop: 56,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderRadius: 999,
          background: "rgba(20,20,22,0.92)",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: refreshing ? undefined : `rotate(${progress * 180}deg)`,
            animation: refreshing ? "ptrSpin 0.8s linear infinite" : undefined,
          }}
        >
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "0.02em",
          }}
        >
          {refreshing
            ? "Refreshing…"
            : progress >= 1
              ? "Release to refresh"
              : "Pull to refresh"}
        </span>
      </div>
      <style>{`
        @keyframes ptrSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
