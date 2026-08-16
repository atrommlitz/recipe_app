"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useRef, useState } from "react"

import { MethodBadge, MethodToggle } from "@/components/MethodChip"
import { buttonPrimary, buttonQuiet, inputClass, labelClass } from "@/components/ui"
import { formatTotalTime, relativeDate } from "@/lib/format"
import type { CookingMethod } from "@/lib/database.types"
import type { GridRecipe } from "@/lib/queries"

/** "Not cooked in the last N days" presets. 0 means don't filter on it. */
const STALENESS = [
  { label: "Any", days: 0 },
  { label: "Not in 2 weeks", days: 14 },
  { label: "Not in a month", days: 30 },
  { label: "Not in 3 months", days: 90 },
  { label: "Never cooked", days: -1 },
] as const

function lastCooked(recipe: GridRecipe): number | null {
  if (!recipe.cook_log?.length) return null
  return recipe.cook_log.reduce(
    (max, e) => Math.max(max, new Date(e.cooked_at).getTime()),
    0,
  )
}

export function RandomPicker({
  recipes,
  methods,
  now,
}: {
  recipes: GridRecipe[]
  methods: CookingMethod[]
  /**
   * Reference time for the "not cooked in N days" filter, supplied by the
   * server. Reading the clock during render would be impure and could give
   * different answers on different renders.
   */
  now: number
}) {
  const [activeMethods, setActiveMethods] = useState<Set<string>>(new Set())
  const [stalenessDays, setStalenessDays] = useState<number>(0)
  const [picked, setPicked] = useState<GridRecipe | null>(null)
  const [rolling, setRolling] = useState(false)
  const [shuffleTitle, setShuffleTitle] = useState<string>("")
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const pool = useMemo(() => {
    return recipes.filter((recipe) => {
      if (activeMethods.size > 0) {
        if (!recipe.cooking_methods.some((m) => activeMethods.has(m.id))) return false
      }

      if (stalenessDays === 0) return true

      const cooked = lastCooked(recipe)
      if (stalenessDays === -1) return cooked === null
      if (cooked === null) return true // never cooked always qualifies as "stale"
      return now - cooked > stalenessDays * 86_400_000
    })
  }, [recipes, activeMethods, stalenessDays, now])

  function roll() {
    if (pool.length === 0) return

    for (const t of timers.current) clearTimeout(t)
    timers.current = []

    const winner = pool[Math.floor(Math.random() * pool.length)]

    // Brief shuffle before it lands — the whole point of this screen is that
    // it's a small moment, not a database query.
    if (pool.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRolling(true)
      setPicked(null)

      const ticks = 8
      for (let i = 0; i < ticks; i++) {
        timers.current.push(
          setTimeout(() => {
            setShuffleTitle(pool[Math.floor(Math.random() * pool.length)].title)
          }, i * 70),
        )
      }
      timers.current.push(
        setTimeout(() => {
          setRolling(false)
          setPicked(winner)
        }, ticks * 70),
      )
    } else {
      setPicked(winner)
    }
  }

  const time = picked
    ? formatTotalTime(picked.prep_time_minutes, picked.cook_time_minutes)
    : ""

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-28 sm:px-6">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
        What should we make?
      </h1>

      {/* Filters ----------------------------------------------------------- */}
      <div className="mt-6 space-y-4">
        <div>
          <span className={labelClass}>Cooked how</span>
          <div className="flex flex-wrap gap-1.5">
            {methods.map((method) => (
              <MethodToggle
                key={method.id}
                name={method.name}
                selected={activeMethods.has(method.id)}
                onToggle={() =>
                  setActiveMethods((current) => {
                    const next = new Set(current)
                    if (next.has(method.id)) next.delete(method.id)
                    else next.add(method.id)
                    return next
                  })
                }
              />
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="staleness" className={labelClass}>
            Last made
          </label>
          <select
            id="staleness"
            value={stalenessDays}
            onChange={(e) => setStalenessDays(Number(e.target.value))}
            className={`${inputClass} w-full sm:w-auto`}
          >
            {STALENESS.map((option) => (
              <option key={option.label} value={option.days}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
          <button
            type="button"
            onClick={roll}
            disabled={pool.length === 0 || rolling}
            className={buttonPrimary}
          >
            {picked || rolling ? "Pick again" : "Pick one"}
          </button>
          <span className="tnum text-xs text-ink-mute">
            {pool.length} {pool.length === 1 ? "recipe" : "recipes"} in the running
          </span>
        </div>
      </div>

      {/* Result ------------------------------------------------------------ */}
      {rolling ? (
        <div className="mt-8 border border-rule bg-card p-6 text-center rounded-card">
          <p className="font-display text-xl font-bold text-ink-mute">
            {shuffleTitle || "…"}
          </p>
        </div>
      ) : null}

      {picked && !rolling ? (
        <div
          key={picked.id}
          className="mt-8 overflow-hidden border border-rule bg-card rounded-card motion-safe:animate-[pick-in_320ms_ease-out]"
        >
          {picked.image_url ? (
            <div className="relative aspect-[16/9] bg-ground">
              <Image
                src={picked.image_url}
                alt=""
                fill
                sizes="(min-width: 640px) 640px, 92vw"
                className="object-cover"
              />
            </div>
          ) : null}

          <div className="border-t border-rule p-5">
            <h2 className="font-display text-2xl font-extrabold leading-tight text-ink">
              {picked.title}
            </h2>

            <p className="tnum mt-1 text-xs text-ink-mute">
              {[
                picked.servings ? `Serves ${picked.servings}` : null,
                time,
                `Last made ${relativeDate(
                  picked.cook_log?.length
                    ? new Date(lastCooked(picked) as number).toISOString()
                    : null,
                ).toLowerCase()}`,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </p>

            {picked.cooking_methods.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[...picked.cooking_methods]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((m) => (
                    <MethodBadge key={m.id} name={m.name} />
                  ))}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/recipes/${picked.id}`} className={buttonPrimary}>
                Open recipe
              </Link>
              <button type="button" onClick={roll} className={buttonQuiet}>
                Pick again
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pool.length === 0 ? (
        <p className="mt-8 text-ink-mute">
          Nothing matches those filters. Loosen them and try again.
        </p>
      ) : null}
    </div>
  )
}
