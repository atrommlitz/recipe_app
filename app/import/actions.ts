"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import type { EditableRecipe } from "@/lib/schemas"

export type ImportFailure = { title: string; error: string }
export type ImportResult = { imported: number; failed: ImportFailure[] }

/**
 * Inserts a chunk of already-parsed recipes. One failure does not abort the
 * chunk — the importer reports exactly which recipes didn't make it.
 */
export async function importRecipes(recipes: EditableRecipe[]): Promise<ImportResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { imported: 0, failed: [{ title: "—", error: "Not signed in." }] }

  let imported = 0
  const failed: ImportFailure[] = []

  for (const recipe of recipes) {
    const title = recipe.title?.trim() || "Untitled recipe"

    try {
      const { data, error } = await supabase
        .from("recipes")
        .insert({
          title,
          servings: recipe.servings,
          prep_time_minutes: recipe.prep_time_minutes,
          cook_time_minutes: recipe.cook_time_minutes,
          notes: recipe.notes?.trim() || null,
          image_url: recipe.image_url,
          source_url: recipe.source_url,
        })
        .select("id")
        .single()

      if (error || !data) throw new Error(error?.message ?? "Insert failed.")

      const ingredients = recipe.ingredients
        .filter((i) => i.item?.trim())
        .map((i, index) => ({
          recipe_id: data.id,
          quantity: i.quantity,
          unit: i.unit?.trim() || null,
          item: i.item.trim(),
          sort_order: index,
        }))

      if (ingredients.length > 0) {
        const { error: ingredientError } = await supabase
          .from("ingredients")
          .insert(ingredients)
        if (ingredientError) throw new Error(ingredientError.message)
      }

      const steps = recipe.steps
        .map((s) => s.trim())
        .filter(Boolean)
        .map((instruction, index) => ({
          recipe_id: data.id,
          instruction,
          step_number: index + 1,
        }))

      if (steps.length > 0) {
        const { error: stepError } = await supabase.from("steps").insert(steps)
        if (stepError) throw new Error(stepError.message)
      }

      imported++
    } catch (e) {
      failed.push({ title, error: e instanceof Error ? e.message : "Unknown error" })
    }
  }

  revalidatePath("/")
  return { imported, failed }
}
