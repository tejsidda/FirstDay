import { MediaItem, Movie } from "./types"

const IMG = "https://image.tmdb.org/t/p"

function proxyTmdbImage(url: string) {
  return `/api/poster-proxy?url=${encodeURIComponent(url)}`
}

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

export type MovieGenre = { id: number; name: string }

export type TmdbMovieDetails = {
  id: number
  title?: string
  runtime?: number | null
  genres?: MovieGenre[]
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string | null
  original_language?: string | null
}

export type TmdbTvDetails = {
  id: number
  name?: string
  episode_run_time?: number[] | null
  number_of_seasons?: number | null
  number_of_episodes?: number | null
  status?: string | null
  genres?: MovieGenre[]
  poster_path?: string | null
  backdrop_path?: string | null
  first_air_date?: string | null
  original_language?: string | null
}

export function formatLanguage(value: string | null | undefined): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (trimmed.length > 3) return trimmed
  const lower = trimmed.toLowerCase()
  return LANG_MAP[lower] || trimmed
}

export function posterURL(path: string, size = "w500") {
  return proxyTmdbImage(`${IMG}/${size}${path}`)
}

export function backdropURL(path: string, size = "w780") {
  return proxyTmdbImage(`${IMG}/${size}${path}`)
}

function tmdbToMovie(item: {
  id: number
  title: string
  release_date?: string
  original_language?: string
  poster_path?: string | null
  backdrop_path?: string | null
}): MediaItem {
  return {
    id: String(item.id),
    mediaType: "movie",
    title: item.title,
    year: item.release_date ? parseInt(item.release_date.split("-")[0], 10) : 0,
    language: formatLanguage(item.original_language),
    poster: item.poster_path
      ? posterURL(item.poster_path)
      : "linear-gradient(145deg, #1a1a2d 0%, #0a0a14 100%)",
    backdrop: item.backdrop_path ? backdropURL(item.backdrop_path) : undefined,
  }
}

function tmdbToTvShow(item: {
  id: number
  name: string
  first_air_date?: string
  original_language?: string
  poster_path?: string | null
  backdrop_path?: string | null
}): MediaItem {
  return {
    id: String(item.id),
    mediaType: "tv",
    title: item.name,
    year: item.first_air_date ? parseInt(item.first_air_date.split("-")[0], 10) : 0,
    language: formatLanguage(item.original_language),
    poster: item.poster_path
      ? posterURL(item.poster_path)
      : "linear-gradient(145deg, #1a1a2d 0%, #0a0a14 100%)",
    backdrop: item.backdrop_path ? backdropURL(item.backdrop_path) : undefined,
  }
}

export async function searchMovies(query: string, year?: number): Promise<MediaItem[]> {
  let url = `/api/tmdb/search?q=${encodeURIComponent(query)}`
  if (year) url += `&year=${year}`
  const res = await fetch(url)
  if (!res.ok) return []
  const results = await res.json()
  return Array.isArray(results) ? results.map(tmdbToMovie) : []
}

export async function searchTvShows(query: string, year?: number): Promise<MediaItem[]> {
  let url = `/api/tmdb/search/tv?q=${encodeURIComponent(query)}`
  if (year) url += `&year=${year}`
  const res = await fetch(url)
  if (!res.ok) return []
  const results = await res.json()
  return Array.isArray(results) ? results.map(tmdbToTvShow) : []
}

export async function getMovieByName(name: string): Promise<Movie | null> {
  const results = await searchMovies(name)
  return results.length > 0 ? results[0] : null
}

export async function getMovieDetails(id: string): Promise<TmdbMovieDetails | null> {
  const res = await fetch(`/api/tmdb/movie/${id}`)
  if (!res.ok) return null
  return res.json()
}

export type TvDetailsForDb = {
  genres: MovieGenre[]
  runtime: number | null
  seasons: number | null
  episodes: number | null
}

export async function getTvDetails(id: string): Promise<TvDetailsForDb | null> {
  const res = await fetch(`/api/tmdb/tv/${id}`)
  if (!res.ok) return null
  const data = (await res.json()) as TmdbTvDetails
  const runtime =
    data.episode_run_time?.length && data.episode_run_time[0] > 0
      ? data.episode_run_time[0]
      : null
  return {
    genres: data.genres ?? [],
    runtime,
    seasons: data.number_of_seasons ?? null,
    episodes: data.number_of_episodes ?? null,
  }
}

export async function getTvCredits(tmdbId: string) {
  const res = await fetch(`/api/tmdb/tv/${tmdbId}/credits`)
  if (!res.ok) return { creators: [] as string[], cast: [] as string[] }
  return res.json()
}

export async function getMovieCredits(tmdbId: string) {
  const res = await fetch(`/api/tmdb/movie/${tmdbId}/credits`)
  if (!res.ok) return { director: "Unknown", cast: [] as string[] }
  return res.json()
}

export async function getMovieImages(tmdbId: string): Promise<string[]> {
  const res = await fetch(`/api/tmdb/movie/${tmdbId}/images`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function getPersonFilmography(
  personName: string
): Promise<{ id: number; title: string; year: number }[]> {
  const res = await fetch(`/api/tmdb/person?name=${encodeURIComponent(personName)}`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function getMovieKeywords(tmdbId: string): Promise<string[]> {
  const res = await fetch(`/api/tmdb/movie/${tmdbId}/keywords`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}
