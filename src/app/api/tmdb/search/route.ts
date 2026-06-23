import { NextRequest, NextResponse } from "next/server"

<<<<<<< HEAD
=======
const TOKEN = process.env.TMDB_TOKEN
>>>>>>> ddc7a636afc9949eabd4692d96cec849a7a31fbb
const BASE = "https://api.themoviedb.org/3"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const query = searchParams.get("q") || ""
  const year = searchParams.get("year") || ""

  if (query.trim().length < 2) return NextResponse.json([])

<<<<<<< HEAD
  const token = process.env.TMDB_TOKEN
  if (!token) {
    console.error("TMDB search unavailable: TMDB_TOKEN is not configured")
=======
  if (!TOKEN) {
>>>>>>> ddc7a636afc9949eabd4692d96cec849a7a31fbb
    return NextResponse.json({ error: "TMDB not configured" }, { status: 503 })
  }

  const buildUrl = (page: number) => {
    let url = `${BASE}/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=${page}`
    if (year) url += `&year=${year}`
    return url
  }

<<<<<<< HEAD
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  let res1: Response
  let res2: Response
  try {
    ;[res1, res2] = await Promise.all([
      fetch(buildUrl(1), { headers }),
      fetch(buildUrl(2), { headers }),
    ])
  } catch (error) {
    console.error("TMDB search request failed:", error)
    return NextResponse.json({ error: "TMDB request failed" }, { status: 502 })
  }

  if (!res1.ok) {
    console.error("TMDB search returned non-OK status:", res1.status)
    return NextResponse.json([])
  }
=======
  const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }

  // Fetch both pages in parallel — fixes the sequential waterfall
  const [res1, res2] = await Promise.all([
    fetch(buildUrl(1), { headers }),
    fetch(buildUrl(2), { headers }),
  ])

  if (!res1.ok) return NextResponse.json([])
>>>>>>> ddc7a636afc9949eabd4692d96cec849a7a31fbb

  const [d1, d2] = await Promise.all([res1.json(), res2.ok ? res2.json() : { results: [] }])

  return NextResponse.json([...(d1.results || []), ...(d2.results || [])])
}
