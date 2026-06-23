import { NextRequest, NextResponse } from "next/server"
import { fetchPersonFilmography } from "@/lib/tmdb-server"

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim()
  if (!name || name.length < 2) {
    return NextResponse.json([])
  }

  try {
    const films = await fetchPersonFilmography(name)
    return NextResponse.json(films)
  } catch {
    return NextResponse.json({ error: "TMDB unavailable" }, { status: 503 })
  }
}
