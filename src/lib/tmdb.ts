import { Movie } from "./types"

// Server components get TMDB_TOKEN (secret). Client fallback uses NEXT_PUBLIC_ for
// on-demand calls like getPersonFilmography triggered by user interaction.
const TOKEN = process.env.TMDB_TOKEN ?? process.env.NEXT_PUBLIC_TMDB_TOKEN

const BASE = "https://api.themoviedb.org/3"
const IMG = "https://image.tmdb.org/t/p"

export const LANG_MAP: Record<string, string> = {
  ml: "Malayalam",
  ko: "Korean",
  te: "Telugu",
  ta: "Tamil",
  hi: "Hindi",
  ja: "Japanese",
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  zh: "Chinese",
  pt: "Portuguese",
  ru: "Russian",
  ar: "Arabic",
  th: "Thai",
  kn: "Kannada",
  bn: "Bengali",
  mr: "Marathi",
  pa: "Punjabi",
  gu: "Gujarati",
  ur: "Urdu",
  id: "Indonesian",
  tr: "Turkish",
  vi: "Vietnamese",
  nl: "Dutch",
  sv: "Swedish",
  no: "Norwegian",
  da: "Danish",
  fi: "Finnish",
  pl: "Polish",
  cs: "Czech",
  he: "Hebrew",
  fa: "Persian",
  uk: "Ukrainian",
}

/**
 * Returns a human-readable language name. Accepts:
 *  - a TMDB 2-letter code ("te" → "Telugu")
 *  - an already-mapped name ("Telugu" → "Telugu")
 *  - anything else → returned as-is
 * Use this on every read site so legacy rows that stored raw codes still
 * display correctly without a DB migration.
 */
export function formatLanguage(value: string | null | undefined): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (trimmed.length > 3) return trimmed
  const lower = trimmed.toLowerCase()
  return LANG_MAP[lower] || trimmed
}

export function posterURL(path: string, size = "w500") {
  return `${IMG}/${size}${path}`
}

export function backdropURL(path: string, size = "w780") {
  return `${IMG}/${size}${path}`
}

function tmdbToMovie(item: any): Movie {
  return {
    id: String(item.id),
    title: item.title,
    year: item.release_date
      ? parseInt(item.release_date.split("-")[0])
      : 0,
    language: formatLanguage(item.original_language),
    poster: item.poster_path
      ? posterURL(item.poster_path)
      : "linear-gradient(145deg, #1a1a2d 0%, #0a0a14 100%)",
    backdrop: item.backdrop_path
      ? backdropURL(item.backdrop_path)
      : undefined,
  }
}

export async function searchMovies(query: string, year?: number): Promise<Movie[]> {
  // Routes through /api/tmdb/search so the TMDB token never reaches the browser
  let url = `/api/tmdb/search?q=${encodeURIComponent(query)}`
  if (year) url += `&year=${year}`
  const res = await fetch(url)
  if (!res.ok) return []
  const results = await res.json()
  return Array.isArray(results) ? results.map(tmdbToMovie) : []
}

export async function getMovieByName(name: string): Promise<Movie | null> {
  const results = await searchMovies(name)
  return results.length > 0 ? results[0] : null
}

export async function getMovieDetails(id: string) {
  const res = await fetch(`${BASE}/movie/${id}?language=en-US`, {
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  return res.json()
}

export async function getMovieCredits(tmdbId: string) {
  const res = await fetch(`${BASE}/movie/${tmdbId}/credits?language=en-US`, {
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    next: { revalidate: 3600 },
  })
  if (!res.ok) return { director: "Unknown", cast: [] }
  const data = await res.json()
  const director = (data.crew || []).find((p: any) => p.job === "Director")
  return {
    director: director ? director.name : "Unknown",
    cast: (data.cast || []).slice(0, 20).map((p: any) => p.name),
  }
}

export async function getMovieImages(tmdbId: string): Promise<string[]> {
  const res = await fetch(`${BASE}/movie/${tmdbId}/images`, {
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    next: { revalidate: 3600 },
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.backdrops || []).slice(0, 3).map((img: any) => backdropURL(img.file_path))
}

export async function getPersonFilmography(personName: string): Promise<{ id: number; title: string; year: number }[]> {
  const searchRes = await fetch(
    `${BASE}/search/person?query=${encodeURIComponent(personName)}&language=en-US&page=1`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  )
  const searchData = await searchRes.json()
  if (!searchData.results || searchData.results.length === 0) return []

  const personId = searchData.results[0].id

  const creditsRes = await fetch(
    `${BASE}/person/${personId}/movie_credits?language=en-US`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  )
  const creditsData = await creditsRes.json()

  const castFilms = (creditsData.cast || [])
    .filter((m: any) => m.release_date)
    .sort((a: any, b: any) => b.popularity - a.popularity)
    .slice(0, 8)
    .map((m: any) => ({
      id: m.id,
      title: m.title,
      year: m.release_date ? parseInt(m.release_date.split("-")[0]) : 0,
    }))

  const crewFilms = (creditsData.crew || [])
    .filter((m: any) => m.job === "Director" && m.release_date)
    .sort((a: any, b: any) => b.popularity - a.popularity)
    .slice(0, 8)
    .map((m: any) => ({
      id: m.id,
      title: m.title,
      year: m.release_date ? parseInt(m.release_date.split("-")[0]) : 0,
    }))

  return castFilms.length >= crewFilms.length ? castFilms : crewFilms
}

export async function getMovieKeywords(tmdbId: string): Promise<string[]> {
  const res = await fetch(`${BASE}/movie/${tmdbId}/keywords`, {
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    next: { revalidate: 3600 },
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.keywords || []).map((k: any) => k.name)
}