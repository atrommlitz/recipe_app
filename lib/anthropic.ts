import "server-only"

import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

import { ingredientDraftSchema, recipeDraftSchema, type IngredientDraft, type RecipeDraft } from "@/lib/schemas"

/**
 * Link import runs on Opus 5 — social captions and blog prose are messy and
 * benefit from the reasoning. Bulk Paprika parsing runs on Haiku 4.5, because
 * splitting an already-clean ingredient line is simple extraction.
 */
const LINK_MODEL = "claude-opus-5"
const BULK_MODEL = "claude-haiku-4-5"

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server.",
    )
    this.name = "MissingApiKeyError"
  }
}

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new MissingApiKeyError()
  return new Anthropic({ apiKey })
}

const RECIPE_SYSTEM = `You extract recipes from web pages, social captions and video descriptions.

Rules:
- Transcribe only what the source states. Never invent ingredients, quantities or steps.
- Convert fractions to decimals: 1/2 -> 0.5, 1 1/2 -> 1.5.
- quantity is null when the source gives no number (e.g. "salt to taste").
- unit is null when the item is counted rather than measured (e.g. "2 eggs" -> quantity 2, unit null, item "eggs").
- Keep preparation notes on the item, e.g. "large eggs, beaten".
- Times are whole minutes. "1 hr 30 min" -> 90. Use null when not stated.
- Steps are the method only. Put tips, storage and serving suggestions in notes.
- Strip leading step numbers from instructions.
- If the text is not a recipe, return an empty ingredients array and an empty steps array.`

/** Full extraction from unstructured page text or a pasted caption. */
export async function parseRecipeFromText(
  text: string,
  sourceUrl?: string,
): Promise<RecipeDraft> {
  const message = await client().messages.parse({
    model: LINK_MODEL,
    max_tokens: 16000,
    system: RECIPE_SYSTEM,
    output_config: {
      format: zodOutputFormat(recipeDraftSchema),
      effort: "medium",
    },
    messages: [
      {
        role: "user",
        content: [
          sourceUrl ? `Source URL: ${sourceUrl}` : "",
          "Extract the recipe from the following content.",
          "",
          text.slice(0, 120_000),
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  })

  const parsed = message.parsed_output
  if (!parsed) throw new Error("Claude did not return a recipe.")
  return parsed
}

const INGREDIENT_SYSTEM = `You split raw recipe ingredient lines into structured fields.

Rules:
- Return one entry per input line, in the same order. Never merge or drop lines.
- Convert fractions to decimals: 1/2 -> 0.5, 1 1/2 -> 1.5. Handle unicode fractions.
- quantity is null when the line has no number (e.g. "salt to taste").
- unit is null when the item is counted rather than measured (e.g. "2 eggs").
- For a range like "2-3 tbsp", use the lower number.
- Keep preparation notes on the item, e.g. "onion, finely diced".
- Section headers like "For the sauce:" become an entry with quantity null, unit null, and the header as item.`

const ingredientBatchSchema = z.object({
  results: z.array(
    z.object({
      index: z.number().describe("The index of the input group this belongs to."),
      ingredients: z.array(ingredientDraftSchema),
    }),
  ),
})

/**
 * Splits several recipes' ingredient lines in one call. Batching is the real
 * cost lever for the Paprika import — prompt caching does not help here, since
 * this system prompt is far below Haiku's 4096-token minimum cacheable prefix.
 */
export async function parseIngredientGroups(
  groups: string[][],
): Promise<IngredientDraft[][]> {
  if (groups.length === 0) return []

  const payload = groups
    .map((lines, index) => `### Group ${index}\n${lines.join("\n")}`)
    .join("\n\n")

  const message = await client().messages.parse({
    model: BULK_MODEL,
    max_tokens: 16000,
    system: INGREDIENT_SYSTEM,
    output_config: { format: zodOutputFormat(ingredientBatchSchema) },
    messages: [
      {
        role: "user",
        content: `Split each group's ingredient lines. Return one result per group, using the group number as index.\n\n${payload}`,
      },
    ],
  })

  const parsed = message.parsed_output
  if (!parsed) throw new Error("Claude did not return parsed ingredients.")

  // Re-key by index so a reordered response still lands on the right recipe.
  return groups.map((_, index) => {
    const match = parsed.results.find((r) => r.index === index)
    return match?.ingredients ?? []
  })
}
