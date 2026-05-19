"use client"

import { useState, useEffect, useRef } from "react"
import { searchMovies } from "@/lib/tmdb"
import { Movie } from "@/lib/types"

export default function MovieSearch({
  onAdd,
  onClose,
}: {
  onAdd: (movie: Movie) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [year, setYear] = useState("")
  const [results, setResults] = useState<Movie[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-focus the input when the component opens
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounced search — waits 400ms after you stop typing
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }

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
  }, [query, year])

  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

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
            className="flex-1 rounded-xl bg-neutral-900 border border-white/10 px-5 py-4 text-white text-base outline-none focus:border-white/25 transition-colors"
            style={{ fontFamily: "Georgia, serif" }}
          />
          <input
            value={year}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 4)
              setYear(digitsOnly)
            }}
            placeholder="Year"
            inputMode="numeric"
            className="w-20 rounded-xl bg-neutral-900 border border-white/10 px-3 py-4 text-white text-sm outline-none focus:border-white/25 transition-colors"
            style={{ fontFamily: "Georgia, serif" }}
          />
        </div>

        {/* Results */}
        {(results.length > 0 || loading) && (
          <div className="mt-2 max-h-[60vh] overflow-y-auto rounded-xl bg-neutral-900 border border-white/10">
            {loading && results.length === 0 && (
              <div className="px-5 py-8 text-center text-white/30 text-sm">
                Searching...
              </div>
            )}

            {results.map((movie) => (
              <button
                key={movie.id}
                onClick={() => {
                  onAdd(movie)
                  onClose()
                }}
                className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-white/5"
              >
                <div
                  className="h-16 w-11 shrink-0 rounded bg-neutral-800 bg-cover bg-center"
                  style={{ backgroundImage: `url(${movie.poster})` }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {movie.title}
                  </p>
                  <p className="text-xs text-white/40">
                    {movie.language} · {movie.year}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-white/20">
                  + Add
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}