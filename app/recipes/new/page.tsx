import type { Metadata } from "next"

import { RecipeForm } from "@/components/RecipeForm"
import { getCookingMethods, getCourses } from "@/lib/queries"
import { emptyRecipe } from "@/lib/schemas"

export const metadata: Metadata = { title: "New recipe" }

export default async function NewRecipePage() {
  const [methods, courses] = await Promise.all([getCookingMethods(), getCourses()])
  return <RecipeForm initial={emptyRecipe} methods={methods} courses={courses} />
}
