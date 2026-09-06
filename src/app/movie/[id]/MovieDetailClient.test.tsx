import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { makeMovieDetailProps } from "@/test/mocks/movieDetail"

const mockSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}))

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn(() => false),
  MOBILE_TAB_BAR_INSET: "64px",
}))

vi.mock("@/components/motion/gsapSetup", () => ({
  ensureGsap: () => ({
    gsap: {
      context: (fn: () => void) => {
        fn()
        return { revert: vi.fn() }
      },
      set: vi.fn(),
      timeline: () => ({
        to: vi.fn().mockReturnThis(),
      }),
    },
  }),
  prefersReducedMotion: () => false,
}))

vi.mock("@/components/RatingDisplay", () => ({
  default: ({ rating }: { rating: number }) => <span data-testid="rating-display">{rating}</span>,
}))

vi.mock("@/components/StandingOvationInput", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: number | null
    onChange: (v: number) => void
  }) => (
    <button type="button" onClick={() => onChange(8)}>
      Set rating {value ?? "none"}
    </button>
  ),
}))

vi.mock("@/components/MediaSearch", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="movie-search">
      <button type="button" onClick={onClose}>
        Close search
      </button>
    </div>
  ),
}))

const mockFrom = vi.fn()

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

vi.mock("@/lib/tmdb", () => ({
  formatLanguage: (code: string) => (code === "en" ? "English" : code || "Unknown"),
  getPersonFilmography: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  addToWatchlistDetailed: vi.fn(),
  messageForAddToWatchlistFailure: vi.fn(() => "Could not add to watchlist"),
  markAsWatchedDetailed: vi.fn(),
  messageForMarkWatchedFailure: vi.fn(() => "Could not save rating"),
  removeFromWatchlist: vi.fn(),
  updateReview: vi.fn(),
  getWatched: vi.fn(),
  getWatchlist: vi.fn(),
}))

import MovieDetailClient from "./MovieDetailClient"
import { useIsMobile } from "@/hooks/useIsMobile"
import { getPersonFilmography } from "@/lib/tmdb"
import {
  addToWatchlistDetailed,
  markAsWatchedDetailed,
  removeFromWatchlist,
  updateReview,
  getWatched,
  getWatchlist,
} from "@/lib/db"

function createSupabaseQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error: null }),
  }
}

function mockUserState({
  watched = null,
  watchlist = [],
}: {
  watched?: Record<string, unknown> | null
  watchlist?: { id: string; mediaType?: string }[]
} = {}) {
  vi.mocked(getWatched).mockResolvedValue(
    watched
      ? [
          {
            id: String(watched.tmdb_id ?? "550"),
            mediaType: "movie" as const,
            title: String(watched.title ?? "Fight Club"),
            year: Number(watched.year ?? 1999),
            language: String(watched.language ?? "en"),
            poster: String(watched.poster ?? "/poster.jpg"),
            backdrop: watched.backdrop ? String(watched.backdrop) : undefined,
            watchedAt: watched.watched_at ? String(watched.watched_at) : undefined,
            rating:
              watched.rating != null && watched.rating !== ""
                ? Number(watched.rating)
                : undefined,
            reviewHeadline: watched.review_headline
              ? String(watched.review_headline)
              : undefined,
            reviewBody: watched.review_body ? String(watched.review_body) : undefined,
          },
        ]
      : [],
  )
  vi.mocked(getWatchlist).mockResolvedValue(
    watchlist.map((item) => ({
      id: item.id,
      mediaType: (item.mediaType ?? "movie") as "movie" | "tv",
      title: "Queued film",
      year: 2020,
      language: "en",
      poster: "/poster.jpg",
    })),
  )
}

class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()

  constructor(
    _callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {}
}

describe("MovieDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.delete("rate")
    vi.mocked(useIsMobile).mockReturnValue(false)
    mockUserState()
    vi.mocked(addToWatchlistDetailed).mockResolvedValue({ ok: true })
    vi.mocked(markAsWatchedDetailed).mockResolvedValue({ ok: true })
    vi.mocked(removeFromWatchlist).mockResolvedValue(true)
    vi.mocked(updateReview).mockResolvedValue(true)
    vi.mocked(getPersonFilmography).mockResolvedValue([])
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)
  })

  it("renders movie metadata and three scroll chapters after user data loads", async () => {
    render(<MovieDetailClient {...makeMovieDetailProps()} />)

    expect(await screen.findByRole("heading", { name: "Fight Club" })).toBeInTheDocument()
    expect(screen.getByText("Mischief. Mayhem. Soap.")).toBeInTheDocument()
    expect(screen.getByText(/insomniac office worker/i)).toBeInTheDocument()
    expect(screen.getByText("David Fincher")).toBeInTheDocument()
    expect(screen.getByText("Brad Pitt")).toBeInTheDocument()
    expect(screen.getByText("rebellion")).toBeInTheDocument()

    const panels = document.querySelectorAll("[data-panel]")
    expect(panels).toHaveLength(3)
    expect(panels[0]?.querySelector("[data-chapter-intro]")).toBeNull()
    expect(panels[1]?.querySelector('[data-chapter-intro="true"]')).not.toBeNull()
    expect(panels[2]?.querySelector('[data-chapter-intro="true"]')).not.toBeNull()
  })

  it("renders a backdrop stage with one image per backdrop", async () => {
    render(<MovieDetailClient {...makeMovieDetailProps()} />)

    await screen.findByRole("heading", { name: "Fight Club" })

    const imgs = document.querySelectorAll(".movie-cinematic-backdrop-img")
    expect(imgs).toHaveLength(3)
    expect(document.querySelector('.movie-cinematic-frame[data-side="right"]')).not.toBeNull()
    expect(document.querySelector(".movie-cinematic-stage-scrim")).not.toBeNull()
  })

  it("omits the backdrop stage when no backdrops are available", async () => {
    render(<MovieDetailClient {...makeMovieDetailProps({ backdrops: [] })} />)

    await screen.findByRole("heading", { name: "Fight Club" })

    expect(document.querySelector(".movie-cinematic-stage")).toBeNull()
  })

  it("uses the mobile cinematic layout when on a small viewport", async () => {
    vi.mocked(useIsMobile).mockReturnValue(true)

    render(<MovieDetailClient {...makeMovieDetailProps()} />)

    await screen.findByRole("heading", { name: "Fight Club" })

    expect(document.querySelector('.movie-cinematic[data-mobile="true"]')).not.toBeNull()
    expect(document.querySelector(".movie-cinematic-stage--mobile")).not.toBeNull()
    expect(document.querySelector('.movie-cinematic-frame[data-side="center"]')).not.toBeNull()
  })

  it("adds the movie to the watchlist", async () => {
    const user = userEvent.setup()
    render(<MovieDetailClient {...makeMovieDetailProps()} />)

    await user.click(await screen.findByRole("button", { name: "Add to watchlist" }))

    await waitFor(() => {
      expect(addToWatchlistDetailed).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "550",
          mediaType: "movie",
          title: "Fight Club",
          backdrop: "https://example.com/backdrop-1.jpg",
        }),
      )
    })
    expect(await screen.findByText("On your watchlist")).toBeInTheDocument()
  })

  it("opens the rating panel when marking watched", async () => {
    const user = userEvent.setup()
    render(<MovieDetailClient {...makeMovieDetailProps()} />)

    await user.click(await screen.findByRole("button", { name: "Mark watched" }))

    expect(await screen.findByText("How much applause?")).toBeInTheDocument()
  })

  it("opens the rating panel on load when rate=1 is present", async () => {
    mockSearchParams.set("rate", "1")

    render(<MovieDetailClient {...makeMovieDetailProps()} />)

    expect(await screen.findByText("How much applause?")).toBeInTheDocument()
  })

  it("shows the watched review section for library entries", async () => {
    mockUserState({
      watched: {
        id: "w-1",
        tmdb_id: "550",
        title: "Fight Club",
        poster: "https://example.com/poster.jpg",
        rating: 9,
        review_headline: "Still holds up",
        review_body: "Chaos and catharsis.",
      },
    })

    render(<MovieDetailClient {...makeMovieDetailProps()} />)

    expect(await screen.findByText("Your take")).toBeInTheDocument()
    expect(screen.getByText("Still holds up")).toBeInTheDocument()
    expect(screen.getByText("Chaos and catharsis.")).toBeInTheDocument()
    expect(screen.getByTestId("rating-display")).toHaveTextContent("9")
    expect(screen.queryByRole("button", { name: "Add to watchlist" })).not.toBeInTheDocument()
  })

  it("loads filmography when a cast member is selected", async () => {
    const user = userEvent.setup()
    vi.mocked(getPersonFilmography).mockResolvedValue([
      { id: 42, title: "Se7en", year: 1995 },
    ])

    render(<MovieDetailClient {...makeMovieDetailProps()} />)

    await user.click(await screen.findByRole("button", { name: "Brad Pitt" }))

    expect(getPersonFilmography).toHaveBeenCalledWith("Brad Pitt")
    expect(await screen.findByText("Also by")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Se7en/ })).toHaveAttribute("href", "/movie/42")
  })

  it("expands the cast list beyond the preview limit", async () => {
    const user = userEvent.setup()
    const cast = Array.from({ length: 14 }, (_, i) => `Actor ${i + 1}`)

    render(
      <MovieDetailClient
        {...makeMovieDetailProps({
          credits: { director: "David Fincher", cast },
        })}
      />,
    )

    await screen.findByRole("heading", { name: "Fight Club" })
    expect(screen.queryByText("Actor 14")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Show all 14" }))

    expect(screen.getByText("Actor 14")).toBeInTheDocument()
  })
})
