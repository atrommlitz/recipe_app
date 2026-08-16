"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"

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
 * Per-card actions: export and delete.
 *
 * Revealed on hover on pointer devices; on touch, where there is no hover,
 * they stay visible — otherwise they'd be unreachable.
 *
 * Order is trash then menu. In the dense grid the buttons shrink, because a
 * tile is only ~125px wide on a phone.
 */
function CardActions({
  title,
  onDelete,
  onExport,
  busy,
  compact = false,
}: {
  title: string
  onDelete: () => void
  onExport: () => void
  busy: boolean
  compact?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Card actions live inside the card's link, so every one of them has to stop
  // the click from navigating.
  const stop = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const size = compact ? "h-6 w-6" : "h-8 w-8"
  const button = `flex ${size} items-center justify-center rounded-[2px] border border-rule bg-card text-ink-mute`

  if (confirming) {
    return (
      <div
        onClick={stop}
        className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 rounded-[2px] border border-alert bg-card px-1.5 py-1"
      >
        {!compact ? <span className="text-xs text-ink">Delete?</span> : null}
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            stop(e)
            onDelete()
          }}
          className="rounded-[2px] bg-alert px-1.5 py-0.5 text-xs text-accent-ink"
        >
          {busy ? "…" : compact ? "Delete" : "Yes"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            stop(e)
            setConfirming(false)
          }}
          className="px-1 text-xs text-ink-mute hover:text-ink"
        >
          {compact ? "×" : "No"}
        </button>
      </div>
    )
  }

  return (
    <div
      onClick={stop}
      className="absolute top-1.5 right-1.5 z-20 flex items-start gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
    >
      <button
        type="button"
        aria-label={`Delete ${title}`}
        title={`Delete ${title}`}
        onClick={(e) => {
          stop(e)
          setConfirming(true)
        }}
        className={`${button} hover:border-alert hover:text-alert`}
      >
        <svg
          width={compact ? "12" : "14"}
          height={compact ? "12" : "14"}
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 3.5h10M5.5 3.5V2h3v1.5M3.5 3.5l.6 8.5h5.8l.6-8.5M6 6v4M8 6v4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className="relative">
        <button
          type="button"
          aria-label={`More actions for ${title}`}
          aria-expanded={menuOpen}
          onClick={(e) => {
            stop(e)
            setMenuOpen((v) => !v)
          }}
          className={`${button} hover:border-ink-mute hover:text-ink`}
        >
          <svg
            width={compact ? "12" : "14"}
            height={compact ? "12" : "14"}
            viewBox="0 0 14 14"
            aria-hidden="true"
          >
            <circle cx="7" cy="2.5" r="1.3" fill="currentColor" />
            <circle cx="7" cy="7" r="1.3" fill="currentColor" />
            <circle cx="7" cy="11.5" r="1.3" fill="currentColor" />
          </svg>
        </button>

        {menuOpen ? (
          <div className="absolute top-full right-0 z-30 mt-1 min-w-[13rem] rounded-[2px] border border-rule bg-card py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
            <button
              type="button"
              onClick={(e) => {
                stop(e)
                setMenuOpen(false)
                onExport()
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-ground"
            >
              Export as .paprikarecipe
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function RecipeCard({
  recipe,
  view = "grid",
  selectable = false,
  selected = false,
  onSelect,
  onDelete,
  onExport,
  deleting = false,
}: {
  recipe: CardRecipe
  view?: ViewMode
  selectable?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
  onDelete?: (id: string) => void
  onExport?: (id: string) => void
  deleting?: boolean
}) {
  const grid = view === "grid"

  // The dense grid drops the card chrome entirely — photos sit straight on the
  // page, which is what makes a wall of them readable. The list keeps its
  // bordered rows, where the extra metadata has somewhere to live.
  const shell = grid
    ? "group relative block text-left"
    : "group relative block overflow-hidden rounded-[2px] border border-rule bg-card text-left transition-colors hover:border-ink-mute"

  const body = grid ? (
    <GridBody recipe={recipe} selected={selectable && selected} />
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
          !grid && selected ? "!border-accent" : ""
        } ${!grid ? "flex items-stretch gap-3" : ""}`}
      >
        {!grid ? (
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
        ) : null}
        {body}
      </button>
    )
  }

  // ---- Normal mode --------------------------------------------------------
  return (
    <div className={shell}>
      {onDelete && onExport ? (
        <CardActions
          title={recipe.title}
          busy={deleting}
          compact={grid}
          onDelete={() => onDelete(recipe.id)}
          onExport={() => onExport(recipe.id)}
        />
      ) : null}

      <Link
        href={`/recipes/${recipe.id}`}
        className={`block ${!grid ? "flex items-stretch gap-3" : ""} [&_h2]:hover:text-accent`}
      >
        {body}
      </Link>
    </div>
  )
}

/**
 * Dense browse tile: a square photo with the title clamped underneath.
 * No meta line and no badges — at this size they'd be unreadable clutter, and
 * the list view is where that detail belongs.
 */
function GridBody({ recipe, selected }: { recipe: CardRecipe; selected?: boolean }) {
  return (
    <>
      <div
        className={`relative aspect-square overflow-hidden rounded-[2px] bg-card ${
          selected ? "ring-2 ring-accent" : ""
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
          <div className="flex h-full items-center justify-center border border-rule">
            <span className="eyebrow">No photo</span>
          </div>
        )}

        {selected ? (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-[2px] bg-accent text-xs text-accent-ink"
          >
            ✓
          </span>
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
        ) : null}
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
