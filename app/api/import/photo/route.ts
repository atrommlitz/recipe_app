import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { MissingApiKeyError, parseRecipeFromImages } from "@/lib/anthropic"
import { methodIdsByName } from "@/lib/queries"
import type { EditableRecipe } from "@/lib/schemas"

export const maxDuration = 300

const MAX_IMAGES = 5
// Roughly the serverless request body ceiling, with headroom for JSON overhead.
const MAX_TOTAL_BYTES = 4_000_000

type Body = { images?: string[] }

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 })

  const { images } = (await request.json()) as Body

  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: "Add at least one photo." }, { status: 400 })
  }
  if (images.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `That's more than ${MAX_IMAGES} photos. Try fewer pages at a time.` },
      { status: 400 },
    )
  }

  const totalBytes = images.reduce((sum, b64) => sum + (b64.length * 3) / 4, 0)
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "Those photos are too large together. Try one or two at a time." },
      { status: 413 },
    )
  }

  try {
    const draft = await parseRecipeFromImages(
      images.map((base64) => ({ base64, mediaType: "image/jpeg" as const })),
    )

    if (draft.ingredients.length === 0 && draft.steps.length === 0) {
      return NextResponse.json(
        {
          error:
            "Couldn't find a recipe in that photo. Try a straighter, better-lit shot with the whole recipe in frame.",
        },
        { status: 422 },
      )
    }

    return NextResponse.json({
      recipe: {
        ...draft,
        image_url: null,
        source_url: null,
        cooking_method_ids: await methodIdsByName(draft.cooking_methods),
      } satisfies EditableRecipe,
    })
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    const message = error instanceof Error ? error.message : "Import failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
