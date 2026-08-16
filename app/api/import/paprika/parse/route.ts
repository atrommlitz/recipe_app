import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { MissingApiKeyError, parseIngredientGroups } from "@/lib/anthropic"

export const maxDuration = 300

type Body = { groups?: string[][] }

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 })

  const { groups } = (await request.json()) as Body

  if (!Array.isArray(groups) || groups.length === 0) {
    return NextResponse.json({ error: "No ingredient groups sent." }, { status: 400 })
  }
  // The client chunks; this is a backstop so one request can't run away.
  if (groups.length > 25) {
    return NextResponse.json({ error: "Too many recipes in one chunk." }, { status: 400 })
  }

  try {
    const results = await parseIngredientGroups(groups)
    return NextResponse.json({ results })
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    const message = error instanceof Error ? error.message : "Parsing failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
