/**
 * Shared class strings so every surface in the app derives from the same
 * ledger tokens. Corners come from two theme radii — `rounded-ui` for anything
 * you press, `rounded-card` for anything that holds content. Don't hardcode a
 * pixel radius at the call site.
 */

/**
 * No width utility here on purpose. Adding `w-full` would collide with the
 * `w-16` / `w-20` sizing on the ingredient row — same specificity, so whichever
 * Tailwind emits last wins and the row blows past the viewport. Callers set
 * their own width.
 */
export const inputClass =
  "border border-rule bg-card px-3 py-2 text-ink rounded-ui " +
  "placeholder:text-ink-mute/60 focus:border-accent focus:outline-none"

export const labelClass = "eyebrow block mb-1.5"

export const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-ui bg-accent px-4 py-2 " +
  "font-display text-sm font-semibold text-accent-ink transition-opacity " +
  "hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"

export const buttonQuiet =
  "inline-flex items-center justify-center gap-2 rounded-ui border border-rule " +
  "bg-card px-4 py-2 font-display text-sm font-medium text-ink transition-colors " +
  "hover:border-ink-mute disabled:cursor-not-allowed disabled:opacity-50"

export const buttonDanger =
  "inline-flex items-center justify-center gap-2 rounded-ui border border-alert " +
  "px-4 py-2 font-display text-sm font-medium text-alert transition-colors " +
  "hover:bg-alert hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
