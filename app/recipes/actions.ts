"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import type { EditableRecipe } from "@/lib/schemas"

export type SaveResult = { error: string } | { id: string }

function clean(recipe: EditableRecipe) {
  const ingredients = recipe.ingredients
    .filter((i) => i.item.trim().length > 0)
    .map((i, index) => ({
      quantity: i.quantity,
      unit: i.unit?.trim() || null,
      item: i.item.trim(),
      sort_order: index,
    }))

  const steps = recipe.steps
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((instruction, index) => ({ instruction, step_number: index + 1 }))

  return { ingredients, steps }
}

/**
 * Creates or replaces a recipe and its children. Children are deleted and
 * reinserted rather than diffed — simpler, and ordering stays consistent.
 */
export async function saveRecipe(
  id: string | null,
  recipe: EditableRecipe,
): Promise<SaveResult> {
  const title = recipe.title.trim()
  if (!title) return { error: "Give the recipe a title." }

  const supabase = await createClient()
  const { ingredients, steps } = clean(recipe)

  const row = {
    title,
    servings: recipe.servings,
    prep_time_minutes: recipe.prep_time_minutes,
    cook_time_minutes: recipe.cook_time_minutes,
    notes: recipe.notes?.trim() || null,
    image_url: recipe.image_url,
    source_url: recipe.source_url?.trim() || null,
  }

  let recipeId = id

  if (recipeId) {
    const { error } = await supabase.from("recipes").update(row).eq("id", recipeId)
    if (error) return { error: error.message }

    await supabase.from("ingredients").delete().eq("recipe_id", recipeId)
    await supabase.from("steps").delete().eq("recipe_id", recipeId)
  } else {
    const { data, error } = await supabase
      .from("recipes")
      .insert(row)
      .select("id")
      .single()
    if (error || !data) return { error: error?.message ?? "Could not save the recipe." }
    recipeId = data.id
  }

  if (ingredients.length > 0) {
    const { error } = await supabase
      .from("ingredients")
      .insert(ingredients.map((i) => ({ ...i, recipe_id: recipeId })))
    if (error) return { error: error.message }
  }

  if (steps.length > 0) {
    const { error } = await supabase
      .from("steps")
      .insert(steps.map((s) => ({ ...s, recipe_id: recipeId })))
    if (error) return { error: error.message }
  }

  revalidatePath("/")
  revalidatePath(`/recipes/${recipeId}`)
  return { id: recipeId }
}

export async function deleteRecipe(id: string): Promise<{ error: string } | void> {
  const supabase = await createClient()
  // Ingredients and steps cascade via the foreign key.
  const { error } = await supabase.from("recipes").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/")
  redirect("/")
}
