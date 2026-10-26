# Recon map: 0xCal (iOS, native) — researched for a web clone

Scope: full core loop — multimodal logging (text/photo/barcode), AI macro
breakdown, LiDAR "Ruler" portion sizing, conversational follow-up
corrections, pantry/catalog, intermittent fasting, weight + Apple Health.
For: improving NutriFit's client-facing food-logging flow (this repo).
Date: 2026-10-26

No app store account, no purchase, no login was used. Everything below comes
from 0xCal's public marketing site and its public App Store listing. No
screenshots were captured (none were accessible without opening the app), so
`replica/screens/` is empty — screen layouts below are inferred from copy and
should be treated as **medium confidence** until seen first-hand.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | marketing site | https://0xcal.app/ | full copy on logging, Ruler, follow-ups, pantry, fasting, no-account positioning, accuracy benchmark |
| 2 | App Store listing | https://apps.apple.com/us/app/0xcal-ai-calorie-tracker/id6749210009 | description, pricing/IAP, version history, ratings |
| 3 | version history (same listing) | — | dates features: Ruler (1.17.0), fasting (1.16.0), pantry matching (1.17.0), Siri/Shortcuts (1.18.0), follow-up question (1.18.1), voice logging + multi-panel (1.19.0) |

No help center, changelog page, or public API docs were found; `/accuracy`
and `/faq` are anchors on the single-page site, not separate pages, so FAQ
answers were not individually extracted (questions only).

## Core loop

Say or show what you ate (text, photo, or barcode); get back an editable,
correctable macro breakdown that gets more accurate the more you use it.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Quick-log sheet | tap "+" / main action | pick text, photo, or barcode without a mode-select step | unified action sheet | empty |
| S02 | Camera + Ruler capture | from S01, choose photo | shoot the plate; LiDAR sizes it (Ruler+ on LiDAR devices) | camera view, diameter/weight readout overlay | capturing, measured |
| S03 | Follow-up chat thread | opens after an estimate, or from S04 | add a missed item in plain language; estimate is rebuilt, not replaced | chat bubbles, text input | empty, awaiting reply, updated |
| S04 | Meal detail | tap a logged meal | per-ingredient breakdown, editable weights, estimate vs. resolved state per row | editable ingredient rows, kcal/macro subtotal | estimate, catalog-resolved, pantry-bound |
| S05 | Day log (today view) | app home | list of today's meals with running total vs. goal | day total header, meal list cards | empty, filled, over budget |
| S06 | Catalog search | from S04 row, "pick the real product" | swap a guessed row for a real catalog item | search box, result rows (name, brand, serving) | empty query, results, no match |
| S07 | Pantry | tab/section | saved foods, reordered by recency + time-of-day usage | pantry list item, first-run explainer ledger | empty, populated, first-open explainer |
| S08 | Barcode scanner | from S01, choose scan | live barcode scan; on-device OCR fallback if no catalog match | viewfinder | scanning, matched, OCR fallback |
| S09 | Fasting bar/screen | inline under day log | start, adjust, or end a fasting window without leaving the day view | inline progress bar | not fasting, fasting, ending |
| S10 | Weight tracking | tab/section | weight graph, synced from/to Apple Health | line chart | empty, trending |
| S11 | Integrations settings | settings | toggle Apple Health + wearables (Garmin, Whoop, Oura, Withings, Fitbit, Strava, Polar, veSync) | toggle rows | off, on, syncing |
| S12 | Paywall / trial | first run or after trial | 3-day trial, single "Unlimited" subscription, founders pricing | price card, trial terms | trial offer, expired |
| S13 | Contextual help | "?" icon on any screen | explains the numbers/logic on that specific screen | help popover | per-screen, varies |

States not seen anywhere in public copy and worth checking once the app is
installed: error/offline state for an AI estimate, permission-denied camera,
and what a resolved-but-later-edited pantry item does to past meals.

## Flows

```
F01 Log a meal by typing
    S01 -> (text) -> AI estimate -> S04 meal detail -> save -> S05 day log
    happy path taps: ~3
    edge: ambiguous description triggers an optional follow-up question (S03) before saving

F02 Log a meal by photo with Ruler
    S01 -> (photo) -> S02 capture, plate measured -> AI estimate -> S04 -> save -> S05
    happy path taps: ~3
    edge: non-LiDAR device skips Ruler+, portion read off scene depth only

F03 Log a meal by barcode
    S01 -> (scan) -> S08 -> catalog match OR on-device OCR of label -> S04 -> save -> S05
    happy path taps: ~2
    edge: barcode in no catalog -> OCR fallback -> manual confirm

F04 Correct an estimate conversationally
    S04 -> S03 ("and some butter") -> estimate rebuilt (not appended) -> S04 updated totals
    edge: a further correction (e.g. reduce butter to 5g) adjusts the same thread again, not a new entry

F05 Resolve a guessed ingredient to a real product
    S04 row (estimate) -> S06 catalog search -> pick product -> row becomes catalog-resolved
    -> next use of that food binds straight to S07 pantry, skipping the guess
    edge: no catalog match -> stays an estimate indefinitely

F06 Manage a fasting window
    S09 inline bar -> start / adjust / end, no tab switch
    edge: fasting shield blocks other food apps via Screen Time during the window

F07 Connect a wearable
    S11 -> toggle a provider -> provider writes into Apple Health -> steps/workouts/weight adjust the calorie budget
    edge: multiple providers write the same Health fields; 0xCal only reads from Health, doesn't dedupe sources itself

F08 Subscribe
    S12 -> start 3-day trial -> auto-converts to paid "Unlimited" at founders price unless cancelled
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Quick-log sheet | text / photo / barcode (one sheet, no mode picker) | default | S01 |
| Chat bubble + input | user message, AI estimate message | sending, updated | S03, embedded in S04 |
| Editable ingredient row | estimate (flagged), catalog-resolved, pantry-bound | default, editing weight | S04 |
| Day total header | under budget, over budget | — | S05 |
| Meal list card | text-logged, photo-logged, barcode-logged | — | S05 |
| Macro bars (carbs/fat/protein) | per-meal, per-day | — | S04, S05 |
| Ruler overlay | standard depth, Ruler+ (LiDAR) | measuring, measured | S02 |
| Catalog result row | community-sourced, Open Food Facts-sourced | — | S06 |
| Pantry list item | has use-count badge, time-of-day ranked | top-ranked, aged out | S07 |
| First-run ledger explainer | — | shown once | S07 |
| Fasting inline bar | not fasting, fasting, ends soon | — | S05/S09 |
| Integration toggle row | per provider (7 wearables + Apple Health) | off, on, error | S11 |
| Paywall price card | trial, converted | — | S12 |
| Contextual "?" popover | per-screen content | open, closed | every screen |

## Inferred data model

```
Meal        id, logged_at, source (text|photo|barcode), raw_input,
            total_kcal, total_carbs_g, total_fat_g, total_protein_g
            evidence: day-log entries ("2 fried eggs — 180 KCAL — 1g carbs/14g fat/12g protein")
            confidence: medium

MealItem    id, meal_id, food_id (nullable — null while still a guess),
            name, weight_g, kcal, carbs_g, fat_g, protein_g, is_estimate
            evidence: "Big Mac meal" resolving to three rows; pushing fries from 117g to 160g recalculates the total
            confidence: high

Food        id, name, source (community | open_food_facts), barcode (nullable),
            kcal_per_100g, carbs_per_100g, fat_per_100g, protein_per_100g,
            country, language
            evidence: "shared community catalog with Open Food Facts, filtered by your language and country"; Atwater sanity check at write time
            confidence: high

PantryItem  id, food_id, use_count, last_used_at,
            morning_count, afternoon_count, evening_count, night_count
            evidence: "use count, a last used date, and four time of day counters"; oat milk ranks top at 8am, drops by 8pm
            confidence: high

FastingWindow  id, start_at, end_at, plan (12:12 | 14:10 | 16:8 | custom), status
            evidence: App Store listing, v1.16.0 notes
            confidence: high

WeightEntry id, date, weight_kg, source (manual | health_sync)
            evidence: "weight progress is graphed, with Apple Health integration"
            confidence: medium

HealthIntegration  id, provider (garmin|whoop|oura|withings|fitbit|strava|polar|vesync),
            enabled, synced_fields
            evidence: "all write to Apple Health. Turn it on once..."
            confidence: medium
```

Relationships: Meal 1-n MealItem, MealItem n-1 Food (nullable until resolved),
Food 1-n PantryItem is really 1-1 per user (PantryItem wraps a Food with
usage stats), 1 user-scope 1-n FastingWindow, 1-n WeightEntry, 1-n
HealthIntegration.

**Open question carried as a guess:** 0xCal markets "no account" and
on-device storage, so there may be no server-side `user_id` at all — scope
above is per-device, not per-account. NutriFit already has accounts
(trainer/client model), so this is a real divergence to resolve in
`/replica-architect`, not something to copy as-is.

## Feature matrix

See `features.csv`. Must: 9, should: 10, could: 10, skip: 4 (totals include
all priority/clone rows).

## Out of scope (cannot or should not be cloned)

- **LiDAR "Ruler" depth measurement, Apple Health sync, Screen Time fasting
  shield, Siri Shortcuts, Apple Watch app, home-screen widgets** — all are
  iOS-exclusive APIs with no web equivalent. A web clone needs its own
  substitute for portion sizing (manual size input, a reference-object
  photo trick, or skip it) rather than a fake "Ruler".
- **0xCal's accumulated community catalog** — the public Open Food Facts
  data behind it is open and fine to use directly; the user-submitted
  corrections 0xCal itself has collected over time are their own data, not
  something to scrape or claim.
- **The specific accuracy-benchmark dataset and comparison copy/numbers**
  (110 foods vs. MyFitnessPal/Fitatu) — their own test results; a clone can
  run the same *kind* of benchmark against its own pipeline, not reuse
  theirs.
- **"gram" branding and exact prompt/model behind the AI estimate** — not
  observable from outside and not something to claim as reverse-engineered.

## Size

Screens 13, flows 8, entities 7. Hard parts: the estimate→follow-up→rebuild
chat loop (correction replaces math, not appends a new line), the
catalog-matching/merge logic against a public food database, and replacing
LiDAR-based portion sizing with something web-feasible. Size: **L** — a few
weeks, since this lands as an addition to NutriFit's existing client flow
rather than a greenfield app.
