"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { getWatched } from "@/lib/db"
import { PULL_REFRESH_EVENT } from "@/lib/pullToRefresh"
import type { Movie } from "@/lib/types"

export default function LibraryPage() {
  const [watched, setWatched] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLanguage, setSelectedLanguage] = useState<string>("All")
  const [gridOpacity, setGridOpacity] = useState(1)
  const didMountRef = useRef(false)

  useEffect(() => {
    let active = true

    async function loadWatched() {
      setLoading(true)
      const items = await getWatched()
      if (!active) return
      setWatched(items)
      setLoading(false)
    }

    loadWatched()

    const onPullRefresh = (e: Event) => {
      e.preventDefault()
      void loadWatched()
    }
    window.addEventListener(PULL_REFRESH_EVENT, onPullRefresh)

    return () => {
      active = false
      window.removeEventListener(PULL_REFRESH_EVENT, onPullRefresh)
    }
  }, [])

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    setGridOpacity(0.5)
    const timer = window.setTimeout(() => setGridOpacity(1), 140)
    return () => window.clearTimeout(timer)
  }, [selectedLanguage])

  const languageCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const film of watched) {
      const lang = film.language?.trim()
      if (!lang) continue
      counts.set(lang, (counts.get(lang) || 0) + 1)
    }
    return counts
  }, [watched])

  const languages = useMemo(
    () => ["All", ...Array.from(languageCounts.keys())],
    [languageCounts]
  )

  const filteredFilms =
    selectedLanguage === "All"
      ? watched
      : watched.filter((m) => m.language === selectedLanguage)

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#080808" }}>
        <p style={{ color: "rgba(255,255,255,0.3)", fontStyle: "italic", fontFamily: 'Georgia, serif' }}>
          Loading your library...
        </p>
      </main>
    )
  }

  const totalCount = watched.length
  const allEmpty = totalCount === 0

  return (
    <main className="min-h-screen" style={{ background: "#080808" }}>
      <Link
        href="/home"
        style={{
          position: "fixed",
          top: 24,
          left: 24,
          zIndex: 50,
          fontFamily: "-apple-system, sans-serif",
          fontSize: 14,
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          textDecoration: "none",
          letterSpacing: "0.1em",
        }}
      >
        FDFS
      </Link>

      <header style={{ paddingLeft: 48, paddingRight: 48, paddingTop: 100 }}>
        <h1
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 36,
            fontWeight: 400,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.9)",
            lineHeight: 1.1,
          }}
        >
          Library
        </h1>
        <p
          style={{
            marginTop: 8,
            fontSize: 14,
            color: "rgba(255,255,255,0.35)",
            fontStyle: "italic",
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          {totalCount} films watched
        </p>

        {!allEmpty && (
          <div className="flex flex-wrap" style={{ marginTop: 28, gap: 8 }}>
            {languages.map((lang) => {
              const count = lang === "All" ? totalCount : languageCounts.get(lang) || 0
              const active = lang === selectedLanguage
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedLanguage(lang)}
                  style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                    padding: "7px 18px",
                    border: active
                      ? "1px solid rgba(255,255,255,0.25)"
                      : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 999,
                    background: active ? "rgba(255,255,255,0.06)" : "transparent",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (active) return
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"
                    e.currentTarget.style.color = "rgba(255,255,255,0.6)"
                  }}
                  onMouseLeave={(e) => {
                    if (active) return
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"
                    e.currentTarget.style.color = "rgba(255,255,255,0.4)"
                  }}
                >
                  {lang} ({count})
                </button>
              )
            })}
          </div>
        )}
      </header>

      {allEmpty ? (
        <div className="min-h-[45vh] flex items-center justify-center" style={{ padding: "0 48px" }}>
          <p
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: 16,
              color: "rgba(255,255,255,0.3)",
              fontStyle: "italic",
              textAlign: "center",
              lineHeight: 1.8,
            }}
          >
            Your library is empty.
            <br />
            Watch a film and it&apos;ll appear here.
          </p>
        </div>
      ) : filteredFilms.length === 0 ? (
        <div className="min-h-[45vh] flex items-center justify-center" style={{ padding: "0 48px" }}>
          <p
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: 16,
              color: "rgba(255,255,255,0.3)",
              fontStyle: "italic",
              textAlign: "center",
            }}
          >
            No {selectedLanguage} films in your library yet.
          </p>
        </div>
      ) : (
        <div
          style={{
            marginTop: 40,
            padding: "0 48px 100px 48px",
            opacity: gridOpacity,
            transition: "opacity 0.2s ease",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              columnGap: 24,
              rowGap: 32,
            }}
          >
            {filteredFilms.map((film) => {
              const stars =
                typeof film.rating === "number"
                  ? "★".repeat(Math.max(0, Math.min(5, film.rating)))
                  : ""
              return (
                <Link key={film.id} href={`/movie/${film.id}`} style={{ textDecoration: "none" }}>
                  <article>
                    <div
                      className="transition-all duration-300 ease-out hover:-translate-y-1.5"
                      style={{
                        width: "100%",
                        aspectRatio: "2 / 3",
                        borderRadius: 8,
                        overflow: "hidden",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.6)"
                        e.currentTarget.style.transform = "translateY(-6px)"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.4)"
                        e.currentTarget.style.transform = "translateY(0)"
                      }}
                    >
                      <img
                        src={film.poster}
                        alt={film.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    </div>
                    <p
                      style={{
                        marginTop: 10,
                        fontFamily: 'Georgia, "Times New Roman", serif',
                        fontSize: 13,
                        fontWeight: 400,
                        color: "rgba(255,255,255,0.8)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {film.title}
                    </p>
                    <p
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        color: "rgba(255,255,255,0.35)",
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                      }}
                    >
                      {film.language || "Unknown"} {film.year ? `· ${film.year}` : ""}
                    </p>
                    {stars && (
                      <p style={{ marginTop: 4, color: "#f5c518", fontSize: 11, letterSpacing: "0.03em" }}>
                        {stars}
                      </p>
                    )}
                  </article>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}
