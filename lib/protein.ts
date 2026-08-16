/**
 * Protein grouping, inferred from ingredient names.
 *
 * There's deliberately no protein column: it would need backfilling for every
 * recipe already in the library and re-checking on every edit. The ingredient
 * rows already say what's in the dish, so this reads them instead.
 */

export const PROTEIN_GROUPS = [
  "Chicken",
  "Beef",
  "Pork",
  "Turkey",
  "Lamb",
  "Seafood",
  "Vegetarian",
] as const

export type ProteinGroup = (typeof PROTEIN_GROUPS)[number]

/**
 * Stock, broth, bouillon and seasoning don't make a dish "chicken" — a
 * vegetable soup built on chicken stock shouldn't answer a search for chicken
 * dinners. These are stripped before matching.
 */
const NOT_THE_PROTEIN =
  /\b(?:chicken|beef|pork|turkey|lamb|fish|seafood|anchovy)\s+(?:broth|stock|bouillon|base|seasoning|granules|powder|consomm[ée]|fat|drippings)\b/gi

const MEAT_PATTERNS: Record<Exclude<ProteinGroup, "Vegetarian">, RegExp> = {
  Chicken: /\b(chicken|poussin|cornish hen)\b/i,
  Beef: /\b(beef|steak|brisket|short ribs?|chuck roast|sirloin|ribeye|rib eye|ground round|oxtail|veal)\b/i,
  Pork: /\b(pork|bacon|pancetta|prosciutto|chorizo|ham|sausages?|salami|guanciale|carnitas)\b/i,
  Turkey: /\b(turkey)\b/i,
  Lamb: /\b(lamb|mutton)\b/i,
  Seafood:
    /\b(fish|salmon|tuna|cod|haddock|halibut|tilapia|snapper|trout|sardines?|anchov(?:y|ies)|shrimps?|prawns?|scallops?|crab|lobster|mussels?|clams?|oysters?|squid|calamari|octopus)\b/i,
}

/**
 * Which protein groups a recipe belongs to. A dish can be more than one
 * (surf and turf, chorizo with chicken). Anything with no meat or seafood is
 * grouped as Vegetarian.
 */
export function inferProteins(ingredientItems: string[]): ProteinGroup[] {
  const haystack = ingredientItems.join("\n").replace(NOT_THE_PROTEIN, " ")

  const found = (
    Object.keys(MEAT_PATTERNS) as Exclude<ProteinGroup, "Vegetarian">[]
  ).filter((group) => MEAT_PATTERNS[group].test(haystack))

  return found.length > 0 ? found : ["Vegetarian"]
}
