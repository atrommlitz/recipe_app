"use client"

import { useEffect, useId, useRef, useState } from "react"

export type FilterOption = { value: string; label: string }

/**
 * A labelled dropdown of checkboxes.
 *
 * `multiple: false` switches to radios, which is what the prep-time buckets
 * need — they nest, so ticking both "under 15" and "under 30" would just mean
 * "under 30" and the extra checkbox would be a lie about how the filter works.
 */
export function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  onClear,
  multiple = true,
  emptyLabel = "Any",
  neutralValue,
}: {
  label: string
  options: FilterOption[]
  selected: Set<string>
  onToggle: (value: string) => void
  onClear?: () => void
  multiple?: boolean
  emptyLabel?: string
  /**
   * The option that means "no filter". A single-select dropdown always has
   * something ticked, so without this the button would look active even when
   * it isn't narrowing anything down.
   */
  neutralValue?: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  // Close on an outside click or Escape. Subscribing to document events is
  // exactly what effects are for; the listeners set state, the body doesn't.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const chosen = options.filter((option) => selected.has(option.value))

  // Show the choice itself when there's one, a count when there are several.
  const summary =
    chosen.length === 0
      ? emptyLabel
      : chosen.length === 1
        ? chosen[0].label
        : `${chosen.length} selected`

  const active =
    chosen.length > 0 &&
    !(neutralValue !== undefined && chosen.every((o) => o.value === neutralValue))

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-[2px] border px-3 py-1.5 text-sm transition-colors ${
          active
            ? "border-accent bg-card text-ink"
            : "border-rule bg-card text-ink-mute hover:border-ink-mute hover:text-ink"
        }`}
      >
        <span className="eyebrow !text-ink-mute">{label}</span>
        <span className={active ? "text-ink" : ""}>{summary}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M1.5 3.5L5 7l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label={label}
          className="absolute top-full left-0 z-30 mt-1 min-w-[13rem] rounded-[2px] border border-rule bg-card py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
        >
          {options.map((option) => {
            const checked = selected.has(option.value)
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-ink hover:bg-ground"
              >
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={multiple ? undefined : panelId}
                  checked={checked}
                  onChange={() => onToggle(option.value)}
                  className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                {option.label}
              </label>
            )
          })}

          {multiple && onClear ? (
            <>
              <div className="my-1 border-t border-rule" />
              <button
                type="button"
                onClick={onClear}
                disabled={!active}
                className="w-full px-3 py-1.5 text-left text-sm text-ink-mute hover:bg-ground hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-mute"
              >
                Clear {label.toLowerCase()}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
