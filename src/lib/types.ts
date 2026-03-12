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

export type Movie = {
  id: string
  title: string
  year: number
  language: string
  poster: string
  backdrop?: string
  rating?: number
  reviewHeadline?: string
  reviewBody?: string
}