# Country Day Camp Swim Portal

A warm, camp-themed scheduling portal for **Rolling Hills Country Day School**
summer swim camp. Instructors look up their weekly lesson schedule and student
goals; the aquatics director imports students and weekly schedules from CSV.

Built with **Next.js 14 (App Router)**, **Supabase (Postgres)**, **Tailwind
CSS**, **papaparse**, and the **ics** package. No authentication in v1.

---

## Quick start

### Easiest: one-paste database setup (no terminal needed)

Open the **Supabase SQL editor** for the swim camp project, paste the entire
contents of [`supabase/setup.sql`](supabase/setup.sql), and click **Run**. That
single file creates the schema **and** loads all seed data (25 instructors, 60
students, the full Week 1 schedule + unavailability). It's idempotent — safe to
re-run. Then just configure the app:

```bash
npm install
cp .env.example .env.local        # values are pre-filled for the camp project
npm run dev                       # http://localhost:3000
```

### Alternative: schema + scripted seed

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local        # values are pre-filled for the camp project

# 3. Create the database schema
#    Open the Supabase SQL editor for the project and run supabase/schema.sql

# 4. Seed instructors, students, and the Week 1 schedule
npm run seed                      # needs network access to Supabase

# 5. Run the app
npm run dev                       # http://localhost:3000
```

> **Note:** `npm run seed` requires network access to your Supabase project. If
> you are in a restricted/CI environment that blocks the Supabase host, use the
> one-paste `supabase/setup.sql` path above instead.
>
> `supabase/setup.sql` is generated from the same source data as the seed
> script via `npx tsx scripts/genSeedSql.ts` — regenerate it if you change
> `lib/seedData.ts`.

---

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Project URL. Safe to expose. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Publishable anon key. Safe to expose (client-side). |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | **Secret.** Used only by `npm run seed` to bypass RLS. Never commit or expose client-side. If omitted, the seed falls back to the anon key (which works with the v1 RLS policies). |

`.env.local` is git-ignored. On Vercel, set the two `NEXT_PUBLIC_*` variables in
**Project Settings → Environment Variables**.

---

## Admin login

The `/admin` section is protected by **Supabase Auth** (email + password). The
public instructor pages stay open (no login). Row-Level Security enforces this:
anyone can **read** (so instructor links work), but **writes** — imports, the
schedule builder, edits — require a logged-in admin.

- Sign in at **`/admin/login`**. Signed-out visits to any `/admin/*` page
  redirect there.
- Add or manage admin users in the Supabase dashboard: **Authentication →
  Users** (use "Add user" with a password and auto-confirm). Rotate or reset
  passwords there too.

Because writes now require auth, **`npm run seed` needs the service-role key**
(`SUPABASE_SERVICE_ROLE_KEY`) to bypass RLS — the anon key can no longer write.
The one-paste `supabase/setup.sql` still works (the SQL editor runs as an
elevated role).

## Database setup

The full schema lives in [`supabase/schema.sql`](supabase/schema.sql). It is
idempotent (`create table if not exists …`) and safe to re-run.

**v1 security note:** there is no auth. The app uses the public anon key for all
reads and writes, so the schema enables Row Level Security with permissive
policies granting `anon` full access. Anyone with the site URL can view and
import. This is an intentional v1 trade-off — lock it down when auth lands in v2.

### Seeding

`npm run seed` (script: [`scripts/seed.ts`](scripts/seed.ts)) is idempotent:

- **Weeks** – upserts Week 1 (Jun 22–26, 2025).
- **Instructors** – upserts all 25 instructors/guards on `slug`.
- **Students** – inserts the 60 seed students **only if the table is empty**.
  Four students are auto-flagged `special_needs`.
- **Week 1 schedule** – replaces Week 1 slots + unavailability with the seed
  grid, matching student names to records.

---

## Replacing the logo

`public/logo.png` is a generated **placeholder** badge (tree, sunset, water
wave) in the brand colors. To use the real Country Day Camp logo:

1. Overwrite `public/logo.png` with the real PNG (keep the filename).
2. Done — the header and the favicon both reference `/logo.png`.

The placeholder can be regenerated with `node scripts/genLogo.mjs`.

---

## Weekly import workflow (aquatics director)

Each week after Week 1, go to **`/admin`** and upload two files.

### 1. Import Students — `/admin/import/students`

- Accepts the **CampSite** export:
  `Last name, First name, Gender, Age, Level, Goals for Lessons`.
- Parsed in the browser; preview the first 5 rows before confirming.
- Students are **upserted** on `first name + last name`, so re-importing
  updates existing records.
- `special_needs` is auto-detected when the goals text contains (case-insensitive)
  `autism`, `ASD`, `special needs`, `ADHD`, or `adapted`.
- Result toast: `57 students imported · 3 updated · 0 errors`.

### 2. Import Schedule — `/admin/import/schedule`

- Pick the **week number** and **year** first.
- Accepts the **Google Sheets** wide-grid export (repeating instructor blocks):

  ```
  Instructor Name,,,,,,
  Time,Jun-22,Jun-23,Jun-24,Jun-25,Jun-26
  4:30 - 5:00,[student | X | blank],...
  5:00 - 5:30,...
  5:30 - 6:00,...
  [blank row]
  Next Instructor Name,,,,,,
  ```

- Transform rules:
  - Sibling pairs (`Ada & Ben` / `Ada and Ben`) become one slot row per student.
  - Each name is fuzzy-matched to a student on first name (with last-name
    disambiguation). Unmatched names are stored as `student_name_raw` and shown
    as orange warning pills on the admin dashboard.
  - `X` cells become `instructor_availability` rows (`is_available = false`).
  - Blank cells are ignored.
- **Confirming replaces** all existing slots for that week, then inserts fresh.
- Result toast: `143 slots imported · 12 unavailable slots recorded · 3 warnings`.

After importing, use the **Instructor QA** list on `/admin` to preview any
instructor's week.

### Schedule Builder — `/admin/build`

An in-app alternative to building the schedule in Google Sheets, with
instructor-consistency suggestions. Shows the **whole summer (all weeks) at
once** for one instructor.

- Pick an **instructor** → see every week (Week 1 … Week 8) stacked.
- Tap **+** on any day/slot to assign a kid. The picker ranks suggestions with
  reason chips: **⭐ Requested** (a parent named this instructor in the kid's
  goals/notes), **↩ Yours** (already with this instructor another week),
  **👫 sib** (a sibling is with this instructor), level badge, special-needs
  flag, and how many slots they're in across the season.
- **↓ Copy to later weeks** replicates an instructor's week into every later
  week (day-for-day), so kids keep the same instructor all summer — then adjust.
- Grey cells are slots the instructor marked unavailable (you can still place a
  kid there if needed).
- **Save all weeks** writes the whole season. (CSV import still works as a bulk
  alternative.)

> Weeks 1–8 run as consecutive 5-day blocks (Week 8 ends Aug 14). Week dates
> live in the `weeks` table.

### Student notes & parent preferences

The `students` table stores three layers of context:

- **goals** — parent-entered goals from the CampSite export (read-only import).
- **parent_notes** — parent preferences / communication (e.g. a requested
  instructor). Auto-populated if a future CampSite export includes a
  `Parent Notes` / `Preferences` / `Instructor Preference` column.
- **staff_notes** — internal aquatics-staff notes, not parent facing.

Parent and staff notes appear in the student goals modal when present.

---

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Landing — searchable instructor picker → `/instructor/[slug]`. |
| `/instructor/[slug]` | Weekly view: "My Students This Week", calendar grid, calendar export. Add `?week=N` to pick a week, `?print=true` for a clean print view. |
| `/admin` | Director dashboard: week selector, import cards, stats, unmatched-name warnings, instructor QA links. |
| `/admin/import/students` | Student CSV import. |
| `/admin/import/schedule` | Schedule CSV import. |

Instructors can bookmark their personal link (e.g. `/instructor/ellie-pizer`)
and skip the picker on future visits.

---

## Calendar export

On an instructor's page, **"Export My Week to Calendar"** builds an `.ics` file
client-side (one event per lesson) and downloads it. Event title is the student
name(s); location is *Rolling Hills Country Day School — Swim Pool*; description
is the student level plus the first 120 characters of their goals.

---

## Testing

The schedule CSV parser is built as an isolated, dependency-light utility
([`lib/parseSchedule.ts`](lib/parseSchedule.ts)) with unit tests
([`lib/parseSchedule.test.ts`](lib/parseSchedule.test.ts)) validated against a
3-instructor sample grid.

```bash
npm test          # run once
npm run test:watch
```

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the
   project's environment variables.
4. Deploy. (Run `npm run seed` once from your machine to populate data.)

---

## V1 scope (not built yet)

No login/auth · no CampSite API · no automated instructor↔student matching ·
no parent-facing view · no in-app schedule builder · instructor view is read-only.

## Project structure

```
app/
  page.tsx                       Landing
  instructor/[slug]/             Weekly view (+ print, week selector)
  admin/                         Dashboard + import pages
components/                      Nav, CalendarGrid, StudentModal, Dropzone, …
lib/
  parseSchedule.ts (+ .test.ts)  Schedule grid parser (tested in isolation)
  parseStudents.ts               CampSite students CSV parser
  matchStudent.ts                Fuzzy name → student matcher
  importActions.ts               Supabase upsert/replace logic
  icsExport.ts                   Client-side .ics builder
  data.ts                        Read queries
  seedData.ts                    Instructors, students, Week 1 schedule
scripts/
  seed.ts                        Idempotent seeder
  genLogo.mjs                    Placeholder logo generator
supabase/
  schema.sql                     Tables, indexes, RLS policies
```
