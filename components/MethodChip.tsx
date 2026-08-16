const base =
  "inline-flex items-center rounded-ui border px-2 py-1 font-mono text-[11px] " +
  "uppercase tracking-[0.08em] transition-colors"

/** Read-only tag shown on recipe cards and the detail view. */
export function MethodBadge({ name }: { name: string }) {
  return (
    <span className={`${base} border-rule text-ink-mute`}>{name}</span>
  )
}

/**
 * Toggleable chip, used both for grid filtering and for picking methods on the
 * add/edit form. Selected state uses the accent — the one place per screen the
 * accent is allowed to repeat, since it's a set.
 */
export function MethodToggle({
  name,
  selected,
  onToggle,
}: {
  name: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`${base} cursor-pointer ${
        selected
          ? "border-accent bg-accent text-accent-ink"
          : "border-rule bg-card text-ink-mute hover:border-ink-mute hover:text-ink"
      }`}
    >
      {name}
    </button>
  )
}
