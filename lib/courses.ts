/**
 * What kind of dish a recipe is. A fixed seeded set, like cooking methods.
 *
 * Unlike protein — which is reliably readable off the ingredient list — course
 * often isn't inferable at all, so this is stored rather than derived. The
 * keyword pass below is only a fallback for the Paprika bulk import, where
 * running a model over every recipe purely to categorise it isn't worth it.
 * The link and photo importers get this from the model instead.
 */

export const COURSE_NAMES = [
  "Main",
  "Side",
  "Appetizer",
  "Soup",
  "Salad",
  "Breakfast",
  "Dessert",
  "Drink",
  "Snack",
  "Sauce",
] as const

export type CourseName = (typeof COURSE_NAMES)[number]

/** Checked before the Main fallback; a specific match always wins. */
const SPECIFIC_PATTERNS: Partial<Record<CourseName, RegExp>> = {
  Dessert:
    /\b(dessert|cake|cupcakes?|cookies?|brownies?|blondies?|pies?|tarts?|cheesecake|pudding|mousse|cobbler|crumble|crisp|fudge|truffles?|ice cream|gelato|sorbet|frosting|icing|doughnuts?|donuts?|eclairs?|macarons?|tiramisu|panna cotta)\b/i,
  Drink:
    /\b(drinks?|cocktails?|mocktails?|smoothies?|juice|lemonade|limeade|latte|margarita|mojito|martini|sangria|punch|spritz|milkshakes?|shakes?|iced tea|hot chocolate|eggnog)\b/i,
  Breakfast:
    /\b(breakfast|brunch|pancakes?|waffles?|french toast|omelettes?|omelets?|frittata|granola|oatmeal|porridge|muesli|scrambled eggs|hash browns?)\b/i,
  Soup: /\b(soups?|chowder|bisque|gazpacho|consomm[ée]|pho|ramen broth|minestrone)\b/i,
  Salad: /\b(salads?|slaw|coleslaw|tabbouleh|panzanella)\b/i,
  Sauce:
    /\b(sauces?|dressing|vinaigrette|marinade|pesto|salsa|chutney|gravy|aioli|compound butter|relish)\b/i,
  Appetizer:
    /\b(appetizers?|starters?|hors d'oeuvre|canap[ée]s?|dips?|hummus|guacamole|bruschetta|deviled eggs|wings|nachos)\b/i,
  Snack: /\b(snacks?|trail mix|granola bars?|popcorn|jerky|energy balls?)\b/i,
  Side: /\b(side dish|side salad|sides?\b.*dish|mashed potatoes|dinner rolls?)\b/i,
}

/**
 * Keyword guess at a recipe's course, from its title and any notes.
 *
 * Falls back to Main when nothing specific matches — most saved recipes are
 * dinners, and a wrong-but-plausible tag is easier to spot and fix than a
 * library where most things are untagged.
 */
export function inferCourses(text: string): CourseName[] {
  if (!text) return ["Main"]

  const found = (Object.keys(SPECIFIC_PATTERNS) as CourseName[]).filter((course) =>
    SPECIFIC_PATTERNS[course]!.test(text),
  )

  return found.length > 0 ? found : ["Main"]
}
