export type Recommendation = {
  id: string
  tmdbId: number
  title: string
  year: number
  language: string
  poster: string
  backdrop: string
  reason: string
  shown: boolean
  addedAt: string
}

export type MovieGenre = { id: number; name: string }

export type Movie = {
  id: string
  title: string
  year: number
  language: string
  poster: string
  backdrop?: string
  genres?: MovieGenre[]
  runtime?: number | null
  watchedAt?: string
  /** 1–10 scale, 0.5 increments; omit or null if unrated */
  rating?: number | null
  reviewHeadline?: string
  reviewBody?: string
}