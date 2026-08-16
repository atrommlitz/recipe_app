import type { Metadata } from "next"

import { LoginForm } from "@/components/LoginForm"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams
  const raw = params?.next
  const candidate = Array.isArray(raw) ? raw[0] : raw
  // Never bounce to an absolute URL supplied via the query string.
  const next = candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/"

  return (
    <div className="flex min-h-[calc(100dvh-1px)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">
            Lemonade
          </h1>
          <p className="mt-1 text-ink-mute">Our recipes, in one place.</p>
        </div>

        <div className="border border-rule bg-card p-6 rounded-card">
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  )
}
