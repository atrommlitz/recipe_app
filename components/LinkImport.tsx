"use client"

import Link from "next/link"
import { useState } from "react"

import { RecipeForm } from "@/components/RecipeForm"
import { buttonPrimary, inputClass, labelClass } from "@/components/ui"
import type { CookingMethod } from "@/lib/database.types"
import type { EditableRecipe } from "@/lib/schemas"

const VIA_LABEL: Record<string, string> = {
  "json-ld": "Read straight from the page's recipe data.",
  model: "Pulled out of the page text by Claude.",
  "pasted-text": "Pulled out of your pasted text by Claude.",
}

export function LinkImport({ methods = [] }: { methods?: CookingMethod[] }) {
  const [url, setUrl] = useState("")
  const [text, setText] = useState("")
  const [showTextarea, setShowTextarea] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditableRecipe | null>(null)
  const [via, setVia] = useState<string | null>(null)

  async function run(usePastedText: boolean) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/import/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim() || undefined,
          text: usePastedText ? text.trim() : undefined,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Import failed.")
        if (data.needsText) setShowTextarea(true)
        return
      }

      setDraft(data.recipe as EditableRecipe)
      setVia(data.via as string)
    } catch {
      setError("Couldn't reach the importer. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  if (draft) {
    return (
      <div>
        <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
          <div className="border border-rule bg-card p-3 rounded-[2px]">
            <p className="text-sm text-ink">
              <span className="eyebrow mr-2">Preview</span>
              {via ? VIA_LABEL[via] : ""} Check it over, fix anything wrong, then
              save.
            </p>
          </div>
        </div>
        <RecipeForm initial={draft} methods={methods} submitLabel="Save recipe" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-safe sm:px-6">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
        Import from a link
      </h1>
      <p className="mt-2 text-ink-mute">
        Works best on recipe blogs and YouTube.{" "}
        <span className="text-ink">
          Instagram and TikTok block automated fetches
        </span>
        , so for those, copy the caption and paste it below.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="url" className={labelClass}>
            Recipe link
          </label>
          <div className="flex gap-2">
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              className={`${inputClass} min-w-0 flex-1`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) void run(false)
              }}
            />
            <button
              type="button"
              disabled={busy || !url.trim()}
              onClick={() => void run(false)}
              className={buttonPrimary}
            >
              {busy ? "Reading…" : "Import"}
            </button>
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-alert">
            {error}
          </p>
        ) : null}

        {showTextarea ? (
          <div className="border-t border-rule pt-4">
            <label htmlFor="paste" className={labelClass}>
              Or paste the recipe text
            </label>
            <textarea
              id="paste"
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the caption or recipe text here…"
              className={`${inputClass} w-full resize-y`}
            />
            <button
              type="button"
              disabled={busy || text.trim().length < 20}
              onClick={() => void run(true)}
              className={`${buttonPrimary} mt-2`}
            >
              {busy ? "Reading…" : "Parse pasted text"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowTextarea(true)}
            className="text-sm text-accent hover:underline"
          >
            Paste the text instead
          </button>
        )}

        <p className="border-t border-rule pt-4 text-sm text-ink-mute">
          Migrating from Paprika?{" "}
          <Link href="/import/paprika" className="text-accent hover:underline">
            Bulk import a .paprikarecipes file
          </Link>
        </p>
      </div>
    </div>
  )
}
