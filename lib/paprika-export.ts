import { gzipSync } from "fflate"

import { formatMinutes, formatQuantity } from "@/lib/format"

/**
 * Writing a single `.paprikarecipe` — the inverse of the importer.
 *
 * The format is one gzipped JSON document (the plural `.paprikarecipes` is a
 * ZIP of these). Fields mirror what the importer reads, so a recipe exported
 * from here and imported back arrives intact.
 */

export type ExportableRecipe = {
  id: string
  title: string
  servings: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  notes: string | null
  image_url: string | null
  source_url: string | null
  created_at: string | null
  ingredients: { quantity: number | null; unit: string | null; item: string }[]
  steps: { instruction: string; step_number: number }[]
  cooking_methods?: { name: string }[]
  courses?: { name: string }[]
}

/** Paprika writes "YYYY-MM-DD HH:MM:SS" rather than ISO 8601. */
function paprikaDate(value: string | null): string {
  const date = value ? new Date(value) : new Date()
  const safe = Number.isNaN(date.getTime()) ? new Date() : date
  return safe.toISOString().slice(0, 19).replace("T", " ")
}

/** Rebuilds "2 cups flour" from the structured row. */
function ingredientLine(i: {
  quantity: number | null
  unit: string | null
  item: string
}): string {
  return [formatQuantity(i.quantity), i.unit, i.item].filter(Boolean).join(" ")
}

export function toPaprikaJson(recipe: ExportableRecipe): Record<string, unknown> {
  return {
    uid: recipe.id,
    name: recipe.title,
    // Paprika stores both as one newline-separated string.
    ingredients: recipe.ingredients.map(ingredientLine).join("\n"),
    directions: [...recipe.steps]
      .sort((a, b) => a.step_number - b.step_number)
      .map((s) => s.instruction)
      .join("\n"),
    notes: recipe.notes ?? "",
    servings: recipe.servings ? String(recipe.servings) : "",
    prep_time: formatMinutes(recipe.prep_time_minutes),
    cook_time: formatMinutes(recipe.cook_time_minutes),
    source: recipe.source_url ? new URL(recipe.source_url).hostname : "Index",
    source_url: recipe.source_url ?? "",
    image_url: recipe.image_url ?? "",
    // Our tags map onto Paprika's free-form category folders.
    categories: [
      ...(recipe.courses ?? []).map((c) => c.name),
      ...(recipe.cooking_methods ?? []).map((m) => m.name),
    ],
    photo: "",
    photo_hash: "",
    photo_large: null,
    rating: 0,
    difficulty: "",
    nutritional_info: "",
    created: paprikaDate(recipe.created_at),
  }
}

/** Filesystem-safe name derived from the title. */
export function exportFilename(title: string): string {
  const base =
    title
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 60) || "recipe"
  return `${base}.paprikarecipe`
}

export function toPaprikaFile(recipe: ExportableRecipe): File {
  const json = JSON.stringify(toPaprikaJson(recipe))
  const gzipped = gzipSync(new TextEncoder().encode(json))

  // Copy into a plain ArrayBuffer — fflate returns a view over a larger
  // pooled buffer, and handing that straight to File would include the slack.
  const bytes = new Uint8Array(gzipped.length)
  bytes.set(gzipped)

  return new File([bytes], exportFilename(recipe.title), {
    type: "application/gzip",
  })
}

/**
 * Hands the file to the OS share sheet where that's available — on an iPhone
 * that's the AirDrop / Messages / Save to Files menu — and falls back to a
 * plain download elsewhere.
 *
 * Must be called directly from a click: Safari revokes the user gesture if too
 * much async work happens first, which is why the recipe data is already in
 * memory rather than fetched here.
 */
export async function shareOrDownload(file: File): Promise<"shared" | "downloaded"> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
  }

  if (typeof navigator.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return "shared"
    } catch (error) {
      // The user dismissing the sheet is not a failure — don't then dump a
      // download on them.
      if (error instanceof DOMException && error.name === "AbortError") return "shared"
    }
  }

  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return "downloaded"
}
