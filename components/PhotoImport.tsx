"use client"

import Link from "next/link"
import { useRef, useState } from "react"

import { RecipeForm } from "@/components/RecipeForm"
import { buttonPrimary, buttonQuiet, labelClass } from "@/components/ui"
import { IMAGE_ACCEPT, prepareImage, type PreparedImage } from "@/lib/image"
import type { CookingMethod, Course } from "@/lib/database.types"
import type { EditableRecipe } from "@/lib/schemas"

const MAX_IMAGES = 5

export function PhotoImport({
  methods,
  courses,
}: {
  methods: CookingMethod[]
  courses: Course[]
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<PreparedImage[]>([])
  const [busy, setBusy] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditableRecipe | null>(null)

  async function addFiles(files: FileList) {
    setError(null)
    const room = MAX_IMAGES - images.length
    if (room <= 0) {
      setError(`That's the ${MAX_IMAGES}-photo limit. Remove one to add another.`)
      return
    }

    // HEIC photos are decoded in WebAssembly and take a few seconds each, so
    // this needs to say something rather than just going quiet.
    setPreparing(true)
    setBusy(true)
    try {
      const prepared: PreparedImage[] = []
      for (const file of Array.from(files).slice(0, room)) {
        prepared.push(await prepareImage(file))
      }
      setImages((current) => [...current, ...prepared])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that image.")
    } finally {
      setPreparing(false)
      setBusy(false)
    }
  }

  async function run() {
    if (images.length === 0) return
    setBusy(true)
    setError(null)

    try {
      const response = await fetch("/api/import/photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images: images.map((i) => i.base64) }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Import failed.")
        return
      }
      setDraft(data.recipe as EditableRecipe)
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
          <div className="border border-rule bg-card p-3 rounded-card">
            <p className="text-sm text-ink">
              <span className="eyebrow mr-2">Preview</span>
              Read off your {images.length === 1 ? "photo" : "photos"}. Handwriting and
              tight print trip it up more than typed text does, so give the
              quantities a proper look before saving.
            </p>
          </div>
        </div>
        <RecipeForm
          initial={draft}
          methods={methods}
          courses={courses}
          submitLabel="Save recipe"
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-28 sm:px-6">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
        Snap a photo
      </h1>
      <p className="mt-2 text-ink-mute">
        A cookbook page, a recipe card, a clipping. Add more than one photo if the
        recipe runs across pages — they&apos;ll be read together as a single recipe,
        in the order you add them.
      </p>

      <div className="mt-6">
        <span className={labelClass}>
          Photos {images.length > 0 ? `(${images.length}/${MAX_IMAGES})` : ""}
        </span>

        {images.length > 0 ? (
          <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((image, index) => (
              <li
                key={index}
                className="relative overflow-hidden rounded-card border border-rule"
              >
                {/* Local preview of a canvas-encoded data URL — next/image
                    would gain nothing here and can't optimise a data URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.dataUrl}
                  alt={`Page ${index + 1}`}
                  className="aspect-[3/4] w-full object-cover"
                />
                <span className="tnum absolute top-1 left-1 rounded-ui bg-ink/80 px-1.5 py-0.5 text-[10px] text-ground">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setImages((current) => current.filter((_, i) => i !== index))
                  }
                  aria-label={`Remove page ${index + 1}`}
                  className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-ui bg-ink/80 text-ground"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || images.length >= MAX_IMAGES}
            onClick={() => inputRef.current?.click()}
            className={buttonQuiet}
          >
            {preparing
              ? "Preparing…"
              : images.length === 0
                ? "Choose photos"
                : "Add another page"}
          </button>

          <button
            type="button"
            disabled={busy || images.length === 0}
            onClick={run}
            className={buttonPrimary}
          >
            {busy ? "Reading…" : "Read recipe"}
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          // capture="environment" would force the camera and block the photo
          // library, which is the wrong default for a cookbook on the counter.
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-alert">
          {error}
        </p>
      ) : null}

      <p className="mt-8 border-t border-rule pt-4 text-sm text-ink-mute">
        Got a link instead?{" "}
        <Link href="/import/link" className="text-accent hover:underline">
          Paste a URL
        </Link>{" "}
        · Migrating from Paprika?{" "}
        <Link href="/import/paprika" className="text-accent hover:underline">
          Bulk import
        </Link>
      </p>
    </div>
  )
}
