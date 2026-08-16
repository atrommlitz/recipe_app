"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useSyncExternalStore, useTransition } from "react"

import { AddRecipeButton } from "@/components/AddRecipeButton"
import { FilterDropdown } from "@/components/FilterDropdown"
import { RecipeCard, type ViewMode } from "@/components/RecipeCard"
import { Toast, useToast } from "@/components/Toast"
import { buttonPrimary, buttonQuiet, inputClass } from "@/components/ui"
import { deleteRecipe } from "@/app/recipes/actions"
import { buildGroceryList, copyText } from "@/lib/grocery"
import { inferProteins, PROTEIN_GROUPS, type ProteinGroup } from "@/lib/protein"
import type { CookingMethod } from "@/lib/database.types"
import type { GridRecipe } from "@/lib/queries"

const VIEW_STORAGE_KEY = "index:view"

/**
 * The layout preference lives in localStorage, which is an external store —
 * reading it in an effect and calling setState would cause a cascading render
 * on every visit. useSyncExternalStore reads it correctly and gives the server
 * a defined snapshot to render, so there's no hydration mismatch either.
 */
const viewListeners = new Set<() => void>()

function subscribeToView(onChange: () => void) {
  viewListeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    viewListeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

function readView(): ViewMode {
  return window.localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "grid"
}

function readServerView(): ViewMode {
  return "grid"
}

function writeView(next: ViewMode) {
  window.localStorage.setItem(VIEW_STORAGE_KEY, next)
  for (const listener of viewListeners) listener()
}

/** Prep-time buckets, in minutes. 0 means no limit. */
const PREP_BUCKETS = [
  { label: "Any", max: 0 },
  { label: "15 min or less", max: 15 },
  { label: "30 min or less", max: 30 },
  { label: "1 hour or less", max: 60 },
] as const

function matchesSearch(recipe: GridRecipe, terms: string[]): boolean {
  if (terms.length === 0) return true
  const haystack = [recipe.title, ...recipe.ingredients.map((i) => i.item)]
    .join(" ")
    .toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

export function RecipeBrowser({
  recipes,
  methods,
}: {
  recipes: GridRecipe[]
  methods: CookingMethod[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [query, setQuery] = useState("")
  const [activeMethods, setActiveMethods] = useState<Set<string>>(new Set())
  const [activeProteins, setActiveProteins] = useState<Set<ProteinGroup>>(new Set())
  const [maxPrep, setMaxPrep] = useState<number>(0)
  const view = useSyncExternalStore(subscribeToView, readView, readServerView)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useToast()

  const terms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  )

  // Protein comes from the ingredient rows, so it's derived once per recipe
  // rather than stored — see lib/protein.ts.
  const proteinsById = useMemo(() => {
    const map = new Map<string, ProteinGroup[]>()
    for (const recipe of recipes) {
      map.set(
        recipe.id,
        inferProteins(recipe.ingredients.map((i) => i.item)),
      )
    }
    return map
  }, [recipes])

  const visible = useMemo(
    () =>
      recipes.filter((recipe) => {
        if (activeMethods.size > 0) {
          if (!recipe.cooking_methods.some((m) => activeMethods.has(m.id))) return false
        }

        if (activeProteins.size > 0) {
          const proteins = proteinsById.get(recipe.id) ?? []
          if (!proteins.some((p) => activeProteins.has(p))) return false
        }

        if (maxPrep > 0) {
          // A recipe with no recorded prep time can't be claimed to be under
          // the limit, so it drops out rather than being assumed quick.
          if (recipe.prep_time_minutes === null) return false
          if (recipe.prep_time_minutes > maxPrep) return false
        }

        return matchesSearch(recipe, terms)
      }),
    [recipes, activeMethods, activeProteins, maxPrep, terms, proteinsById],
  )

  function toggle<T>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) {
    setter((current) => {
      const next = new Set(current)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  async function copyGroceryList() {
    const chosen = recipes.filter((r) => selected.has(r.id))
    if (chosen.length === 0) return

    const ok = await copyText(
      buildGroceryList(chosen.map((r) => ({ title: r.title, ingredients: r.ingredients }))),
    )
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

  function handleDelete(id: string) {
    const recipe = recipes.find((r) => r.id === id)
    setDeletingId(id)
    startTransition(async () => {
      const result = await deleteRecipe(id)
      setDeletingId(null)
      if ("error" in result) {
        setToast(result.error)
        return
      }
      setToast(`Deleted ${recipe?.title ?? "recipe"}`)
      router.refresh()
    })
  }

  const filtering =
    activeMethods.size > 0 || activeProteins.size > 0 || maxPrep > 0 || terms.length > 0

  function clearFilters() {
    setActiveMethods(new Set())
    setActiveProteins(new Set())
    setMaxPrep(0)
    setQuery("")
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-6">
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

      {/* Filters ------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          label="Cooked"
          options={methods.map((m) => ({ value: m.id, label: m.name }))}
          selected={activeMethods}
          onToggle={(id) => toggle(setActiveMethods, id)}
          onClear={() => setActiveMethods(new Set())}
        />

        <FilterDropdown
          label="Protein"
          options={PROTEIN_GROUPS.map((g) => ({ value: g, label: g }))}
          selected={activeProteins}
          onToggle={(g) => toggle(setActiveProteins, g as ProteinGroup)}
          onClear={() => setActiveProteins(new Set())}
        />

        {/* Single-select: the buckets nest, so more than one is meaningless. */}
        <FilterDropdown
          label="Prep"
          multiple={false}
          options={PREP_BUCKETS.map((b) => ({ value: String(b.max), label: b.label }))}
          selected={new Set([String(maxPrep)])}
          onToggle={(value) => setMaxPrep(Number(value))}
          neutralValue="0"
        />
      </div>

      {/* Header row --------------------------------------------------------- */}
      <div className="mt-4 mb-4 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-4">
        <div className="flex items-center gap-3">
          <span className="tnum text-xs text-ink-mute">
            {visible.length} {visible.length === 1 ? "recipe" : "recipes"}
            {filtering ? ` of ${recipes.length}` : ""}
          </span>
          {filtering ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-ink-mute hover:text-accent"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-3 text-sm">
          {/* View toggle */}
          <div
            role="group"
            aria-label="Layout"
            className="flex overflow-hidden rounded-[2px] border border-rule"
          >
            {(["grid", "list"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                aria-label={mode === "grid" ? "Grid view" : "List view"}
                onClick={() => writeView(mode)}
                className={`px-2 py-1 transition-colors ${mode === "list" ? "border-l border-rule" : ""} ${
                  view === mode
                    ? "bg-accent text-accent-ink"
                    : "bg-card text-ink-mute hover:text-ink"
                }`}
              >
                {mode === "grid" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                    <rect x="1" y="1" width="5" height="5" fill="currentColor" />
                    <rect x="8" y="1" width="5" height="5" fill="currentColor" />
                    <rect x="1" y="8" width="5" height="5" fill="currentColor" />
                    <rect x="8" y="8" width="5" height="5" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                    <rect x="1" y="2" width="12" height="2" fill="currentColor" />
                    <rect x="1" y="6" width="12" height="2" fill="currentColor" />
                    <rect x="1" y="10" width="12" height="2" fill="currentColor" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <Link href="/pick" className="text-accent hover:underline">
            Pick one
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
        <p className="mb-4 rounded-[2px] border border-rule bg-card px-3 py-2 text-sm text-ink-mute">
          Tap the recipes you&apos;re shopping for, then copy the combined list.
        </p>
      ) : null}

      {/* Results ------------------------------------------------------------ */}
      {visible.length === 0 ? (
        <p className="py-16 text-center text-ink-mute">
          Nothing matches that. Try a different ingredient or clear the filters.
        </p>
      ) : (
        <div
          className={
            view === "grid"
              ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              : "flex flex-col gap-2"
          }
        >
          {visible.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              view={view}
              selectable={selecting}
              selected={selected.has(recipe.id)}
              onSelect={(id) => toggle(setSelected, id)}
              onDelete={selecting ? undefined : handleDelete}
              deleting={pending && deletingId === recipe.id}
            />
          ))}
        </div>
      )}

      {selecting && selected.size > 0 ? (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-card px-4 py-3"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <span className="tnum text-sm text-ink-mute">{selected.size} selected</span>
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
