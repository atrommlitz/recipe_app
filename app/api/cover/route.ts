import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { ensureCover } from "@/lib/cover"

/**
 * Generates cover art for one recipe.
 *
 * One recipe per request: image generation takes 10–20 seconds, so a batch
 * would sit close to the function timeout and lose everything on one failure.
 * The caller loops and gets progress for free.
 *
 * Auth comes from the proxy, which gates every path but /login and /auth.
 */
export async function POST(request: Request) {
  let body: { recipeId?: string; force?: boolean }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }

  if (!body.recipeId) {
    return NextResponse.json({ error: "recipeId is required." }, { status: 400 })
  }

  const result = await ensureCover(body.recipeId, { force: body.force })

  if (result.status === "failed") {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  if (result.status === "generated") {
    revalidatePath("/")
    revalidatePath(`/recipes/${body.recipeId}`)
  }

  return NextResponse.json(result)
}
