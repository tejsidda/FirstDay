export function ratingNumber(r: unknown): number | null {
  if (r == null || r === "") return null
  const n = Number(r)
  return Number.isFinite(n) ? n : null
}

export function monthYear(date?: string) {
  if (!date) return "Unknown"
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? "Unknown" : d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

export function todayDateInput(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function dateInputToIso(v: string) {
  const [y, m, d] = v.split("-").map(Number)
  if (!y || !m || !d) return new Date().toISOString()
  return new Date(y, m - 1, d, 12).toISOString()
}

export function backdropSide(index: number, isMobile: boolean): "left" | "right" | "center" {
  if (isMobile) return "center"
  return index % 2 === 0 ? "right" : "left"
}
