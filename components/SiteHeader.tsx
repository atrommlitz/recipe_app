import Link from "next/link"

import { signOut } from "@/app/auth/actions"

export function SiteHeader({ email }: { email: string }) {
  return (
    <header className="border-b border-rule bg-ground">
      <div className="mx-auto flex max-w-5xl items-baseline gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="font-display text-lg font-extrabold tracking-tight text-ink"
        >
          Index
        </Link>

        <nav className="ml-auto flex items-baseline gap-4 text-sm">
          <Link href="/recipes/new" className="hover:text-accent">
            Add
          </Link>
          <Link href="/import/link" className="hover:text-accent">
            Import
          </Link>
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
