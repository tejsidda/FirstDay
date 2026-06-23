import "server-only"

const BASE = "https://api.themoviedb.org/3"
const IMG = "https://image.tmdb.org/t/p"

/** Server-only — never fall back to NEXT_PUBLIC_TMDB_TOKEN */
export function getTmdbToken(): string | undefined {
  return process.env.TMDB_TOKEN
}

function authHeaders(): HeadersInit {
  const token = getTmdbToken()
  if (!token) throw new Error("TMDB_TOKEN is not configured")
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

const CACHE_1H = { next: { revalidate: 3600 } } as const

function proxyTmdbImage(url: string) {
  return `/api/poster-proxy?url=${encodeURIComponent(url)}`
}

export function posterURL(path: string, size = "w500") {
  return proxyTmdbImage(`${IMG}/${size}${path}`)
}

export function backdropURL(path: string, size = "w1280") {
  return proxyTmdbImage(`${IMG}/${size}${path}`)
}

export async function fetchMovieDetails(id: string) {
  const res = await fetch(`${BASE}/movie/${id}?language=en-US`, {
    headers: authHeaders(),
    ...CACHE_1H,
  })
  if (!res.ok) return null
  return res.json()
}

export async function fetchMovieCredits(tmdbId: string) {
  const res = await fetch(`${BASE}/movie/${tmdbId}/credits?language=en-US`, {
    headers: authHeaders(),
    ...CACHE_1H,
  })
  if (!res.ok) return { director: "Unknown", cast: [] as string[] }
  const data = await res.json()
  const director = (data.crew || []).find((p: { job?: string }) => p.job === "Director")
  return {
    director: director ? director.name : "Unknown",
    cast: (data.cast || []).slice(0, 20).map((p: { name: string }) => p.name),
  }
}

export async function fetchMovieKeywords(tmdbId: string): Promise<string[]> {
  const res = await fetch(`${BASE}/movie/${tmdbId}/keywords`, {
    headers: authHeaders(),
    ...CACHE_1H,
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.keywords || []).map((k: { name: string }) => k.name)
}

export async function fetchMovieImages(tmdbId: string): Promise<string[]> {
  const res = await fetch(`${BASE}/movie/${tmdbId}/images`, {
    headers: authHeaders(),
    ...CACHE_1H,
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.backdrops || [])
    .slice(0, 3)
    .map((img: { file_path: string }) => backdropURL(img.file_path))
}

export async function fetchPersonFilmography(personName: string) {
  const searchRes = await fetch(
    `${BASE}/search/person?query=${encodeURIComponent(personName)}&language=en-US&page=1`,
    { headers: authHeaders(), ...CACHE_1H }
  )
  const searchData = await searchRes.json()
  if (!searchData.results?.length) return []

  const personId = searchData.results[0].id
  const creditsRes = await fetch(`${BASE}/person/${personId}/movie_credits?language=en-US`, {
    headers: authHeaders(),
    ...CACHE_1H,
  })
  const creditsData = await creditsRes.json()

  const castFilms = (creditsData.cast || [])
    .filter((m: { release_date?: string }) => m.release_date)
    .sort((a: { popularity: number }, b: { popularity: number }) => b.popularity - a.popularity)
    .slice(0, 8)
    .map((m: { id: number; title: string; release_date: string }) => ({
      id: m.id,
      title: m.title,
      year: parseInt(m.release_date.split("-")[0], 10),
    }))

  const crewFilms = (creditsData.crew || [])
    .filter((m: { job?: string; release_date?: string }) => m.job === "Director" && m.release_date)
    .sort((a: { popularity: number }, b: { popularity: number }) => b.popularity - a.popularity)
    .slice(0, 8)
    .map((m: { id: number; title: string; release_date: string }) => ({
      id: m.id,
      title: m.title,
      year: parseInt(m.release_date.split("-")[0], 10),
    }))

  return castFilms.length >= crewFilms.length ? castFilms : crewFilms
}
