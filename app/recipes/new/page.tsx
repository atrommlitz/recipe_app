import type { Metadata } from "next"

import { RecipeForm } from "@/components/RecipeForm"
import { getCookingMethods } from "@/lib/queries"
import { emptyRecipe } from "@/lib/schemas"

export const metadata: Metadata = { title: "New recipe" }

export default async function NewRecipePage() {
  const methods = await getCookingMethods()
  return <RecipeForm initial={emptyRecipe} methods={methods} />
}
