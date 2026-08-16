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
 * they stay visible — otherwise they'd be unreachable. Both confirm or act in
 * place rather than in a dialog, so a mis-tap costs one more tap, not a modal.
 */
function CardActions({
  title,
  onDelete,
  onExport,
  busy,
}: {
  title: string
  onDelete: () => void
  onExport: () => void
  busy: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Card actions live inside the card's link, so every one of them has to stop
  // the click from navigating.
  const stop = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const button =
    "flex h-8 w-8 items-center justify-center rounded-[2px] border border-rule bg-card text-ink-mute"

  if (confirming) {
    return (
      <div
        onClick={stop}
        className="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-[2px] border border-alert bg-card px-1.5 py-1"
      >
        <span className="text-xs text-ink">Delete?</span>
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            stop(e)
            onDelete()
          }}
          className="rounded-[2px] bg-alert px-1.5 py-0.5 text-xs text-accent-ink"
        >
          {busy ? "…" : "Yes"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            stop(e)
            setConfirming(false)
          }}
          className="px-1 text-xs text-ink-mute hover:text-ink"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <div
      onClick={stop}
      className="absolute top-2 right-2 z-20 flex items-start gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
    >
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
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
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
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M2 3.5h10M5.5 3.5V2h3v1.5M3.5 3.5l.6 8.5h5.8l.6-8.5M6 6v4M8 6v4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
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
  const meta = metaLine(recipe)
  const tags = sortedTags(recipe)

  const shell =
    "group relative block overflow-hidden rounded-[2px] border bg-card text-left transition-colors"

  // ---- Selection mode: the card picks rather than navigates ----------------
  if (selectable) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect?.(recipe.id)}
        className={`${shell} w-full ${
          selected ? "border-accent" : "border-rule hover:border-ink-mute"
        } ${view === "list" ? "flex items-stretch gap-3" : ""}`}
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
        {view === "list" ? (
          <ListBody recipe={recipe} meta={meta} tags={tags} />
        ) : (
          <GridBody recipe={recipe} meta={meta} tags={tags} />
        )}
      </button>
    )
  }

  // ---- Normal mode --------------------------------------------------------
  return (
    <div className={`${shell} border-rule hover:border-ink-mute`}>
      {onDelete && onExport ? (
        <CardActions
          title={recipe.title}
          busy={deleting}
          onDelete={() => onDelete(recipe.id)}
          onExport={() => onExport(recipe.id)}
        />
      ) : null}

      <Link
        href={`/recipes/${recipe.id}`}
        className={`block ${view === "list" ? "flex items-stretch gap-3" : ""} [&_h2]:hover:text-accent`}
      >
        {view === "list" ? (
          <ListBody recipe={recipe} meta={meta} tags={tags} />
        ) : (
          <GridBody recipe={recipe} meta={meta} tags={tags} />
        )}
      </Link>
    </div>
  )
}

function GridBody({
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
        {tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((m) => (
              <MethodBadge key={m.id} name={m.name} />
            ))}
          </div>
        ) : null}
      </div>
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
