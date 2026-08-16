import "server-only"

import { classifyRecipeImage } from "@/lib/anthropic"
import { createClient } from "@/lib/supabase/server"

/**
 * Cover art for recipes that don't have a usable photo.
 *
 * Two cases look identical on the grid: a recipe with no image at all, and one
 * whose image is a photograph of the recipe *card* — which is how most of the
 * library arrived. Both get a generated photo of the dish instead.
 *
 * Images come from Vercel's AI Gateway, which the app is already deployed
 * behind; on Vercel the OIDC token authenticates it with no key to manage,
 * and AI_GATEWAY_API_KEY covers everywhere else.
 */

const IMAGE_MODEL = "google/imagen-4.0-fast-generate-001"
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/images/generations"
const BUCKET = "recipe-images"

export class MissingGatewayKeyError extends Error {
  constructor() {
    super(
      "No AI Gateway credentials. Set AI_GATEWAY_API_KEY, or run `vercel env pull` " +
        "to get a VERCEL_OIDC_TOKEN for local development.",
    )
    this.name = "MissingGatewayKeyError"
  }
}

function gatewayToken(): string {
  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
  if (!token) throw new MissingGatewayKeyError()
  return token
}

type CoverSubject = {
  id: string
  title: string
  ingredients: string[]
  courses: string[]
  methods: string[]
}

/** Framing varies by recipe so a screen full of covers doesn't look stamped. */
const ANGLES = [
  "shot from directly overhead",
  "shot from a three-quarter angle just above the table",
  "shot at table level with the plate filling the frame",
]

const PLATING: Record<string, string> = {
  Drink: "in a tall glass with condensation on it",
  Dessert: "plated on a small dessert plate",
  Soup: "in a deep bowl with a spoon resting alongside",
  Salad: "piled in a wide shallow bowl",
  Breakfast: "on a plate with a fork and a cup of coffee just out of focus",
  Sauce: "in a small pouring jug beside what it's served with",
  Snack: "in a bowl, a few pieces spilling onto the surface",
}

export function coverPrompt(recipe: CoverSubject): string {
  // Cheap stable hash so the same recipe always gets the same framing.
  const seed = [...recipe.id].reduce((n, c) => n + c.charCodeAt(0), 0)
  const angle = ANGLES[seed % ANGLES.length]
  const course = recipe.courses[0] ?? "Main"
  const plating = PLATING[course] ?? "served on a ceramic plate"

  // The first handful of ingredients carry the look of the dish; the tail is
  // usually salt, oil and spices, which do nothing for the picture.
  const key = recipe.ingredients.slice(0, 6).join(", ")

  return [
    `A appetising photograph of ${recipe.title}, ${plating}, ${angle}.`,
    key ? `The dish is made with ${key}.` : "",
    recipe.methods.includes("Grill") ? "It has char marks from the grill." : "",
    "Home cooking, freshly made, styled simply on a warm cream linen surface.",
    "Natural window light from the side, soft shadows, shallow depth of field.",
    "No text, no writing, no labels, no packaging, no hands and no people.",
  ]
    .filter(Boolean)
    .join(" ")
}

/** Calls the gateway and returns the raw image. */
export async function generateCoverImage(
  prompt: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gatewayToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: "1024x1024",
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Image generation failed (${response.status}): ${detail.slice(0, 300)}`)
  }

  const json = (await response.json()) as {
    data?: { b64_json?: string; url?: string }[]
  }
  const image = json.data?.[0]
  if (!image) throw new Error("The gateway returned no image.")

  // Providers return either inline base64 or a short-lived URL.
  if (image.b64_json) {
    return {
      bytes: Uint8Array.from(atob(image.b64_json), (c) => c.charCodeAt(0)),
      contentType: "image/png",
    }
  }

  if (image.url) {
    const file = await fetch(image.url)
    if (!file.ok) throw new Error(`Could not download the generated image.`)
    return {
      bytes: new Uint8Array(await file.arrayBuffer()),
      contentType: file.headers.get("content-type") ?? "image/png",
    }
  }

  throw new Error("The gateway returned an image in an unrecognised shape.")
}

export type CoverResult =
  | { status: "generated"; imageUrl: string }
  | { status: "kept"; reason: string }
  | { status: "failed"; error: string }

/**
 * Gives a recipe a cover if it needs one.
 *
 * `force` skips the "is the existing image fine?" check — for when you disagree
 * with the classifier, or just want a different picture.
 */
export async function ensureCover(
  recipeId: string,
  { force = false }: { force?: boolean } = {},
): Promise<CoverResult> {
  // Fail before spending a Claude call on classification if we can't generate
  // anything anyway.
  try {
    gatewayToken()
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) }
  }

  const supabase = await createClient()

  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("id, title, image_url, ingredients(item, sort_order), courses(name), cooking_methods(name)")
    .eq("id", recipeId)
    .order("sort_order", { referencedTable: "ingredients", ascending: true })
    .maybeSingle()

  if (error) return { status: "failed", error: error.message }
  if (!recipe) return { status: "failed", error: "No such recipe." }

  if (recipe.image_url && !force) {
    const kind = await classifyRecipeImage(recipe.image_url)
    if (kind === "food") return { status: "kept", reason: "already a photo of the food" }
  }

  try {
    const { bytes, contentType } = await generateCoverImage(
      coverPrompt({
        id: recipe.id,
        title: recipe.title,
        ingredients: recipe.ingredients.map((i) => i.item),
        courses: recipe.courses.map((c) => c.name),
        methods: recipe.cooking_methods.map((m) => m.name),
      }),
    )

    const path = `covers/${recipe.id}-${Date.now()}.${contentType.split("/")[1] ?? "png"}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: false })
    if (uploadError) return { status: "failed", error: uploadError.message }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path)

    const { error: updateError } = await supabase
      .from("recipes")
      .update({ image_url: publicUrl })
      .eq("id", recipe.id)
    if (updateError) return { status: "failed", error: updateError.message }

    return { status: "generated", imageUrl: publicUrl }
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) }
  }
}
