import { describe, expect, it } from "vitest"
import {
  backdropSide,
  dateInputToIso,
  monthYear,
  ratingNumber,
  todayDateInput,
} from "./movieDetailUtils"

describe("movieDetailUtils", () => {
  describe("ratingNumber", () => {
    it("returns null for empty values", () => {
      expect(ratingNumber(null)).toBeNull()
      expect(ratingNumber(undefined)).toBeNull()
      expect(ratingNumber("")).toBeNull()
    })

    it("parses numeric ratings", () => {
      expect(ratingNumber(8)).toBe(8)
      expect(ratingNumber("7.5")).toBe(7.5)
    })

    it("returns null for non-finite numbers", () => {
      expect(ratingNumber("n/a")).toBeNull()
      expect(ratingNumber(NaN)).toBeNull()
    })
  })

  describe("monthYear", () => {
    it("formats valid release dates", () => {
      expect(monthYear("1999-10-15")).toBe("October 1999")
    })

    it("returns Unknown for missing or invalid dates", () => {
      expect(monthYear()).toBe("Unknown")
      expect(monthYear("not-a-date")).toBe("Unknown")
    })
  })

  describe("todayDateInput", () => {
    it("formats a date as YYYY-MM-DD", () => {
      expect(todayDateInput(new Date(2026, 6, 13))).toBe("2026-07-13")
    })
  })

  describe("dateInputToIso", () => {
    it("converts a date input to local noon ISO", () => {
      expect(dateInputToIso("2024-03-05")).toBe(new Date(2024, 2, 5, 12).toISOString())
    })

    it("falls back to now for invalid input", () => {
      const before = Date.now()
      const iso = dateInputToIso("bad")
      const after = Date.now()
      const ts = new Date(iso).getTime()
      expect(ts).toBeGreaterThanOrEqual(before)
      expect(ts).toBeLessThanOrEqual(after)
    })
  })

  describe("backdropSide", () => {
    it("keeps mobile backdrops centered", () => {
      expect(backdropSide(0, true)).toBe("center")
      expect(backdropSide(1, true)).toBe("center")
    })

    it("alternates desktop backdrop sides by chapter index", () => {
      expect(backdropSide(0, false)).toBe("right")
      expect(backdropSide(1, false)).toBe("left")
      expect(backdropSide(2, false)).toBe("right")
    })
  })
})
