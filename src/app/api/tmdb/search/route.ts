import { NextRequest, NextResponse } from "next/server"

const TOKEN = process.env.TMDB_TOKEN
const BASE = "https://api.themoviedb.org/3"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const query = searchParams.get("q") || ""
  const year = searchParams.get("year") || ""

  if (query.trim().length < 2) return NextResponse.json([])

  if (!TOKEN) {
    return NextResponse.json({ error: "TMDB not configured" }, { status: 503 })
  }

  const buildUrl = (page: number) => {
    let url = `${BASE}/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=${page}`
    if (year) url += `&year=${year}`
    return url
  }

  const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }

  // Fetch both pages in parallel — fixes the sequential waterfall
  const [res1, res2] = await Promise.all([
    fetch(buildUrl(1), { headers }),
    fetch(buildUrl(2), { headers }),
  ])

  if (!res1.ok) return NextResponse.json([])

  const [d1, d2] = await Promise.all([res1.json(), res2.ok ? res2.json() : { results: [] }])

  return NextResponse.json([...(d1.results || []), ...(d2.results || [])])
}
