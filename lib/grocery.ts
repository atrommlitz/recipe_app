import { formatQuantity } from "@/lib/format"

export type GroceryIngredient = {
  quantity: number | null
  unit: string | null
  item: string
}

/**
 * Combines ingredients across one or more recipes into a plain-text list.
 *
 * Combining is exact-match only, on the normalised item name plus unit —
 * "2 cups flour" + "1 cup flour" becomes "3 cups flour", while "onion" and
 * "yellow onion" deliberately stay separate. Fuzzy matching would silently
 * merge things that aren't the same, which is worse than a slightly longer list.
 *
 * Anything with no quantity ("salt, to taste") is listed once, unnumbered.
 */
export function buildGroceryList(
  recipes: { title: string; ingredients: GroceryIngredient[] }[],
  multiplier = 1,
): string {
  type Entry = {
    quantity: number | null
    unit: string | null
    item: string
    unquantified: boolean
  }

  const combined = new Map<string, Entry>()

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const item = ingredient.item.trim()
      if (!item) continue

      const unit = ingredient.unit?.trim() || null
      const key = `${item.toLowerCase()}|${(unit ?? "").toLowerCase()}`
      const scaled =
        ingredient.quantity === null || ingredient.quantity === undefined
          ? null
          : ingredient.quantity * multiplier

      const existing = combined.get(key)

      if (!existing) {
        combined.set(key, {
          quantity: scaled,
          unit,
          item,
          unquantified: scaled === null,
        })
        continue
      }

      // Once any occurrence is unquantified, the total is unknowable — keep
      // the line but drop the number rather than inventing one.
      if (scaled === null || existing.quantity === null) {
        existing.quantity = null
        existing.unquantified = true
      } else {
        existing.quantity += scaled
      }
    }
  }

  return [...combined.values()]
    .map((entry) =>
      [entry.quantity === null ? "" : formatQuantity(entry.quantity), entry.unit, entry.item]
        .filter(Boolean)
        .join(" "),
    )
    .join("\n")
}

/** Writes text to the clipboard, falling back for older mobile browsers. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }

    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}
