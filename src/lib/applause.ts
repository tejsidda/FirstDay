/**
 * Theatre-applause scale: 1 = walked out, 10 = standing ovation.
 * Higher is always better — labels make the metaphor obvious.
 */

export function getApplauseLabel(rating: number | null | undefined): string {
  if (rating == null || Number.isNaN(rating)) return "How much applause?"
  const r = Math.max(1, Math.min(10, rating))

  if (r <= 1.5) return "Walked out early"
  if (r <= 2.5) return "Not worth the ticket"
  if (r <= 3.5) return "Cold silence"
  if (r <= 4.5) return "Polite at best"
  if (r <= 5.5) return "Mixed house"
  if (r <= 6.5) return "Scattered applause"
  if (r <= 7.5) return "Solid applause"
  if (r <= 8.5) return "Roaring approval"
  if (r < 10) return "On their feet"
  return "Standing ovation"
}

export const APPLAUSE_LOW_HINT = "Walked out"
export const APPLAUSE_HIGH_HINT = "Standing ovation"
