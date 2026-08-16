"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

type Option = {
  href: string
  title: string
  description: string
}

const OPTIONS: Option[] = [
  {
    href: "/import/link",
    title: "Paste a link",
    description: "A blog, YouTube, or a caption you've copied.",
  },
  {
    href: "/import/photo",
    title: "Snap a photo",
    description: "One recipe, from one or more photos of the same dish.",
  },
  {
    href: "/import/photos",
    title: "Bulk photo import",
    description: "A stack of recipe cards — one photo becomes one recipe.",
  },
  {
    href: "/recipes/new",
    title: "Start from blank",
    description: "Type it out yourself.",
  },
  {
    href: "/import/paprika",
    title: "Import a Paprika file",
    description: "Bring a whole .paprikarecipes library across at once.",
  },
]

/**
 * Thumb-reachable add button for the home grid. Square with a 2px radius
 * rather than the usual circular FAB — a circle would be the one shape this
 * design system doesn't use anywhere else.
 */
export function AddRecipeButton() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)

  // Native <dialog> gives Escape-to-close and a focus trap for free.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add a recipe"
        aria-haspopup="dialog"
        className="fixed right-4 z-20 flex h-14 w-14 items-center justify-center rounded-[2px] border border-accent bg-accent text-accent-ink shadow-[0_2px_12px_rgba(0,0,0,0.18)] transition-opacity hover:opacity-90 sm:right-6"
        style={{ bottom: "max(env(safe-area-inset-bottom), 1rem)" }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path
            d="M11 3.5v15M3.5 11h15"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="square"
          />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        // Clicking the backdrop lands on the dialog element itself; clicks on
        // the content are caught by the inner wrapper's stopPropagation.
        onClick={() => setOpen(false)}
        aria-labelledby="add-recipe-heading"
        className="m-0 w-full max-w-md bg-transparent p-0 backdrop:bg-ink/50 open:fixed open:top-1/2 open:left-1/2 open:-translate-x-1/2 open:-translate-y-1/2"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-4 border border-rule bg-card rounded-[2px]"
        >
          <div className="flex items-baseline justify-between border-b border-rule px-4 py-3">
            <h2
              id="add-recipe-heading"
              className="font-display text-lg font-extrabold text-ink"
            >
              Add a recipe
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-xl leading-none text-ink-mute hover:text-ink"
            >
              ×
            </button>
          </div>

          <ul>
            {OPTIONS.map((option) => (
              <li key={option.href} className="border-b border-rule last:border-b-0">
                <Link
                  href={option.href}
                  onClick={() => setOpen(false)}
                  className="group block px-4 py-3 transition-colors hover:bg-ground"
                >
                  <span className="font-display font-bold text-ink group-hover:text-accent">
                    {option.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-mute">
                    {option.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  )
}
