import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { MissingApiKeyError, parseIngredientGroups, parseRecipeFromText } from "@/lib/anthropic"
import { extractJsonLdRecipe, extractOpenGraph, htmlToText } from "@/lib/extract"
import { methodIdsByName } from "@/lib/queries"
import { inferMethods } from "@/lib/steps"
import type { EditableRecipe } from "@/lib/schemas"

export const maxDuration = 120

// Sites serve very different markup to obvious bots.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

type Body = { url?: string; text?: string }

function blocked(url: string) {
  const host = new URL(url).hostname.replace(/^www\./, "")
  return /^(instagram\.com|tiktok\.com|facebook\.com)$/.test(host)
}

export async function POST(request: Request) {
  // Same auth gate as the rest of the app — this route calls a paid API.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 })

  const body = (await request.json()) as Body
  const rawUrl = body.url?.trim()
  const pastedText = body.text?.trim()

  try {
    // --- Path 3: user pasted the caption themselves ------------------------
    if (pastedText) {
      const draft = await parseRecipeFromText(pastedText, rawUrl)
      return NextResponse.json({
        recipe: {
          ...draft,
          image_url: null,
          source_url: rawUrl ?? null,
          cooking_method_ids: await methodIdsByName(draft.cooking_methods),
        } satisfies EditableRecipe,
        via: "pasted-text",
      })
    }

    if (!rawUrl) {
      return NextResponse.json({ error: "Paste a link first." }, { status: 400 })
    }

    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      return NextResponse.json({ error: "That doesn't look like a URL." }, { status: 400 })
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return NextResponse.json({ error: "Only http and https links work." }, { status: 400 })
    }

    let html: string
    try {
      const response = await fetch(url, {
        headers: { "user-agent": BROWSER_UA, accept: "text/html,*/*" },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      html = await response.text()
    } catch {
      return NextResponse.json(
        {
          error: blocked(rawUrl)
            ? "Instagram and TikTok block automated fetches. Open the post, copy the caption, and paste it below."
            : "Couldn't load that page. Paste the recipe text below instead.",
          needsText: true,
        },
        { status: 422 },
      )
    }

    // --- Path 1: JSON-LD schema.org/Recipe ---------------------------------
    const jsonLd = extractJsonLdRecipe(html)
    if (jsonLd && jsonLd.ingredientLines.length > 0) {
      // The structure is already reliable; the model only splits ingredients.
      const [ingredients] = await parseIngredientGroups([jsonLd.ingredientLines])

      // This path never runs the full model pass, so methods come from
      // keyword inference over the instructions we just extracted.
      const methodNames = inferMethods([jsonLd.title, ...jsonLd.steps].join("\n"))

      return NextResponse.json({
        recipe: {
          title: jsonLd.title,
          servings: jsonLd.servings,
          prep_time_minutes: jsonLd.prepMinutes,
          cook_time_minutes: jsonLd.cookMinutes,
          ingredients,
          steps: jsonLd.steps,
          notes: jsonLd.notes,
          cooking_methods: methodNames,
          image_url: jsonLd.imageUrl,
          source_url: rawUrl,
          cooking_method_ids: await methodIdsByName(methodNames),
        } satisfies EditableRecipe,
        via: "json-ld",
      })
    }

    // --- Path 2: OpenGraph + readable body text ----------------------------
    const og = extractOpenGraph(html)
    const text = htmlToText(html)
    const combined = [
      og.title ? `Title: ${og.title}` : "",
      og.description ? `Description: ${og.description}` : "",
      "",
      text,
    ]
      .filter(Boolean)
      .join("\n")

    if (combined.trim().length < 80) {
      return NextResponse.json(
        {
          error:
            "That page didn't return any readable text. Copy the recipe and paste it below.",
          needsText: true,
        },
        { status: 422 },
      )
    }

    const draft = await parseRecipeFromText(combined, rawUrl)

    if (draft.ingredients.length === 0 && draft.steps.length === 0) {
      return NextResponse.json(
        {
          error:
            "Couldn't find a recipe on that page. Copy the recipe text and paste it below.",
          needsText: true,
        },
        { status: 422 },
      )
    }

    return NextResponse.json({
      recipe: {
        ...draft,
        image_url: og.image ?? null,
        source_url: rawUrl,
        cooking_method_ids: await methodIdsByName(draft.cooking_methods),
      } satisfies EditableRecipe,
      via: "model",
    })
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    const message = error instanceof Error ? error.message : "Import failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
