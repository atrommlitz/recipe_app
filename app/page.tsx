import Link from "next/link"

import { RecipeBrowser } from "@/components/RecipeBrowser"
import { buttonPrimary, buttonQuiet } from "@/components/ui"
import { getCookingMethods, getCourses, getGridRecipes } from "@/lib/queries"

export default async function HomePage() {
  const [{ recipes, error }, methods, courses] = await Promise.all([
    getGridRecipes(),
    getCookingMethods(),
    getCourses(),
  ])

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <p className="text-alert">Couldn&apos;t load recipes: {error}</p>
      </div>
    )
  }

  if (recipes.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-2xl font-extrabold text-ink">
          Nothing in the box yet
        </h1>
        <p className="mt-2 text-ink-mute">
          Write one out by hand, snap a photo of a cookbook page, paste a link, or
          bring the whole Paprika library across in one go.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/recipes/new" className={buttonPrimary}>
            Add a recipe
          </Link>
          <Link href="/import/photo" className={buttonQuiet}>
            Snap a photo
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

  return <RecipeBrowser recipes={recipes} methods={methods} courses={courses} />
}
