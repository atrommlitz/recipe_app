"use client"

import Image from "next/image"
import Link from "next/link"

import { MethodBadge } from "@/components/MethodChip"
import type { CookingMethod, Recipe } from "@/lib/database.types"
import { formatTotalTime } from "@/lib/format"

type CardRecipe = Recipe & { cooking_methods?: CookingMethod[] }

function CardBody({ recipe }: { recipe: CardRecipe }) {
  const time = formatTotalTime(recipe.prep_time_minutes, recipe.cook_time_minutes)
  const meta = [recipe.servings ? `Serves ${recipe.servings}` : null, time]
    .filter(Boolean)
    .join("  ·  ")

  const methods = [...(recipe.cooking_methods ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  )

  return (
    <>
      <div className="relative aspect-[4/3] bg-ground">
        {recipe.image_url ? (
          <Image
            src={recipe.image_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 340px, (min-width: 640px) 45vw, 92vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="eyebrow">No photo</span>
          </div>
        )}
      </div>

      <div className="border-t border-rule px-3 py-3">
        <h2 className="font-display text-lg font-bold leading-tight text-ink">
          {recipe.title}
        </h2>
        {meta ? <p className="tnum mt-1 text-xs text-ink-mute">{meta}</p> : null}
        {methods.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {methods.map((m) => (
              <MethodBadge key={m.id} name={m.name} />
            ))}
          </div>
        ) : null}
      </div>
    </>
  )
}

export function RecipeCard({
  recipe,
  selectable = false,
  selected = false,
  onSelect,
}: {
  recipe: CardRecipe
  selectable?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
}) {
  const shell =
    "group relative block overflow-hidden rounded-[2px] border bg-card text-left transition-colors"

  // In selection mode the card picks rather than navigates, so tapping a card
  // while building a grocery list never yanks you off the page.
  if (selectable) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect?.(recipe.id)}
        className={`${shell} w-full ${
          selected ? "border-accent" : "border-rule hover:border-ink-mute"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-[2px] border text-xs ${
            selected
              ? "border-accent bg-accent text-accent-ink"
              : "border-rule bg-card text-transparent"
          }`}
        >
          ✓
        </span>
        <CardBody recipe={recipe} />
      </button>
    )
  }

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className={`${shell} border-rule hover:border-ink-mute [&_h2]:group-hover:text-accent`}
    >
      <CardBody recipe={recipe} />
    </Link>
  )
}
