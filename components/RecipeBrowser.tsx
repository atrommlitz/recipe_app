"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { AddRecipeButton } from "@/components/AddRecipeButton"
import { MethodToggle } from "@/components/MethodChip"
import { RecipeCard } from "@/components/RecipeCard"
import { Toast, useToast } from "@/components/Toast"
import { buttonPrimary, buttonQuiet, inputClass } from "@/components/ui"
import { buildGroceryList, copyText } from "@/lib/grocery"
import type { CookingMethod } from "@/lib/database.types"
import type { GridRecipe } from "@/lib/queries"

/**
 * Search and filtering run over the already-loaded set rather than round
 * tripping to the server, so typing filters the grid on every keystroke.
 */
function matchesSearch(recipe: GridRecipe, terms: string[]): boolean {
  if (terms.length === 0) return true

  const haystack = [
    recipe.title,
    ...recipe.ingredients.map((i) => i.item),
  ]
    .join(" ")
    .toLowerCase()

  // Every term must match somewhere — "chicken broccoli" means both.
  return terms.every((term) => haystack.includes(term))
}

export function RecipeBrowser({
  recipes,
  methods,
}: {
  recipes: GridRecipe[]
  methods: CookingMethod[]
}) {
  const [query, setQuery] = useState("")
  const [activeMethods, setActiveMethods] = useState<Set<string>>(new Set())
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [toast, setToast] = useToast()

  const terms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  )

  const visible = useMemo(
    () =>
      recipes.filter((recipe) => {
        // OR across selected methods: show anything matching any of them.
        if (activeMethods.size > 0) {
          const has = recipe.cooking_methods.some((m) => activeMethods.has(m.id))
          if (!has) return false
        }
        return matchesSearch(recipe, terms)
      }),
    [recipes, activeMethods, terms],
  )

  function toggleMethod(id: string) {
    setActiveMethods((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function copyGroceryList() {
    const chosen = recipes.filter((r) => selected.has(r.id))
    if (chosen.length === 0) return

    const list = buildGroceryList(
      chosen.map((r) => ({ title: r.title, ingredients: r.ingredients })),
    )

    const ok = await copyText(list)
    setToast(
      ok
        ? `Copied ${chosen.length === 1 ? "1 recipe" : `${chosen.length} recipes`} to clipboard`
        : "Couldn't copy — check clipboard permissions",
    )
    if (ok) {
      setSelecting(false)
      setSelected(new Set())
    }
  }

  const filtering = activeMethods.size > 0 || terms.length > 0

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-6">
      {/* Search ------------------------------------------------------------ */}
      <div className="mb-3">
        <label htmlFor="search" className="sr-only">
          Search recipes and ingredients
        </label>
        <input
          id="search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or ingredient…"
          className={`${inputClass} w-full`}
        />
      </div>

      {/* Method filters ---------------------------------------------------- */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {methods.map((method) => (
          <MethodToggle
            key={method.id}
            name={method.name}
            selected={activeMethods.has(method.id)}
            onToggle={() => toggleMethod(method.id)}
          />
        ))}
        {activeMethods.size > 0 ? (
          <button
            type="button"
            onClick={() => setActiveMethods(new Set())}
            className="ml-1 text-xs text-ink-mute hover:text-accent"
          >
            Clear
          </button>
        ) : null}
      </div>

      {/* Header row -------------------------------------------------------- */}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-rule pt-4">
        <span className="tnum text-xs text-ink-mute">
          {visible.length} {visible.length === 1 ? "recipe" : "recipes"}
          {filtering ? ` of ${recipes.length}` : ""}
        </span>

        <div className="flex items-center gap-3 text-sm">
          <Link href="/pick" className="text-accent hover:underline">
            What should we make?
          </Link>
          {selecting ? (
            <button
              type="button"
              onClick={() => {
                setSelecting(false)
                setSelected(new Set())
              }}
              className="text-ink-mute hover:text-ink"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSelecting(true)}
              className="text-ink-mute hover:text-accent"
            >
              Grocery list
            </button>
          )}
        </div>
      </div>

      {selecting ? (
        <p className="mb-4 border border-rule bg-card px-3 py-2 text-sm text-ink-mute rounded-[2px]">
          Tap the recipes you&apos;re shopping for, then copy the combined list.
        </p>
      ) : null}

      {/* Grid -------------------------------------------------------------- */}
      {visible.length === 0 ? (
        <p className="py-16 text-center text-ink-mute">
          Nothing matches that. Try a different ingredient or clear the filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              selectable={selecting}
              selected={selected.has(recipe.id)}
              onSelect={toggleSelected}
            />
          ))}
        </div>
      )}

      {/* Selection action bar ---------------------------------------------- */}
      {selecting && selected.size > 0 ? (
        <div
          className="fixed inset-x-0 z-30 border-t border-rule bg-card px-4 py-3"
          style={{ bottom: 0, paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <span className="tnum text-sm text-ink-mute">
              {selected.size} selected
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className={buttonQuiet}
              >
                Clear
              </button>
              <button type="button" onClick={copyGroceryList} className={buttonPrimary}>
                Copy grocery list
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!selecting ? <AddRecipeButton /> : null}
      <Toast message={toast} />
    </div>
  )
}
