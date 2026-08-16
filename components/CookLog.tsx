"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Toast, useToast } from "@/components/Toast"
import { buttonQuiet } from "@/components/ui"
import { deleteCookLogEntry, markCooked } from "@/app/recipes/actions"
import { absoluteDate, relativeDate } from "@/lib/format"
import type { CookLogEntry } from "@/lib/database.types"

export function CookLog({
  recipeId,
  entries,
}: {
  recipeId: string
  entries: CookLogEntry[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showHistory, setShowHistory] = useState(false)
  const [toast, setToast] = useToast()

  // Newest first — the server orders these, but sort defensively.
  const sorted = [...entries].sort((a, b) => b.cooked_at.localeCompare(a.cooked_at))
  const last = sorted[0]

  function handleMarkCooked() {
    startTransition(async () => {
      const result = await markCooked(recipeId)
      if ("error" in result) {
        setToast(result.error)
        return
      }
      setToast("Logged — nice one")
      router.refresh()
    })
  }

  function handleDelete(entryId: string) {
    startTransition(async () => {
      const result = await deleteCookLogEntry(entryId, recipeId)
      if ("error" in result) {
        setToast(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <section className="mt-8 border-t border-rule pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Last cooked</span>
          <p className="text-ink">
            {relativeDate(last?.cooked_at)}
            {sorted.length > 0 ? (
              <span className="tnum ml-2 text-xs text-ink-mute">
                {sorted.length}
                {sorted.length === 1 ? " time" : " times"}
              </span>
            ) : null}
          </p>
        </div>

        <button
          type="button"
          onClick={handleMarkCooked}
          disabled={pending}
          className={buttonQuiet}
        >
          {pending ? "Saving…" : "Mark as cooked"}
        </button>
      </div>

      {sorted.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
            className="text-sm text-accent hover:underline"
          >
            {showHistory ? "Hide history" : `Show history (${sorted.length})`}
          </button>

          {showHistory ? (
            <ul className="mt-2 border-t border-rule">
              {sorted.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-4 border-b border-rule py-2"
                >
                  <span className="tnum text-sm text-ink">
                    {absoluteDate(entry.cooked_at)}
                    <span className="ml-2 text-ink-mute">
                      {relativeDate(entry.cooked_at)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    disabled={pending}
                    aria-label={`Remove cook log entry from ${absoluteDate(entry.cooked_at)}`}
                    className="shrink-0 px-2 text-ink-mute hover:text-alert"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Toast message={toast} />
    </section>
  )
}
