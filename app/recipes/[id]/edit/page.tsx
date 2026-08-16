import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { RecipeForm } from "@/components/RecipeForm"
import { createClient } from "@/lib/supabase/server"
import type { EditableRecipe } from "@/lib/schemas"
import type { Ingredient, Recipe, Step } from "@/lib/database.types"

type FullRecipe = Recipe & { ingredients: Ingredient[]; steps: Step[] }

export const metadata: Metadata = { title: "Edit recipe" }

export default async function EditRecipePage({
  params,
}: PageProps<"/recipes/[id]/edit">) {
  const { id } = await params

  const supabase = await createClient()
  const { data } = await supabase
    .from("recipes")
    .select("*, ingredients(*), steps(*)")
    .eq("id", id)
    .order("sort_order", { referencedTable: "ingredients", ascending: true })
    .order("step_number", { referencedTable: "steps", ascending: true })
    .maybeSingle()

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
  }

  return <RecipeForm recipeId={recipe.id} initial={initial} submitLabel="Save changes" />
}
