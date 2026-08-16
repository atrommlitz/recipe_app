"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Manual override for cover art.
 *
 * Recipes get a cover automatically when they arrive without a usable photo,
 * so this is for the two cases automation can't judge: the generated picture
 * isn't right, or a real photo you'd rather replace. Always regenerates.
 */
export function CoverButton({ recipeId }: { recipeId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setBusy(true)
    setError(null)

    try {
      const response = await fetch("/api/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId, force: true }),
      })
      const body = await response.json()

      if (!response.ok) {
        setError(typeof body.error === "string" ? body.error : "Couldn't make a photo.")
        return
      }
      router.refresh()
    } catch {
      setError("Couldn't reach the server.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="text-ink-mute hover:text-accent disabled:opacity-50"
      >
        {busy ? "Making a photo…" : "New photo"}
      </button>
      {error ? <span className="text-xs text-alert">{error}</span> : null}
    </>
  )
}
