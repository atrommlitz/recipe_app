"use client"

import Link from "next/link"
import { useRef, useState } from "react"

import { buttonPrimary, buttonQuiet } from "@/components/ui"
import { importRecipes, type ImportFailure } from "@/app/import/actions"
import { prepareImage, type PreparedImage } from "@/lib/image"
import { uploadImage } from "@/lib/upload"
import type { CookingMethod } from "@/lib/database.types"
import type { EditableRecipe } from "@/lib/schemas"

const MAX_PHOTOS = 40
const INSERT_CHUNK = 20

type Phase = "idle" | "preparing" | "reading" | "saving" | "done" | "error"

/**
 * One photo in, one recipe out — the opposite of the single-recipe importer,
 * where several photos are pages of the same dish.
 *
 * Each photo needs its own model call because each is a different recipe, so
 * this is the slowest importer by design. It runs them one at a time with a
 * visible count rather than firing everything at once, and a photo that fails
 * to parse is reported by name instead of taking the batch down.
 */
export function BulkPhotoImport({ methods }: { methods: CookingMethod[] }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<{ image: PreparedImage; name: string }[]>([])
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState(0)
  const [failed, setFailed] = useState<ImportFailure[]>([])

  const methodIdByName = new Map(methods.map((m) => [m.name.toLowerCase(), m.id]))

  async function addFiles(files: FileList) {
    setError(null)
    const room = MAX_PHOTOS - photos.length
    if (room <= 0) {
      setError(`That's the ${MAX_PHOTOS}-photo limit for one batch.`)
      return
    }

    setPhase("preparing")
    try {
      const prepared: { image: PreparedImage; name: string }[] = []
      const chosen = Array.from(files).slice(0, room)
      for (const [i, file] of chosen.entries()) {
        setProgress({ done: i, total: chosen.length })
        prepared.push({ image: await prepareImage(file), name: file.name })
      }
      setPhotos((current) => [...current, ...prepared])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read those images.")
    } finally {
      setPhase("idle")
    }
  }

  async function run() {
    if (photos.length === 0) return

    setError(null)
    setImported(0)
    setFailed([])
    setPhase("reading")
    setProgress({ done: 0, total: photos.length })

    const drafts: EditableRecipe[] = []
    const failures: ImportFailure[] = []

    for (const [index, photo] of photos.entries()) {
      try {
        const response = await fetch("/api/import/photo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ images: [photo.image.base64] }),
        })
        const data = await response.json()

        if (!response.ok) {
          // A missing key or an expired session will fail every remaining
          // photo the same way, so stop rather than burn through the batch.
          if (response.status === 503 || response.status === 401) {
            setError(data.error ?? "Import failed.")
            setPhase("error")
            return
          }
          failures.push({ title: photo.name, error: data.error ?? "Couldn't read it" })
        } else {
          const recipe = data.recipe as EditableRecipe
          // Keep the photo as the recipe's image — it's what you'll recognise
          // it by in the grid.
          let imageUrl: string | null = null
          try {
            const blob = await (await fetch(photo.image.dataUrl)).blob()
            imageUrl = await uploadImage(blob, "page.jpg")
          } catch {
            // A missing image isn't worth losing the recipe over.
          }

          drafts.push({
            ...recipe,
            image_url: imageUrl,
            cooking_method_ids:
              recipe.cooking_method_ids ??
              (recipe.cooking_methods ?? [])
                .map((name) => methodIdByName.get(name.toLowerCase()))
                .filter((id): id is string => Boolean(id)),
          })
        }
      } catch {
        failures.push({ title: photo.name, error: "Network error" })
      }

      setProgress({ done: index + 1, total: photos.length })
    }

    setPhase("saving")
    setProgress({ done: 0, total: drafts.length })

    let total = 0
    for (let start = 0; start < drafts.length; start += INSERT_CHUNK) {
      const chunk = drafts.slice(start, start + INSERT_CHUNK)
      const result = await importRecipes(chunk)
      total += result.imported
      failures.push(...result.failed)
      setProgress({ done: Math.min(start + INSERT_CHUNK, drafts.length), total: drafts.length })
    }

    setImported(total)
    setFailed(failures)
    setPhase("done")
  }

  const busy = phase === "preparing" || phase === "reading" || phase === "saving"

  const label: Record<Phase, string> = {
    idle: "",
    preparing: `Preparing photos… ${progress.done} of ${progress.total}`,
    reading: `Reading recipe ${progress.done + (progress.done < progress.total ? 1 : 0)} of ${progress.total}…`,
    saving: `Saving… ${progress.done} of ${progress.total}`,
    done: "",
    error: "",
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-28 sm:px-6">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
        Bulk photo import
      </h1>
      <p className="mt-2 text-ink-mute">
        One photo per recipe. Pick a whole stack of recipe cards or cookbook
        pages and each becomes its own recipe.{" "}
        <span className="text-ink">
          If a single recipe spans two pages, use{" "}
          <Link href="/import/photo" className="text-accent hover:underline">
            Snap a photo
          </Link>{" "}
          instead
        </span>{" "}
        — that reads several photos as one dish.
      </p>

      {phase !== "done" ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className={buttonQuiet}
            >
              {photos.length === 0 ? "Choose photos" : "Add more"}
            </button>

            <button
              type="button"
              disabled={busy || photos.length === 0}
              onClick={run}
              className={buttonPrimary}
            >
              {busy
                ? "Working…"
                : `Import ${photos.length || ""} ${photos.length === 1 ? "recipe" : "recipes"}`}
            </button>

            {photos.length > 0 && !busy ? (
              <button
                type="button"
                onClick={() => setPhotos([])}
                className="text-sm text-ink-mute hover:text-alert"
              >
                Clear
              </button>
            ) : null}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(e.target.files)
              e.target.value = ""
            }}
          />

          {photos.length > 0 ? (
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {photos.map((photo, index) => (
                <li
                  key={index}
                  className="relative overflow-hidden rounded-[2px] border border-rule"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.image.dataUrl}
                    alt={photo.name}
                    className="aspect-[3/4] w-full object-cover"
                  />
                  {!busy ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPhotos((current) => current.filter((_, i) => i !== index))
                      }
                      aria-label={`Remove ${photo.name}`}
                      className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-[2px] bg-ink/80 text-ground"
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {busy ? (
        <div className="mt-6 rounded-[2px] border border-rule bg-card p-4">
          <p className="tnum text-sm text-ink">{label[phase]}</p>
          {progress.total > 0 ? (
            <div className="mt-2 h-1 w-full bg-ground">
              <div
                className="h-1 bg-accent transition-[width]"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          ) : null}
          <p className="mt-2 text-xs text-ink-mute">
            Each photo is read separately, so a big batch takes a while. Keep this
            tab open.
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-6 text-sm text-alert">
          {error}
        </p>
      ) : null}

      {phase === "done" ? (
        <div className="mt-6 rounded-[2px] border border-rule bg-card p-4">
          <h2 className="font-display text-lg font-bold text-ink">
            Imported {imported} {imported === 1 ? "recipe" : "recipes"}
            {failed.length > 0 ? `, ${failed.length} failed` : ""}
          </h2>

          {failed.length > 0 ? (
            <ul className="mt-3 space-y-1 border-t border-rule pt-3 text-sm">
              {failed.map((f, i) => (
                <li key={i} className="text-ink-mute">
                  <span className="text-alert">{f.title}</span> — {f.error}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/" className={buttonPrimary}>
              See the recipes
            </Link>
            <button
              type="button"
              onClick={() => {
                setPhotos([])
                setPhase("idle")
              }}
              className={buttonQuiet}
            >
              Import another batch
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
