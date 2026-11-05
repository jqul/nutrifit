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

## Update 2026-11-04 (second pass): P1, P2 and P3 built

All three proposals above were built on `feat/recetas` (migration 0062):

- **P1 — recipe metadata:** `recipes.meal_type`, `recipes.tags`, editor fields, search + filters in the recipe list.
- **P2 — client recipe book:** `recipes.in_recipe_book` + a «Libro de recetas» button in the client's Dieta tab. Visibility is
  per recipe (visible to every client of the nutritionist, or only through the plan); **by client tag was not built**.
  This also **tightened the RLS**: until now a client could read *every* recipe of their nutritionist through the API
  (the app only showed the ones in their plan); now they read a recipe only if it is in their book or in their active plan.
- **P3 — «Proponer menú»:** `menuProposal.ts`, no AI. Splits the daily kcal (25/35/10/30 %), picks one recipe per slot
  by type, allergens, protein density and how little it has to be scaled (0.5×–2×), never repeats a recipe, offers variants.
- Still not built: P4 (plan by email) and P5 (AI generation), by decision.

## Update 2026-11-04 (third pass): more research and what was built

Sources (public pages, read 2026-11-04; paraphrased, nothing copied):
help-center articles on creating nutrition plans, on creating/sharing recipes, on the Library section, on the initial client
questionnaire and on the new forms (intercom.help/harbiz-help), and the product pages on nutrition planning, client
evolution and the client app (harbiz.io).

### What else Harbiz does that is relevant (and where NutriFit stands)

| # | Harbiz | NutriFit today | Verdict |
| --- | --- | --- | --- |
| N1 | **Programs**: weekly blocks that bundle nutrition, forms, videos, documents, scheduled messages and progress records; can auto-archive the client at the end and chain into another program; assignable to a client or a group | weekly menu, templates, recurring surveys and scheduled messages exist separately; **no phases** (e.g. 4 weeks deficit → 2 weeks maintenance) | **Biggest gap.** Proposal F1 |
| N2 | **Body metrics**: weight, % fat, body measurements, **custom metrics**, history, graphs, and the professional can hide a metric from the client | weight + progress photos + lab results; **no body measurements / custom metrics** | Gap. Proposal F2 |
| N3 | Photo comparison across dates | progress photos exist; comparison view not checked | Check, maybe small |
| N4 | Recipe fields: portion size, prep time, category, allergens + diet type, tags, YouTube/Vimeo link | name, photo, steps, meal type, tags | **Diet type, prep time, video built**; portion size and allergen tagging not built |
| N5 | Recipe/document visibility: all / hidden / **by client tag** | per recipe: plan-only / book / book by tag (built) | **Built** (migration 0064) |
| N6 | Documents visible to all, none, or by tag | guides: all clients | **Built** for guides (migration 0064) |
| N7 | A hidden recipe inside a plan shows the client only the ingredient list | our client sees the steps of any recipe in their plan | Not built; low value |
| N8 | Initial questionnaire with switchable fields (goal, phone, starting weight, height, sex, PAR-Q) feeding the TDEE formulas and the first weight | anamnesis + consent + custom questions exist; fields are not switchable | Partial; low value |
| N9 | Forms: short/long text, single/multiple choice, number, 1-5 scale, yes/no, file; export a client's answers; auto-assign on purchase | custom surveys + anamnesis question types; export exists in GDPR export | Mostly covered |
| N10 | Client app: today's plan, weekly summary, schedule, nutrition, progress + **achievements**, chat, **community groups**, videos, files, store | Hoy, Dieta, Progreso («Tu semana»), Más, guides, messages; no achievements, no groups | Achievements = small retention win (F3). Groups/store: skip (no payments) |
| N11 | Habit tracking is just water at meals + reminders (their own blog is thin on it) | check-in has water, hunger, energy, mood, digestion | We are ahead |
| N12 | Weak points users report: nutrition UI for building recipes, small food/menu base, price vs. performance, no clinical features | — | Our angle: simpler editor + clinical data (labs, notes, consent) |

### Built in this pass (feat/harbiz-2, migration 0064)

- Recipe visibility **by client tag** and guide visibility **by client tag** (enforced by the read policies, tested with
  simulated roles); recipe **diet types**, **prep time** and **video link** (https YouTube/Vimeo only).
- The **«Ocultar calorías y macros»** switch now also sits in the client's **Plan de dieta** tab, next to the plan
  objective (it was only at the bottom of Perfil, which was hard to find).

### Proposals (not built)

| id | idea | cost |
| --- | --- | --- |
| F1 | **Fases del plan**: a client timeline (name, dates, plan/template per phase), «estás en la fase 2 de 3», a reminder to the nutritionist when a phase ends. Automatic plan switching only as a second step | medium (table + panel + one more alert); automatic switch = high (cron + save_diet_plan as service) |
| F2 | **Medidas corporales y métricas propias** (% grasa, cintura, cadera…, history, chart, per-metric «ocultar al cliente») | medium (table + RLS + charts + hide flag) |
| F3 | **Logros** in the client's Progreso (first weigh-in, 7/30-day streak, % of the goal reached…), pure function over data we already have | small |
| F4 | Photo comparison by date (if missing) | small |
| F5 | Recipe portion size + allergen tags (feeds the menu proposal and the client's allergy check) | small–medium |

### Fases del plan (F1), first version built on feat/fases (migration 0065)

A per-client timeline (name, dates, text for the client, optional reference template). The client sees «Tu fase · 2 de 3» in Hoy;
the nutritionist sees «Fases por revisar» in the control center when a phase ends within 3 days or ended without a successor.
**It does not change the plan on its own** (that step needs a cron + save_diet_plan as service role; still a proposal). The
push digest does not include phase endings yet (it would need a new alert kind in the shared code and a redeploy of
send-nutricionista-alerts).

### Medidas corporales (F2) built on feat/medidas (migration 0066)

`metric_definitions` (standard ones created once per nutritionist, plus custom ones; each can be hidden from the client) and
`body_metrics` (value + date, one per client/metric/day). The nutritionist records them in Seguimiento; the client reads the
visible ones in Progreso → «Tus medidas». The client cannot write them yet (Harbiz lets clients add their own records: possible
follow-up). **Correction to the table above:** NutriFit already had client **achievements** (`AchievementBadges` in Progreso: first
weigh-in, streaks, hydration goal, meal photos), so F3 is not a gap.

### Last bits (feat/medidas-cliente-alergenos, migration 0067)

The client can now record their own body measurements (only visible metrics, no future dates, enforced by RLS). Recipes carry
**allergens** and **servings**: the menu proposal skips a recipe whose allergen tag clashes with the client's allergies, and the
client's recipe book warns about it. What remains from the Harbiz list: nothing worth doing now (programs with automatic plan
switching and push alerts for phase endings stay as proposals).
