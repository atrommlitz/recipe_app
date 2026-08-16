"use client"

import { useEffect, useState } from "react"

/** Brief confirmation message. Returns [message, show]. */
export function useToast(timeoutMs = 2200) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), timeoutMs)
    return () => clearTimeout(timer)
  }, [message, timeoutMs])

  return [message, setMessage] as const
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 rounded-[2px] border border-rule bg-ink px-4 py-2 text-sm text-ground shadow-[0_2px_12px_rgba(0,0,0,0.2)]"
      style={{ bottom: "calc(max(env(safe-area-inset-bottom), 1rem) + 5rem)" }}
    >
      {message}
    </div>
  )
}
