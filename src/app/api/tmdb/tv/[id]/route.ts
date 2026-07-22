import { NextRequest, NextResponse } from "next/server"
import { fetchTvDetails } from "@/lib/tmdb-server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid TV id" }, { status: 400 })
  }

  try {
    const show = await fetchTvDetails(id)
    if (!show) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({
      id: show.id,
      name: show.name,
      episode_run_time: show.episode_run_time ?? null,
      number_of_seasons: show.number_of_seasons ?? null,
      number_of_episodes: show.number_of_episodes ?? null,
      status: show.status ?? null,
      genres: (show.genres || []).map((g: { id: number; name: string }) => ({
        id: g.id,
        name: g.name,
      })),
      poster_path: show.poster_path ?? null,
      backdrop_path: show.backdrop_path ?? null,
      first_air_date: show.first_air_date ?? null,
      original_language: show.original_language ?? null,
      overview: show.overview ?? null,
      tagline: show.tagline ?? null,
    })
  } catch {
    return NextResponse.json({ error: "TMDB unavailable" }, { status: 503 })
  }
}
