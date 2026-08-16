import Link from "next/link"

/**
 * Thumb-reachable add button for the home grid. Square with a 2px radius
 * rather than the usual circular FAB — a circle would be the one shape this
 * design system doesn't use anywhere else.
 */
export function AddRecipeButton() {
  return (
    <Link
      href="/recipes/new"
      aria-label="Add a recipe"
      title="Add a recipe"
      className="fixed right-4 z-20 flex h-14 w-14 items-center justify-center rounded-[2px] border border-accent bg-accent text-accent-ink shadow-[0_2px_12px_rgba(0,0,0,0.18)] transition-opacity hover:opacity-90 sm:right-6"
      style={{ bottom: "max(env(safe-area-inset-bottom), 1rem)" }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M11 3.5v15M3.5 11h15"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="square"
        />
      </svg>
    </Link>
  )
}
