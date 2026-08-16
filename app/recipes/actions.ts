"use server"

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

  // Tags: replace wholesale, same as ingredients and steps. Undefined means
  // the caller doesn't manage them, so leave whatever is there alone rather
  // than clearing it.
  if (recipe.cooking_method_ids !== undefined) {
    await supabase.from("recipe_cooking_methods").delete().eq("recipe_id", recipeId)

    if (recipe.cooking_method_ids.length > 0) {
      const { error } = await supabase.from("recipe_cooking_methods").insert(
        recipe.cooking_method_ids.map((cooking_method_id) => ({
          recipe_id: recipeId,
          cooking_method_id,
        })),
      )
      if (error) return { error: error.message }
    }
  }

  if (recipe.course_ids !== undefined) {
    await supabase.from("recipe_courses").delete().eq("recipe_id", recipeId)

    if (recipe.course_ids.length > 0) {
      const { error } = await supabase.from("recipe_courses").insert(
        recipe.course_ids.map((course_id) => ({ recipe_id: recipeId, course_id })),
      )
      if (error) return { error: error.message }
    }
  }

  revalidatePath("/")
  revalidatePath(`/recipes/${recipeId}`)
  return { id: recipeId }
}

/** Records that a recipe was made just now. */
export async function markCooked(
  recipeId: string,
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const { error } = await supabase.from("cook_log").insert({ recipe_id: recipeId })
  if (error) return { error: error.message }

  revalidatePath(`/recipes/${recipeId}`)
  revalidatePath("/")
  return { ok: true }
}

/** Removes a cook log entry — for the inevitable accidental tap. */
export async function deleteCookLogEntry(
  entryId: string,
  recipeId: string,
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const { error } = await supabase.from("cook_log").delete().eq("id", entryId)
  if (error) return { error: error.message }

  revalidatePath(`/recipes/${recipeId}`)
  revalidatePath("/")
  return { ok: true }
}

/**
 * Deletes a recipe. Children cascade via their foreign keys.
 *
 * Navigation is left to the caller: the edit page wants to go home afterwards,
 * but deleting from a card on the grid should stay put.
 */
export async function deleteRecipe(
  id: string,
): Promise<{ error: string } | { ok: true }> {
  return deleteRecipes([id])
}

/** Deletes a batch in one round trip — what selection mode sends. */
export async function deleteRecipes(
  ids: string[],
): Promise<{ error: string } | { ok: true }> {
  if (ids.length === 0) return { ok: true }

  const supabase = await createClient()
  const { error } = await supabase.from("recipes").delete().in("id", ids)
  if (error) return { error: error.message }

  revalidatePath("/")
  return { ok: true }
}
