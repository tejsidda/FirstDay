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

const MIN_BACKDROP_WIDTH = 1280
const MIN_BACKDROP_HEIGHT = 720
const RELAXED_BACKDROP_WIDTH = 1000
const RELAXED_BACKDROP_HEIGHT = 560
const MAX_MOVIE_BACKDROPS = 3

type TmdbBackdrop = {
  file_path: string
  width: number
  height: number
  vote_average?: number
  iso_639_1?: string | null
}

export type MovieBackdropResult = {
  urls: string[]
  fromPoster: boolean
}

function rankBackdrops(images: TmdbBackdrop[]): TmdbBackdrop[] {
  return [...images].sort((a, b) => {
    const langScore = (iso: string | null | undefined) => (!iso || iso === "en" ? 1 : 0)
    const lang = langScore(b.iso_639_1) - langScore(a.iso_639_1)
    if (lang !== 0) return lang
    const area = b.width * b.height - a.width * a.height
    if (area !== 0) return area
    return (b.vote_average ?? 0) - (a.vote_average ?? 0)
  })
}

function pickQualified(
  sorted: TmdbBackdrop[],
  minW: number,
  minH: number,
  limit: number,
  exclude: Set<string>
): TmdbBackdrop[] {
  const out: TmdbBackdrop[] = []
  for (const img of sorted) {
    if (img.width < minW || img.height < minH) continue
    if (exclude.has(img.file_path)) continue
    exclude.add(img.file_path)
    out.push(img)
    if (out.length >= limit) return out
  }
  return out
}

export async function getMovieBackdrops(
  tmdbId: string,
  fallback?: { posterPath?: string | null; backdropPath?: string | null }
): Promise<MovieBackdropResult> {
  let res: Response
  try {
    res = await fetch(`${BASE}/movie/${tmdbId}/images?include_image_language=en,null`, {
      headers: authHeaders(),
      ...CACHE_1H,
    })
  } catch {
    res = new Response(null, { status: 500 })
  }

  if (!res.ok) {
    if (fallback?.posterPath) {
      return { urls: [posterURL(fallback.posterPath, "w1280")], fromPoster: true }
    }
    if (fallback?.backdropPath) {
      return { urls: [backdropURL(fallback.backdropPath)], fromPoster: false }
    }
    return { urls: [], fromPoster: false }
  }

  const data = await res.json()
  const sorted = rankBackdrops((data.backdrops || []) as TmdbBackdrop[])
  const seen = new Set<string>()

  let picks = pickQualified(sorted, MIN_BACKDROP_WIDTH, MIN_BACKDROP_HEIGHT, MAX_MOVIE_BACKDROPS, seen)
  if (picks.length < MAX_MOVIE_BACKDROPS) {
    picks = [
      ...picks,
      ...pickQualified(
        sorted,
        RELAXED_BACKDROP_WIDTH,
        RELAXED_BACKDROP_HEIGHT,
        MAX_MOVIE_BACKDROPS - picks.length,
        seen
      ),
    ]
  }

  if (picks.length > 0) {
    return {
      urls: picks.map((img) => backdropURL(img.file_path)),
      fromPoster: false,
    }
  }

  if (fallback?.posterPath) {
    return { urls: [posterURL(fallback.posterPath, "w1280")], fromPoster: true }
  }
  if (fallback?.backdropPath) {
    return { urls: [backdropURL(fallback.backdropPath)], fromPoster: false }
  }
  return { urls: [], fromPoster: false }
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
