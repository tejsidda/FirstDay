import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { makeMovie } from "@/test/mocks/movies"
import { passthrough } from "@/test/mocks/motion"

const mockPush = vi.fn()
const onSearchOpen = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}))

vi.mock("@/components/motion/ParallaxY", () => ({
  default: passthrough,
}))

import HeroCarousel from "@/components/cinematic/HeroCarousel"

const movies = [
  makeMovie({ id: "1", title: "First Film" }),
  makeMovie({ id: "2", title: "Second Film" }),
  makeMovie({ id: "3", title: "Third Film" }),
]

describe("HeroCarousel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the first movie by default", () => {
    render(
      <HeroCarousel
        movies={movies}
        isMobile={false}
        sourceEyebrow="From your watchlist"
        onSearchOpen={onSearchOpen}
      />,
    )

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("First Film")
    expect(screen.getByText("From your watchlist")).toBeInTheDocument()
  })

  it("shows navigation controls on desktop when multiple movies exist", () => {
    render(
      <HeroCarousel
        movies={movies}
        isMobile={false}
        sourceEyebrow="From your watchlist"
        onSearchOpen={onSearchOpen}
      />,
    )

    expect(screen.getByRole("button", { name: "Previous film" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next film" })).toBeInTheDocument()
  })

  it("hides navigation controls on mobile", () => {
    render(
      <HeroCarousel
        movies={movies}
        isMobile
        sourceEyebrow="From your watchlist"
        onSearchOpen={onSearchOpen}
      />,
    )

    expect(screen.queryByRole("button", { name: "Previous film" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Next film" })).not.toBeInTheDocument()
  })

  it("advances to the next film after clicking next", async () => {
    render(
      <HeroCarousel
        movies={movies}
        isMobile={false}
        sourceEyebrow="From your watchlist"
        onSearchOpen={onSearchOpen}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Next film" }))
    await vi.advanceTimersByTimeAsync(320)

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Second Film")
    })
  })

  it("wraps to the last film when clicking previous on the first slide", async () => {
    render(
      <HeroCarousel
        movies={movies}
        isMobile={false}
        sourceEyebrow="From your watchlist"
        onSearchOpen={onSearchOpen}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Previous film" }))
    await vi.advanceTimersByTimeAsync(320)

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Third Film")
    })
  })

  it("completes manual navigation without leaving the hero context hidden", async () => {
    render(
      <HeroCarousel
        movies={movies}
        isMobile={false}
        sourceEyebrow="From your watchlist"
        onSearchOpen={onSearchOpen}
      />,
    )

    const context = () => document.querySelector(".hero-context") as HTMLElement

    fireEvent.click(screen.getByRole("button", { name: "Next film" }))
    expect(context().style.opacity).toBe("0")

    await vi.advanceTimersByTimeAsync(320)

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Second Film")
      expect(context().style.opacity).toBe("1")
    })
  })

  it("navigates to movie details from the primary CTA", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })

    render(
      <HeroCarousel
        movies={movies}
        isMobile={false}
        sourceEyebrow="From your watchlist"
        onSearchOpen={onSearchOpen}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Open details" }))

    expect(mockPush).toHaveBeenCalledWith("/movie/1")
  })

  it("calls onSearchOpen from the secondary CTA", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })

    render(
      <HeroCarousel
        movies={movies}
        isMobile={false}
        sourceEyebrow="From your watchlist"
        onSearchOpen={onSearchOpen}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Search films" }))

    expect(onSearchOpen).toHaveBeenCalledTimes(1)
  })
})
