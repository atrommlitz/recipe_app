"use client"

import Link from "next/link"
import { useState } from "react"

import { Toast, useToast } from "@/components/Toast"
import { buttonPrimary, buttonQuiet } from "@/components/ui"
import { buildGroceryList, copyText } from "@/lib/grocery"
import { formatQuantity, scaleLabel, scaleQuantity } from "@/lib/format"
import type { Ingredient } from "@/lib/database.types"

/** Half steps from the recipe as written up to triple. */
export const MULTIPLIERS = [1, 1.5, 2, 2.5, 3] as const

/**
 * Owns the multiplier, so everything that depends on it lives here: the
 * ingredient ledger, the grocery list, and the hand-off into cook mode.
 * Scaling is display-only — it never touches the stored rows.
 */
export function RecipeScaler({
  recipeId,
  title,
  ingredients,
  servings,
  hasSteps,
}: {
  recipeId: string
  title: string
  ingredients: Ingredient[]
  servings: number | null
  hasSteps: boolean
}) {
  const [multiplier, setMultiplier] = useState<number>(1)
  const [toast, setToast] = useToast()

  async function copyGroceryList() {
    const list = buildGroceryList([{ title, ingredients }], multiplier)
    const ok = await copyText(list)
    setToast(
      ok
        ? `Copied${multiplier !== 1 ? ` ${scaleLabel(multiplier)}` : ""} to clipboard`
        : "Couldn't copy — check clipboard permissions",
    )
  }

  return (
    <>
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="eyebrow !text-ink-mute">Ingredients</h2>

          <div
            role="group"
            aria-label="Scale ingredient quantities"
            className="flex overflow-hidden rounded-[2px] border border-rule"
          >
            {MULTIPLIERS.map((m) => {
              const active = m === multiplier
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMultiplier(m)}
                  className={[
                    "tnum cursor-pointer px-2.5 py-1.5 text-xs transition-colors",
                    m !== 1 ? "border-l border-rule" : "",
                    active
                      ? "bg-accent text-accent-ink"
                      : "bg-card text-ink-mute hover:text-ink",
                  ].join(" ")}
                >
                  {scaleLabel(m)}
                </button>
              )
            })}
          </div>
        </div>

        {servings ? (
          <p className="tnum mb-3 text-xs text-ink-mute">
            {/* Half steps can land on a fraction: 3 servings at 1.5x is 4½. */}
            Makes {formatQuantity(servings * multiplier)}{" "}
            {servings * multiplier === 1 ? "serving" : "servings"}
            {multiplier !== 1 ? ` (${servings} × ${scaleLabel(multiplier).slice(0, -1)})` : ""}
          </p>
        ) : null}

        <ul className="border-t border-rule">
          {ingredients.map((ing) => {
            const scaled = scaleQuantity(ing.quantity, multiplier)
            const amount = [formatQuantity(scaled), ing.unit].filter(Boolean).join(" ")

            return (
              <li
                key={ing.id}
                className="flex items-baseline gap-4 border-b border-rule py-2.5"
              >
                <span className="min-w-0 flex-1 break-words text-ink">{ing.item}</span>
                {amount ? (
                  <span className="tnum shrink-0 text-sm text-ink">{amount}</span>
                ) : (
                  <span className="shrink-0 text-xs text-ink-mute italic">to taste</span>
                )}
              </li>
            )
          })}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          {hasSteps ? (
            <Link
              href={`/recipes/${recipeId}/cook?scale=${multiplier}`}
              className={buttonPrimary}
            >
              Start cooking
            </Link>
          ) : null}
          <button type="button" onClick={copyGroceryList} className={buttonQuiet}>
            Copy grocery list
          </button>
        </div>
      </section>

      <Toast message={toast} />
    </>
  )
}
