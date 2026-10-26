# Bugs found testing the extras-logging feature

Scope: `ExtrasQuickLogSheet` and `ExtrasHoyCard` only (the 0xCal + MyFitnessPal
work), driven manually through the demo (`/?demo=1` → client Laura Gómez /
María Torres → "Vista previa cliente" → Dieta → "Añadir varios alimentos"),
desktop and mobile (375×812) widths. No automated Playwright suite was added
— see `test-plan.md` for why.

### BUG-001: Saving an extras entry in demo mode did nothing visible

- Severity: S3 (broken with a workaround — real accounts are unaffected;
  visibly wrong in the one place prospects actually try the feature)
- Flow / case: F-new-1-H1 (happy path, demo mode)
- Screen: ExtrasQuickLogSheet
- Build: before commit `4155e7c`. Browser: built-in Chromium pane, 800×600.

Steps
1. Open the demo, preview a client, go to Dieta.
2. "Añadir varios alimentos" → search "Pechuga de pollo" → add a Quick Add
   row "Pastel casero de la abuela", 320 kcal → "Añadir a mi diario de hoy".

Expected: like `ScannedFoodSheet`, the new total shows up in "Extras de
hoy" and the day total immediately, even though nothing is persisted.
Actual: a toast appeared (not captured) and the sheet closed, but "Extras
de hoy" stayed at 192 kcal — the entry vanished.
Evidence: before/after screenshots, day total unchanged (192 kcal both times).
Suspected cause: the demo-mode branch in `save()` only showed a toast; it
never called `publishMealLogs`, unlike `ScannedFoodSheet`'s equivalent path.
Status: fixed in `src/components/client/ExtrasQuickLogSheet.tsx` (same
commit as this test pass) — demo mode now publishes to the shared
`mealProgress` snapshot like every other logging sheet.

### BUG-002: A "varios alimentos" entry displayed "0 g ·" in Extras de hoy

- Severity: S4 (cosmetic, but reads as broken data)
- Flow / case: F-new-1-H1
- Screen: ExtrasHoyCard

Steps
1. Add any entry through "Añadir varios alimentos" and save it.
2. Look at it in "Extras de hoy".

Expected: `"52 kcal · P 0,3 · C 14 · G 0,2"` (a multi-item entry has no
single grams total — by design, see `scannedLogs.ts`).
Actual: `"0 g · 52 kcal · P 0,3 · C 14 · G 0,2"` — the always-0 grams for
this entry type was printed instead of omitted.
Evidence: screenshot of "Manzana — 0 g · 52 kcal...".
Suspected cause: `ExtrasHoyCard.tsx` always rendered `{grams} g ·` without
checking whether this log actually carries a grams figure.
Status: fixed in `src/components/client/ExtrasHoyCard.tsx` — `0 g ·` is now
only shown when `info.grams > 0`.

## Not reproduced / out of this pass

- **Recent-items chips with real data** — `recentChips` is intentionally
  skipped in demo mode (no `extra_log_items` rows exist there), so the
  "añadir de nuevo" chip row could only be checked by reading the code and
  the unit-level logic (dedupe by `food_id`, exclude `quick_add` rows,
  limit 6), not by seeing it render. To check live: apply migrations 0058
  and 0059, log two or three catalog extras on a real client account, then
  reopen the sheet.
- **RLS policies** (`client_manages_own_extra_log_items`,
  `nutricionista_reads_extra_log_items`) — written against the same
  pattern as `meal_logs`' own policies, but nothing in this project is
  deployed yet, so they were reviewed, not exercised against a real
  Postgres instance.
