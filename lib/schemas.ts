import { z } from "zod"

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
  steps: z.array(z.string()).describe("Method steps in order, one instruction per entry, without leading numbers."),
  notes: z
    .string()
    .nullable()
    .describe("Any tips, storage or serving notes that are not method steps. Null when there are none."),
})

export type IngredientDraft = z.infer<typeof ingredientDraftSchema>
export type RecipeDraft = z.infer<typeof recipeDraftSchema>

/** A draft plus the fields the model never supplies. */
export type EditableRecipe = RecipeDraft & {
  image_url: string | null
  source_url: string | null
  /**
   * Optional so importers don't have to supply it — an imported recipe simply
   * has no cooking methods until someone edits it. Undefined is treated as an
   * empty list on save.
   */
  cooking_method_ids?: string[]
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
}
