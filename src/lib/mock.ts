import { Movie } from "./types"

export const WATCHLIST: Movie[] = [
  {
    id: "1",
    title: "Kumbalangi Nights",
    year: 2019,
    language: "Malayalam",
    poster: "https://media.themoviedb.org/t/p/w1066_and_h600_face/8i8ml0LRdFT6LSaTMUG3gLzJfEq.jpg",
  },
  {
    id: "2",
    title: "Parasite",
    year: 2019,
    language: "Korean",
    poster: "https://media.themoviedb.org/t/p/w1066_and_h600_face/hiKmpZMGZsrkA3cdce8a7Dpos1j.jpg",
  },
  {
    id: "3",
    title: "RRR",
    year: 2022,
    language: "Telugu",
    poster: "https://media.themoviedb.org/t/p/w1066_and_h600_face/d3l7kgFJyLTTQSrR4ysCk5yeVyW.jpg",
  },
]

export const RECENTLY_WATCHED: Movie[] = [
  { id: "1",
    title: "Kumbalangi Nights",
    year: 2019,
    language: "Malayalam",
    poster: "https://media.themoviedb.org/t/p/w440_and_h660_face/o0Is0aKOhwhDoit7t3fyovifweO.jpg",
  },
  { id: "2",
    title: "Parasite",
    year: 2019,
    language: "Korean",
    poster: "https://media.themoviedb.org/t/p/w440_and_h660_face/hiKmpZMGZsrkA3cdce8a7Dpos1j.jpg",
  },
  { id: "3",
    title: "RRR",
    year: 2022,
    language: "Telugu",
    poster: "https://media.themoviedb.org/t/p/w440_and_h660_face/wE0I6efAW4cDDmZQWtwZMOW44EJ.jpg",
    rating: 4, },
  {
    id: "4",
    title: "Vikram",
    year: 2022,
    language: "Tamil",
    poster: "https://image.tmdb.org/t/p/w500/774UV1aCURb4s4JfEFg3IEMu5Zj.jpg",
    rating: 4,
  },
  {
    id: "5",
    title: "Jawan",
    year: 2023,
    language: "Hindi",
    poster: "https://image.tmdb.org/t/p/w500/jFt1gS4BGHlK8xt76Y81Alp4dbt.jpg",
    rating: 3,
  },
]

const EXTRA: Movie[] = [
  { id: "6", title: "Past Lives", year: 2023, language: "Korean", poster: "https://image.tmdb.org/t/p/w500/k3waqVXSnvCIOWKPBRFzMGNIQB4.jpg" },
  { id: "7", title: "Jallikattu", year: 2019, language: "Malayalam", poster: "https://image.tmdb.org/t/p/w500/6kbbLeGLPAqcFyDKJMjN8ey1HRb.jpg" },
  { id: "8", title: "Drive My Car", year: 2021, language: "Japanese", poster: "https://image.tmdb.org/t/p/w500/x8mvYGq3GVkMxLFwqsnhKJoFi3j.jpg" },
  { id: "9", title: "Sardar Udham", year: 2021, language: "Hindi", poster: "https://image.tmdb.org/t/p/w500/lSHpdH2MuOJ5GkavYkYwBBpkhey.jpg" },
  { id: "10", title: "Kaathal", year: 2023, language: "Malayalam", poster: "https://image.tmdb.org/t/p/w500/cSwsBe8RQQP2v1oiLNpaXP4Mwqz.jpg" },
  { id: "11", title: "Super Deluxe", year: 2019, language: "Tamil", poster: "https://image.tmdb.org/t/p/w500/bBYCjMq0hGhOrRiHmJWdX4mSFPD.jpg" },
]

export const WATCHLIST_UP_NEXT: Movie[] = [WATCHLIST[0], WATCHLIST[1], WATCHLIST[2], EXTRA[0], EXTRA[1], EXTRA[2], EXTRA[3]]
export const WATCHLIST_SAVED_EARLIER: Movie[] = [RECENTLY_WATCHED[3], RECENTLY_WATCHED[4], EXTRA[4], EXTRA[5]]

export const WATCHLIST_ALL: Movie[] = [...WATCHLIST, ...EXTRA]

export const RECENT_BY_CATEGORY: { category: string; movies: Movie[] }[] = [
  { category: "Malayalam", movies: [WATCHLIST[0], EXTRA[1], EXTRA[4]] },
  { category: "Korean", movies: [WATCHLIST[1], EXTRA[0]] },
  { category: "Hindi", movies: [EXTRA[3], RECENTLY_WATCHED[4]] },
  { category: "Tamil", movies: [RECENTLY_WATCHED[3], EXTRA[5]] },
  { category: "Japanese", movies: [EXTRA[2]] },
]

export const WATCHLIST_PRIORITY: Movie[] = [WATCHLIST[0], WATCHLIST[1], EXTRA[0], WATCHLIST[2], EXTRA[3], RECENTLY_WATCHED[3], EXTRA[2]]