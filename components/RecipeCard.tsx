"use client"

import Image from "next/image"
import Link from "next/link"

import { Mark } from "@/components/Mark"
import { MethodBadge } from "@/components/MethodChip"
import type { CookingMethod, Course, Recipe } from "@/lib/database.types"
import { formatTotalTime } from "@/lib/format"

type CardRecipe = Recipe & {
  cooking_methods?: CookingMethod[]
  courses?: Course[]
}

export type ViewMode = "grid" | "list"

function metaLine(recipe: CardRecipe) {
  const time = formatTotalTime(recipe.prep_time_minutes, recipe.cook_time_minutes)
  return [recipe.servings ? `Serves ${recipe.servings}` : null, time]
    .filter(Boolean)
    .join("  ·  ")
}

/** Course first — it's the more useful glance ("Dessert" beats "Oven"). */
function sortedTags(recipe: CardRecipe) {
  return [
    ...[...(recipe.courses ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    ...[...(recipe.cooking_methods ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  ]
}

/**
 * A recipe tile.
 *
 * Cards carry no buttons of their own. Acting on a recipe from the grid goes
 * through selection mode instead, which keeps the wall of photos clean and
 * makes every action work on one recipe or twenty without changing shape.
 */
export function RecipeCard({
  recipe,
  view = "grid",
  selectable = false,
  selected = false,
  onSelect,
}: {
  recipe: CardRecipe
  view?: ViewMode
  selectable?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
}) {
  const grid = view === "grid"

  // The dense grid drops the card chrome entirely — photos sit straight on the
  // page, which is what makes a wall of them readable. The list keeps its
  // bordered rows, where the extra metadata has somewhere to live.
  const shell = grid
    ? "group relative block text-left"
    : "group relative block overflow-hidden rounded-[2px] border border-rule bg-card text-left transition-colors hover:border-ink-mute"

  const body = grid ? (
    <GridBody recipe={recipe} selecting={selectable} selected={selected} />
  ) : (
    <ListBody recipe={recipe} meta={metaLine(recipe)} tags={sortedTags(recipe)} />
  )

  // ---- Selection mode: the card picks rather than navigates ----------------
  if (selectable) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect?.(recipe.id)}
        className={`${shell} w-full ${
          !grid ? `flex items-stretch gap-3 ${selected ? "!border-accent" : ""}` : ""
        }`}
      >
        {!grid ? <Tick selected={selected} className="absolute top-2 right-2 z-10" /> : null}
        {body}
      </button>
    )
  }

  // ---- Normal mode --------------------------------------------------------
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className={`${shell} ${!grid ? "flex items-stretch gap-3" : ""} [&_h2]:hover:text-accent`}
    >
      {body}
    </Link>
  )
}

/**
 * Selection tick, borrowed from the photo-picker convention: an empty ring
 * while a card is selectable, filled once it's chosen.
 */
function Tick({
  selected,
  onPhoto = false,
  className = "",
}: {
  selected: boolean
  onPhoto?: boolean
  className?: string
}) {
  // An empty ring needs different contrast depending on what it sits on: a
  // photo in the grid, the card's own paper in the list.
  const empty = onPhoto
    ? "border-white/70 bg-black/15 backdrop-blur-[2px]"
    : "border-rule bg-ground"

  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
        selected ? "border-accent bg-accent text-accent-ink" : `${empty} text-transparent`
      } ${className}`}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M2.5 6.3 4.8 8.6 9.5 3.9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

/** Stands in for a missing photo, so a tile is never just an empty box. */
function NoPhoto({ size }: { size: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-ground">
      <Mark className={`${size} text-ink/70`} />
    </div>
  )
}

/**
 * Dense browse tile: a square photo with the title clamped underneath.
 * No meta line and no badges — at this size they'd be unreadable clutter, and
 * the list view is where that detail belongs.
 */
function GridBody({
  recipe,
  selecting,
  selected,
}: {
  recipe: CardRecipe
  selecting?: boolean
  selected?: boolean
}) {
  return (
    <>
      <div className="relative aspect-square overflow-hidden rounded-[2px] bg-card">
        {/* Selecting shrinks the tile away from its slot — the photo-picker
            gesture. The tick sits outside this wrapper so it holds still. */}
        <div
          className={`absolute inset-0 transition-transform ${
            selected ? "scale-[0.92]" : ""
          }`}
        >
          {recipe.image_url ? (
            <Image
              src={recipe.image_url}
              alt=""
              fill
              sizes="(min-width: 1024px) 200px, (min-width: 640px) 24vw, 32vw"
              className="object-cover"
            />
          ) : (
            <NoPhoto size="h-1/2 w-1/2" />
          )}
        </div>

        {selecting ? (
          <Tick
            selected={Boolean(selected)}
            onPhoto
            className="absolute right-1.5 bottom-1.5"
          />
        ) : null}
      </div>

      <h2 className="mt-1.5 line-clamp-2 font-display text-[0.8125rem] leading-snug font-bold text-ink sm:text-sm">
        {recipe.title}
      </h2>
    </>
  )
}

function ListBody({
  recipe,
  meta,
  tags,
}: {
  recipe: CardRecipe
  meta: string
  tags: { id: string; name: string }[]
}) {
  return (
    <>
      <div className="relative w-24 shrink-0 self-stretch bg-ground sm:w-32">
        {recipe.image_url ? (
          <Image
            src={recipe.image_url}
            alt=""
            fill
            sizes="128px"
            className="object-cover"
          />
        ) : (
          <NoPhoto size="h-10 w-10" />
        )}
      </div>

      <div className="min-w-0 flex-1 py-3 pr-10">
        <h2 className="font-display text-base font-bold leading-tight text-ink sm:text-lg">
          {recipe.title}
        </h2>
        {meta ? <p className="tnum mt-1 text-xs text-ink-mute">{meta}</p> : null}
        {tags.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tags.map((m) => (
              <MethodBadge key={m.id} name={m.name} />
            ))}
          </div>
        ) : null}
      </div>
    </>
  )
}
