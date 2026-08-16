import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { CookLog } from "@/components/CookLog"
import { MethodBadge } from "@/components/MethodChip"
import { RecipeScaler } from "@/components/RecipeScaler"
import { createClient } from "@/lib/supabase/server"
import { formatMinutes } from "@/lib/format"
import type {
  CookLogEntry,
  CookingMethod,
  Course,
  Ingredient,
  Recipe,
  Step,
} from "@/lib/database.types"

type FullRecipe = Recipe & {
  ingredients: Ingredient[]
  steps: Step[]
  cooking_methods: CookingMethod[]
  courses: Course[]
  cook_log: CookLogEntry[]
}

async function getRecipe(id: string): Promise<FullRecipe | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("recipes")
    .select(
      "*, ingredients(*), steps(*), cooking_methods(id, name, sort_order), courses(id, name, sort_order), cook_log(*)",
    )
    .eq("id", id)
    .order("sort_order", { referencedTable: "ingredients", ascending: true })
    .order("step_number", { referencedTable: "steps", ascending: true })
    .order("cooked_at", { referencedTable: "cook_log", ascending: false })
    .maybeSingle()

  return (data as FullRecipe | null) ?? null
}

export async function generateMetadata({
  params,
}: PageProps<"/recipes/[id]">): Promise<Metadata> {
  const { id } = await params
  const recipe = await getRecipe(id)
  return { title: recipe?.title ?? "Recipe" }
}

export default async function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  const { id } = await params
  const recipe = await getRecipe(id)

  if (!recipe) notFound()

  const meta = [
    recipe.servings ? `Serves ${recipe.servings}` : null,
    recipe.prep_time_minutes ? `${formatMinutes(recipe.prep_time_minutes)} prep` : null,
    recipe.cook_time_minutes ? `${formatMinutes(recipe.cook_time_minutes)} cook` : null,
  ].filter(Boolean)

  // Course first — it says more at a glance than the equipment does.
  const tags = [
    ...[...recipe.courses].sort((a, b) => a.sort_order - b.sort_order),
    ...[...recipe.cooking_methods].sort((a, b) => a.sort_order - b.sort_order),
  ]

  return (
    <article className="pb-28">
      {recipe.image_url ? (
        <div className="relative aspect-[16/10] w-full bg-card sm:aspect-[21/9]">
          <Image
            src={recipe.image_url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <header className="border-b border-rule pb-5">
          <h1 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-4xl">
            {recipe.title}
          </h1>

          {meta.length > 0 ? (
            <p className="tnum mt-2 text-xs text-ink-mute">{meta.join("  ·  ")}</p>
          ) : null}

          {tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((m) => (
                <MethodBadge key={m.id} name={m.name} />
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <Link
              href={`/recipes/${recipe.id}/edit`}
              className="text-accent hover:underline"
            >
              Edit
            </Link>
            {recipe.source_url ? (
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-mute hover:text-ink"
              >
                Source ↗
              </a>
            ) : null}
          </div>
        </header>

        <div className="mt-8">
          <RecipeScaler
            recipeId={recipe.id}
            title={recipe.title}
            ingredients={recipe.ingredients}
            servings={recipe.servings}
            hasSteps={recipe.steps.length > 0}
          />
        </div>

        {recipe.steps.length > 0 ? (
          <section className="mt-10">
            <h2 className="eyebrow !text-ink-mute mb-3">Instructions</h2>
            <ol className="border-t border-rule">
              {recipe.steps.map((step, index) => (
                <li key={step.id} className="flex gap-4 border-b border-rule py-4">
                  <span className="tnum shrink-0 pt-0.5 text-sm text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="min-w-0 flex-1 leading-relaxed text-ink">
                    {step.instruction}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {recipe.notes ? (
          <section className="mt-10">
            <h2 className="eyebrow !text-ink-mute mb-3">Notes</h2>
            <p className="whitespace-pre-wrap leading-relaxed text-ink">
              {recipe.notes}
            </p>
          </section>
        ) : null}

        <CookLog recipeId={recipe.id} entries={recipe.cook_log} />
      </div>
    </article>
  )
}
