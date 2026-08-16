import { gunzipSync, unzipSync } from "fflate"

import { inferMethods, splitIntoSteps, stripStepMarker } from "@/lib/steps"
import type { EditableRecipe } from "@/lib/schemas"

/**
 * A .paprikarecipes file is a ZIP archive whose entries are each a gzipped
 * JSON document. Everything here runs in the browser: the archives are large
 * once photos are embedded, well past a serverless request body limit.
 */

export type PaprikaRecipe = {
  uid?: string
  name?: string
  ingredients?: string
  directions?: string
  notes?: string
  servings?: string
  prep_time?: string
  cook_time?: string
  source?: string
  source_url?: string
  image_url?: string
  photo?: string
  photo_data?: string
}

export function unpackArchive(buffer: ArrayBuffer): PaprikaRecipe[] {
  const entries = unzipSync(new Uint8Array(buffer))
  const recipes: PaprikaRecipe[] = []

  for (const [name, bytes] of Object.entries(entries)) {
    if (name.endsWith("/") || bytes.length === 0) continue

    let json: string
    try {
      // Entries are gzipped; a few exports ship plain JSON, so fall back.
      json = new TextDecoder().decode(gunzipSync(bytes))
    } catch {
      try {
        json = new TextDecoder().decode(bytes)
      } catch {
        continue
      }
    }

    try {
      const parsed = JSON.parse(json)
      if (Array.isArray(parsed)) recipes.push(...parsed)
      else if (parsed && typeof parsed === "object") recipes.push(parsed)
    } catch {
      // Skip anything that isn't a recipe document.
    }
  }

  return recipes
}

/**
 * Paprika stores times as free text: "30 mins", "1 hr 15 min", "1 hour", "45".
 * Plain regex is enough — no reason to spend a model call on this.
 */
export function parseTimeToMinutes(value: string | undefined): number | null {
  if (!value) return null
  const text = value.toLowerCase().trim()
  if (!text) return null

  let minutes = 0
  let matched = false

  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/)
  if (hours) {
    minutes += Number(hours[1]) * 60
    matched = true
  }

  const mins = text.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/)
  if (mins) {
    minutes += Number(mins[1])
    matched = true
  }

  if (!matched) {
    // A bare number is conventionally minutes.
    const bare = text.match(/^(\d+(?:\.\d+)?)$/)
    if (bare) minutes = Number(bare[1])
  }

  const rounded = Math.round(minutes)
  return rounded > 0 ? rounded : null
}

/** "4", "4-6", "Serves 4", "Makes 12 cookies" -> the first whole number. */
export function parseServings(value: string | undefined): number | null {
  if (!value) return null
  const match = value.match(/\d+/)
  if (!match) return null
  const n = Number(match[0])
  return n > 0 ? n : null
}

/** Paprika keeps ingredients as one newline-separated string. */
export function splitLines(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(/\r?\n/)
    .map((line) => stripStepMarker(line))
    .filter((line) => line.length > 0)
}

/**
 * Maps Paprika fields onto our schema. Ingredients are left as raw lines here —
 * the caller sends them through Claude to split into quantity/unit/item.
 *
 * Paprika's `source` (a human-readable site name) has no column in our schema,
 * so it is folded into notes rather than dropped.
 */
export function mapPaprikaRecipe(recipe: PaprikaRecipe): {
  base: Omit<EditableRecipe, "ingredients">
  ingredientLines: string[]
  photoBase64: string | null
  methodNames: string[]
} {
  const notes = [
    recipe.notes?.trim(),
    recipe.source?.trim() ? `Source: ${recipe.source.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")

  const title = recipe.name?.trim() || "Untitled recipe"
  // Handles both the usual one-per-line directions and the occasional
  // single-paragraph blob.
  const steps = splitIntoSteps(recipe.directions)

  return {
    base: {
      title,
      servings: parseServings(recipe.servings),
      prep_time_minutes: parseTimeToMinutes(recipe.prep_time),
      cook_time_minutes: parseTimeToMinutes(recipe.cook_time),
      steps,
      notes: notes || null,
      image_url: recipe.image_url?.trim() || null,
      source_url: recipe.source_url?.trim() || null,
    },
    ingredientLines: splitLines(recipe.ingredients),
    photoBase64: recipe.photo || recipe.photo_data || null,
    // Keyword guess rather than a model call — tagging 87 recipes shouldn't
    // cost 87 extra requests, and these are easy to correct by hand.
    methodNames: inferMethods([title, ...steps].join("\n")),
  }
}
