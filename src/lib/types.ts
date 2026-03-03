export type Movie = {
  id: string
  title: string
  year: number
  language: string
  poster: string
  /** Optional 1–5 star rating for watched films */
  rating?: number
}
