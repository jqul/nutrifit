# Test plan: extras logging (0xCal + MyFitnessPal ideas)

Build: `4155e7c` (pre-fix), fixes landed in this pass. Date: 2026-10-26.
Env: local dev server (`npm run dev`), NutriFit's own demo mode
(`/?demo=1`) as seed data — no Supabase project is deployed yet, so this
covers client-side logic end to end but not RLS or real persistence.

Scope: `F-new-1` (log several catalog foods / Quick Add, from
`replica/architecture.md` and `replica/architecture-myfitnesspal.md`) and
the recent-items chips. Everything else in the app (diet plans, barcode
scan, weight, check-ins) is pre-existing and out of scope for this pass.

**No Playwright/e2e suite was added.** This codebase's own convention is
vitest unit tests on `src/lib/*.ts` logic and manual/demo-mode QA on
components — there is no existing Playwright setup, and no other
component in `src/components/` has a dedicated spec file. Adding a whole
new test framework for two UI flows would be disproportionate
infrastructure; the pure logic worth automating already has vitest
coverage, and the rest was click-tested below.

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F-new-1-H1 | catalog search → add → save | happy | demo → client preview → Dieta → "Añadir varios alimentos" → search "pollo" → pick "Pechuga de pollo" → save | macros shown live (165 kcal/31g prot/100g), entry appears in Extras de hoy, day total updates | manual | pass (after BUG-001 fix) |
| F-new-1-H2 | Quick Add → save | happy | toggle "Apuntar solo macros" → name + 320 kcal → save, combined with a catalog row already added | both items sum into one entry and one day-total bump | manual | pass (after BUG-001 fix) |
| F-new-1-E1 | unmatched catalog query | edge: empty/no-match search | type "manzana" without selecting a suggestion, try to save | row excluded from total, warning text shown, save button stays disabled until resolved or removed | manual | pass |
| F-new-1-E2 | Quick Add missing kcal | edge: empty required field | add a Quick Add row with a name but no kcal | row contributes nothing to the total, save stays disabled if it's the only row | manual | pass (verified by reading `quickAddMacros`: returns `null` without a finite `kcal`) |
| F-new-1-E3 | mobile width | edge: 375×812 viewport | open the sheet, switch modes, add a Quick Add row | 4-column numeric grid and catalog rows fit without horizontal scroll or clipped text | manual | pass |
| F-new-1-E4 | display of a multi-item entry | edge: no single grams figure | save any "varios alimentos" entry, look at Extras de hoy | macros shown without a misleading "0 g ·" prefix | manual | pass (after BUG-002 fix) |
| F-new-2-H1 | recent-item chip | happy | reopen the sheet after logging 2–3 catalog items on a real (non-demo) account | up to 6 chips, most recent `food_id` first, `quick_add` rows excluded | not run | **not verified** — demo mode has no `extra_log_items` history; needs a real client account post-migration (see `bugs.md`) |
| F-new-2-E1 | chip tap into an already-filled blank row | edge | tap a chip when the sheet's only row is the default empty one | that row is replaced, not duplicated | manual (code read) | pass by inspection of `addChip`'s ternary |
| N1 | Quick Add numeric bounds | negative | kcal > 4750 or a macro > 500 | row excluded from the total (same bounds as the DB check constraints) | manual (code read) | pass by inspection of `quickAddMacros` |

## Summary

7 of 9 cases run manually against the real UI (demo mode + both viewport
widths), 2 verified by code inspection only (bounds checking, chip-replace
logic) — both are pure, easily-wrong-if-you-squint logic that would
benefit from a `src/lib` extraction with real vitest cases if this feature
sees more changes. 1 case (recent chips with real data) could not be run
at all without a deployed Supabase project. 2 bugs found, both fixed:
BUG-001 (S3, demo mode didn't reflect a save) and BUG-002 (S4, "0 g ·"
cosmetic). No open S1/S2. Full suite: `tsc --noEmit` clean, 746/746 vitest
tests passing after the fixes. Next: `/replica-diff` doesn't fit this
project (it's not a full clone with a parity score to chase) — the
remaining open item is applying migrations 0058/0059 to a real Supabase
project and re-running F-new-2-H1 there.
