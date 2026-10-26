# Architecture: appointment reminders + in-app chat, ideas from Nutrium

Two gaps survived `recon-nutrium.md`'s bar, and they're not the same size.
**Automated appointment reminders** is a small, clear win, built the same
way every other NutriFit reminder already works. **In-app chat** is a real
subsystem — smaller than it looks because NutriFit already has the two
pieces it needs (Realtime, Web Push), but still a bigger decision than
anything else this pack has built so far. Plan both; only build the first
without asking again.

## What's already covered, so it's out of this plan

- Scheduling, billing, nutritional assessment, templates, recipes, progress
  tracking, the patient app's plan + diary — see `features-nutrium.csv`,
  "already covered" rows.
- `Appointment.videoLink` already covers "paste a Zoom/Meet link"; no
  built-in calling needed.
- AI notes/scores — rejected again, same reasoning as 0xCal and
  MyFitnessPal (see recon's "Out of scope").

## Part 1: automated appointment reminders

**The gap, concretely:** NutriFit has 4 scheduled reminder jobs today
(`send-risk-reminders`, `send-survey-reminders`, `send-billing-reminders`,
`send-nutricionista-risk-alerts`) and none of them is "your appointment is
tomorrow." A booking confirmed weeks ago relies entirely on the client
remembering.

**Stack:** no new layer — same Supabase Edge Function + `pg_cron` +
Web Push pattern as the four jobs that already exist.

**Schema:**

```sql
-- 0060_appointment_reminders.sql
alter table appointments add column reminder_sent_at timestamptz;
```

One column. `reminder_sent_at is null` is the dedupe check — once a
reminder goes out for a booking, it never fires again for that same row,
matching how `nutricionista_alert_state` dedupes alerts elsewhere, just
inlined since this is 1:1 per appointment rather than per client+kind.

**Edge Function `send-appointment-reminders`:** same shape as
`send-survey-reminders` (CRON_SECRET header check, VAPID push, service-role
client) —

```ts
const WINDOW_START = "now() + interval '23 hours'"
const WINDOW_END   = "now() + interval '25 hours'"
// appointments where status = 'confirmada', client_id is not null,
// start_at between WINDOW_START and WINDOW_END, reminder_sent_at is null
// -> push to that client's push_subscriptions
// -> update reminder_sent_at = now()
```

A 2-hour-wide window checked by a job that runs every 15 minutes means
every qualifying appointment gets caught once, comfortably inside the
window, without needing exact-minute cron alignment.

**Cron registration** (same `cron.schedule` pattern as `0037`, upserted by
job name, anon key and `CRON_SECRET` substituted at apply time — never
committed as real values, same as every existing job):

```sql
select cron.schedule(
  'nutrifit-appointment-reminders',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := 'https://yuhebegybxjrdmkpwjqa.supabase.co/functions/v1/send-appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
```

### The parts that bite

- **Push-only means silent failure for a client who never enabled
  notifications.** `PushToggle` is opt-in; a client who hasn't turned it on
  gets nothing, with no fallback channel (NutriFit has no SMS/email
  sending today). Worth surfacing in-app ("activa las notificaciones para
  no perderte recordatorios") rather than pretending coverage is universal.
- **Time zones.** `start_at` is `timestamptz`, already stored correctly in
  UTC — the 23–25h window math works regardless of the client's zone, as
  long as the comparison stays in UTC server-side (it does, by using
  Postgres's own `now()`).
- **A rescheduled appointment must not skip its reminder.** Changing
  `start_at` on an existing row doesn't reset `reminder_sent_at` — if a
  booking already got reminded once, moving it later should get a fresh
  reminder. Reset `reminder_sent_at` to `null` wherever the app updates
  `start_at` (the edit-appointment path in `CalendarTab`), not just on
  create.

### Build order

1. Migration `0060` (one column) + `send-appointment-reminders` function +
   cron registration. This is the whole feature — no UI changes needed,
   it's a background job against data that already exists.
2. The `reminder_sent_at`-reset-on-reschedule fix, in the same pass (it's
   a one-line addition to wherever `CalendarTab` already updates
   `start_at`, not a separate milestone).

## Part 2: in-app chat (plan only — bigger, don't build without asking)

**The gap:** `MensajesTab` and `buildWAUrl` open WhatsApp with a
pre-filled message. That's a redirect, not a conversation — neither side
has an in-app history, and it depends on the client actually having
WhatsApp.

**Why this is cheaper here than it sounds:** NutriFit already has the two
expensive parts. Realtime is already wired in (`0054_realtime_appointments`
added `appointments` to the `supabase_realtime` publication — the exact
same one-line pattern adds a `messages` table). Push delivery already
exists (`send-push`, reused as-is for "new message" notifications). What's
actually new is a table, a thread UI, and read-state — not infrastructure.

**Schema:**

```sql
-- draft, not applied — see "don't build without asking" below
create table messages (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references nutricionistas(uid) on delete cascade,
  client_id uuid not null references clientes(id) on delete cascade,
  sender text not null check (sender in ('nutricionista', 'client')),
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on messages (client_id, created_at);
alter table messages enable row level security;
create policy nutricionista_manages_own_messages on messages for all
  using (private.is_nutricionista_of_client(client_id)) with check (private.is_nutricionista_of_client(client_id));
create policy client_manages_own_messages on messages for all
  using (private.is_owner_client(client_id)) with check (private.is_owner_client(client_id));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
```

**UI, sketched, not built:** a thread view replacing (or sitting beside)
`MensajesTab`'s template list on the trainer side, and a new tab in
`DietaClienteTab`'s sibling tabs on the client side, both subscribed to
the same Realtime channel `ScannedFoodSheet`/`CalendarTab` already use the
pattern for. New message → `send-push` to whichever side isn't typing.

### Why this stays a plan, not a build

Every other feature in this pack so far has been small enough to build in
the same pass as its architecture doc. This one isn't: it's a new
persistent feature both sides will use daily, it changes how clients
expect to reach their nutricionista (a habit, not just a screen), and
getting the WhatsApp-to-in-app transition wrong (e.g., silently losing a
message a client thought was sent) is a worse failure mode than anything
else built in this pack. It deserves its own decision, not a drive-by
"might as well."

## Rejected (from `recon-nutrium.md`, deliberately not planned)

- **Built-in video calling** — `Appointment.videoLink` already covers the
  real need.
- **AI consultation notes / AI scores** — third time this call's been
  made this session; see "Out of scope" in the recon.
- **Multi-staff accounts, Nutrium Academy, infographics library, academic
  partnerships, patient testimonials** — see the recon; none are product
  gaps for a single-nutricionista practice tool.

## Summary

Part 1 (reminders): 1 new column, 1 new edge function, 1 new cron job —
small, ready to build like everything else in this pack. Part 2 (chat): 1
new table, Realtime + push reused, but a real UI subsystem and a habit
change for both sides of the app — scoped, not built. Next step: build
Part 1 now; come back to Part 2 only with an explicit yes.
