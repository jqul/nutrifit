# Recon map: Fitai Labs (nutritionists' side) — researched for ideas for NutriFit

Scope: only what Fitai Labs offers to **nutritionists** and their clients (plan generation, follow-up, client app, automation).
Not the gym / trainer sides (classes, bookings, memberships), which do not apply to NutriFit.
For: finding what is worth taking, in the same exercise already run against 0xCal, MyFitnessPal, Nutrium and Harbiz
(`recon.md`, `recon-myfitnesspal.md`, `recon-nutrium.md`, `recon-harbiz.md`).
Date: 2026-11-05

No account, no login, no paywall was bypassed. Everything below comes from Fitai Labs' **public website** (home, product,
nutritionists, pricing and use-cases pages) and a public startup directory entry. Nothing was copied (no code, copy, assets or
screenshots; `replica/screens/` stays empty); each row is a paraphrase of what the feature *does*. The product itself was not
used, so anything that is only a marketing claim is marked as such and the vague phrases are discounted.

## Sources

| # | source | what it gave |
| --- | --- | --- |
| 1 | fitailabs.com (home, `/es/product`, `/es/solutions/nutritionists`, `/es/pricing`, `/es/5-casos-uso-ia`) | modules, nutritionist page claims, plans and prices (the use-cases page only loaded its intro and FAQ) |
| 2 | madri+d startup directory entry for Fitai Labs | company: Spanish startup (2024), app for exercise and nutrition; an older consumer-app pricing (9,99 € / 17,99 € per month) that no longer matches the professional product |

Public ones also say it is backed by Google for Startups and Lanzadera. Third-party reviews of the product were not found, so
there is no user feedback to weigh the claims against.

## What Fitai Labs is

An **AI-first practice platform** for trainers, gyms and nutritionists: an AI copilot drafts plans in the professional's style, a
white-label client app delivers them, and billing, scheduling and a lead CRM are bundled. For nutritionists the pitch is «un plan
en 2 minutos en vez de 90», reviewed and sent by the professional.

## What it does for nutritionists (as described publicly)

| # | Fitai Labs | confidence | NutriFit today |
| --- | --- | --- | --- |
| A1 | **Plan from a chat**: the nutritionist describes the case in a conversation (no forms) and the AI drafts a full plan (their demo: 1900 kcal, vegetarian, 5 meals, macro split, tags like «sin lácteos», «alta saciedad», «mediterránea») | claim; no way to check quality | **No AI.** Plan editor, templates, calculator, «Proponer menú» from the nutritionist's own recipes (no AI) |
| A2 | **Draft, never final**: the AI proposal is edited (foods, portions, distribution, clinical criteria) before it is published | specific | Same philosophy: «Proponer menú» and the weekly review are proposals the nutritionist accepts, edits or discards |
| A3 | **Their own method**: macros, clinical criteria, allergies/intolerances, FODMAP, gluten-free, vegan… configured once and applied to every plan; «trained on your clinical approach» | scope specific, mechanism vague | Allergens and diet types on recipes (this week), client allergies respected by substitutions and by the menu proposal. No per-nutritionist «rules» |
| A4 | **Substitutions** by preference, budget or season | specific, no detail | Same-group equivalents with quantities, never a food that clashes with the allergies. No preferences/dislikes, budget or season |
| A5 | **Pre-consultation summary**: adherence and patterns of the patient before the visit; progress over weeks and months | specific | Weekly review card, «¿Cómo vas?» reading, alerts, PDF progress report. **No «prepare the consultation» brief** and adherence only for 7/30 days (no monthly history) |
| A6 | **Signals/suggestions**: adherence drop, deficits, pattern changes; example: after an energy drop, review B12 and iron | specific, framed as suggestions | Alerts with a suggestion («a quién escribir hoy»), lab markers out of range. We do not link an alert (energy) to a lab marker |
| A7 | **AI agent** for adherence and «automated consultations» | vague, no details | Daily push to the nutritionist (never writes to the client on its own). Nothing client-facing automated |
| A8 | **White-label app**: own logo, colours **and domain**; higher tier also own app **icon and name**; «ready in 48 h» | specific | Logo and colour, no own domain, name or icon |
| A9 | **Client app**: diet, recipes, shopping list, habits and consultation in one place | specific | Yes: plan, recipes book, shopping list, check-in, progress, guides, appointments |
| A10 | **Imports** the patient list from CSV/Excel in one click | specific | Yes, and more (weight, notes, labs history, pasted tables) |
| A11 | **Billing** (Stripe subscriptions, packages, invoices valid «fiscally»), per-patient revenue, store | specific | Out of scope (no payments: product decision). Invoices as PDF exist |
| A12 | **Automations**: welcome, renewals, reminders, forms, notifications | mostly vague | Reminders (risk, surveys, billing, appointments), phases with automatic plan change |
| A13 | **GDPR**: encrypted clinical data, explicit consent, access traceability | claims, no certification named | Consent document, signed name, export/delete, private files with expiring links. **No access log** («who opened what») |
| A14 | **Lead CRM, e-mail/WhatsApp campaigns, public web, online courses, staff accounts, contracts** | specific, higher tiers | Not covered; mostly outside the product (broadcast to client groups exists) |
| A15 | **Pricing**: 63–79 €/month (Pro), 79–99 € (Business), 159–199 € (Scale), **unlimited clients** in all, 2.5 % / 1.5 % / 0 % commission per payment, 15-day trial of Business | specific | No pricing defined yet. Useful as a reference |

## Where NutriFit is ahead or level

Clinical depth (lab results with ranges, private consultation notes, anamnesis, consent, body measurements, phases), the weekly
review and its explained readjustments, importing a client's whole history, a recipe book with visibility per client tag, hiding
calories/macros per client, and a client app that needs no download. Fitai's nutritionist page does not describe a food database or food logging (it lists photo overload on WhatsApp as a pain point but shows no photo feature).

## What is worth taking (and what is not)

The AI part is the headline but also the part with no verifiable substance: no food database, no explanation of how it is «trained»,
and the professional bodies' own warnings about relying on AI-generated diets (which the public press reports) point to the same
design Fitai itself uses, **a draft that the nutritionist reviews**. NutriFit already has that design without a language model.

| id | idea | why | cost / risk |
| --- | --- | --- | --- |
| G1 | **«Preparar la consulta»**: one printable page per client with what changed since the last consultation: weight and measurement changes, adherence month by month, check-in signals, alerts, labs out of range, the phase they are in, messages and notes since then | the deterministic version of A5/A6; everything already exists as data | small–medium; pure functions + a PDF like the progress report. **Recommended first** |
| G2 | **Adherence history by month** (and by week) in Seguimiento | A5; needed by G1 | small |
| G3 | **Food preferences and dislikes per client** («no me gusta el pescado») used by the menu proposal and the substitutions | A3/A4 without AI; today only allergies are respected | small–medium (one client field + filters) |
| G4 | **Weekly menu proposal** (7 days with variety) from the nutritionist's recipes, extending «Proponer menú» | A1 without AI | medium; pure function + modal |
| G5 | **Link an alert to a lab marker** («energía baja» + hierro/B12 pending or low) as a hint in the alert | A6 | small; careful wording (a hint, never a diagnosis) |
| G6 | **App name and icon per nutritionist** (the PWA manifest and install name), own domain later | A8 | medium; domain needs hosting decisions |
| G7 | **Access log** («quién abrió la ficha y cuándo») | A13; stronger GDPR story | medium; new table + trigger or app-level writes |
| G8 | **LLM plan generation from a chat** | A1 | **Needs an explicit product decision** (cost per plan, health liability, allergens, quality). If ever done: draft only, built from the nutritionist's own foods and recipes (grounded), with the same allergen check as today, never sent to the client without review |
| — | Payments, store, bookings, classes, lead CRM, campaigns, courses, public web | out of scope (no payments; other business) | skip |

Recommendation: **G1 + G2** first (the most useful thing Fitai Labs shows, and it is just our own data), then G3, then G4.
G8 only if you decide you want a language model, and then as a drafting assistant on top of what already exists.

## Pricing reference (not a decision)

Fitai Labs charges per professional, not per client: unlimited clients on every plan, and a commission on the payments it
processes that falls as the plan rises. NutriFit has no pricing and no payments, so only the per-professional, unlimited-clients
shape is comparable.
