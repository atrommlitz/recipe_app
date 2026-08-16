"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { ImageUpload } from "@/components/ImageUpload"
import { MethodToggle } from "@/components/MethodChip"
import type { CookingMethod } from "@/lib/database.types"
import {
  buttonDanger,
  buttonPrimary,
  buttonQuiet,
  inputClass,
  labelClass,
} from "@/components/ui"
import { deleteRecipe, saveRecipe } from "@/app/recipes/actions"
import { formatQuantity, parseQuantity } from "@/lib/format"
import type { EditableRecipe } from "@/lib/schemas"

type IngredientRow = { key: string; quantity: string; unit: string; item: string }
type StepRow = { key: string; text: string }

const newKey = () => crypto.randomUUID()

function toIngredientRows(recipe: EditableRecipe): IngredientRow[] {
  const rows = recipe.ingredients.map((i) => ({
    key: newKey(),
    quantity: formatQuantity(i.quantity),
    unit: i.unit ?? "",
    item: i.item,
  }))
  return rows.length > 0 ? rows : [{ key: newKey(), quantity: "", unit: "", item: "" }]
}

function toStepRows(recipe: EditableRecipe): StepRow[] {
  const rows = recipe.steps.map((text) => ({ key: newKey(), text }))
  return rows.length > 0 ? rows : [{ key: newKey(), text: "" }]
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

function numberOrNull(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export function RecipeForm({
  recipeId,
  initial,
  methods = [],
  submitLabel = "Save recipe",
}: {
  recipeId?: string
  initial: EditableRecipe
  methods?: CookingMethod[]
  submitLabel?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [title, setTitle] = useState(initial.title)
  const [imageUrl, setImageUrl] = useState<string | null>(initial.image_url)
  const [sourceUrl, setSourceUrl] = useState(initial.source_url ?? "")
  const [servings, setServings] = useState(initial.servings?.toString() ?? "")
  const [prep, setPrep] = useState(initial.prep_time_minutes?.toString() ?? "")
  const [cook, setCook] = useState(initial.cook_time_minutes?.toString() ?? "")
  const [notes, setNotes] = useState(initial.notes ?? "")
  const [ingredients, setIngredients] = useState<IngredientRow[]>(() =>
    toIngredientRows(initial),
  )
  const [steps, setSteps] = useState<StepRow[]>(() => toStepRows(initial))
  const [methodIds, setMethodIds] = useState<Set<string>>(
    () => new Set(initial.cooking_method_ids ?? []),
  )

  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function handleSave() {
    setError(null)

    const draft: EditableRecipe = {
      title,
      image_url: imageUrl,
      source_url: sourceUrl.trim() || null,
      servings: numberOrNull(servings),
      prep_time_minutes: numberOrNull(prep),
      cook_time_minutes: numberOrNull(cook),
      notes: notes.trim() || null,
      ingredients: ingredients.map((r) => ({
        quantity: parseQuantity(r.quantity),
        unit: r.unit.trim() || null,
        item: r.item,
      })),
      steps: steps.map((s) => s.text),
      cooking_method_ids: [...methodIds],
    }

    startTransition(async () => {
      const result = await saveRecipe(recipeId ?? null, draft)
      if ("error" in result) {
        setError(result.error)
        return
      }
      router.push(`/recipes/${result.id}`)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!recipeId) return
    startTransition(async () => {
      const result = await deleteRecipe(recipeId)
      if (result && "error" in result) setError(result.error)
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-safe sm:px-6">
      <h1 className="mb-6 font-display text-2xl font-extrabold tracking-tight text-ink">
        {recipeId ? "Edit recipe" : "New recipe"}
      </h1>

      <div className="space-y-6">
        <div>
          <label htmlFor="title" className={labelClass}>
            Title
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${inputClass} w-full font-display text-lg font-bold`}
            placeholder="Braised short ribs"
          />
        </div>

        <ImageUpload value={imageUrl} onChange={setImageUrl} />

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="servings" className={labelClass}>
              Serves
            </label>
            <input
              id="servings"
              inputMode="numeric"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className={`${inputClass} w-full tnum`}
            />
          </div>
          <div>
            <label htmlFor="prep" className={labelClass}>
              Prep (min)
            </label>
            <input
              id="prep"
              inputMode="numeric"
              value={prep}
              onChange={(e) => setPrep(e.target.value)}
              className={`${inputClass} w-full tnum`}
            />
          </div>
          <div>
            <label htmlFor="cook" className={labelClass}>
              Cook (min)
            </label>
            <input
              id="cook"
              inputMode="numeric"
              value={cook}
              onChange={(e) => setCook(e.target.value)}
              className={`${inputClass} w-full tnum`}
            />
          </div>
        </div>

        {methods.length > 0 ? (
          <section>
            <span className={labelClass}>How it&apos;s cooked</span>
            <div className="flex flex-wrap gap-1.5">
              {methods.map((method) => (
                <MethodToggle
                  key={method.id}
                  name={method.name}
                  selected={methodIds.has(method.id)}
                  onToggle={() =>
                    setMethodIds((current) => {
                      const next = new Set(current)
                      if (next.has(method.id)) next.delete(method.id)
                      else next.add(method.id)
                      return next
                    })
                  }
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* Ingredients ---------------------------------------------------- */}
        <section>
          <span className={labelClass}>Ingredients</span>
          <ul className="space-y-2">
            {ingredients.map((row, index) => (
              <li key={row.key} className="flex flex-wrap items-start gap-2">
                <input
                  aria-label={`Quantity for ingredient ${index + 1}`}
                  inputMode="decimal"
                  placeholder="1½"
                  value={row.quantity}
                  onChange={(e) =>
                    setIngredients((rows) =>
                      rows.map((r) =>
                        r.key === row.key ? { ...r, quantity: e.target.value } : r,
                      ),
                    )
                  }
                  className={`${inputClass} tnum w-16 shrink-0 text-center`}
                />
                <input
                  aria-label={`Unit for ingredient ${index + 1}`}
                  placeholder="cup"
                  value={row.unit}
                  onChange={(e) =>
                    setIngredients((rows) =>
                      rows.map((r) =>
                        r.key === row.key ? { ...r, unit: e.target.value } : r,
                      ),
                    )
                  }
                  className={`${inputClass} w-20 shrink-0`}
                />
                <input
                  aria-label={`Ingredient ${index + 1}`}
                  placeholder="bone-in short ribs"
                  value={row.item}
                  onChange={(e) =>
                    setIngredients((rows) =>
                      rows.map((r) =>
                        r.key === row.key ? { ...r, item: e.target.value } : r,
                      ),
                    )
                  }
                  className={`${inputClass} order-last w-full sm:order-none sm:w-auto sm:min-w-0 sm:flex-1`}
                />
                <div className="ml-auto flex shrink-0 flex-col sm:ml-0">
                  <button
                    type="button"
                    aria-label={`Move ingredient ${index + 1} up`}
                    onClick={() => setIngredients((rows) => move(rows, index, index - 1))}
                    className="px-1 text-xs text-ink-mute hover:text-accent"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ingredient ${index + 1} down`}
                    onClick={() => setIngredients((rows) => move(rows, index, index + 1))}
                    className="px-1 text-xs text-ink-mute hover:text-accent"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ingredient ${index + 1}`}
                  onClick={() =>
                    setIngredients((rows) => rows.filter((r) => r.key !== row.key))
                  }
                  className="shrink-0 px-1 py-2 text-ink-mute hover:text-alert"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              setIngredients((rows) => [
                ...rows,
                { key: newKey(), quantity: "", unit: "", item: "" },
              ])
            }
            className="mt-2 text-sm text-accent hover:underline"
          >
            + Add ingredient
          </button>
        </section>

        {/* Method --------------------------------------------------------- */}
        <section>
          <span className={labelClass}>Method</span>
          <ul className="space-y-2">
            {steps.map((row, index) => (
              <li key={row.key} className="flex items-start gap-2">
                <span className="tnum w-6 shrink-0 pt-2.5 text-xs text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <textarea
                  aria-label={`Step ${index + 1}`}
                  rows={2}
                  value={row.text}
                  onChange={(e) =>
                    setSteps((rows) =>
                      rows.map((r) =>
                        r.key === row.key ? { ...r, text: e.target.value } : r,
                      ),
                    )
                  }
                  className={`${inputClass} min-w-0 flex-1 resize-y`}
                />
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    aria-label={`Move step ${index + 1} up`}
                    onClick={() => setSteps((rows) => move(rows, index, index - 1))}
                    className="px-1 text-xs text-ink-mute hover:text-accent"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move step ${index + 1} down`}
                    onClick={() => setSteps((rows) => move(rows, index, index + 1))}
                    className="px-1 text-xs text-ink-mute hover:text-accent"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  aria-label={`Remove step ${index + 1}`}
                  onClick={() => setSteps((rows) => rows.filter((r) => r.key !== row.key))}
                  className="shrink-0 px-1 py-2 text-ink-mute hover:text-alert"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setSteps((rows) => [...rows, { key: newKey(), text: "" }])}
            className="mt-2 text-sm text-accent hover:underline"
          >
            + Add step
          </button>
        </section>

        <div>
          <label htmlFor="notes" className={labelClass}>
            Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} w-full resize-y`}
            placeholder="Better on day two."
          />
        </div>

        <div>
          <label htmlFor="source" className={labelClass}>
            Source link
          </label>
          <input
            id="source"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className={`${inputClass} w-full`}
            placeholder="https://"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className={buttonPrimary}
          >
            {pending ? "Saving…" : submitLabel}
          </button>

          <button
            type="button"
            onClick={() => router.back()}
            disabled={pending}
            className={buttonQuiet}
          >
            Cancel
          </button>

          {recipeId ? (
            <div className="ml-auto">
              {confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-mute">Delete for good?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={pending}
                    className={buttonDanger}
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="text-sm text-ink-mute hover:text-ink"
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="text-sm text-ink-mute hover:text-alert"
                >
                  Delete
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
