"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

import { formatQuantity, scaleQuantity } from "@/lib/format"
import type { Ingredient, Step } from "@/lib/database.types"

/**
 * Deliberately the odd screen out: fixed dark ground, oversized type, and
 * nothing on it that isn't the step you're on. Everything is sized for wet
 * hands and a phone propped against the backsplash, so the design system's
 * usual restraint gives way to contrast and tap-target size.
 *
 * Colours are hard-coded rather than tokenised because this view should look
 * the same in light and dark mode — the kitchen doesn't care what your OS is set to.
 */
const GROUND = "#141312"
const PAPER = "#F2EFE4"
const MUTED = "#8C877B"
const ACCENT = "#6E9BE0"

export function CookMode({
  recipeId,
  title,
  steps,
  ingredients,
  multiplier,
}: {
  recipeId: string
  title: string
  steps: Step[]
  ingredients: Ingredient[]
  multiplier: number
}) {
  const [index, setIndex] = useState(0)
  const [showIngredients, setShowIngredients] = useState(false)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

  const total = steps.length
  const atStart = index === 0
  const atEnd = index >= total - 1

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, total - 1)), [total])
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  // Keep the screen awake. Re-acquired on tab focus because the browser drops
  // the lock whenever the page is hidden.
  useEffect(() => {
    let cancelled = false

    async function acquire() {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> }
        }
        if (!nav.wakeLock) return
        const sentinel = await nav.wakeLock.request("screen")
        if (cancelled) {
          void sentinel.release()
          return
        }
        wakeLockRef.current = sentinel
      } catch {
        // Denied or unsupported — cook mode still works, the screen just dims.
      }
    }

    void acquire()

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibility)
      void wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [])

  // Arrow keys for anyone cooking from a laptop on the counter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") next()
      if (e.key === "ArrowLeft") prev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [next, prev])

  if (total === 0) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: GROUND, color: PAPER }}
      >
        <p className="text-xl">This recipe has no method steps yet.</p>
        <Link href={`/recipes/${recipeId}`} className="underline" style={{ color: ACCENT }}>
          Back to the recipe
        </Link>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{
        background: GROUND,
        color: PAPER,
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* Header: just enough to know where you are and how to leave. */}
      <header className="flex items-center justify-between gap-4 px-5 py-4">
        <span className="tnum text-sm" style={{ color: MUTED }}>
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          {multiplier > 1 ? `  ·  ${multiplier}x` : ""}
        </span>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowIngredients((v) => !v)}
            aria-expanded={showIngredients}
            className="text-sm underline underline-offset-4"
            style={{ color: ACCENT }}
          >
            Ingredients
          </button>
          <Link
            href={`/recipes/${recipeId}`}
            aria-label="Exit cook mode"
            className="text-2xl leading-none"
            style={{ color: MUTED }}
          >
            ×
          </Link>
        </div>
      </header>

      {/* Progress: one hairline per step. */}
      <div className="flex gap-1 px-5" aria-hidden="true">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className="h-0.5 flex-1"
            style={{ background: i <= index ? ACCENT : "#332F2A" }}
          />
        ))}
      </div>

      {/* The step. */}
      <main className="flex flex-1 items-center px-5 py-8">
        <p className="font-serif text-[1.75rem] leading-[1.35] sm:text-4xl sm:leading-[1.3]">
          {steps[index].instruction}
        </p>
      </main>

      {/* Oversized controls — assume wet hands and no precision. */}
      <nav
        className="flex gap-3 px-5"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
      >
        <button
          type="button"
          onClick={prev}
          disabled={atStart}
          className="flex-1 rounded-[2px] border py-6 text-lg font-semibold disabled:opacity-30"
          style={{ borderColor: "#3A362F", color: PAPER }}
        >
          Back
        </button>

        {atEnd ? (
          <Link
            href={`/recipes/${recipeId}`}
            className="flex-[2] rounded-[2px] py-6 text-center text-lg font-semibold"
            style={{ background: ACCENT, color: GROUND }}
          >
            Done
          </Link>
        ) : (
          <button
            type="button"
            onClick={next}
            className="flex-[2] rounded-[2px] py-6 text-lg font-semibold"
            style={{ background: ACCENT, color: GROUND }}
          >
            Next
          </button>
        )}
      </nav>

      {/* Ingredient reference, scaled to whatever was active on the detail view. */}
      {showIngredients ? (
        <div
          className="fixed inset-0 z-40 flex flex-col"
          // Fully opaque: even a few percent of transparency lets the bright
          // step text ghost through and the whole thing reads as broken.
          style={{ background: GROUND }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
          >
            <span className="tnum text-sm" style={{ color: MUTED }}>
              {title}
              {multiplier > 1 ? `  ·  ${multiplier}x` : ""}
            </span>
            <button
              type="button"
              onClick={() => setShowIngredients(false)}
              aria-label="Close ingredients"
              className="text-2xl leading-none"
              style={{ color: MUTED }}
            >
              ×
            </button>
          </div>

          <ul className="flex-1 overflow-y-auto px-5 pb-10">
            {ingredients.map((ing) => {
              const amount = [
                formatQuantity(scaleQuantity(ing.quantity, multiplier)),
                ing.unit,
              ]
                .filter(Boolean)
                .join(" ")

              return (
                <li
                  key={ing.id}
                  className="flex items-baseline justify-between gap-4 border-b py-3 text-lg"
                  style={{ borderColor: "#2A2723" }}
                >
                  <span className="min-w-0 flex-1">{ing.item}</span>
                  <span className="tnum shrink-0" style={{ color: amount ? PAPER : MUTED }}>
                    {amount || "to taste"}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
