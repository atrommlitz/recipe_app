import { createClient } from "@/lib/supabase/server"
import type { CookingMethod, Course, Recipe } from "@/lib/database.types"

/**
 * Everything the grid needs in one round trip: methods for the filter chips
 * and badges, ingredient names for search, and cook dates for the "haven't
 * made this in a while" picker.
 *
 * Fetching it all up front lets search and filtering run entirely client-side,
 * which is what makes them feel instant. At household scale (hundreds of
 * recipes) the payload is small; if this library ever grew into the thousands,
 * this is the query to move server-side.
 */
export type GridIngredient = {
  quantity: number | null
  unit: string | null
  item: string
  sort_order: number
}

export type GridRecipe = Recipe & {
  cooking_methods: CookingMethod[]
  courses: Course[]
  // Steps ride along so the Paprika export can be built without a round trip:
  // the iOS share sheet must open from the click, and awaiting a fetch first
  // can lose the user gesture.
  steps: { instruction: string; step_number: number }[]
  // Full ingredient rows, not just names: search needs the names, the grocery
  // list needs the quantities and units.
  ingredients: GridIngredient[]
  cook_log: { cooked_at: string }[]
}

export async function getGridRecipes(): Promise<{
  recipes: GridRecipe[]
  error: string | null
  /**
   * Reference timestamp for anything relative ("not cooked in 30 days").
   * Read here rather than in a component so it isn't a render-phase side
   * effect — this is a plain async function, not a component.
   */
  now: number
}> {
  const now = Date.now()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("recipes")
    .select(
      "*, cooking_methods(id, name, sort_order), courses(id, name, sort_order), ingredients(quantity, unit, item, sort_order), steps(instruction, step_number), cook_log(cooked_at)",
    )
    .order("created_at", { ascending: false })
    .order("sort_order", { referencedTable: "ingredients", ascending: true })
    .order("step_number", { referencedTable: "steps", ascending: true })

  if (error) return { recipes: [], error: error.message, now }
  return { recipes: (data ?? []) as GridRecipe[], error: null, now }
}

export async function getCookingMethods(): Promise<CookingMethod[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("cooking_methods")
    .select("*")
    .order("sort_order", { ascending: true })
  return data ?? []
}

export async function getCourses(): Promise<Course[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("courses")
    .select("*")
    .order("sort_order", { ascending: true })
  return data ?? []
}

/**
 * Resolves names (from the model, or from keyword inference) to seeded row
 * ids. Unknown names are dropped rather than created — both sets are
 * deliberately fixed.
 */
async function idsByName(
  table: "cooking_methods" | "courses",
  names: string[],
): Promise<string[]> {
  if (!names || names.length === 0) return []

  const supabase = await createClient()
  const { data } = await supabase.from(table).select("id, name")
  if (!data) return []

  const byName = new Map(data.map((row) => [row.name.toLowerCase(), row.id]))
  return names
    .map((name) => byName.get(name.trim().toLowerCase()))
    .filter((id): id is string => Boolean(id))
}

export function methodIdsByName(names: string[]) {
  return idsByName("cooking_methods", names)
}

export function courseIdsByName(names: string[]) {
  return idsByName("courses", names)
}

/** Most recent cook date for a recipe, or null if it's never been made. */
export function lastCookedAt(recipe: {
  cook_log: { cooked_at: string }[]
}): Date | null {
  if (!recipe.cook_log || recipe.cook_log.length === 0) return null
  const newest = recipe.cook_log.reduce((max, entry) =>
    entry.cooked_at > max.cooked_at ? entry : max,
  )
  return new Date(newest.cooked_at)
}
