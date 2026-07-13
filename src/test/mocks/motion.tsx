import type { ReactNode } from "react"

export function passthrough({ children }: { children?: ReactNode }) {
  return <>{children}</>
}
