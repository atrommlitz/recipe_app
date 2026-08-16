import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { CookMode } from "@/components/CookMode"
import { MULTIPLIERS } from "@/components/RecipeScaler"
import { createClient } from "@/lib/supabase/server"
import type { Ingredient, Recipe, Step } from "@/lib/database.types"

type FullRecipe = Recipe & { ingredients: Ingredient[]; steps: Step[] }

export const metadata: Metadata = { title: "Cooking" }

export default async function CookPage({ params, searchParams }: PageProps<"/recipes/[id]/cook">) {
  const { id } = await params
  const search = await searchParams

  const rawScale = Array.isArray(search?.scale) ? search.scale[0] : search?.scale
  const parsed = Number(rawScale)
  // Carry through whatever multiplier was active on the detail view. Anything
  // outside the toggle's own values falls back to the recipe as written.
  const multiplier = (MULTIPLIERS as readonly number[]).includes(parsed) ? parsed : 1

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

  return (
    <CookMode
      recipeId={recipe.id}
      title={recipe.title}
      steps={recipe.steps}
      ingredients={recipe.ingredients}
      multiplier={multiplier}
    />
  )
}
