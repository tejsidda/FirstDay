"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { searchMovies, formatLanguage } from "@/lib/tmdb"
import { Movie } from "@/lib/types"

export default function MovieSearch({
  onAdd,
  onClose,
}: {
  onAdd: (movie: Movie) => Promise<{ ok: boolean; message?: string }>
  onClose: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [year, setYear] = useState("")
  const [results, setResults] = useState<Movie[]>([])
  const [loading, setLoading] = useState(false)
  const [addMessage, setAddMessage] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queryReady = query.trim().length >= 2

  // Auto-focus the input when the component opens
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounced search — waits 400ms after you stop typing
  useEffect(() => {
    if (!queryReady) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      const parsedYear =
        year.trim().length === 4 && /^\d{4}$/.test(year.trim())
          ? Number(year.trim())
          : undefined
      const movies = await searchMovies(query, parsedYear)
      setResults(movies)
      setLoading(false)
    }, 400)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, year, queryReady])

  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  return (
    <div
      data-ptr-ignore
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "color-mix(in srgb, var(--background-base) 80%, transparent)" }} />

      {/* Search panel */}
      <div
        className="relative z-10 w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input + year filter */}
        <div className="flex items-stretch gap-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a movie..."
            className="t-body flex-1 rounded-xl border px-5 py-4 text-white outline-none transition-colors"
            style={{ background: "var(--background-elevated)", borderColor: "var(--border-hairline)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-hairline)")}
          />
          <input
            value={year}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 4)
              setYear(digitsOnly)
            }}
            placeholder="Year"
            inputMode="numeric"
            className="t-label-value t-tabular w-20 rounded-xl border px-3 py-4 text-white outline-none transition-colors"
            style={{ background: "var(--background-elevated)", borderColor: "var(--border-hairline)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-hairline)")}
          />
        </div>

        {/* Results */}
        {(queryReady && (results.length > 0 || loading)) && (
          <div className="mt-2 max-h-[60vh] overflow-y-auto rounded-xl border" style={{ background: "var(--background-mid)", borderColor: "var(--border-hairline)" }}>
            {loading && results.length === 0 && (
              <div className="t-meta px-5 py-8 text-center text-white/30">
                Searching...
              </div>
            )}

            {results.map((movie) => (
              <div
                key={movie.id}
                className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
              >
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    router.push(`/movie/${movie.id}`)
                  }}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  aria-label={`Open ${movie.title}`}
                >
                  <div
                    className="h-16 w-11 shrink-0 rounded bg-cover bg-center"
                    style={{ backgroundColor: "var(--background-elevated)", backgroundImage: `url(${movie.poster})` }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="t-title-sm truncate text-white/90">
                      {movie.title}
                    </p>
                    <p className="t-caption text-white/40">
                      {formatLanguage(movie.language)} · {movie.year}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await onAdd(movie)
                      if (result.ok) {
                        setAddMessage("")
                        onClose()
                        return
                      }
                      setAddMessage(result.message || "This one's already in your library.")
                    }}
                    className="t-button-sm rounded-full border px-3 py-1.5 transition-colors hover:bg-white/5"
                    style={{
                      color: "var(--text-emphasis)",
                      borderColor: "var(--border-default)",
                    }}
                  >
                    + Watchlist
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      router.push(`/movie/${movie.id}?rate=1`)
                    }}
                    className="t-button-sm rounded-full px-3 py-1.5 transition-opacity hover:opacity-90"
                    style={{
                      color: "var(--text-inverse)",
                      background: "var(--text-strong)",
                    }}
                  >
                    Already watched
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {addMessage && (
          <div
            className="t-meta mt-2 rounded-xl border px-4 py-3"
            style={{
              background: "rgba(130,40,40,0.16)",
              borderColor: "rgba(255,120,120,0.28)",
              color: "rgba(255,200,200,0.9)",
            }}
          >
            {addMessage}
          </div>
        )}
      </div>
    </div>
  )
}