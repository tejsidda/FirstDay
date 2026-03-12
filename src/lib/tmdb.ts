import { Movie } from "./types"

const TOKEN = process.env.NEXT_PUBLIC_TMDB_TOKEN

const BASE = "https://api.themoviedb.org/3"
const IMG = "https://image.tmdb.org/t/p"

const LANG_MAP: Record<string, string> = {
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
  id: "Indonesian",
}

export function posterURL(path: string, size = "w500") {
  return `${IMG}/${size}${path}`
}

export function backdropURL(path: string) {
  return `${IMG}/w1280${path}`
}

function tmdbToMovie(item: any): Movie {
  return {
    id: String(item.id),
    title: item.title,
    year: item.release_date
      ? parseInt(item.release_date.split("-")[0])
      : 0,
    language: LANG_MAP[item.original_language] || item.original_language,
    poster: item.poster_path
      ? posterURL(item.poster_path)
      : "linear-gradient(145deg, #1a1a2d 0%, #0a0a14 100%)",
    backdrop: item.backdrop_path
      ? backdropURL(item.backdrop_path)
      : undefined,
  }
}

export async function searchMovies(query: string, year?: number): Promise<Movie[]> {
  let url = `${BASE}/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=1`
  if (year) url += `&year=${year}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
  })
  const data = await res.json()

  const res2 = await fetch(url.replace("page=1", "page=2"), {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
  })
  const data2 = await res2.json()

  const allResults = [...(data.results || []), ...(data2.results || [])]
  return allResults.map(tmdbToMovie)
}

export async function getMovieByName(name: string): Promise<Movie | null> {
  const results = await searchMovies(name)
  return results.length > 0 ? results[0] : null
}

export async function getMovieDetails(id: string) {
    const res = await fetch(
      `${BASE}/movie/${id}?language=en-US`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    )
    return await res.json()
  }

export async function getMovieCredits(tmdbId: string) {
  const res = await fetch(
    `${BASE}/movie/${tmdbId}/credits?language=en-US`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  )
  const data = await res.json()
  const director = (data.crew || []).find(
    (person: any) => person.job === "Director"
  )
  return {
    director: director ? director.name : "Unknown",
    cast: (data.cast || []).slice(0, 5).map((person: any) => person.name),
  }
}

export async function getMovieImages(tmdbId: string) {
  const res = await fetch(
    `${BASE}/movie/${tmdbId}/images`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  )
  const data = await res.json()
  return {
    backdrops: (data.backdrops || [])
      .slice(0, 4)
      .map((img: any) => `${IMG}/w1280${img.file_path}`),
    posters: (data.posters || [])
      .slice(0, 2)
      .map((img: any) => `${IMG}/w500${img.file_path}`),
  }
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
  const res = await fetch(
    `${BASE}/movie/${tmdbId}/keywords`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  )
  const data = await res.json()
  return (data.keywords || []).map((k: any) => k.name)
}