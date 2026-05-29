import { NextResponse } from "next/server"

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const TMDB_TOKEN = process.env.TMDB_TOKEN ?? process.env.NEXT_PUBLIC_TMDB_TOKEN
const TMDB_BASE = "https://api.themoviedb.org/3"

const LANG_MAP: Record<string, string> = {
  ml: "Malayalam",
  ko: "Korean",
  te: "Telugu",
  ta: "Tamil",
  hi: "Hindi",
  ja: "Japanese",
  en: "English",
  kn: "Kannada",
  id: "Indonesian",
}

export async function POST(request: Request) {
  try {
    if (!ANTHROPIC_KEY || !TMDB_TOKEN) {
      return NextResponse.json({ recommendations: [] })
    }

    const { watched, watchlist } = await request.json()
    const wl = Array.isArray(watchlist) ? watchlist : []

    if (!watched || watched.length === 0) {
      return NextResponse.json({ recommendations: [] })
    }

    // Step 1: User language preferences from watched
    const langCounts: Record<string, number> = {}
    watched.forEach((m: { language?: string }) => {
      const lang = m.language || "Unknown"
      langCounts[lang] = (langCounts[lang] || 0) + 1
    })
    const topLanguages = Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang]) => lang)

    const reverseLangMap: Record<string, string> = {}
    Object.entries(LANG_MAP).forEach(([code, name]) => {
      reverseLangMap[name] = code
    })

    // Step 2: TMDB discover candidates per top languages
    const candidatePromises = topLanguages.slice(0, 2).map(async (lang) => {
      const code = reverseLangMap[lang] || lang.toLowerCase().slice(0, 2)
      const url = `${TMDB_BASE}/discover/movie?with_original_language=${code}&sort_by=vote_average.desc&vote_count.gte=50&page=1&language=en-US`
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${TMDB_TOKEN}`,
          "Content-Type": "application/json",
        },
      })
      const data = await res.json()
      return (data.results || []).slice(0, 20)
    })

    const candidateArrays = await Promise.all(candidatePromises)
    const allCandidates = candidateArrays.flat()

    // Deduplicate by TMDB id
    const seenIds = new Set<string>()
    const uniqueCandidates: { id: number; title: string; original_language?: string; release_date?: string; overview?: string }[] = []
    for (const m of allCandidates) {
      const id = String(m.id)
      if (seenIds.has(id)) continue
      seenIds.add(id)
      uniqueCandidates.push(m)
    }

    const watchedIds = new Set(watched.map((m: { id: string }) => String(m.id)))
    const watchlistIds = new Set(wl.map((m: { id: string }) => String(m.id)))
    const candidates = uniqueCandidates.filter(
      (m) => !watchedIds.has(String(m.id)) && !watchlistIds.has(String(m.id))
    )

    if (candidates.length === 0) {
      return NextResponse.json({ recommendations: [] })
    }

    // Step 3: Prompt for Claude
    const userProfile = watched
      .filter((m: { rating?: number }) => m.rating != null && m.rating >= 8)
      .slice(0, 10)
      .map((m: { title: string; language?: string; year?: number; rating?: number; reviewHeadline?: string }) => {
        let line = `- "${m.title}" (${m.language}, ${m.year}) — rated ${m.rating}/10`
        if (m.reviewHeadline) line += ` — "${m.reviewHeadline}"`
        return line
      })
      .join("\n")

    if (!userProfile.trim()) {
      // No highly-rated films to anchor taste — still try with all watched
      const fallbackProfile = watched
        .slice(0, 10)
        .map((m: { title: string; language?: string; year?: number; rating?: number; reviewHeadline?: string }) => {
          let line = `- "${m.title}" (${m.language}, ${m.year})`
          if (m.rating != null) line += ` — rated ${m.rating}/10`
          if (m.reviewHeadline) line += ` — "${m.reviewHeadline}"`
          return line
        })
        .join("\n")
      if (!fallbackProfile.trim()) {
        return NextResponse.json({ recommendations: [] })
      }
    }

    const profileBlock =
      userProfile.trim() ||
      watched
        .slice(0, 10)
        .map((m: { title: string; language?: string; year?: number; rating?: number; reviewHeadline?: string }) => {
          let line = `- "${m.title}" (${m.language}, ${m.year})`
          if (m.rating != null) line += ` — rated ${m.rating}/10`
          if (m.reviewHeadline) line += ` — "${m.reviewHeadline}"`
          return line
        })
        .join("\n")

    const candidateList = candidates
      .slice(0, 30)
      .map((m) => {
        const lang = LANG_MAP[m.original_language || ""] || m.original_language || "Unknown"
        const year = m.release_date ? m.release_date.split("-")[0] : "Unknown"
        return `- ID:${m.id} "${m.title}" (${lang}, ${year}) — ${(m.overview || "").slice(0, 100)}`
      })
      .join("\n")

    const prompt = `You are a film recommendation engine for a personal movie diary app. The user has watched and loved these films:

${profileBlock}

From the following list of films they haven't seen, pick the 25 they would most likely love. Consider the emotional tone of their reviews and their language preferences.

Candidate films:
${candidateList}

Return exactly 25 film recommendations as a JSON array. No other text, no markdown, no explanation outside the JSON. Each object must have:
- "tmdbId": the ID number as a string
- "title": the film title
- "reason": a short, personal reason (1-2 sentences) written as if you're a friend recommending a film. Use the emotional language from their reviews. Be warm and specific, not generic.

Respond ONLY with the JSON array (exactly 25 objects). Example format:
[{"tmdbId":"123","title":"Film Name","reason":"If you felt warmth watching X, this one hits the same way."}]`

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error("Anthropic API error:", anthropicRes.status, errText)
      return NextResponse.json({ recommendations: [] })
    }

    const anthropicData = await anthropicRes.json()
    const responseText = anthropicData.content?.[0]?.text || "[]"

    let recommendations: { tmdbId?: string; title?: string; reason?: string }[] = []
    try {
      const cleaned = responseText.replace(/```json|```/g, "").trim()
      const parsed = JSON.parse(cleaned)
      recommendations = Array.isArray(parsed) ? parsed : []
    } catch {
      console.error("Failed to parse recommendations:", responseText)
      return NextResponse.json({ recommendations: [] })
    }

    const enriched = await Promise.all(
      recommendations.map(async (rec) => {
        const tmdbId = rec.tmdbId != null ? String(rec.tmdbId) : ""
        if (!tmdbId) {
          return {
            title: rec.title || "",
            tmdbId: "",
            year: 0,
            language: "",
            poster: "",
            backdrop: "",
            reason: rec.reason || "",
          }
        }
        try {
          const detailRes = await fetch(`${TMDB_BASE}/movie/${tmdbId}?language=en-US`, {
            headers: {
              Authorization: `Bearer ${TMDB_TOKEN}`,
              "Content-Type": "application/json",
            },
          })
          const detail = await detailRes.json()
          const posterPath = detail.poster_path
            ? `https://image.tmdb.org/t/p/w500${detail.poster_path}`
            : ""
          const backdropPath = detail.backdrop_path
            ? `https://image.tmdb.org/t/p/w780${detail.backdrop_path}`
            : ""
          return {
            title: rec.title || detail.title || "",
            tmdbId,
            year: detail.release_date ? parseInt(detail.release_date.split("-")[0], 10) : 0,
            language: LANG_MAP[detail.original_language] || detail.original_language || "",
            poster: posterPath,
            backdrop: backdropPath,
            reason: rec.reason || "",
          }
        } catch {
          return {
            title: rec.title || "",
            tmdbId,
            poster: "",
            backdrop: "",
            year: 0,
            language: "",
            reason: rec.reason || "",
          }
        }
      })
    )

    const valid = enriched.filter((r) => r.tmdbId)
    return NextResponse.json({ recommendations: valid })
  } catch (error) {
    console.error("Recommendation error:", error)
    return NextResponse.json({ recommendations: [] })
  }
}
