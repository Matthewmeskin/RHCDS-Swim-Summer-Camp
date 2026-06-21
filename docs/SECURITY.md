# Security lockdown — status & cutover runbook

This documents the staged hardening of the Swim Portal and the exact steps to
complete the final lockdown.

## Why staged

The instructor portal originally ran entirely on the public `anon` key (no
login), so the database had to be wide open for it to work. Locking it down
requires instructors to log in first — which requires their emails on file.
We therefore roll out in stages, each individually deployable, so the live
site (active mid-camp) never breaks.

## Done

### Stage 1 — server-enforced admin (DEPLOYED)
- `public.admins` allowlist + `public.is_admin()` (seeded with the director).
- Auth session moved to cookies (`@supabase/ssr`).
- `middleware.ts` gates every `/admin/*` route server-side against `is_admin()`.

### Stage 2 — instructor identity (DEPLOYED)
- RPCs `my_instructor_slug()`, `login_allowed(email)`.
- Magic-link login: `/auth/callback` routes admins → `/admin`, instructors →
  their schedule, unknown → home.
- Home page leads with email sign-in + a temporary "find your name" fallback.
- Admin → Instructor Links: per-instructor email field + bulk paste-import.

### Stage 3a — admin-only writes + instructor scoping (APPLIED to DB)
- `my_instructor_id()` helper.
- `admin_all_*` policies (full access where `is_admin()`) on every table.
- Dropped the broad "any authenticated user can write" policies.
- Added instructor-scoped policies (`ins_*`, `auth_read_*`) — effective once an
  instructor logs in; null/none for everyone else.
- `anon` read/write policies are intentionally KEPT here so the portal still
  works until cutover.

## Remaining — Stage 3b cutover (NOT YET APPLIED)

This is the step that closes the camper-PII exposure. Do all prerequisites
first, then apply DB + code together.

### Prerequisites
1. Load instructor emails (Admin → Instructor Links → type or "Import emails").
   Aim for the `✉️ N/31` counter to read 31/31.
2. Supabase dashboard → Authentication → URL Configuration → add the live site
   URL and `https://<app-domain>/**` to **Redirect URLs**.
3. Re-enable signups (Authentication → Email → "Allow new users to sign up").
   This is now safe: after 3b, an authenticated user who is neither admin nor a
   known instructor email can read/write nothing.
4. Smoke-test magic-link login with one real instructor (and the admin email).

### DB: run `supabase/stage3b_cutover.sql` (drops all `anon` policies + adds the
   staff-notes RPC). After it, `anon` can do nothing.

### Code (deploy together with the DB change)
- Switch `saveStaffNotes` to call the `save_staff_note` RPC (instructors are
  authenticated now; direct table update is blocked by design).
- Remove the "find your name" fallback from `app/page.tsx` (login-only home).

### Verify
- Logged out (anon): hitting the API / instructor URL returns no rows.
- Instructor: sees only their own schedule, students, availability.
- Admin: unchanged, full access.
- Run Supabase Advisors (security) — expect no "RLS disabled / overly
  permissive" findings.

## Stage 4 — polish (later)
- Shared-secret on `/api/notify-availability`.
- Audit log of admin actions.
- Raise admin password minimum.
