import { gzipSync, zipSync } from "fflate"

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
    source: recipe.source_url ? new URL(recipe.source_url).hostname : "Lemonade",
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

  // Copy into a plain ArrayBuffer — fflate returns a view over a larger
  // pooled buffer, and handing that straight to File would include the slack.
  const bytes = detach(gzipSync(new TextEncoder().encode(json)))

  return new File([bytes], exportFilename(recipe.title), {
    type: "application/gzip",
  })
}

/** Strips fflate's view off the pooled buffer it was allocated from. */
function detach(view: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(view.length))
  bytes.set(view)
  return bytes
}

/**
 * Many recipes go out as a `.paprikarecipes` archive — a ZIP of the same
 * gzipped documents, which is exactly what Paprika's own bulk export writes
 * and what this app's importer already reads.
 */
export function toPaprikaArchive(
  recipes: ExportableRecipe[],
  name = "Lemonade recipes",
): File {
  const entries: Record<string, Uint8Array> = {}
  const used = new Map<string, number>()

  for (const recipe of recipes) {
    let entry = exportFilename(recipe.title)
    // Two recipes can share a title; a ZIP can't share an entry name.
    const seen = used.get(entry)
    if (seen !== undefined) {
      used.set(entry, seen + 1)
      entry = entry.replace(/\.paprikarecipe$/, ` (${seen + 1}).paprikarecipe`)
    } else {
      used.set(entry, 0)
    }

    entries[entry] = gzipSync(new TextEncoder().encode(JSON.stringify(toPaprikaJson(recipe))))
  }

  // level 0 — the entries are already gzipped, so deflating again buys nothing.
  const zipped = detach(zipSync(entries, { level: 0 }))

  return new File([zipped], `${name}.paprikarecipes`, { type: "application/zip" })
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
