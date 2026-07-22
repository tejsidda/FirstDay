import { NextRequest, NextResponse } from "next/server"
import { fetchTvCredits } from "@/lib/tmdb-server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid TV id" }, { status: 400 })
  }

  try {
    const credits = await fetchTvCredits(id)
    return NextResponse.json(credits)
  } catch {
    return NextResponse.json({ creators: [], cast: [] }, { status: 503 })
  }
}
