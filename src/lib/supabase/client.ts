import { createBrowserClient } from "@supabase/ssr"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function projectRefFromUrl(url: string): string | null {
  return url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null
}

function projectRefFromAnonKey(key: string): string | null {
  try {
    const payload = key.split(".")[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const json =
      typeof atob === "function"
        ? atob(base64)
        : Buffer.from(base64, "base64").toString("utf8")
    return (JSON.parse(json) as { ref?: string }).ref ?? null
  } catch {
    return null
  }
}

if (process.env.NODE_ENV === "development" && supabaseUrl && supabaseKey) {
  const urlRef = projectRefFromUrl(supabaseUrl)
  const keyRef = projectRefFromAnonKey(supabaseKey)
  if (urlRef && keyRef && urlRef !== keyRef) {
    console.error(
      `Supabase config mismatch: URL is for project "${urlRef}" but anon key is for "${keyRef}". Both must come from the same project in Supabase → Settings → API.`,
    )
  }
}

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey)
}

export const supabase = createClient()
