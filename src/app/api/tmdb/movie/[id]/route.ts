import { NextRequest, NextResponse } from "next/server"
import { fetchMovieDetails } from "@/lib/tmdb-server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid movie id" }, { status: 400 })
  }

  try {
    const movie = await fetchMovieDetails(id)
    if (!movie) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({
      id: movie.id,
      title: movie.title,
      runtime: movie.runtime ?? null,
      genres: (movie.genres || []).map((g: { id: number; name: string }) => ({
        id: g.id,
        name: g.name,
      })),
      poster_path: movie.poster_path ?? null,
      backdrop_path: movie.backdrop_path ?? null,
      release_date: movie.release_date ?? null,
      original_language: movie.original_language ?? null,
    })
  } catch {
    return NextResponse.json({ error: "TMDB unavailable" }, { status: 503 })
  }
}
