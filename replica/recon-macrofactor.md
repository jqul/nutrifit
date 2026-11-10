# Recon map: MacroFactor — researched for ideas for NutriFit (with a close look at its design)

Scope: the **MacroFactor Nutrition** app (iOS/Android) as a client-facing product: logging, targets, expenditure, weekly check-in,
dashboard and charts. Not MacroFactor Workouts (a separate app), not billing.
For: the same exercise already run against 0xCal, MyFitnessPal, Nutrium, Harbiz and Fitai Labs (`recon.md`, `recon-myfitnesspal.md`,
`recon-nutrium.md`, `recon-harbiz.md`, `recon-fitailabs.md`). The user's note: «el diseño parece bueno».
Date: 2026-11-09

No account, no login, no paywall was bypassed, and the app itself was not used. Everything comes from MacroFactor's **public**
website, its public help center, two public design/UX articles by the vendor, and two public comparison/review pages. The home page
screenshots were looked at in a browser (cookies declined) only to describe the visual design in our own words; nothing was copied
(no code, copy, assets or screenshots; `replica/screens/` stays empty). Each row paraphrases what a feature *does*.

**Bias warning.** Most of what is below is the vendor describing itself (its speed benchmark, its «three times more accurate»
claims, its comparison with Cronometer). The only third-party page found is a review by the founder of an app that pairs with
MacroFactor, and it says it synthesises published material rather than testing. No independent test or study was found. Rows say
which is which.

## Sources

| # | source | what it gave |
| --- | --- | --- |
| 1 | macrofactor.com (home, `/dashboard-revamp/`, `/mm-april-2022/`, `/fastest-food-logger/`, `/macrofactor-vs-cronometer/`) | dashboard and Strategy redesign (Sept 2024), food logger redesign (Apr 2022), the speed index, feature list and pricing (Aug 2026) |
| 2 | help.macrofactorapp.com (collection «MacroFactor Nutrition»: expenditure, weight trend, check-ins and coaching modules, program styles, weekly budget, dynamic maintenance, diet breaks, recomposition, integrations, how to log food) | how the algorithms behave at user level, settings, edge cases |
| 3 | gainframe.app review (Jul 2026) | praise and complaints, secondhand; author has a commercial tie |
| 4 | the home page, looked at in a browser | colours, type, layout of the phone mockups |

Not read: the Workouts app, release notes and roadmap pages, the speed-index spreadsheet, the Context-vs-Speed mode article, the
wearables page, the recipe-import page.

## What MacroFactor is

A **paid, premium-only calorie and macro tracker with an adaptive coach**. The user logs food and weight; the app estimates their
real energy expenditure from those two things only (no wearable energy data), and every week a check-in resets calorie and macro
targets towards the goal. Its identity is three things: the algorithm (expenditure + weight trend), the **speed of logging**, and an
**«adherence-neutral»** tone (no shaming, no red numbers, no demand for perfection). It is a consumer self-service product: there
is no nutritionist in the loop. A coach/trainer mode was not found in the pages read; the vendor only mentions «coached and
collaborative programs», which are algorithm modes, not a professional.

Price (vendor, Aug 2026): about 12 USD/month or 72 USD/year, 7-day trial, no free tier (the most common complaint per the review).

## Core loop

Log food (and weigh in) every day → expenditure and weight trend update → weekly check-in proposes new targets → follow them.

## Features and what NutriFit has today

| # | MacroFactor | source | NutriFit today |
| --- | --- | --- | --- |
| H1 | **Adaptive expenditure** from logged intake and weight trend (not wearables); shown as a daily value with an «updating / holding» state and a band | vendor + help | Nothing. Our clients tick off a plan, they do not count calories, so there is no reliable intake figure. Not a fit (see «Cannot or should not be cloned») |
| H2 | **Weight trend**: smoothed line that weights recent points, shown beside the raw scale value; gaps interpolated; trend drives the targets | help | Weight chart with a centred 3-point moving average (`trendLine.ts`); raw and smoothed are not shown together; no averages by range |
| H3 | **Weekly check-in** as a short sequence of skippable **coaching modules** (partial logging, weigh-in, fasting, logging break, program update); each explains why it appears and can be dismissed for good; early check-in up to 2 days before; day of the week configurable | vendor + help | Nutritionist's weekly review card and «Reajuste del plan» (`dietAdjustment.ts`, conservative, editable, applied by the nutritionist). Nothing guided on the client side |
| H4 | **Goal with a rate** (slider, green = recommended range) and **Goal ETA** | vendor + help | Goal weight and «¿Cómo vas?» sentence; no projected date, no chosen rate |
| H5 | **Adherence-neutral**: targets follow what was eaten, not what was prescribed; unlogged days are ignored rather than counted as failures; partly logged days flagged and the user decides | vendor + help | `calcAdherence` counts a day with no check-in as **not adherent** (denominator = all days). Reajuste already refuses to cut when adherence is under 70 % |
| H6 | **Weekly calorie budget**: move calories between days inside the week (coached/collaborative styles); manual style has none | help | Day types and options per meal exist; no weekly budget |
| H7 | **Dynamic maintenance**: near the target weight (within ~0.7 kg) targets track true maintenance; outside the band a small deficit or surplus (~0.15 % of body weight per week) | help | Phases have a «Mantenimiento» in the demo; the reajuste is about losing/gaining, not about holding |
| H8 | **Diet breaks / refeeds / recomposition**: no special mode; advice is to switch the goal to maintenance for 1–2 weeks or just eat near expenditure | help | Phases cover it by hand |
| H9 | **Food logger**: one screen with five methods (scan, search, quick add, describe, library) and a **plate** that stages the meal; «Add» vs «Log Foods»; **multi-add** «+» on each result; history first, then your foods, then common, then branded; **hourly go-tos** (what you usually eat at this hour); favourites on top; shortcuts from icon long-press, widgets, toolbar | vendor + help | Camera barcode scan and «Extras de hoy» (`ScannedFoodSheet`, `ExtrasQuickLogSheet`): one item at a time, no history/favourites/hour suggestions, no plate |
| H10 | **AI logging** (describe by text or voice, photo, multi-photo) | vendor | Not planned: a paid service, and the budget decision is no recurring costs |
| H11 | **Recipes**: custom, nested, prep/cook time and steps, recipe viewer, import from a URL | vendor | Recipes with type, tags, time, allergens, steps, book for the client, bulk import from a table. No nesting, no import from a URL |
| H12 | **Dashboard**: «Nutrition & Targets» with a tap-a-day column chart (deselect for the week), a day view that flips between «remaining» and «consumed», an **Energy Balance** card (30 days vs target or vs expenditure) | vendor | Client «Hoy llevas X kcal de Y»; the intake balance exists on the nutritionist's side only |
| H13 | **Charts**: edge-to-edge, default or full screen, **range chips (1W 1M 3M 6M 1Y All)**, pinch and pan, tap-and-hold tooltip, averages above the chart that follow the range, **insight cards** under the chart (change over 3/7/… days) | vendor + home page | Weight chart with change for the last week and 4 weeks; fixed range; no tooltip, no averages by range |
| H14 | **Habits and streaks**: calendar for quick entry, yearly view of streaks, fasting-day marks, optional period tracking | vendor | Streak and 7/30-day adherence, period logging that marks the chart; no yearly view |
| H15 | **Remembered choices**: day-view toggle, chart size, toolbar style are remembered per user | vendor | Dark mode is remembered; little else |
| H16 | **Shortcuts toolbar** (one-tap scan/search, top favourites above the nav bar, fades on scroll), home-screen widgets, watch app | vendor | None. A PWA cannot do widgets or a watch app, but the manifest can declare app shortcuts |
| H17 | **Integrations**: Apple Health / Health Connect for weight and nutrition, with a fixed priority; wearables' energy deliberately not used | help | Weight CSV import; no health-app sync |
| H18 | **Programme styles**: coached / collaborative / manual, switchable without losing data | help | The nutritionist is the coach; a plan can be edited or locked by them |

## What is good about the design (observed, in our own words)

From the vendor's design articles and the home page mockups:

1. **A dark, near-black interface with colour used as meaning, not decoration.** A warm coral/salmon for expenditure, a violet for the
   weight trend, green for «on target», white pill buttons for the primary action. Cards are flat, rounded, with no heavy shadows.
2. **Tone as a design principle.** The vendor says the dashboard is «colourful yet adherence-neutral»: no red failure states, no streak
   guilt, effort and consistency rewarded over perfection. This is a rule applied to colour, wording and what counts as a miss.
3. **Dense, scannable rows.** A food row is one line of name plus one compact line of numbers (calories, protein, fat, carbs, amount),
   with a small round «+» at the end. Foods carry a little illustrated icon, which makes a long list easier to scan.
4. **Chips for time ranges** under every chart, with the averages above the chart changing with the chip; **insight cards** below it
   showing change over preset spans with a tiny sparkline and an increase/decrease tag. Legend items double as state explanations
   («updating», «holding», «flux range»).
5. **Progressive disclosure.** The day view, the plate and the charts show the headline first; the detail (all nutrients, a macros
   tooltip, the full-screen chart) is one tap or one hold away, and the choice is remembered.
6. **One design system everywhere.** After redoing the food logger (Apr 2022) the team says it rebuilt «half the app» and then aligned the
   other screens to it (Strategy, dashboard, More). A recurring control pair («Add» / «Log Foods») and a single staging area («the plate»)
   are used by every logging method.
7. **Reach and defaults.** The search field and the primary button sit at the bottom, within thumb reach; the keyboard goes away when you
   scroll; the shortcuts toolbar fades while scrolling to give the screen back. A «speed» logging style is the default.
8. **Wide, heavy, tracked-out headline type on the marketing site** with simple black/white blocks; the app itself is calmer.

What I could **not** see: the real app's typography, spacing scale, dark/light variants beyond the dark mockups, motion, or empty/error
states. The statements above come from the vendor's text and from phone mockups, not from using the app.

## Screens (as far as the public pages show)

| ID | screen | purpose | states known |
| --- | --- | --- | --- |
| S01 | Dashboard | targets for the day, expenditure and weight-trend cards, energy balance | day vs week; remaining vs consumed |
| S02 | Food log / timeline | what was eaten by hour, a «+» per hour | long-press on an hour |
| S03 | Food logger (search, scan, quick add, describe, library) | stage foods on the plate and log once | plate open/closed; scrolled |
| S04 | Strategy | goal ring, check-in countdown, program style | check-in available / not; early check-in |
| S05 | Check-in modules | partial logging, weigh-in, fasting, logging break, program update | each skippable; dismiss for good |
| S06 | Expenditure and Weight trend charts | trend over a range with insight cards | range chips; default vs full screen; updating vs holding |
| S07 | Habits and data | calendar, streaks (year view), period tracking | on/off |
| S08 | More | settings, integrations, shortcut toolbar style, check-in day | |

## Flows

- F01 **Log a meal**: open logger (1 tap from the toolbar) → add each food (history/hour suggestions) → «Log Foods» once.
  Vendor benchmark: about 26 discrete actions across its four test cases vs 40 for MyFitnessPal (vendor-run, biased).
- F02 **Weekly check-in**: Strategy shows an alert → modules in sequence (skip any) → new weekly targets, accept or decline.
- F03 **Set a goal**: direction, target weight, rate slider → targets follow at the next check-in.

## Cannot or should not be cloned

- **The expenditure estimate (H1).** It only works if the user logs *every* meal and weighs often; its own help says partly logged days
  poison the estimate for about three weeks. NutriFit clients tick a plan; clients with «Ocultar calorías» must not see numbers at all.
  A guess built from ticks would look precise and be wrong.
- **AI/photo/voice logging (H10).** Paid; budget decision is no recurring costs.
- **Watch app, widgets, Apple Health/Health Connect sync (H16, H17).** Native-only. A PWA can declare app shortcuts, not widgets.
- **Its food database** (about 1.4 million verified foods, 4 million barcodes, per the vendor). Licensed/built over years. We have our
  own catalogue plus the barcode scanner backed by Open Food Facts.
- **Premium-only pricing model.** NutriFit has no payments by decision.

## Size

Studying the whole product: M. Taking the ideas below: each is S unless marked.

## What is worth taking for NutriFit (ranked, all free to run, no AI)

| # | idea | why it fits | size |
| --- | --- | --- | --- |
| M1 | **Weight chart like theirs**: range chips (1S/1M/3M/6M/Todo), raw weigh-ins as dots plus a smoothed trend line that weights recent points, average and change for the chosen range, a tap tooltip, and the choice remembered | The most directly reusable idea: our chart already has the data (weights, goal) and only lacks range, trend and averages | S |
| M2 | **«Sin culpa»: an unlogged day is not a failed day** — adherence over the days that have a check-in, with «N de 7 días registrados» shown, and wording/colours audited so the client never sees red for a gap | Our adherence number punishes forgetting to tick; it also drives the nutritionist's alerts, so fixing it changes who gets flagged. Needs a decision before changing | S–M |
| M3 | **Goal ETA**: «a este ritmo llegas a 74 kg hacia el 12 de enero», in «¿Cómo vas?» and in the nutritionist's reajuste | Pure function over the weights we already have; motivating without pressure | S |
| M4 | **Phase presets** (definición, mantenimiento, pausa de dieta, volumen) and a **maintenance mode in the reajuste** (hold within ~0.7 kg of the goal instead of proposing cuts) | Their dynamic maintenance and diet-break advice map straight onto our phases | S |
| M5 | **A guided weekly mini check-in for the client**: skippable steps (weigh in, «¿olvidaste apuntar algún día?», how it went), each saying why it appears | Their strongest UX pattern; feeds the nutritionist's weekly review with better data | M |
| M6 | **Extras logging like their logger**: history first, favourites, «lo que sueles tomar a esta hora», a «+» on each result, one «Guardar» for several items | Makes the scanner/extras flow faster; only for clients who see numbers | M |
| M7 | **Design pass inspired by their system**: compact one-line macros on rows (kcal · P · G · C), range chips and insight cards as shared components, colour tied to meaning, bottom-reach primary actions, «remaining/consumed» toggle remembered, dark mode following the system by default | Several are cheap and consistent with the design already in the app | S–M |
| M8 | **PWA shortcuts** in the client manifest (Registrar peso, Mi plan de hoy) | Their long-press shortcuts; the manifest is already generated per client | S |
| M9 | **Weekly calorie budget** the nutritionist can switch on per client («muévete hasta ±X kcal entre días») | Their flexible-dieting idea; needs care with clients who must not see numbers | M–L |
| M10 | **Import a recipe from a URL** (schema.org recipe data) | Fast way to grow the recipe book | M (needs a server function) |

Suggested order if the user says go: M1 → M3 → M4 → M7 → M8, then decide M2 and M5 explicitly.

## Update 2026-11-10: steps (the «reloj o móvil» question)

A web app cannot read steps from the phone or a watch (no browser access to Apple Health / Health Connect), and a native app or an aggregator would add recurring costs the user rejects. Built the free option: an optional «Pasos de hoy» field in the client check-in (`daily_checkins.steps`, migration 0072), shown as a neutral card (7/30-day averages, change vs the previous week, 14 daily bars) to the nutritionist and the client. No steps goal and no effect on adherence. An iPhone Shortcuts automation that posts the steps automatically stays as a possible later step.
