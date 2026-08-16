"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"

import { signIn, type SignInState } from "@/app/auth/actions"
import { buttonPrimary, inputClass, labelClass } from "@/components/ui"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`${buttonPrimary} w-full`}>
      {pending ? "Opening…" : "Open"}
    </button>
  )
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<SignInState, FormData>(signIn, {
    error: null,
  })

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {/* Hidden username so password managers have something to key on. */}
      <input
        type="text"
        name="username"
        value="index"
        readOnly
        autoComplete="username"
        aria-hidden="true"
        tabIndex={-1}
        className="hidden"
      />

      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className={`${inputClass} w-full`}
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-alert">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  )
}
