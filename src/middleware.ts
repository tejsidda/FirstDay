import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

const AUTH_PATHS = new Set(["/landing", "/auth/callback"])

const PROTECTED_PREFIXES = [
  "/home",
  "/library",
  "/watchlist",
  "/wrapped",
  "/movie",
  "/tv",
  "/test",
]

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/") return true
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (user && AUTH_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL("/home", request.url))
  }

  if (!user && isProtectedPath(pathname)) {
    return NextResponse.redirect(new URL("/landing", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
