import { NextResponse } from "next/server"

const ALLOWED = /^https:\/\/image\.tmdb\.org\//i

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url")
  if (!url || !ALLOWED.test(url)) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json({ error: "Upstream failed" }, { status: 502 })
    }
    const contentType = res.headers.get("content-type") || "image/jpeg"
    const buf = await res.arrayBuffer()
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 })
  }
}
