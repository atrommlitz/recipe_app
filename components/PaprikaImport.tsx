"use client"

import Link from "next/link"
import { useRef, useState } from "react"

import { buttonPrimary, buttonQuiet } from "@/components/ui"
import { importRecipes, type ImportFailure } from "@/app/import/actions"
import { mapPaprikaRecipe, unpackArchive } from "@/lib/paprika"
import { base64ToBlob, uploadImage } from "@/lib/upload"
import type { CookingMethod, Course } from "@/lib/database.types"
import type { EditableRecipe } from "@/lib/schemas"

// 10 recipes per Claude call turns ~87 calls into ~9.
const PARSE_CHUNK = 10
// Inserts are cheap; bigger chunks just mean fewer round trips.
const INSERT_CHUNK = 20

type Phase = "idle" | "unpacking" | "photos" | "parsing" | "inserting" | "done" | "error"

type Progress = { done: number; total: number }

export function PaprikaImport({
  methods,
  courses,
}: {
  methods: CookingMethod[]
  courses: Course[]
}) {
  const methodIdByName = new Map(methods.map((m) => [m.name.toLowerCase(), m.id]))
  const courseIdByName = new Map(courses.map((c) => [c.name.toLowerCase(), c.id]))

  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState<Progress>({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState(0)
  const [failed, setFailed] = useState<ImportFailure[]>([])
  const [photoFailures, setPhotoFailures] = useState(0)

  async function handleFile(file: File) {
    setError(null)
    setImported(0)
    setFailed([])
    setPhotoFailures(0)

    try {
      // 1 — unpack ------------------------------------------------------
      setPhase("unpacking")
      setProgress({ done: 0, total: 0 })

      const buffer = await file.arrayBuffer()
      const raw = unpackArchive(buffer)

      if (raw.length === 0) {
        setPhase("error")
        setError(
          "No recipes found in that file. Make sure it's the .paprikarecipes export, not a single .paprikarecipe.",
        )
        return
      }

      const mapped = raw.map(mapPaprikaRecipe)

      // 2 — photos ------------------------------------------------------
      setPhase("photos")
      setProgress({ done: 0, total: mapped.length })

      let photoErrors = 0
      const imageUrls: (string | null)[] = []

      for (let i = 0; i < mapped.length; i++) {
        const entry = mapped[i]
        let url = entry.base.image_url

        if (entry.photoBase64) {
          try {
            url = await uploadImage(base64ToBlob(entry.photoBase64))
          } catch {
            // Keep the original image_url if there was one; a missing photo
            // is not a reason to lose the recipe.
            photoErrors++
          }
        }

        imageUrls.push(url)
        setProgress({ done: i + 1, total: mapped.length })
      }
      setPhotoFailures(photoErrors)

      // 3 — parse ingredients -------------------------------------------
      setPhase("parsing")
      setProgress({ done: 0, total: mapped.length })

      const drafts: EditableRecipe[] = []

      for (let start = 0; start < mapped.length; start += PARSE_CHUNK) {
        const slice = mapped.slice(start, start + PARSE_CHUNK)
        const groups = slice.map((entry) => entry.ingredientLines)

        const response = await fetch("/api/import/paprika/parse", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ groups }),
        })
        const data = await response.json()

        if (!response.ok) {
          setPhase("error")
          setError(data.error ?? "Ingredient parsing failed.")
          return
        }

        slice.forEach((entry, index) => {
          drafts.push({
            ...entry.base,
            image_url: imageUrls[start + index],
            ingredients: data.results[index] ?? [],
            cooking_method_ids: entry.methodNames
              .map((name) => methodIdByName.get(name.toLowerCase()))
              .filter((id): id is string => Boolean(id)),
            course_ids: entry.courseNames
              .map((name) => courseIdByName.get(name.toLowerCase()))
              .filter((id): id is string => Boolean(id)),
          })
        })

        setProgress({ done: Math.min(start + PARSE_CHUNK, mapped.length), total: mapped.length })
      }

      // 4 — insert -------------------------------------------------------
      setPhase("inserting")
      setProgress({ done: 0, total: drafts.length })

      let totalImported = 0
      const allFailures: ImportFailure[] = []

      for (let start = 0; start < drafts.length; start += INSERT_CHUNK) {
        const chunk = drafts.slice(start, start + INSERT_CHUNK)
        const result = await importRecipes(chunk)
        totalImported += result.imported
        allFailures.push(...result.failed)
        setProgress({
          done: Math.min(start + INSERT_CHUNK, drafts.length),
          total: drafts.length,
        })
      }

      setImported(totalImported)
      setFailed(allFailures)
      setPhase("done")
    } catch (e) {
      setPhase("error")
      setError(e instanceof Error ? e.message : "Import failed.")
    }
  }

  const busy = ["unpacking", "photos", "parsing", "inserting"].includes(phase)

  const phaseLabel: Record<Phase, string> = {
    idle: "",
    unpacking: "Unpacking the archive…",
    photos: `Uploading photos… ${progress.done} of ${progress.total}`,
    parsing: `Splitting ingredients… ${progress.done} of ${progress.total}`,
    inserting: `Saving recipes… ${progress.done} of ${progress.total}`,
    done: "",
    error: "",
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-safe sm:px-6">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
        Import from Paprika
      </h1>
      <p className="mt-2 text-ink-mute">
        In Paprika: <span className="text-ink">File → Export → Paprika Recipe Format</span>,
        then pick the <code className="tnum text-ink">.paprikarecipes</code> file here.
        Everything is unpacked in your browser, so the size of the archive doesn&apos;t
        matter.
      </p>

      <div className="mt-6">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={buttonPrimary}
        >
          {busy ? "Working…" : "Choose .paprikarecipes file"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".paprikarecipes,.zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ""
          }}
        />
      </div>

      {busy ? (
        <div className="mt-6 border border-rule bg-card p-4 rounded-card">
          <p className="tnum text-sm text-ink">{phaseLabel[phase]}</p>
          {progress.total > 0 ? (
            <div className="mt-2 h-1 w-full bg-ground">
              <div
                className="h-1 bg-accent transition-[width]"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          ) : null}
          <p className="mt-2 text-xs text-ink-mute">
            Keep this tab open until it finishes.
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-6 text-sm text-alert">
          {error}
        </p>
      ) : null}

      {phase === "done" ? (
        <div className="mt-6 border border-rule bg-card p-4 rounded-card">
          <h2 className="font-display text-lg font-bold text-ink">
            Imported {imported} {imported === 1 ? "recipe" : "recipes"}
            {failed.length > 0 ? `, ${failed.length} failed` : ""}
          </h2>

          {photoFailures > 0 ? (
            <p className="mt-1 text-sm text-ink-mute">
              {photoFailures} {photoFailures === 1 ? "photo" : "photos"} couldn&apos;t be
              uploaded. Those recipes came across without an image.
            </p>
          ) : null}

          {failed.length > 0 ? (
            <ul className="mt-3 space-y-1 border-t border-rule pt-3 text-sm">
              {failed.map((f, i) => (
                <li key={i} className="text-ink-mute">
                  <span className="text-alert">{f.title}</span> — {f.error}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex gap-2">
            <Link href="/" className={buttonPrimary}>
              See the recipes
            </Link>
            <button
              type="button"
              onClick={() => setPhase("idle")}
              className={buttonQuiet}
            >
              Import another file
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
