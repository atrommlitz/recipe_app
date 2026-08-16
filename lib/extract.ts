/**
 * Page-content extraction, cheapest path first.
 *
 * 1. JSON-LD schema.org/Recipe — most food blogs publish it, and it is already
 *    structured, so we skip the model for everything except ingredient splitting.
 * 2. OpenGraph tags + readable body text — fed to the model.
 * 3. Nothing usable — the caller falls back to asking for pasted text.
 */

import { splitIntoSteps } from "@/lib/steps"

export type JsonLdRecipe = {
  title: string
  imageUrl: string | null
  servings: number | null
  prepMinutes: number | null
  cookMinutes: number | null
  ingredientLines: string[]
  steps: string[]
  notes: string | null
}

/** "PT1H30M" -> 90. Returns null for anything unparseable. */
export function isoDurationToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null
  const match = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return null
  const [, d, h, m] = match
  const total = Number(d ?? 0) * 1440 + Number(h ?? 0) * 60 + Number(m ?? 0)
  return total > 0 ? total : null
}

function firstNumber(value: unknown): number | null {
  if (typeof value === "number") return Math.round(value)
  if (Array.isArray(value)) return firstNumber(value[0])
  if (typeof value === "string") {
    const match = value.match(/\d+/)
    return match ? Number(match[0]) : null
  }
  return null
}

function pickImage(value: unknown): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return pickImage(value[0])
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    if (typeof obj.url === "string") return obj.url
  }
  return null
}

function flattenInstructions(value: unknown, out: string[] = []): string[] {
  if (!value) return out

  if (typeof value === "string") {
    // Plenty of sites dump the whole method into one string — split it so
    // each instruction lands as its own step rather than one wall of text.
    out.push(...splitIntoSteps(decodeEntities(stripTags(value))))
    return out
  }

  if (Array.isArray(value)) {
    for (const entry of value) flattenInstructions(entry, out)
    return out
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const type = String(obj["@type"] ?? "")

    if (type.includes("HowToSection") && obj.itemListElement) {
      flattenInstructions(obj.itemListElement, out)
      return out
    }

    const text = obj.text ?? obj.name
    if (typeof text === "string") {
      out.push(...splitIntoSteps(decodeEntities(stripTags(text))))
    }
  }

  return out
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ")
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
}

/** Walks a JSON-LD blob (object, array, or @graph) looking for a Recipe node. */
function findRecipeNode(node: unknown, depth = 0): Record<string, unknown> | null {
  if (!node || depth > 6) return null

  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findRecipeNode(entry, depth + 1)
      if (found) return found
    }
    return null
  }

  if (typeof node !== "object") return null
  const obj = node as Record<string, unknown>

  const type = obj["@type"]
  const types = Array.isArray(type) ? type.map(String) : [String(type ?? "")]
  if (types.some((t) => t.toLowerCase() === "recipe")) return obj

  if (obj["@graph"]) return findRecipeNode(obj["@graph"], depth + 1)

  return null
}

export function extractJsonLdRecipe(html: string): JsonLdRecipe | null {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    let data: unknown
    try {
      data = JSON.parse(block[1].trim())
    } catch {
      continue // Malformed JSON-LD is common; just try the next block.
    }

    const node = findRecipeNode(data)
    if (!node) continue

    const ingredientLines = (
      Array.isArray(node.recipeIngredient)
        ? node.recipeIngredient
        : Array.isArray(node.ingredients)
          ? node.ingredients
          : []
    )
      .map((line: unknown) => decodeEntities(stripTags(String(line))).trim())
      .filter(Boolean)

    const steps = flattenInstructions(node.recipeInstructions)

    if (ingredientLines.length === 0 && steps.length === 0) continue

    const title = decodeEntities(stripTags(String(node.name ?? ""))).trim()
    const description = node.description
      ? decodeEntities(stripTags(String(node.description))).trim()
      : null

    return {
      title: title || "Untitled recipe",
      imageUrl: pickImage(node.image),
      servings: firstNumber(node.recipeYield),
      prepMinutes: isoDurationToMinutes(node.prepTime),
      cookMinutes:
        isoDurationToMinutes(node.cookTime) ??
        isoDurationToMinutes(node.totalTime),
      ingredientLines,
      steps,
      notes: description,
    }
  }

  return null
}

export function extractOpenGraph(html: string) {
  const meta = (property: string) => {
    const pattern = new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
      "i",
    )
    const alt = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
      "i",
    )
    const match = html.match(pattern) ?? html.match(alt)
    return match ? decodeEntities(match[1]).trim() : null
  }

  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)

  return {
    title: meta("og:title") ?? (titleTag ? decodeEntities(titleTag[1]).trim() : null),
    description: meta("og:description") ?? meta("description"),
    image: meta("og:image"),
  }
}

/** Rough readable-text pass: drop scripts, styles and nav chrome, then untag. */
export function htmlToText(html: string): string {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n")

  // Decode per line — decodeEntities collapses all whitespace, so running it
  // over the whole string would flatten the newlines inserted above.
  return stripTags(body)
    .split("\n")
    .map((line) => decodeEntities(line).trim())
    .filter(Boolean)
    .join("\n")
}
