import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Movie } from "@/lib/types"
import { makeMovie, makeRecommendation } from "@/test/mocks/movies"
import { passthrough } from "@/test/mocks/motion"

const mockPush = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
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

vi.mock("@/lib/db", () => ({
  getWatchlist: vi.fn(),
  getWatched: vi.fn(),
  getUnshownRecommendations: vi.fn(),
  addToWatchlistDetailed: vi.fn(),
  markRecommendationShown: vi.fn(),
  messageForAddToWatchlistFailure: vi.fn(() => "Could not add to watchlist"),
}))

vi.mock("@/lib/recommend", () => ({
  getRecommendations: vi.fn(),
  refreshRecommendations: vi.fn(),
}))

vi.mock("@/components/motion/SplitReveal", () => ({
  default: ({
    children,
    as: Tag = "div",
  }: {
    children: React.ReactNode
    as?: keyof React.JSX.IntrinsicElements
  }) => createElement(Tag, null, children),
}))

vi.mock("@/components/motion/ClipReveal", () => ({
  default: passthrough,
}))

vi.mock("@/components/motion/ParallaxY", () => ({
  default: passthrough,
}))

vi.mock("@/components/motion/FooterWordmark", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}))

vi.mock("@/components/motion/gsapSetup", () => ({
  ensureGsap: () => ({ ScrollTrigger: { refresh: vi.fn() } }),
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

vi.mock("@/components/cinematic/HeroCarousel", () => ({
  default: ({
    movies,
    sourceEyebrow,
    onSearchOpen,
  }: {
    movies: Movie[]
    sourceEyebrow: string
    onSearchOpen: () => void
  }) => (
    <div data-testid="hero-carousel">
      <span data-testid="hero-eyebrow">{sourceEyebrow}</span>
      <span data-testid="hero-movie-count">{movies.length}</span>
      <button type="button" onClick={onSearchOpen}>
        Hero search
      </button>
    </div>
  ),
}))

import HomeContent from "@/components/HomeContent"
import {
  getUnshownRecommendations,
  getWatched,
  getWatchlist,
} from "@/lib/db"

describe("HomeContent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getWatchlist).mockResolvedValue([])
    vi.mocked(getWatched).mockResolvedValue([])
    vi.mocked(getUnshownRecommendations).mockResolvedValue([])
  })

  it("shows loading state before data resolves", () => {
    vi.mocked(getWatchlist).mockReturnValue(new Promise(() => {}))
    vi.mocked(getWatched).mockReturnValue(new Promise(() => {}))

    render(<HomeContent />)

    expect(screen.getByText("Loading your cinema…")).toBeInTheDocument()
  })

  it("shows empty onboarding when library and watchlist are empty", async () => {
    render(<HomeContent />)

    expect(await screen.findByText("Your cinema starts here.")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Search for a film" }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId("hero-carousel")).not.toBeInTheDocument()
  })

  it("opens search from the empty state CTA", async () => {
    const user = userEvent.setup()
    render(<HomeContent />)

    await user.click(await screen.findByRole("button", { name: "Search for a film" }))

    expect(screen.getByTestId("movie-search")).toBeInTheDocument()
  })

  it("renders hero from watchlist when watchlist has items", async () => {
    vi.mocked(getWatchlist).mockResolvedValue([
      makeMovie({ id: "10", title: "Watchlist Film" }),
      makeMovie({ id: "11", title: "Another Watchlist Film" }),
    ])
    vi.mocked(getWatched).mockResolvedValue([
      makeMovie({ id: "20", title: "Watched Film" }),
    ])

    render(<HomeContent />)

    expect(await screen.findByTestId("hero-carousel")).toBeInTheDocument()
    expect(screen.getByTestId("hero-eyebrow")).toHaveTextContent("From your watchlist")
    expect(screen.getByTestId("hero-movie-count")).toHaveTextContent("2")
  })

  it("renders hero from library when watchlist is empty", async () => {
    vi.mocked(getWatched).mockResolvedValue([
      makeMovie({ id: "20", title: "Watched Film" }),
      makeMovie({ id: "21", title: "Second Watched Film" }),
    ])

    render(<HomeContent />)

    expect(await screen.findByTestId("hero-carousel")).toBeInTheDocument()
    expect(screen.getByTestId("hero-eyebrow")).toHaveTextContent("From your library")
    expect(screen.getByTestId("hero-movie-count")).toHaveTextContent("1")
  })

  it("shows recently watched and watchlist sections when data exists", async () => {
    vi.mocked(getWatchlist).mockResolvedValue([
      makeMovie({ id: "10", title: "Queued Film" }),
    ])
    vi.mocked(getWatched).mockResolvedValue([
      makeMovie({ id: "20", title: "Seen Film" }),
    ])

    render(<HomeContent />)

    expect(await screen.findByRole("heading", { name: "Recently watched" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Want to watch" })).toBeInTheDocument()
    expect(screen.getByText("Seen Film")).toBeInTheDocument()
    expect(screen.getByText("Queued Film")).toBeInTheDocument()
  })

  it("prompts to rate three films when recommendations are unavailable", async () => {
    vi.mocked(getWatched).mockResolvedValue([
      makeMovie({ id: "1", title: "One" }),
      makeMovie({ id: "2", title: "Two" }),
    ])

    render(<HomeContent />)

    expect(
      await screen.findByText("Rate three films and we'll start curating your picks."),
    ).toBeInTheDocument()
  })

  it("offers personalized recommendations when enough films are watched", async () => {
    vi.mocked(getWatched).mockResolvedValue([
      makeMovie({ id: "1", title: "One" }),
      makeMovie({ id: "2", title: "Two" }),
      makeMovie({ id: "3", title: "Three" }),
    ])

    render(<HomeContent />)

    expect(
      await screen.findByRole("button", { name: "Get personalized recommendations" }),
    ).toBeInTheDocument()
  })

  it("renders recommendation cards when unshown recommendations exist", async () => {
    vi.mocked(getWatched).mockResolvedValue([
      makeMovie({ id: "1", title: "One" }),
    ])
    vi.mocked(getUnshownRecommendations).mockResolvedValue([
      makeRecommendation({ title: "Curated Pick" }),
    ])

    render(<HomeContent />)

    expect(await screen.findByText("Curated Pick")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument()
  })

  it("opens search when fdfs:open-search is dispatched", async () => {
    render(<HomeContent />)

    await waitFor(() => {
      expect(screen.queryByText("Loading your cinema…")).not.toBeInTheDocument()
    })

    await act(async () => {
      window.dispatchEvent(new Event("fdfs:open-search"))
    })

    expect(await screen.findByTestId("movie-search")).toBeInTheDocument()
  })
})
