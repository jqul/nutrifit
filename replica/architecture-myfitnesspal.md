# Architecture: Quick Add + "copy a recent item" from MyFitnessPal

Two small additions on top of what's already built for 0xCal
(`extra_log_items`, `ExtrasQuickLogSheet`). No new table, one new migration
that loosens an existing constraint, no new screen — both land inside
`ExtrasQuickLogSheet`.

## What's already covered, so it's out of this plan

- A catalog-backed multi-item extras log → `extra_log_items`,
  [ExtrasQuickLogSheet.tsx](src/components/client/ExtrasQuickLogSheet.tsx)
- Barcode scanning, day balance, weight tracking → unchanged, see
  `replica/architecture.md`
- Meal planning + grocery list (MFP's Premium+ feature) → NutriFit's own
  diet-plan editor + `buildShoppingList` already does this,
  nutricionista-authored instead of generated

## Addition 1: Quick Add

Today, a row in `ExtrasQuickLogSheet` that doesn't match a catalog food is
excluded entirely — the client just can't log it. Quick Add is the
fallback: type a label and the numbers by hand (kcal required, macros
optional), no catalog match needed. No AI involved — these are the
client's own numbers, same as reading a label by eye, not a guess made for
them.

**Schema:** `extra_log_items.food_id` is already nullable. The only change
is the `source` check constraint, which today only allows `'barcode'` and
`'catalog'`.

```sql
-- 0059_extra_log_items_quick_add.sql
alter table extra_log_items drop constraint extra_log_items_source_check;
alter table extra_log_items add constraint extra_log_items_source_check
  check (source in ('barcode', 'catalog', 'quick_add'));

-- `is_estimate` already exists and was unused (see 0058) — reused here:
-- true for a quick_add row (the client's own eyeball numbers, not a
-- verified catalog value), false for 'barcode' and 'catalog'.
comment on column extra_log_items.is_estimate is
  'true for a quick_add row (unverified manual numbers); false for barcode/catalog rows (verified values).';
```

**UI:** a small toggle at the top of `ExtrasQuickLogSheet`: "Buscar en el
catálogo" (today's behavior) / "Apuntar solo macros" (Quick Add: a label +
4 numeric inputs, kcal required, protein/carbs/fat default to 0). Unlike
MFP, no Premium-gating macros behind a paywall tier — there's no reason to
withhold protein/carbs/fat from a client who wants to type them; MFP's gate
there is a monetization mechanic (already flagged out of scope in the
recon), not a UX idea worth copying.

**Save path:** same as today — one `meal_logs` row + one or more
`extra_log_items` rows, just with `food_id: null, source: 'quick_add',
is_estimate: true` instead of a catalog match. The note-string fallback in
`scannedLogs.ts` needs a third branch (today it recognizes
`"(producto escaneado"` and `"(varios alimentos"`); reuse the same
`"(varios alimentos"` suffix for Quick Add too — from the diary's point of
view it's the same shape (several macro totals in one entry), so no new
regex branch is needed, only the save code path differs.

## Addition 2: Copy a recent/frequent item

MFP's own numbers say swipe-to-copy is its single highest-used shortcut
(11% of loggers, 8.6M uses in a month) — worth taking seriously. The
NutriFit version: show up to 6 of the client's most recently logged
catalog items as tap-to-add chips at the top of `ExtrasQuickLogSheet`,
before they type anything. Tapping one adds a resolved row immediately,
pre-filled with the grams they used last time (editable, as any row
already is).

**No schema change.** Reads straight from `extra_log_items`, which already
has everything needed:

```ts
// in ExtrasQuickLogSheet, on open
const { data } = await supabase.from('extra_log_items')
  .select('food_id, name, grams')
  .eq('client_id', clientId).eq('source', 'catalog')
  .order('created_at', { ascending: false }).limit(20)
// dedupe by food_id client-side, keep first occurrence (most recent), take 6
```

Client-side dedupe over a `limit(20)` read, not a `distinct` query — simpler
than a window-function query, and 20 rows is nothing to filter in the
browser. `quick_add` rows are excluded (no `food_id` to re-resolve against
the catalog — there's nothing to "re-add," it'd just be another manual
entry).

**UI:** a horizontal row of chips (`"Arroz blanco (cocido)"`,
`"Pechuga de pollo"`, ...) above the search rows, each a food name only
(no grams shown on the chip — the grams come from the row it creates,
immediately editable). Tapping one appends a pre-filled, already-resolved
row to the list, same as picking it from the search dropdown would.

## The parts that bite

- **Quick Add's numbers are the client's own, not verified against
  anything** — unlike a catalog row, a Quick Add entry has no Atwater
  check, no label to double-check against. That's accepted, not a bug: the
  client is doing what they'd do with a label anyway. No validation beyond
  the same numeric bounds the migration already enforces (`kcal <= 950*5`,
  macros `<= 500`).
- **Recent-items chips must only offer catalog-backed foods.** A
  `quick_add` row re-offered as a chip would invite the client to "copy" a
  number they made up once, presenting it as if it were a real re-lookup —
  filtering `source = 'catalog'` in the query above is what prevents that,
  not an incidental detail.
- **Dedup by `food_id`, not by name.** Two different catalog entries can
  share a similar name; keying the chip list by `food_id` is what makes
  "tap to re-add" actually re-add the same row, not a different one that
  merely looks the same.

## Build order

1. **Vertical slice:** migration `0059` (constraint change) + the Quick
   Add toggle and its save path. Proves the schema change end to end.
2. **Must-have:** the recent-items chip row, since it's the cheaper build
   and (per MFP's own numbers) likely the higher-leverage one.
3. Both ship together in practice — neither depends on the other, and
   together they're still a small, same-sprint change on top of what's
   already built.

## Rejected (from `recon-myfitnesspal.md`, deliberately not planned)

- **Copy a previous day's entries wholesale** — real gap, smaller payoff
  than the two above; revisit only if clients ask for it specifically.
- **Multi-day diary (view/edit a past day)** — same reasoning; today
  everything logs to "today" by design, and nothing in the recon showed
  evidence this is actually blocking anyone yet.
- **Streak/commitment popups, the multi-day paywall gate, recipe-URL
  import, AI Coach, GLP-1 logging, device-sync hub, workouts/steps, Net
  Carbs Mode** — see `recon-myfitnesspal.md`'s "Out of scope" and the
  feature matrix; none survive the same bar applied to 0xCal.

## Summary

Stack: unchanged. Tables: 0 new (one altered constraint via migration
0059). Routes/calls: 1 new read (recent items). Riskiest part: making sure
Quick Add rows can never be mistaken for verified catalog values, in the
UI and in the recent-items query alike. Next step: implement — this is
small enough to build directly rather than needing `/replica-design`.
