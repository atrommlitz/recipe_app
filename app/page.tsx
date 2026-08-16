import Link from "next/link"

import { AddRecipeButton } from "@/components/AddRecipeButton"
import { RecipeCard } from "@/components/RecipeCard"
import { buttonPrimary, buttonQuiet } from "@/components/ui"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = await createClient()
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <p className="text-alert">Couldn&apos;t load recipes: {error.message}</p>
      </div>
    )
  }

  if (!recipes || recipes.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-2xl font-extrabold text-ink">
          Nothing in the box yet
        </h1>
        <p className="mt-2 text-ink-mute">
          Write one out by hand, paste a link, or bring the whole Paprika library
          across in one go.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/recipes/new" className={buttonPrimary}>
            Add a recipe
          </Link>
          <Link href="/import/link" className={buttonQuiet}>
            Paste a link
          </Link>
          <Link href="/import/paprika" className={buttonQuiet}>
            Import Paprika
          </Link>
        </div>
      </div>
    )
  }

  // pb-28 keeps the last row clear of the floating add button.
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-28 sm:px-6">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
          Recipes
        </h1>
        <span className="tnum text-xs text-ink-mute">
          {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>

      <AddRecipeButton />
    </div>
  )
}
