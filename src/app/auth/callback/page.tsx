"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      )

      if (error) {
        console.error("Auth callback error:", error.message)
        router.replace("/landing")
        return
      }

      router.replace("/home")
    }

    run()
  }, [router])

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#0D0D0F", color: "rgba(255,255,255,0.7)" }}
    >
      <p style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: "italic" }}>
        Signing you in...
      </p>
    </main>
  )
}

