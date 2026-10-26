# Architecture: NutriFit extras logging, improved with ideas from 0xCal

This is **not** a rebuild of 0xCal. Most of its feature set already exists
in NutriFit in a different, trainer-appropriate form (barcode scanning,
Open Food Facts lookup, a day balance, weight tracking). Comparing
`replica/recon.md` against the actual code in `src/` and `supabase/` turned
up exactly one real gap worth building, plus one existing fragility that
blocks building it cleanly. Everything else from the recon (fasting, pantry
re-ranking by time of day, all iOS-only APIs, "no account") is explicitly
**not** planned — see "Rejected" below for why.

**Revision:** the first version of this plan used an LLM (Edge Function
`parse-meal-text`) to turn free text into ingredients. Built and tested
once, then deliberately reverted: for a health app with a nutricionista
relying on the numbers, an AI guess carries more risk (looking as
"official" as a real catalog value, while sometimes being wrong) and cost
(a paid API key, a rate limit to maintain) than its payoff justified before
anyone had asked to use it. **What's below now is the no-AI version**:
multiple catalog items per entry, picked by the client with the same
autocomplete the app already uses in `RecipeEditorPanel`, no LLM anywhere.

## What's already covered, so it's out of this plan

- Barcode scanning + Open Food Facts lookup → [BarcodeScanner.tsx](src/components/shared/BarcodeScanner.tsx), [openFoodFacts.ts](src/lib/openFoodFacts.ts)
- Grams → macros, quick-add amounts, day total vs. target → [ScannedFoodSheet.tsx](src/components/client/ScannedFoodSheet.tsx), [dayBalance.ts](src/lib/dayBalance.ts)
- A personal/custom foods catalog with Atwater sanity-checking → [foodDraft.ts](src/lib/foodDraft.ts) (already does the same kcal-vs-macros check 0xCal advertises)
- Weight tracking + graph → [weightProgress.ts](src/lib/weightProgress.ts), [WeightChart.tsx](src/components/shared/WeightChart.tsx)

## The real gap

Today a client can only log something **outside the plan** one item at a
time, by finding its barcode. There is no way to log a home-cooked plate
with several ingredients ("rice, chicken and salad") in one go. That's the
real, scoped improvement here — solved by picking several items from the
catalog NutriFit already has, not by guessing from free text.

## The real fragility that blocks it

Extras aren't stored as data — they're stored as a formatted sentence in
`meal_logs.note` (`"150 g · 212 kcal · P 12 g · C 8 g · G 14 g (producto
escaneado…"`) that [scannedLogs.ts](src/lib/scannedLogs.ts) parses back out
with a regex. That works for one scanned product per entry. It cannot hold
"rice + chicken + salad" as three separate, later-correctable rows. This
gets fixed once, as part of adding the feature, not as a separate cleanup.

## Stack

No new layer, no new vendor, no new secret. Reuse what's here.

| layer | choice | why |
| --- | --- | --- |
| web | existing Vite + React + TS | already the app; same autocomplete-against-`foods` pattern as [RecipeEditorPanel.tsx](src/components/shared/RecipeEditorPanel.tsx) |
| database | existing Supabase Postgres | already the app; new migration only |
| auth | existing Supabase Auth / RLS | already the app |
| hosting | existing Vercel | already the app |

No AI, no LLM API key, no edge function for this. Macros come straight
from the `foods` table (per-100g values NutriFit already maintains), the
same way `ScannedFoodSheet` and `RecipeEditorPanel` already compute them —
via the existing [`computeMacros`](src/lib/foodConversion.ts) helper.

## Schema

One new table, one column removed from the "parse the note" hack's reason
to exist (the note stays for human-readable display, but stops being the
source of truth).

```sql
-- 0058_extra_log_items.sql (actual final version, see the migration file)
create table extra_log_items (
  id uuid primary key default gen_random_uuid(),
  meal_log_id uuid not null references meal_logs(id) on delete cascade,
  client_id uuid not null references clientes(id) on delete cascade,  -- denormalized so RLS reuses private.is_owner_client, no subquery
  food_id uuid references foods(id) on delete set null,   -- always set: every row here comes from the catalog
  name text not null,
  grams numeric not null check (grams > 0 and grams <= 5000),
  kcal numeric not null check (kcal >= 0),
  protein_g numeric not null check (protein_g >= 0),
  carbs_g numeric not null check (carbs_g >= 0),
  fat_g numeric not null check (fat_g >= 0),
  source text not null check (source in ('barcode', 'catalog')),
  is_estimate boolean not null default false,  -- unused for now, kept for a future need to flag an unconfirmed row
  created_at timestamptz not null default now()
);

create index on extra_log_items (meal_log_id);
create index on extra_log_items (client_id);
create index on extra_log_items (food_id);

alter table extra_log_items enable row level security;

-- Same shape as meal_logs' own policies (private.is_owner_client / is_nutricionista_of_client).
create policy client_manages_own_extra_log_items on extra_log_items for all
  using (private.is_owner_client(client_id)) with check (private.is_owner_client(client_id));
create policy nutricionista_reads_extra_log_items on extra_log_items for select
  using (private.is_nutricionista_of_client(client_id) or private.is_super_admin());
```

`meal_logs` itself is untouched — plan-completion rows keep working exactly
as they do today. Only extras move from "macros encoded in `note`" to
"macros in `extra_log_items`, `note` kept as the plain-language summary
for display and for old rows." `scannedLogs.ts` becomes two code paths
(old note-parsed rows for history already in the database, new
`extra_log_items` rows going forward) rather than a migration that rewrites
history — simpler and nothing to get wrong on old data.

Indexes: on the two foreign keys, matching the project's existing
convention (see `idx_meal_logs_client_id` in
[0007](supabase/migrations/0007_messaging_push_calendar_business.sql)).
Access rule: Postgres RLS, same as every other client-owned table here —
not a new pattern.

## API

No edge function, no webhook, no scheduled job — everything goes straight
through `supabase-js`, same as `ScannedFoodSheet` and `RecipeEditorPanel`.

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `supabase.from('foods').select('*')` | already loaded once by `DietaClienteTab`; passed down to power the autocomplete | client, read-only (RLS: `foods_read_all`) | — | `Food[]` | F-new-1 |
| `supabase.from('meal_logs').insert(...)` then `.from('extra_log_items').insert(items)` | saves the chosen catalog items as one extra entry | client, own row | meal_log + items (each with `food_id`) | the saved rows | F-new-1 |

```
F-new-1  Log several catalog foods at once
    ExtrasQuickLogSheet (new, lives next to ScannedFoodSheet) -> add a row per
    ingredient, type-ahead against `foods` (same list DietaClienteTab already
    loads) -> pick a match -> set grams, macros computed live via computeMacros
    -> repeat for each ingredient -> confirm -> insert meal_logs + extra_log_items
    -> ExtrasHoyCard shows it
    happy path taps: ~2 per ingredient (search, pick) + 1 to confirm
    edge: a typed name matches nothing in the catalog -> that row contributes
    0 and is flagged, client either picks a real match, removes the row, or
    (if it has a barcode) uses the scanner instead
```

## The parts that bite

- **An unmatched row must not silently count as 0 kcal and get saved as if
  it were real.** `ExtrasQuickLogSheet` only saves rows with a resolved
  `food_id`; unresolved rows are visibly flagged and excluded from the
  total, never defaulted to zero and saved anyway.
- **Old data stays old.** Do not backfill `extra_log_items` from existing
  `note` strings. `scannedLogs.ts` keeps reading old rows via regex
  indefinitely; new rows go through the new table. One format, two readers,
  no migration risk to historical logs.
- **The catalog itself has a gap, and that's honest, not a bug.** If a
  client's real food isn't in `foods` yet, this feature can't log it
  precisely — same limit the nutricionista already works within when
  building a plan. The fix for that is a better catalog (more own-foods,
  more of the public base library), not a workaround inside this feature.

## Build order

1. **Vertical slice:** migration `0058_extra_log_items.sql` + a bare
   `ExtrasQuickLogSheet` with one row, the catalog autocomplete, and a save
   button. Proves the insert path end to end.
2. **Must-have:** multiple rows (add/remove), live totals, and the
   unmatched-row warning — what's built now.
3. **Could, later, only if clients actually ask for it:** inline grams-edit
   on `ExtrasHoyCard` after saving (today: delete and re-add), and surfacing
   each client's most-used catalog items first in the autocomplete.

## Rejected (from the recon, deliberately not planned)

- **An LLM parsing free text** — tried, reverted. See "Revision" at the
  top: cost and misplaced trust in a health-tracking context outweighed the
  benefit before anyone had asked for it. If this ever comes back, it
  should be because clients hit the catalog's limits often enough to
  justify it, not because 0xCal has it.
- **Fasting windows / fasting shield** — orthogonal to a trainer-managed
  plan; NutriFit's nutricionistas already control eating windows through
  the plan itself. Would be a whole new feature area with no evidence
  anyone asked for it.
- **Pantry re-ranked by time of day** — real complexity (four usage
  counters, a ranking algorithm) for a problem NutriFit doesn't clearly
  have: extras are already fast to re-log (`QUICK_GRAMS` shortcuts, and now
  catalog autocomplete). Revisit only if clients have enough repeat items
  for ranking to matter.
- **Conversational multi-turn correction ("and some butter")** — there's no
  AI estimate to correct anymore; adding/removing a row already does the job.
- **LiDAR "Ruler", Apple Health, wearables, Siri, Watch, widgets, "no
  account"** — already out of scope per the recon; none apply to a web app
  with an existing trainer/client account model.
- **Public accuracy benchmark page** — marketing for 0xCal, not a product
  feature; irrelevant to NutriFit's trainer-sold model.

## Summary

Stack: unchanged (Vite/React/Supabase), one new table, zero new services.
Tables: 1 new. Routes/calls: 2 (read catalog, insert). Riskiest part: an
unmatched ingredient must never get saved with invented numbers — it's
excluded, not defaulted. Next step: none pending — this is built, type-checks,
and the test suite is green; what's left is applying the migration and
trying it with a real client account.
