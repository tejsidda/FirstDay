import { NextRequest, NextResponse } from "next/server"

const BASE = "https://api.themoviedb.org/3"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const query = searchParams.get("q") || ""
  const year = searchParams.get("year") || ""

  if (query.trim().length < 2) return NextResponse.json([])

  const token = process.env.TMDB_TOKEN
  if (!token) {
    console.error("TMDB TV search unavailable: TMDB_TOKEN is not configured")
    return NextResponse.json({ error: "TMDB not configured" }, { status: 503 })
  }

  const buildUrl = (page: number) => {
    let url = `${BASE}/search/tv?query=${encodeURIComponent(query)}&language=en-US&page=${page}`
    if (year) url += `&first_air_date_year=${year}`
    return url
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  let res1: Response
  let res2: Response
  try {
    ;[res1, res2] = await Promise.all([
      fetch(buildUrl(1), { headers }),
      fetch(buildUrl(2), { headers }),
    ])
  } catch (error) {
    console.error("TMDB TV search request failed:", error)
    return NextResponse.json({ error: "TMDB request failed" }, { status: 502 })
  }

  if (!res1.ok) {
    console.error("TMDB TV search returned non-OK status:", res1.status)
    return NextResponse.json([])
  }

  const [d1, d2] = await Promise.all([res1.json(), res2.ok ? res2.json() : { results: [] }])

  const merged = [...(d1.results || []), ...(d2.results || [])]
  const seen = new Set<number>()
  const unique = merged.filter((m: { id: number }) => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })

  return NextResponse.json(unique)
}
