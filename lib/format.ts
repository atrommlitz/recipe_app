/** Display formatting. Nothing here mutates stored data. */

const VULGAR: Record<string, string> = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
  "1/5": "⅕",
  "2/5": "⅖",
  "3/5": "⅗",
  "4/5": "⅘",
  "1/6": "⅙",
  "5/6": "⅚",
  "1/8": "⅛",
  "3/8": "⅜",
  "5/8": "⅝",
  "7/8": "⅞",
}

/**
 * Denominators a cook actually measures in, in order of preference.
 *
 * Halves, quarters and eighths first because those are the markings on real
 * measuring spoons; thirds because cup sets have them. Sixteenths are last but
 * present so half-scaling lands exactly — 0.125 x 1.5 is 3/16, and showing
 * "3/16 tsp" is more use at the counter than the 0.19 it would otherwise fall
 * back to. Fifths are deliberately absent: they'd win on near-misses like this
 * one and nobody owns a 1/5 teaspoon.
 */
const DENOMINATORS = [2, 4, 3, 8, 16, 6]

/**
 * Renders a quantity the way it would be written on a recipe card:
 * 1.5 -> "1½", 0.75 -> "¾", 0.333 -> "⅓", 2 -> "2", 1.7 -> "1.7".
 * Returns "" for null so "salt, to taste" shows no number at all.
 */
export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ""
  if (value === 0) return "0"

  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)
  const whole = Math.floor(abs)
  const frac = abs - whole

  if (frac < 0.005) return `${sign}${whole}`

  for (const denom of DENOMINATORS) {
    const numer = Math.round(frac * denom)
    if (numer <= 0 || numer >= denom) continue
    if (Math.abs(frac - numer / denom) > 0.02) continue

    const glyph = VULGAR[`${numer}/${denom}`]
    const fraction = glyph ?? `${numer}/${denom}`
    return whole > 0 ? `${sign}${whole}${fraction}` : `${sign}${fraction}`
  }

  // No clean fraction — show at most two decimals, without trailing zeros.
  return `${sign}${parseFloat(abs.toFixed(2))}`
}

const VULGAR_TO_DECIMAL: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
}

/**
 * Parses what a cook would actually type into a quantity box:
 * "1.5", "1/2", "1 1/2", "1½", "½". Returns null for empty or unparseable
 * input so "to taste" ingredients stay quantity-less.
 */
export function parseQuantity(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null

  let text = input.trim()
  if (!text) return null

  // Pull off a trailing vulgar fraction glyph, e.g. "1½".
  let glyphValue = 0
  for (const [glyph, value] of Object.entries(VULGAR_TO_DECIMAL)) {
    if (text.includes(glyph)) {
      glyphValue = value
      text = text.replace(glyph, " ").trim()
      break
    }
  }

  if (!text) return glyphValue || null

  // "1 1/2" or "1/2" or "1.5"
  const mixed = text.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixed) {
    const denom = Number(mixed[3])
    if (denom === 0) return null
    return Number(mixed[1]) + Number(mixed[2]) / denom
  }

  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (fraction) {
    const denom = Number(fraction[2])
    if (denom === 0) return null
    return Number(fraction[1]) / denom
  }

  const plain = Number(text)
  if (!Number.isNaN(plain)) return plain + glyphValue

  return glyphValue || null
}

/** "1x", "1.5x" — no trailing ".0", which would imply precision. */
export function scaleLabel(multiplier: number): string {
  return `${multiplier % 1 === 0 ? multiplier : multiplier.toFixed(1)}x`
}

/** Scales a quantity for display only. Null passes straight through. */
export function scaleQuantity(
  value: number | null | undefined,
  multiplier: number,
): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return value * multiplier
}

/** 90 -> "1 hr 30 min", 45 -> "45 min", 120 -> "2 hr". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes <= 0) return ""
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} hr`
  return `${hours} hr ${mins} min`
}

/**
 * Relative date for the cook log: "Today", "Yesterday", "3 days ago",
 * "2 weeks ago", "5 months ago". Deliberately coarse — nobody needs
 * "13 days ago" to be distinguishable from "2 weeks ago" here.
 */
export function relativeDate(value: string | Date | null | undefined): string {
  if (!value) return "Never"

  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return "Never"

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000)

  if (days < 0) return "Just now"
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 14) return "Last week"
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  if (days < 365) return `${Math.round(days / 30)} months ago`

  const years = Math.round(days / 365)
  return years === 1 ? "A year ago" : `${years} years ago`
}

/** Absolute date for the cook log history list, e.g. "12 Mar 2026". */
export function absoluteDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Total time across prep + cook, or "" when neither is recorded. */
export function formatTotalTime(
  prep: number | null | undefined,
  cook: number | null | undefined,
): string {
  const total = (prep ?? 0) + (cook ?? 0)
  return formatMinutes(total)
}
