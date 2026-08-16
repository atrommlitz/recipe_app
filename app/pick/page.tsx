import type { Metadata } from "next"

import { RandomPicker } from "@/components/RandomPicker"
import { getCookingMethods, getGridRecipes } from "@/lib/queries"

export const metadata: Metadata = { title: "What should we make?" }

export default async function PickPage() {
  const [{ recipes, now }, methods] = await Promise.all([
    getGridRecipes(),
    getCookingMethods(),
  ])

  return <RandomPicker recipes={recipes} methods={methods} now={now} />
}
