# Lemonade

A shared recipe app for two people. Next.js 16 (App Router) · Supabase · Tailwind v4 · Claude.

**Live:** https://recipe-app-atrommlitzs-projects.vercel.app

Vercel Authentication is deliberately off for this project — the app has its own
password gate, and leaving Vercel's SSO on would mean every device had to be
logged into Vercel first. That does mean the app password is the only thing in
front of it, including in front of the Anthropic key the importers spend.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

Environment lives in `.env.local` (already populated except the Anthropic key — see below).

## Signing in

One shared password, no username. Supabase Auth still runs underneath — the
account identity is `HOUSEHOLD_EMAIL`, which the app supplies for you — so RLS,
sessions and direct-to-Storage uploads keep working normally.

To change the password: Supabase dashboard → **Authentication → Users**.

If you ever add a second Supabase account, do it in that dashboard (**Add
user**, tick *Auto Confirm User*) rather than with raw SQL — GoTrue reads
several token columns as non-nullable strings, and a hand-written `INSERT`
leaves them `NULL`, which makes every sign-in fail with
`Database error querying schema`.

## The Anthropic key

Both importers call Claude and need `ANTHROPIC_API_KEY` in `.env.local`.
Without it they return a 503 with a message saying so; the rest of the app
works fine. Get a key at [console.anthropic.com](https://console.anthropic.com).

Models used:

| Path | Model | Why |
|---|---|---|
| Link import | `claude-opus-5` | Social captions and blog prose are messy |
| Paprika bulk | `claude-haiku-4-5` | Splitting a clean ingredient line is simple extraction |

Bulk import batches 10 recipes per call, so an ~87-recipe library is ~9 calls.
Prompt caching is deliberately **not** used — the system prompt is far below
Haiku's 4096-token minimum cacheable prefix, so a `cache_control` marker would
silently do nothing.

## Importing

**Link** (`/import/link`) tries three paths, cheapest first:
JSON-LD `schema.org/Recipe` → OpenGraph + page text via Claude → you paste the
text yourself. Blogs and YouTube work well. **Instagram and TikTok block
automated fetches** — for those, copy the caption and use the paste box.

**Paprika** (`/import/paprika`): in Paprika, *File → Export → Paprika Recipe
Format*. The archive is unzipped in your browser, so its size doesn't matter.

Paprika's `source` field (the site name) has no column in the schema, so it's
appended to `notes`.

## Design

The "Lemonade" direction: ledger-paper ground, chunky grotesque display over a
serif body, pen-blue accent used at most once per screen, monospaced tabular
quantities. All tokens live in `app/globals.css` — derive from them rather than
hardcoding values.

The signature element is the ingredient ledger: hairline rules with a
right-aligned tabular quantity column. Scaling changes only that column.

`components/ui.ts` deliberately omits a width utility from `inputClass` —
adding `w-full` there collides with the `w-16`/`w-20` ingredient row sizing
(same specificity, last-emitted wins) and blows the row past the viewport.

## Layout

```
app/
  page.tsx                      grid
  recipes/[id]/                 detail, edit
  recipes/new/                  add
  import/link|paprika/          importers
  api/import/                   link + paprika parse routes
  auth/actions.ts               sign in/out
components/                     RecipeForm, RecipeScaler, ImageUpload, …
lib/
  supabase/{client,server}.ts   per-request clients
  anthropic.ts                  Claude calls (structured outputs)
  extract.ts                    JSON-LD / OG / text extraction
  paprika.ts                    archive unpacking + field mapping
  format.ts                     fraction rendering + parsing
proxy.ts                        auth gate (Next 16 renamed middleware.ts)
public/sw.js                    shell caching only
```

## Not in V1

Cooking method tags, cook log, ingredient search, photo/OCR import, cook mode,
grocery list export, random picker.
