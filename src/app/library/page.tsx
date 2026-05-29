"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getWatched, addToWatchlist } from "@/lib/db"
import { PULL_REFRESH_EVENT } from "@/lib/pullToRefresh"
import type { Movie } from "@/lib/types"
import { formatLanguage } from "@/lib/tmdb"
import RatingDisplay from "@/components/RatingDisplay"
import MovieSearch from "@/components/MovieSearch"
import FilterChip from "@/components/FilterChip"

function LibraryPoster({
  film,
  onClick,
}: {
  film: Movie
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Open ${film.title}`}
      style={{
        display: "block",
        width: "100%",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
        transition: "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "2 / 3",
          overflow: "hidden",
          borderRadius: 8,
          boxShadow: hovered
            ? "0 14px 32px rgba(10,12,18,0.55)"
            : "0 4px 14px rgba(10,12,18,0.35)",
          transition: "box-shadow 0.3s ease",
        }}
      >
        <img
          src={film.poster}
          alt={film.title}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        {film.rating != null && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "var(--panel-overlay)",
              borderRadius: 6,
              padding: "4px 8px",
              backdropFilter: "blur(4px)",
            }}
          >
            <RatingDisplay rating={film.rating} size="sm" />
          </div>
        )}
      </div>
      <div
        className="t-title-sm"
        style={{
          marginTop: 10,
          color: "var(--text-emphasis)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {film.title}
      </div>
      <div
        className="t-caption"
        style={{ marginTop: 2, color: "var(--text-search)" }}
      >
        {formatLanguage(film.language)}
        {film.year != null ? ` · ${film.year}` : ""}
      </div>
    </button>
  )
}

export default function LibraryPage() {
  const [watched, setWatched] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLanguage, setSelectedLanguage] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [isMobile, setIsMobile] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handler = () => setSearchOpen(true)
    window.addEventListener("fdfs:open-search", handler)
    return () => window.removeEventListener("fdfs:open-search", handler)
  }, [])

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)")
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const films = await getWatched()
      if (!active) return
      setWatched(films)
      setLoading(false)
    }
    load()

    const onPullRefresh = (e: Event) => {
      e.preventDefault()
      void load()
    }
    window.addEventListener(PULL_REFRESH_EVENT, onPullRefresh)
    return () => {
      active = false
      window.removeEventListener(PULL_REFRESH_EVENT, onPullRefresh)
    }
  }, [])

  const handleAdd = async (movie: Movie) => {
    if (watched.some((m) => m.id === movie.id)) {
      return {
        ok: false,
        message: "Already in your library — pick another one?",
      }
    }
    const success = await addToWatchlist(movie)
    if (success) return { ok: true }
    return { ok: false, message: "Already on your watchlist." }
  }

  const languages = [
    "All",
    ...Array.from(
      new Set(
        watched
          .map((m) => formatLanguage(m.language))
          .filter((l): l is string => Boolean(l)),
      ),
    ).sort(),
  ]

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredWatched = watched.filter((film) => {
    const filmLang = formatLanguage(film.language)
    const languageOk =
      selectedLanguage === "All" || filmLang === selectedLanguage
    if (!normalizedQuery) return languageOk
    return (
      languageOk &&
      `${film.title} ${filmLang} ${film.year}`
        .toLowerCase()
        .includes(normalizedQuery)
    )
  })

  if (loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background-library)" }}
      >
        <p className="t-meta" style={{ color: "var(--text-search)" }}>
          Loading your library…
        </p>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen page-with-mobile-tabs"
      style={{ background: "var(--background-library)" }}
    >

      {/* Ambient gradient — scoped to top of page */}
      <div
        style={{
          position: "absolute",
          inset: "0 0 auto 0",
          height: 700,
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(80,100,180,0.06) 0%, transparent 65%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Masthead */}
      <header
        style={{
          position: "relative",
          paddingTop: isMobile ? 80 : 128,
          paddingBottom: isMobile ? 32 : 56,
          paddingLeft: isMobile ? 20 : 56,
          paddingRight: isMobile ? 20 : 56,
          textAlign: "center",
        }}
      >
        {watched.length === 0 ? (
          <EmptyState onSearch={() => setSearchOpen(true)} />
        ) : (
          <>
            <div
              className="t-label"
              style={{ color: "var(--text-label)", marginBottom: 16 }}
            >
              Your library
            </div>
            <div
              className="t-display-num t-tabular"
              style={{ color: "var(--text-strong)" }}
            >
              {watched.length}
            </div>
            <p
              className="t-body"
              style={{
                margin: 0,
                marginTop: 16,
                color: "var(--text-dim)",
                fontStyle: "italic",
              }}
            >
              {watched.length === 1 ? "film" : "films"}. Every one meant
              something.
            </p>
          </>
        )}
      </header>

      {/* Filter bar */}
      {watched.length > 0 && (
        <div
          style={{
            position: "sticky",
            top: isMobile ? 52 : 64,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: isMobile ? "14px 16px" : "16px 56px",
            background: "var(--background-library)",
            borderBottom: "1px solid var(--border-default)",
            flexWrap: "wrap",
          }}
        >
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your library"
            aria-label="Search your library"
            className="t-label-value"
            style={{
              flex: isMobile ? "1 1 100%" : "0 0 280px",
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid var(--border-default)",
              background: "var(--tint-base)",
              color: "var(--text-emphasis)",
              outline: "none",
              transition: "border-color 0.2s ease, background 0.2s ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--border-strong)"
              e.currentTarget.style.background = "var(--tint-hover)"
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border-default)"
              e.currentTarget.style.background = "var(--tint-base)"
            }}
          />
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {languages.map((lang) => (
              <FilterChip
                key={lang}
                label={lang}
                active={selectedLanguage === lang}
                onClick={() =>
                  setSelectedLanguage((prev) => (prev === lang ? "All" : lang))
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {watched.length > 0 && (
        <section
          style={{
            position: "relative",
            padding: isMobile ? "32px 20px 80px" : "48px 56px 120px",
            maxWidth: 1400,
            margin: "0 auto",
          }}
        >
          {filteredWatched.length === 0 ? (
            <div
              className="t-meta"
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "var(--text-dim)",
              }}
            >
              No films match that search.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "repeat(2, minmax(0, 1fr))"
                  : "repeat(auto-fill, minmax(180px, 1fr))",
                gap: isMobile ? 20 : 28,
              }}
            >
              {filteredWatched.map((film) => (
                <LibraryPoster
                  key={film.id}
                  film={film}
                  onClick={() => router.push(`/movie/${film.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {searchOpen && (
        <MovieSearch
          onAdd={handleAdd}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </main>
  )
}

function EmptyState({ onSearch }: { onSearch: () => void }) {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <div
        className="t-label"
        style={{ color: "var(--text-label)", marginBottom: 20 }}
      >
        Your library
      </div>
      <h1
        className="t-display"
        style={{ margin: 0, color: "var(--text-strong)" }}
      >
        No films yet.
      </h1>
      <p
        className="t-body"
        style={{
          marginTop: 16,
          marginBottom: 28,
          color: "var(--text-dim)",
        }}
      >
        Mark something as watched and it will live here, along with your
        rating and review.
      </p>
      <button
        type="button"
        onClick={onSearch}
        className="t-button"
        style={{
          color: "var(--text-inverse)",
          background: "var(--text-strong)",
          border: "none",
          borderRadius: 999,
          padding: "12px 28px",
          cursor: "pointer",
        }}
      >
        Find a film
      </button>
    </div>
  )
}
