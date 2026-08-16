"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { signOut } from "@/app/auth/actions"

export function SiteHeader({ email }: { email: string }) {
  const pathname = usePathname()

  // Cook mode owns the whole screen — no nav chrome at the stove.
  if (pathname?.endsWith("/cook")) return null

  return (
    <header className="border-b border-rule bg-ground">
      <div className="mx-auto flex max-w-5xl items-baseline gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="font-display text-lg font-extrabold tracking-tight text-ink"
        >
          Lemonade
        </Link>

        {/* Adding lives entirely on the + button on the home grid — no
            duplicate entry points up here. */}
        <nav className="ml-auto flex items-baseline gap-4 text-sm">
          <form action={signOut}>
            <button
              type="submit"
              title={email}
              className="cursor-pointer text-ink-mute hover:text-accent"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  )
}
