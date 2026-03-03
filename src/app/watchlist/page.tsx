"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import {
  WATCHLIST_ALL,
  WATCHLIST_PRIORITY,
} from "@/lib/mock"
import { Movie } from "@/lib/types"
import MoviePosterCard from "@/components/MoviePosterCard"

function PriorityRow({ movie, index }: { movie: Movie; index: number }) {
  const isGradient = movie.poster.startsWith("linear-gradient")
  const isFirst = index === 0
  return (
    <Link
      href={`/movie/${movie.id}`}
      className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-200 hover:bg-white/5"
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
        style={{
          backgroundColor: isFirst ? "rgba(245, 158, 11, 0.9)" : "rgba(255,255,255,0.08)",
        }}
      >
        {index + 1}
      </span>
      <div
        className="h-[52px] w-9 shrink-0 overflow-hidden rounded-md bg-black/40 bg-cover bg-center"
        style={
          isGradient
            ? { background: movie.poster }
            : { backgroundImage: `url(${movie.poster})`, backgroundSize: "cover" }
        }
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white" style={{ fontWeight: 500 }}>
          {movie.title}
        </p>
        <p className="text-xs text-white/35">{movie.language}</p>
      </div>
    </Link>
  )
}

export default function WatchlistPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Main: grid only */}
      <main className="min-w-0 px-6 py-8 pr-[280px] md:px-8">
        <header className="mb-8">
          <h1
            className="text-2xl font-semibold tracking-tight text-white"
            style={{ fontWeight: 600 }}
          >
            Watchlist
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {WATCHLIST_ALL.length} {WATCHLIST_ALL.length === 1 ? "film" : "films"} you mean to watch.
          </p>
        </header>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
          }}
        >
          {WATCHLIST_ALL.map((movie) => (
            <MoviePosterCard key={movie.id} movie={movie} size="large" />
          ))}
        </div>
        <div className="pb-24" />
      </main>

      {/* Priority panel — fixed right, glass */}
      <aside
        className="fixed right-0 top-0 z-30 h-full w-64 border-l overflow-hidden"
        style={{
          borderColor: "rgba(255,255,255,0.06)",
          backgroundColor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div
          className="sticky top-0 border-b px-4 py-4"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-wider text-white/50"
            style={{ fontWeight: 600 }}
          >
            Priority to watch
          </h2>
        </div>
        <div
          className="overflow-y-auto px-2 py-3"
          style={{ maxHeight: "calc(100vh - 4rem)" }}
        >
          <div className="space-y-0.5">
            {WATCHLIST_PRIORITY.map((movie, i) => (
              <PriorityRow key={movie.id} movie={movie} index={i} />
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
