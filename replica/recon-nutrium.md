# Recon map: Nutrium (web + patient app) — researched for ideas for NutriFit

Scope: the practice-management core (scheduling, in-app messaging, AI
documentation, billing, patient app) — not the whole product (academic
partnerships, Nutrium Academy courses, infographics library). This is the
first recon in this pack against a **direct competitor** (same category as
NutriFit: software for nutricionistas), not an adjacent consumer app.
For: finding genuine gaps in NutriFit, same exercise already run against
0xCal and MyFitnessPal.
Date: 2026-10-26

No account, no trial, no login was used — Nutrium requires a 14-day trial
signup to see the product itself, which this recon deliberately avoided
(public marketing pages only). That means screen-level detail here is
lower confidence than the 0xCal/MFP recons, which had fuller App Store
listings to work from.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | professionals marketing page | https://nutrium.com/es/professionals | positioning, feature highlights, pricing tiers |
| 2 | pricing/features page | https://nutrium.com/es/professionals/pricing | the fullest feature list found: per-category breakdown (food/nutrition, scheduling/clients, patient app, AI, education) |

No help center article, no app store listing, and no walkthrough video were
read. `/professionals/features` 404s — there is no separate features page;
the pricing page is the feature list. Everything below not explicitly
sourced from these two pages is marked as a guess.

## Core loop

A nutricionista runs their whole practice from one tool — schedule and get
paid for consultations, build a plan, and the patient follows it through a
companion app that keeps the two of them in touch between visits.

## Screens (lower confidence — no account was used)

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Patient list / scheduling calendar | app home (guessed) | bookings, admin access for staff | calendar, patient list | — (not observed) |
| S02 | Nutritional assessment / plan builder | per patient | personalized plans, automatic calculations, templates | template picker, calculation fields | — |
| S03 | Built-in video consultation | from a booking | video call through Nutrium itself (not Zoom/Meet) | call window | only this path produces AI notes |
| S04 | AI consultation notes review | after a Nutrium video call | auto-generated notes from the call, professional reviews before anything is saved | editable note draft | draft, reviewed/saved |
| S05 | Billing / payments | per patient or practice-wide | "simple payments and billing" | invoice list (guessed) | — |
| S06 | Patient app: meal plan + food diary | patient's own app | the patient's side of what S02 produces, plus logging | plan view, diary | — |
| S07 | Patient app: direct chat | patient app | two-way messaging with their nutricionista, inside the product | chat thread | — |
| S08 | Patient app: progress tracking | patient app | automatic weight-change tracking, visual reports | chart | — |

## Flows (inferred from marketing copy, not observed — low-medium confidence)

```
F01 Reduce no-shows
    a booking is made -> automated reminder sent before the appointment, on a schedule
    -> patient confirms or the slot is managed automatically
    (marketing claim only: "Reduce las ausencias sin esfuerzo"; no mechanism detail found)

F02 Document a consultation with AI
    S03 video consultation (Nutrium's own call, not Zoom/Meet) -> S04 AI drafts notes
    -> professional reviews and saves (nothing saved without review, per the page)
    edge: a Zoom/Meet consultation gets no AI notes — the feature is tied to Nutrium's own video

F03 Stay in touch between visits
    S07 direct chat, both sides, inside the product
    (vs. NutriFit today: a nutricionista taps a WhatsApp-deep-link template —
    no in-app history, no thread either side can review later)
```

## Components (guessed from copy, not seen)

| component | notes |
| --- | --- |
| Automated reminder/scheduling engine | the specific mechanism (push? email? SMS? how far in advance?) is not described anywhere public |
| In-app chat thread | persistent, both sides, inside the product — not an external redirect |
| AI note draft | reviewable before saving; scoped to Nutrium's own video calls only |
| Visual progress report | for the patient, "automatic" weight tracking |

## Inferred data model

Not attempted in detail — with no account access, there isn't enough
concrete evidence (field names, exact screens) to infer a trustworthy
schema the way the 0xCal/MFP recons could. Worth revisiting only for
whichever single feature survives into `architecture-nutrium.md`.

## Feature matrix

See `features-nutrium.csv`.

## Out of scope (cannot or should not be cloned)

- **Nutrium's own built-in video calling** — a real-time video
  infrastructure build (WebRTC, call quality, recording) is a different
  scale of project than anything else in this pack; NutriFit's existing
  `videoLink` field (paste a Zoom/Meet link) already covers the actual
  need at a fraction of the cost.
- **AI-generated consultation notes / "puntuaciones con IA"** — same call
  already made twice this session (0xCal, MyFitnessPal): an AI writing or
  scoring clinical-adjacent content in a health app, reviewed or not,
  carries cost and trust risk that hasn't been asked for yet. Flagged here
  for `/replica-architect` to formally reject, for consistency, not
  silently dropped.
- **Nutrium Academy courses, the infographics library, academic
  partnerships** — a content/education business line, not a product
  feature of the practice-management tool itself.
- **"Comentarios reales" (patient testimonials)** — a marketing/social-proof
  feature on Nutrium's own public pages, not something that helps a
  NutriFit nutricionista run their practice.
- **Multi-staff / administrator access** — real gap (NutriFit is
  single-nutricionista per account) but a structural account-model change,
  not a feature; no evidence any current NutriFit nutricionista runs a
  multi-person clinic that needs it.

## Size

Screens ~8 (low confidence, no account seen), flows 3. The three hardest
parts if any of this were pursued: building real-time in-app chat
(presence, delivery, push notifications — a genuine subsystem, not a
screen), the complete absence of real appointment-reminder automation in
NutriFit today (so this isn't a tweak, it's a new scheduled-job feature
from zero), and — same as every round so far — resisting the AI features
just because a competitor has them. Size: **the one clear "should"
(automated appointment reminders) is S–M; in-app chat, if pursued, is L**.
