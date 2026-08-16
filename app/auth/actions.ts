"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

/**
 * The app shows a single shared password — there is no username to type.
 *
 * Supabase Auth still runs underneath: HOUSEHOLD_EMAIL is the account identity,
 * not something either of you enters. Keeping real auth means RLS, sessions and
 * direct-to-Storage uploads all keep working unchanged. It lives in an env var
 * rather than in source so this repo can stay public without publishing it.
 *
 * To change the password: Supabase dashboard → Authentication → Users.
 */
function householdEmail() {
  const email = process.env.HOUSEHOLD_EMAIL
  if (!email) {
    throw new Error(
      "HOUSEHOLD_EMAIL is not set. Add it to .env.local (and to the Vercel project env).",
    )
  }
  return email
}

export type SignInState = { error: string | null }

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const password = String(formData.get("password") ?? "")
  const next = String(formData.get("next") ?? "/")

  if (!password) return { error: "Enter the password." }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: householdEmail(),
    password,
  })

  if (error) return { error: "That's not the password." }

  revalidatePath("/", "layout")
  // Only ever redirect to a path on this site.
  redirect(next.startsWith("/") ? next : "/")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
