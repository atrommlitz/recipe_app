import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { RecipeForm } from "@/components/RecipeForm"
import { createClient } from "@/lib/supabase/server"
import { getCookingMethods } from "@/lib/queries"
import type { EditableRecipe } from "@/lib/schemas"
import type { CookingMethod, Ingredient, Recipe, Step } from "@/lib/database.types"

type FullRecipe = Recipe & {
  ingredients: Ingredient[]
  steps: Step[]
  cooking_methods: CookingMethod[]
}

export const metadata: Metadata = { title: "Edit recipe" }

export default async function EditRecipePage({
  params,
}: PageProps<"/recipes/[id]/edit">) {
  const { id } = await params

  const supabase = await createClient()
  const [{ data }, methods] = await Promise.all([
    supabase
      .from("recipes")
      .select("*, ingredients(*), steps(*), cooking_methods(id, name, sort_order)")
      .eq("id", id)
      .order("sort_order", { referencedTable: "ingredients", ascending: true })
      .order("step_number", { referencedTable: "steps", ascending: true })
      .maybeSingle(),
    getCookingMethods(),
  ])

  const recipe = data as FullRecipe | null
  if (!recipe) notFound()

  const initial: EditableRecipe = {
    title: recipe.title,
    servings: recipe.servings,
    prep_time_minutes: recipe.prep_time_minutes,
    cook_time_minutes: recipe.cook_time_minutes,
    notes: recipe.notes,
    image_url: recipe.image_url,
    source_url: recipe.source_url,
    ingredients: recipe.ingredients.map((i) => ({
      quantity: i.quantity,
      unit: i.unit,
      item: i.item,
    })),
    steps: recipe.steps.map((s) => s.instruction),
    cooking_method_ids: recipe.cooking_methods.map((m) => m.id),
  }

  return (
    <RecipeForm
      recipeId={recipe.id}
      initial={initial}
      methods={methods}
      submitLabel="Save changes"
    />
  )
}
