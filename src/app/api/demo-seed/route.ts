import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { DEMO_SEED } from "@/data/demo-seed"
import {
  DEMO_LIBRARY_LIMIT,
  DEMO_WATCHLIST_LIMIT,
  type DemoPortfolioResponse,
} from "@/lib/demo-portfolio"
import type { MediaItem, Recommendation } from "@/lib/types"

type PortfolioRow = {
  watched: MediaItem[] | null
  watchlist: MediaItem[] | null
  recommendations: Recommendation[] | null
  locked_at: string | null
}

function portfolioResponse(
  row: PortfolioRow | null,
  locked: boolean,
): DemoPortfolioResponse {
  if (!row || !locked) {
    return {
      locked: false,
      watched: [],
      watchlist: [],
      recommendations: DEMO_SEED.recommendations,
    }
  }

  return {
    locked: true,
    lockedAt: row.locked_at,
    watched: row.watched ?? [],
    watchlist: row.watchlist ?? [],
    recommendations:
      row.recommendations?.length
        ? row.recommendations
        : DEMO_SEED.recommendations,
  }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from("demo_portfolio")
    .select("watched, watchlist, recommendations, locked_at")
    .eq("id", 1)
    .maybeSingle()

  if (error) {
    console.error("demo-seed GET:", error.message)
    return NextResponse.json({ locked: false })
  }

  const row = data as PortfolioRow | null
  const isLocked = Boolean(row?.locked_at)

  if (isLocked) {
    return NextResponse.json(portfolioResponse(row, true))
  }

  if (user) {
    return NextResponse.json({
      locked: false,
      lockedAt: null,
      watched: [],
      watchlist: [],
      recommendations: DEMO_SEED.recommendations,
    })
  }

  return NextResponse.json({ locked: false })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const watched = Array.isArray(body.watched) ? body.watched : []
  const watchlist = Array.isArray(body.watchlist) ? body.watchlist : []

  if (watched.length !== DEMO_LIBRARY_LIMIT) {
    return NextResponse.json(
      {
        error: `Demo library must have exactly ${DEMO_LIBRARY_LIMIT} titles (currently ${watched.length}).`,
      },
      { status: 400 },
    )
  }

  if (watchlist.length !== DEMO_WATCHLIST_LIMIT) {
    return NextResponse.json(
      {
        error: `Demo watchlist must have exactly ${DEMO_WATCHLIST_LIMIT} titles (currently ${watchlist.length}).`,
      },
      { status: 400 },
    )
  }

  const { data: existing } = await supabase
    .from("demo_portfolio")
    .select("locked_at")
    .eq("id", 1)
    .maybeSingle()

  if (existing?.locked_at) {
    return NextResponse.json(
      { error: "Demo portfolio is already locked. Unlock before replacing." },
      { status: 409 },
    )
  }

  const { error } = await supabase
    .from("demo_portfolio")
    .update({
      watched,
      watchlist,
      recommendations: DEMO_SEED.recommendations,
      locked_at: new Date().toISOString(),
      locked_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)

  if (error) {
    console.error("demo-seed lock:", error.message)
    return NextResponse.json({ error: "Could not lock demo portfolio." }, { status: 500 })
  }

  return NextResponse.json({
    locked: true,
    watched,
    watchlist,
    recommendations: DEMO_SEED.recommendations,
  })
}

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { error } = await supabase
    .from("demo_portfolio")
    .update({
      watched: [],
      watchlist: [],
      recommendations: [],
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)

  if (error) {
    console.error("demo-seed unlock:", error.message)
    return NextResponse.json({ error: "Could not unlock demo portfolio." }, { status: 500 })
  }

  return NextResponse.json({ locked: false })
}
