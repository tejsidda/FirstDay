import { Movie } from "./types"

export const WATCHLIST: Movie[] = [
  {
    id: "1",
    title: "Kumbalangi Nights",
    year: 2019,
    language: "Malayalam",
    poster: "/images/KL.jpg",
  },
  {
    id: "2",
    title: "Parasite",
    year: 2019,
    language: "Korean",
    poster: "/images/Parasite.jpg",
  },
  {
    id: "3",
    title: "RRR",
    year: 2022,
    language: "Telugu",
    poster: "/images/RRR.jpeg",
  },
]

export const RECENTLY_WATCHED: Movie[] = [
  { ...WATCHLIST[0], rating: 5 },
  { ...WATCHLIST[1], rating: 5 },
  { ...WATCHLIST[2], rating: 4 },
  {
    id: "4",
    title: "Vikram",
    year: 2022,
    language: "Tamil",
    poster: "linear-gradient(145deg, #2d2d1a 0%, #14140a 100%)",
    rating: 4,
  },
  {
    id: "5",
    title: "Jawan",
    year: 2023,
    language: "Hindi",
    poster: "linear-gradient(145deg, #1a1a3d 0%, #0a0a1a 100%)",
    rating: 3,
  },
]

const EXTRA: Movie[] = [
  { id: "6", title: "Past Lives", year: 2023, language: "Korean", poster: "linear-gradient(145deg, #1a2d2d 0%, #0a1414 100%)" },
  { id: "7", title: "Jallikattu", year: 2019, language: "Malayalam", poster: "linear-gradient(145deg, #2d1a1a 0%, #140a0a 100%)" },
  { id: "8", title: "Drive My Car", year: 2021, language: "Japanese", poster: "linear-gradient(145deg, #1a1a2d 0%, #0a0a14 100%)" },
  { id: "9", title: "Sardar Udham", year: 2021, language: "Hindi", poster: "linear-gradient(145deg, #2d2d1a 0%, #14140a 100%)" },
  { id: "10", title: "Kaathal", year: 2023, language: "Malayalam", poster: "linear-gradient(145deg, #1a2d1a 0%, #0a140a 100%)" },
  { id: "11", title: "Super Deluxe", year: 2019, language: "Tamil", poster: "linear-gradient(145deg, #1a1a2d 0%, #0a0a14 100%)" },
]

export const WATCHLIST_UP_NEXT: Movie[] = [WATCHLIST[0], WATCHLIST[1], WATCHLIST[2], EXTRA[0], EXTRA[1], EXTRA[2], EXTRA[3]]
export const WATCHLIST_SAVED_EARLIER: Movie[] = [RECENTLY_WATCHED[3], RECENTLY_WATCHED[4], EXTRA[4], EXTRA[5]]

/** All movies in watchlist (for center column) */
export const WATCHLIST_ALL: Movie[] = [...WATCHLIST, ...EXTRA]

/** Recent releases in favorite categories (for left scrollable column) */
export const RECENT_BY_CATEGORY: { category: string; movies: Movie[] }[] = [
  { category: "Malayalam", movies: [WATCHLIST[0], EXTRA[1], EXTRA[4]] },
  { category: "Korean", movies: [WATCHLIST[1], EXTRA[0]] },
  { category: "Hindi", movies: [EXTRA[3], RECENTLY_WATCHED[4]] },
  { category: "Tamil", movies: [RECENTLY_WATCHED[3], EXTRA[5]] },
  { category: "Japanese", movies: [EXTRA[2]] },
]

/** Priority order to watch (for right scrollable column) */
export const WATCHLIST_PRIORITY: Movie[] = [WATCHLIST[0], WATCHLIST[1], EXTRA[0], WATCHLIST[2], EXTRA[3], RECENTLY_WATCHED[3], EXTRA[2]]
