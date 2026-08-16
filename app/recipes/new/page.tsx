import type { Metadata } from "next"

import { RecipeForm } from "@/components/RecipeForm"
import { emptyRecipe } from "@/lib/schemas"

export const metadata: Metadata = { title: "New recipe" }

export default function NewRecipePage() {
  return <RecipeForm initial={emptyRecipe} />
}
