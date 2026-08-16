import Image from "next/image"
import Link from "next/link"

import type { Recipe } from "@/lib/database.types"
import { formatTotalTime } from "@/lib/format"

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const time = formatTotalTime(recipe.prep_time_minutes, recipe.cook_time_minutes)
  const meta = [recipe.servings ? `Serves ${recipe.servings}` : null, time]
    .filter(Boolean)
    .join("  ·  ")

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group block border border-rule bg-card rounded-[2px] overflow-hidden transition-colors hover:border-ink-mute"
    >
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
        <h2 className="font-display text-lg font-bold leading-tight text-ink group-hover:text-accent">
          {recipe.title}
        </h2>
        {meta ? <p className="tnum mt-1 text-xs text-ink-mute">{meta}</p> : null}
      </div>
    </Link>
  )
}
