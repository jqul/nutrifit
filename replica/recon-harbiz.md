# Recon map: Harbiz (nutrition module) — researched for ideas for NutriFit

Scope: only the nutrition side of Harbiz (diet plans, recipes, what the client sees). Not the booking, payments,
video-call or training modules.
For: finding genuine gaps in NutriFit's plan editor and client app, the same exercise already run against 0xCal,
MyFitnessPal and Nutrium (`replica/recon.md`, `recon-myfitnesspal.md`, `recon-nutrium.md`).
Date: 2026-11-04

No account, no login, no paywall was bypassed. Everything below comes from Harbiz's **public help-center articles**
about nutrition. Nothing was copied (no code, copy, assets or screenshots; `replica/screens/` stays empty) and what is
written here is a paraphrase of what each feature *does*, so NutriFit's versions are written from scratch. The exact
article URLs were not recorded at the time, so treat the rows as medium confidence and re-check the article before
leaning on a detail.

## Core loop

The professional builds a plan (from a template or from scratch, or generates one), sends it, and the client follows it
and browses recipes in their app.

## What Harbiz's nutrition module does (as described publicly)

| # | Harbiz feature | what it does | NutriFit today |
| --- | --- | --- | --- |
| H1 | Plan templates and "programs" | reusable plans; programs group content over time | templates: **yes** (Plantillas). multi-phase programs: not looked at |
| H2 | Macros as grams **or percent** | targets can be typed either way | **done on this branch** (`macroUnits.ts`, toggle in the plan objective) |
| H3 | Energy expenditure calculator | BMR/TDEE with an activity factor | **yes** (`metabolicCalculator.ts`, Calculadora metabólica) |
| H4 | Meal options | several alternatives for a meal, client picks | **yes** (`optionGroup`, «Opciones») |
| H5 | Shopping list | list built from the plan | **yes** (grouped by aisle, shareable) |
| H6 | Plan by email | send the plan to the client | PDF download and in-app plan: **yes**; sending by email: **no** (WhatsApp link only) |
| H7 | AI plan generation | builds a plan from a few inputs, from a recipe base, paid by credits | **no, and not decided**: needs an explicit product decision (cost, health liability, quality of what it produces) |
| H8 | Recipes with metadata | allergens, diet type, meal type, tags | recipes with photo and steps: **yes**; searchable metadata/tags: **partial** (allergens are matched by name, no diet/meal-type tags on recipes) |
| H9 | Recipe visibility | a recipe can be visible to all clients, hidden, or only to clients with certain tags | **no**: every recipe linked in a plan shows up, nothing is browsable outside the plan |
| H10 | Client «recipe book» | the client browses the recipes they are allowed to see | **no** (they see only recipes attached to meals) |
| H11 | Hide calories/macros from the client | for clients who should not see the numbers | **done on this branch** (migration 0061, Perfil → «Lo que ve en su app») |

## What was built from this

1. **H11 — ocultar calorías y macros a un cliente.** Per-client setting (`clientes.hide_numbers`). The client's app shows
   the plan without any energy or nutrient figure (no daily target, no per-meal kcal, no macro pills, no fibre, no day
   balance, no PDF figures) and hides what only exists to count (product scanner, extras). The nutritionist sees
   everything. Reaches the client through `get_my_client_profile` (the function lists columns one by one).
2. **H2 — macros en g o en %.** Pure conversion (4-4-9 kcal/g) with tests; the plan stays stored in grams, only the
   editing view changes, with a «Reparto: X % de las kcal» check that warns when it is far from 100.

## Proposals (not built — they need an explicit OK)

| id | idea | why | cost / risk |
| --- | --- | --- | --- |
| P1 | Recipe metadata (meal type, diet type, free tags) and a search in the recipe list | closes most of H8 with no schema risk | small migration + editor fields + filter |
| P2 | Recipe visibility (all / only linked in plan / by client tag) and a **client recipe book** tab | closes H9 + H10; strong for retention | migration + RLS on recipes for clients (careful: clients must only read what they are allowed to) |
| P3 | **«Proponer menú desde mis recetas»** — non-AI: pick recipes of the nutritionist's own and fill meals to approach the kcal/macro target | the useful 80 % of H7 with no model, no credits, no liability | pure function + tests + a modal; no new tables |
| P4 | Send the plan by email | H6 | needs an email provider/function; not worth it while WhatsApp + PDF work |
| P5 | AI plan generation | H7 | **only if the product owner decides**: cost per plan, wrong-plan liability, allergens |

Recommendation: P1 → P3 → P2, in that order; skip P4/P5 for now.

## Out of scope

Payments, booking, video calls, training/workout programs (the product decision «no cobros» stands).
