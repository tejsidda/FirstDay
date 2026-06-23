import { NextRequest, NextResponse } from "next/server"
import { fetchMovieCredits } from "@/lib/tmdb-server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid movie id" }, { status: 400 })
  }

  try {
    return NextResponse.json(await fetchMovieCredits(id))
  } catch {
    return NextResponse.json({ error: "TMDB unavailable" }, { status: 503 })
  }
}
