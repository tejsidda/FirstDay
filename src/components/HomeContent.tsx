"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import TopOverlayNav from "@/components/TopOverlayNav"
import MovieSearch from "@/components/MovieSearch"
import { getWatchlist, getWatched, addToWatchlist } from "@/lib/db"
import { Movie } from "@/lib/types"

function PolaroidCard({
  film,
  rotation,
  offsetX,
  offsetY,
  onClick,
}: {
  film: Movie
  rotation: number
  offsetX: number
  offsetY: number
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        cursor: "pointer",
        transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        transform: hovered
          ? "rotate(0deg) translateY(-12px) scale(1.05)"
          : `rotate(${rotation}deg) translateX(${offsetX}px) translateY(${offsetY}px)`,
        zIndex: hovered ? 20 : 1,
        position: "relative",
      }}
    >
      <div
        style={{
          background: hovered
            ? "rgba(255,255,255,0.08)"
            : "rgba(255,255,255,0.03)",
          padding: "10px 10px 40px 10px",
          borderRadius: 4,
          boxShadow: hovered
            ? "0 20px 50px rgba(0,0,0,0.7), 0 0 1px rgba(255,255,255,0.1)"
            : "0 4px 16px rgba(0,0,0,0.5)",
          transition: "all 0.4s ease",
        }}
      >
        <div style={{ aspectRatio: "2/3", overflow: "hidden", borderRadius: 2 }}>
          <img
            src={film.poster}
            alt={film.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 14,
            right: 14,
          }}
        >
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 12,
              fontStyle: "italic",
              color: hovered
                ? "rgba(255,255,255,0.7)"
                : "rgba(255,255,255,0.3)",
              transition: "color 0.3s ease",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {film.title}
          </div>
          {film.rating && (
            <div
              style={{
                fontSize: 9,
                color: "#f5c518",
                marginTop: 2,
                opacity: hovered ? 1 : 0.5,
                transition: "opacity 0.3s ease",
              }}
            >
              {"★".repeat(film.rating)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function HomeContent() {
  const [watchlist, setWatchlist] = useState<Movie[]>([])
  const [watched, setWatched] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [titleRevealed, setTitleRevealed] = useState(0)
  const [introComplete, setIntroComplete] = useState(false)
  const [creditsPaused, setCreditsPaused] = useState(false)
  const router = useRouter()
  const ambientCacheRef = useRef<Record<string, [number, number, number]>>({})

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const [w, r] = await Promise.all([getWatchlist(), getWatched()])
      setWatchlist(w)
      setWatched(r)
      setLoading(false)
    }
    loadData()
  }, [])

  const heroMovie = watchlist[0] || watched[0] || null

  // Typing effect for hero title
  useEffect(() => {
    if (!heroMovie) return
    const title = heroMovie.title
    let i = 0
    setTitleRevealed(0)
    setIntroComplete(false)
    const interval = setInterval(() => {
      i++
      setTitleRevealed(i)
      if (i >= title.length) {
        clearInterval(interval)
        setTimeout(() => setIntroComplete(true), 800)
      }
    }, 80)
    return () => clearInterval(interval)
  }, [heroMovie?.id])

  const handleAddToWatchlist = async (movie: Movie) => {
    const success = await addToWatchlist(movie)
    if (success) {
      setWatchlist((prev) => [movie, ...prev])
    }
  }

  const polaroidStyles = useMemo(() => {
    return watched.slice(0, 12).map(() => ({
      rotation: (Math.random() - 0.5) * 16,
      offsetX: (Math.random() - 0.5) * 30,
      offsetY: (Math.random() - 0.5) * 20,
    }))
  }, [watched.length])

  if (loading) {
    return (
      <main
        className="relative text-white min-h-screen flex items-center justify-center"
        style={{ background: "#080808" }}
      >
        <p
          style={{
            color: "rgba(255,255,255,0.3)",
            fontStyle: "italic",
            fontFamily: "Georgia, serif",
            fontSize: 16,
          }}
        >
          Loading your cinema...
        </p>
      </main>
    )
  }

  return (
    <main
      className="relative text-white"
      style={{ background: "#080808", minHeight: "100vh" }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes blink {
          50% { border-color: transparent; }
        }
        @keyframes creditsScroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>

      <TopOverlayNav onSearchClick={() => setSearchOpen(true)} />

      {/* Section 1: The Opening */}
      <section
        style={{
          position: "relative",
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {heroMovie && (
          <div
            style={{
              position: "absolute",
              inset: -100,
              backgroundImage: `url(${heroMovie.poster})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(50px) saturate(1.5) brightness(0.4)",
              transform: "scale(1.5)",
              animation: "fadeIn 2s ease-out forwards",
              opacity: 0,
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 10,
            textAlign: "center",
            padding: "0 48px",
          }}
        >
          <div
            style={{
              fontFamily: "-apple-system, sans-serif",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.3em",
              color: "rgba(255,255,255,0.25)",
              marginBottom: 24,
            }}
          >
            F D F S
          </div>

          <h1
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: "clamp(40px, 8vw, 80px)",
              fontWeight: 400,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.9)",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              minHeight: "1.2em",
            }}
          >
            {heroMovie ? heroMovie.title.slice(0, titleRevealed) : ""}
            <span
              style={{
                borderRight:
                  titleRevealed < (heroMovie?.title.length || 0)
                    ? "2px solid rgba(255,255,255,0.5)"
                    : "none",
                animation: "blink 0.8s step-end infinite",
                marginLeft: 2,
              }}
            />
          </h1>

          <p
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 15,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.3)",
              marginTop: 16,
              opacity: introComplete ? 1 : 0,
              transform: introComplete ? "translateY(0)" : "translateY(10px)",
              transition: "opacity 0.8s ease, transform 0.8s ease",
            }}
          >
            {heroMovie
              ? `${heroMovie.language} · ${heroMovie.year} · from your watchlist`
              : ""}
          </p>

          <div
            style={{
              position: "absolute",
              bottom: -120,
              left: "50%",
              transform: "translateX(-50%)",
              opacity: introComplete ? 1 : 0,
              transition: "opacity 1s ease 0.5s",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 1,
                height: 30,
                background:
                  "linear-gradient(to bottom, transparent, rgba(255,255,255,0.2))",
              }}
            />
            <span
              style={{
                fontFamily: "-apple-system, sans-serif",
                fontSize: 8,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.2)",
              }}
            >
              Your cinema awaits
            </span>
          </div>
        </div>
      </section>

      {/* Section 2: Recently Watched — Polaroid Desk */}
      {watched.length > 0 && (
        <section
          style={{
            position: "relative",
            padding: "80px 48px 100px",
            background: "#080808",
            minHeight: "80vh",
          }}
        >
          <div style={{ marginBottom: 48, maxWidth: 500 }}>
            <h2
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 32,
                fontWeight: 400,
                fontStyle: "italic",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              recently watched
            </h2>
            <p
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 13,
                fontStyle: "italic",
                color: "rgba(255,255,255,0.25)",
                marginTop: 8,
              }}
            >
              your film journal
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 32,
              maxWidth: 1200,
            }}
          >
            {watched.slice(0, 12).map((film, i) => (
              <PolaroidCard
                key={film.id}
                film={film}
                rotation={polaroidStyles[i]?.rotation || 0}
                offsetX={polaroidStyles[i]?.offsetX || 0}
                offsetY={polaroidStyles[i]?.offsetY || 0}
                onClick={() => router.push(`/movie/${film.id}`)}
              />
            ))}
          </div>

          {watched.length > 12 && (
            <div style={{ marginTop: 48, textAlign: "center" }}>
              <a
                href="/library"
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 13,
                  fontStyle: "italic",
                  color: "rgba(255,255,255,0.25)",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  paddingBottom: 2,
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "rgba(255,255,255,0.5)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "rgba(255,255,255,0.25)")
                }
              >
                view your full library →
              </a>
            </div>
          )}
        </section>
      )}

      {/* Section 3: Want to Watch — End Credits Scroll */}
      {watchlist.length > 0 && (
        <section
          style={{
            position: "relative",
            padding: "60px 0",
            background: "#080808",
            overflow: "hidden",
            minHeight: "60vh",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 32,
                fontWeight: 400,
                fontStyle: "italic",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              want to watch
            </h2>
            <p
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 13,
                fontStyle: "italic",
                color: "rgba(255,255,255,0.25)",
                marginTop: 8,
              }}
            >
              your upcoming screenings
            </p>
          </div>

          <div
            style={{
              position: "absolute",
              top: 100,
              left: 0,
              right: 0,
              height: 80,
              background: "linear-gradient(to bottom, #080808, transparent)",
              zIndex: 5,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 80,
              background: "linear-gradient(to top, #080808, transparent)",
              zIndex: 5,
              pointerEvents: "none",
            }}
          />

          <div
            onMouseEnter={() => setCreditsPaused(true)}
            onMouseLeave={() => setCreditsPaused(false)}
            style={{
              height: 400,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                animation: `creditsScroll ${Math.max(watchlist.length * 4, 12)}s linear infinite`,
                animationPlayState: creditsPaused ? "paused" : "running",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {[...watchlist, ...watchlist].map((film, i) => (
                <a
                  key={`${film.id}-${i}`}
                  href={`/movie/${film.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    padding: "16px 48px",
                    textDecoration: "none",
                    transition: "background 0.2s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.03)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <img
                    src={film.poster}
                    alt=""
                    style={{
                      width: 40,
                      height: 60,
                      objectFit: "cover",
                      borderRadius: 3,
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      fontFamily: "Georgia, serif",
                      fontSize: 18,
                      fontWeight: 400,
                      fontStyle: "italic",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    {film.title}
                  </div>
                  <div
                    style={{
                      fontFamily: "-apple-system, sans-serif",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.25)",
                      letterSpacing: "0.08em",
                      flexShrink: 0,
                    }}
                  >
                    {film.language} · {film.year}
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
              marginTop: 32,
              position: "relative",
              zIndex: 10,
            }}
          >
            <a
              href="/watchlist"
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 13,
                fontStyle: "italic",
                color: "rgba(255,255,255,0.25)",
                textDecoration: "none",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                paddingBottom: 2,
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.5)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.25)")
              }
            >
              view the full reel →
            </a>
          </div>
        </section>
      )}

      {/* Section 4: Search */}
      <section
        style={{
          padding: "80px 48px",
          textAlign: "center",
          background: "#080808",
        }}
      >
        <p
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 20,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.4)",
            marginBottom: 24,
          }}
        >
          Looking for something?
        </p>

        <button
          onClick={() => setSearchOpen(true)}
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 15,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.3)",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 999,
            padding: "14px 40px",
            cursor: "pointer",
            transition: "all 0.3s ease",
            minWidth: 300,
            textAlign: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"
            e.currentTarget.style.color = "rgba(255,255,255,0.6)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"
            e.currentTarget.style.color = "rgba(255,255,255,0.3)"
          }}
        >
          Search for a film...
        </button>
      </section>

      {/* Section 5: Footer */}
      <footer
        style={{
          padding: "60px 48px 40px",
          textAlign: "center",
          background: "#080808",
        }}
      >
        <div
          style={{
            width: 30,
            height: 1,
            background: "rgba(255,255,255,0.06)",
            margin: "0 auto 24px",
          }}
        />
        <p
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 12,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.12)",
          }}
        >
          First Day First Show
        </p>
      </footer>

      {searchOpen && (
        <MovieSearch
          onAdd={handleAddToWatchlist}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </main>
  )
}
