import { z } from "zod"

import { COURSE_NAMES, type CourseName } from "@/lib/courses"
import { METHOD_NAMES, type MethodName } from "@/lib/steps"

/**
 * The shape shared by the manual form, the link importer and the Paprika
 * importer. Kept deliberately flat and free of numeric constraints so it can
 * double as an Anthropic structured-output schema.
 */

export const ingredientDraftSchema = z.object({
  quantity: z
    .number()
    .nullable()
    .describe("Numeric amount, or null when the recipe gives no number (e.g. 'salt to taste'). Convert fractions to decimals: 1/2 -> 0.5."),
  unit: z
    .string()
    .nullable()
    .describe("Unit of measure such as cup, tbsp, g, oz. Null when the item is counted rather than measured (e.g. '2 eggs')."),
  item: z
    .string()
    .describe("The ingredient itself, including any preparation note, e.g. 'large eggs, beaten'."),
})

export const recipeDraftSchema = z.object({
  title: z.string().describe("The recipe name."),
  servings: z.number().nullable().describe("Number of servings, or null if not stated."),
  prep_time_minutes: z.number().nullable().describe("Prep time in whole minutes, or null."),
  cook_time_minutes: z.number().nullable().describe("Cook time in whole minutes, or null."),
  ingredients: z.array(ingredientDraftSchema),
  steps: z
    .array(z.string())
    .describe(
      "Instructions in order, ONE action per entry, without leading numbers. Never return the whole method as a single entry — split it.",
    ),
  cooking_methods: z
    .array(z.enum(METHOD_NAMES))
    .describe(
      "Which of the fixed cooking methods this recipe uses, judged from the instructions and equipment. Usually one or two. Empty if genuinely unclear.",
    ),
  courses: z
    .array(z.enum(COURSE_NAMES))
    .describe(
      "What kind of dish this is. Almost always exactly one. Use Main for a dinner or lunch centrepiece.",
    ),
  notes: z
    .string()
    .nullable()
    .describe("Any tips, storage or serving notes that are not method steps. Null when there are none."),
})

export type IngredientDraft = z.infer<typeof ingredientDraftSchema>
export type RecipeDraft = z.infer<typeof recipeDraftSchema>

/**
 * A draft plus the fields the model never supplies.
 *
 * `cooking_methods` is required on RecipeDraft because the model must always
 * answer it, but optional here: by the time a recipe reaches the form it's the
 * resolved `cooking_method_ids` that matter, and hand-written recipes never
 * have the name list at all.
 */
export type EditableRecipe = Omit<RecipeDraft, "cooking_methods" | "courses"> & {
  cooking_methods?: MethodName[]
  courses?: CourseName[]
  image_url: string | null
  source_url: string | null
  /**
   * Undefined means "this caller doesn't manage tags" and leaves existing ones
   * alone on save; an empty array clears them.
   */
  cooking_method_ids?: string[]
  course_ids?: string[]
}

export const emptyRecipe: EditableRecipe = {
  title: "",
  servings: 4,
  prep_time_minutes: null,
  cook_time_minutes: null,
  ingredients: [{ quantity: null, unit: null, item: "" }],
  steps: [""],
  notes: null,
  image_url: null,
  source_url: null,
  cooking_method_ids: [],
  course_ids: [],
}
