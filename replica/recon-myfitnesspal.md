# Recon map: MyFitnessPal (iOS/Android, native) — researched for ideas for NutriFit

Scope: the diary/logging core loop and its gamification/retention layer
(Quick Add, copy-a-previous-entry, streaks, multi-day diary, recipe import,
water tracking, meal planning) — not the whole app (workouts, step
tracking, GLP-1 medication logging, device-sync hub are out: see below).
For: finding genuine gaps in NutriFit's client-facing food logging, the
same exercise already run against 0xCal (see `replica/recon.md`).
Date: 2026-10-26

No account, no login, no paywall was bypassed. Everything below comes from
MyFitnessPal's public pricing page, its App Store listing, and public
community/forum discussion of specific features. No screenshots were
captured; `replica/screens/` stays empty.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | pricing page | https://www.myfitnesspal.com/premium | feature-to-tier mapping (Free vs. Premium), pricing |
| 2 | App Store listing | https://apps.apple.com/us/app/myfitnesspal/id341232718 | description, feature highlights, Premium/Premium+ split, version history |
| 3 | public community/forum threads (MyFitnessPal feature-suggestions board, a 2015 Cronometer forum thread, a Behance case study on "swipe to copy") | various | Quick Add behavior, streak-popup complaints, swipe-to-copy usage stats — all third-party, treated as medium/low confidence |

No official help-center article on Quick Add, streaks, or the diary's
multi-day view was found; those rows below are lower confidence than the
tier/pricing table.

## Core loop

Log what you ate (search, barcode, or just type a number) against a
14M+-item database, see the day's macros update, get nudged back tomorrow.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Diary (day view) | app home | meals of the day with running totals vs. goal | meal sections, day total header | empty, filled, past day (read-only parts), over/under goal |
| S02 | Food search | "+" on a meal | search 14M+ foods, log a serving | search box, result rows | empty query, results, no match |
| S03 | Barcode scanner | from S02 | scan a packaged product | viewfinder | scanning, matched, not found (Premium-gated per some sources) |
| S04 | Quick Add | from S02, a separate tab | log raw kcal (free) or kcal+macros (Premium) with no food match at all | numeric inputs only | free (kcal only), Premium (full macros) |
| S05 | Recent/frequent foods | S02 default tab | fast re-log of what's already been eaten before | list with swipe-to-copy | empty, populated |
| S06 | Recipe import | recipes section | paste a URL, get parsed ingredients + macros | URL input, parsed ingredient list | parsing, parsed (sometimes wrong), failed |
| S07 | Streak / commitment popup | interstitial after logging | gamified nudge to keep a logging streak | modal/banner | shown, dismissed (users ask for a mute option) |
| S08 | Water tracker | diary section | log hydration separately from food | counter/stepper | empty, filled |
| S09 | Meal plan builder (Premium+) | separate section | personalized meal plan toward targets, generates a grocery list | plan calendar, grocery list | — |
| S10 | AI Coach (Premium) | chat tab | nutrition Q&A, meal suggestions from a fridge photo | chat thread | — |

## Flows

```
F01 Log a meal by search
    S01 -> S02 search -> pick a result -> set serving -> save -> S01 updated
    happy path taps: ~4

F02 Quick Add a number with no food match
    S01 -> S02 -> S04 Quick Add -> type kcal (free) or kcal+macros (Premium) -> save
    happy path taps: ~3
    edge: free users can only enter kcal, not macros (gated)

F03 Re-log something already eaten before
    S01 -> S05 recent/frequent -> swipe to copy -> same entry logged again, no re-search
    (Behance case study: 11% of loggers used this 8.6M times in one month —
    the single highest-leverage shortcut in the app)

F04 Copy a previous day's logged meals
    S01 (past day) -> select entries -> copy to today
    edge: diary beyond a short window needs Premium (multi-day logging gate)

F05 Import a recipe from a URL
    S06 -> paste URL -> parsed ingredients (often wrong on vague instructions) -> edit -> save -> logs like any other food
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Quick Add numeric form | kcal-only (free), full macros (Premium) | — | S04 |
| Swipe-to-copy row | recent, frequent | swiped, copied | S05 |
| Streak/commitment interstitial | — | shown, dismissed, (requested: muted) | S07 |
| Multi-day diary nav | free (short window), Premium (7+ days) | locked, unlocked | S01 |
| Recipe URL parser | — | parsing, parsed, failed | S06 |
| Water counter | — | — | S08 |

## Inferred data model

```
DiaryEntry   id, date, meal_slot, source (search | barcode | quick_add | recipe | copied),
             food_id (nullable for quick_add), name, kcal, proteinG, carbsG, fatG
             evidence: diary day view, Quick Add description
             confidence: medium

QuickAddEntry  same shape as DiaryEntry but food_id always null, macros optional
             (kcal required, macros Premium-gated per the 2015 forum thread — unconfirmed for the
             current app)
             confidence: low — dated source

RecentFood   food_id, last_logged_at, log_count
             evidence: "recent/frequent foods" tab, swipe-to-copy usage stats
             confidence: medium

WaterLog     date, amount_ml
             confidence: medium (feature confirmed to exist; exact fields guessed)

StreakState  current_streak_days, longest_streak, last_logged_date
             evidence: community complaints about the popup, implies a persisted streak count
             confidence: low
```

Relationships: User 1-n DiaryEntry, DiaryEntry n-1 Food (nullable for
Quick Add), User 1-n WaterLog, User 1-1 StreakState.

## Feature matrix

See `features-myfitnesspal.csv`.

## Out of scope (cannot or should not be cloned)

- **The 14–20M food database itself** — MyFitnessPal's own aggregated,
  partly user-submitted catalog. NutriFit already has the right public
  substitute (Open Food Facts + its own `foods` table); growing that
  catalog is the real lever, not scraping theirs.
- **AI Coach** — same call already made against 0xCal: an AI giving
  nutrition guidance in an app where a real nutricionista is the authority
  is a liability, not a feature, for this product.
- **GLP-1 medication logging, device-sync hub (35–40+ wearables), workout
  and step tracking** — a different product surface (general fitness
  tracking) than a trainer-managed nutrition plan; no evidence any
  NutriFit nutricionista or client has asked for it.
- **Recipe import from a URL** — "accuracy is mixed, struggles with vague
  instructions" per the sources themselves; not worth building something
  users already report as unreliable in the original.

## Size

Screens 10, flows 5, entities 5. The three hardest/most-debatable parts:
telling a genuine Quick-Add gap from a "nice to have," deciding whether a
streak/gamification layer fits a product sold through a trainer
relationship rather than habit-loop retention, and scoping multi-day
editing without turning the extras log into a second diet-plan editor.
Size: **S** for the one or two items likely worth it (see architecture),
not attempting the rest.
