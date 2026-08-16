"use client"

import { useState } from "react"

import type { Ingredient } from "@/lib/database.types"
import { formatQuantity, scaleQuantity } from "@/lib/format"

const MULTIPLIERS = [1, 2, 3, 4] as const

/**
 * The signature element: ingredients as a ruled ledger with a right-aligned
 * tabular quantity column. Scaling is display-only — the multiplier lives in
 * component state and never touches the stored row.
 */
export function RecipeScaler({
  ingredients,
  servings,
}: {
  ingredients: Ingredient[]
  servings: number | null
}) {
  const [multiplier, setMultiplier] = useState<number>(1)

  return (
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
                  "tnum cursor-pointer px-3 py-1.5 text-xs transition-colors",
                  m !== 1 ? "border-l border-rule" : "",
                  active
                    ? "bg-accent text-accent-ink"
                    : "bg-card text-ink-mute hover:text-ink",
                ].join(" ")}
              >
                {m}x
              </button>
            )
          })}
        </div>
      </div>

      {servings ? (
        <p className="tnum mb-3 text-xs text-ink-mute">
          Makes {servings * multiplier} {servings * multiplier === 1 ? "serving" : "servings"}
          {multiplier > 1 ? ` (${servings} × ${multiplier})` : ""}
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
                <span className="tnum shrink-0 text-sm text-ink transition-opacity">
                  {amount}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-ink-mute italic">to taste</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
