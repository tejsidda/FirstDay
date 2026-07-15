"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { searchMovies } from "@/lib/tmdb"
import { Movie } from "@/lib/types"

export default function TestPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Movie[]>([])
  const [watchlist, setWatchlist] = useState<any[]>([])
  const [status, setStatus] = useState("")

  // Load watchlist from Supabase on page load
  useEffect(() => {
    loadWatchlist()
  }, [])

  const loadWatchlist = async () => {
    const { data, error } = await supabase
      .from("watchlist")
      .select("*")
      .order("added_at", { ascending: false })

    if (error) {
      setStatus("Error loading: " + error.message)
    } else {
      setWatchlist(data || [])
    }
  }

  const handleSearch = async () => {
    const movies = await searchMovies(query)
    setResults(movies)
  }

  const handleAdd = async (movie: Movie) => {
    const { error } = await supabase.from("watchlist").insert({
      tmdb_id: movie.id,
      title: movie.title,
      year: movie.year,
      language: movie.language,
      poster: movie.poster,
      backdrop: movie.backdrop || null,
    })

    if (error) {
      setStatus("Error adding: " + error.message)
    } else {
      setStatus(`Added "${movie.title}" to watchlist!`)
      loadWatchlist()
    }
  }

  return (
    <div style={{ background: "#000", color: "#fff", padding: 40, minHeight: "100vh" }}>
      <h1>Supabase + TMDB Test</h1>

      {status && (
        <p style={{ color: "#f5c518", marginTop: 8 }}>{status}</p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search a movie..."
          style={{ padding: 8, background: "#222", color: "#fff", border: "1px solid #444", borderRadius: 6 }}
        />
        <button onClick={handleSearch} style={{ padding: "8px 16px", background: "#333", color: "#fff", border: "none", borderRadius: 6 }}>
          Search
        </button>
      </div>

      <div style={{ marginTop: 24 }}>
        {results.map(m => (
          <div key={m.id} style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
            <img src={m.poster} alt="" style={{ width: 60, borderRadius: 4 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600 }}>{m.title}</p>
              <p style={{ opacity: 0.5, fontSize: 14 }}>{m.language} · {m.year}</p>
            </div>
            <button
              onClick={() => handleAdd(m)}
              style={{ padding: "6px 14px", background: "#222", color: "#fff", border: "1px solid #444", borderRadius: 6, cursor: "pointer" }}
            >
              + Add
            </button>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 40 }}>Watchlist from Database ({watchlist.length})</h2>
      <div style={{ marginTop: 16 }}>
        {watchlist.map(m => (
          <div key={m.id} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
            <img src={m.poster} alt="" style={{ width: 50, borderRadius: 4 }} />
            <div>
              <p style={{ fontWeight: 600 }}>{m.title}</p>
              <p style={{ opacity: 0.5, fontSize: 12 }}>{m.language} · {m.year}</p>
            </div>
          </div>
        ))}
        {watchlist.length === 0 && (
          <p style={{ opacity: 0.3 }}>No movies in watchlist yet. Search and add one above.</p>
        )}
      </div>
    </div>
  )
}