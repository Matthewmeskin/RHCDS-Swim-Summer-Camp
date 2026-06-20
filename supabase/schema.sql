-- Country Day Camp Swim Portal — schema (v1)
-- Run this in the Supabase SQL editor for the swim camp project
-- (project ref: aaioiktrlkyexmcbobzx). Safe to re-run.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists instructors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  role text check (role in ('instructor', 'guard', 'admin')) default 'instructor',
  slug text unique
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  gender text,
  age int,
  level text check (level in ('Non-Swimmer', 'Beginner', 'Intermediate', 'Advanced')),
  goals text,             -- parent-entered goals from the CampSite export
  special_needs boolean default false,
  parent_notes text,      -- parent preferences / communication (e.g. requested instructor)
  staff_notes text,       -- internal aquatics-staff notes, not parent facing
  active boolean default true
);

-- Add later columns to pre-existing installs (idempotent).
alter table students add column if not exists parent_notes text;
alter table students add column if not exists staff_notes text;
alter table students add column if not exists preferred_instructor_id uuid references instructors(id);
alter table students add column if not exists active boolean default true;
alter table instructors add column if not exists active boolean default true;

-- Instructor progress notes (one editable note per instructor + kid).
create table if not exists instructor_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  instructor_id uuid references instructors(id),
  note text,
  updated_at timestamptz default now(),
  unique (student_id, instructor_id)
);

-- Upsert target for student import (first_name + last_name).
create unique index if not exists students_name_unique
  on students (first_name, last_name);

create table if not exists weeks (
  id uuid primary key default gen_random_uuid(),
  week_number int unique,
  start_date date,
  end_date date,
  label text
);

create table if not exists schedule_slots (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references instructors(id),
  student_id uuid references students(id),
  student_name_raw text,
  lesson_date date not null,
  start_time time not null,
  end_time time not null,
  week_number int references weeks(week_number)
);

create table if not exists instructor_availability (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references instructors(id),
  lesson_date date not null,
  start_time time not null,
  is_available boolean default false,
  week_number int
);

create table if not exists import_logs (
  id uuid primary key default gen_random_uuid(),
  imported_at timestamptz default now(),
  file_type text check (file_type in ('students', 'schedule')),
  week_number int,
  rows_inserted int,
  rows_updated int,
  warnings jsonb
);

-- Tracks that an instructor submitted availability for a week (so the admin can
-- tell "set, fully available" apart from "never touched").
create table if not exists availability_submissions (
  instructor_id uuid references instructors(id),
  week_number int,
  updated_at timestamptz default now(),
  primary key (instructor_id, week_number)
);

-- Enrollment: who attends which week and how many lessons (powers Auto-fill).
create table if not exists student_enrollment (
  student_id uuid references students(id) on delete cascade,
  week_number int,
  lessons int default 1,
  primary key (student_id, week_number)
);

-- Helpful query indexes.
create index if not exists schedule_slots_week_idx on schedule_slots (week_number);
create index if not exists schedule_slots_instructor_idx on schedule_slots (instructor_id);
create index if not exists availability_week_idx on instructor_availability (week_number);
create index if not exists availability_instructor_idx on instructor_availability (instructor_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- The instructor portal has NO login, so reads are public (anon). All WRITES
-- require an authenticated (logged-in admin) session — see the admin login.
-- Note: student goals/notes are readable by anon so instructor pages work;
-- that's an intentional trade-off until instructor auth is added.

alter table instructors enable row level security;
alter table students enable row level security;
alter table weeks enable row level security;
alter table schedule_slots enable row level security;
alter table instructor_availability enable row level security;
alter table import_logs enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'instructors','students','weeks','schedule_slots',
    'instructor_availability','import_logs'
  ]
  loop
    execute format('drop policy if exists %I on %I;', 'public_all_' || t, t);
    execute format('drop policy if exists %I on %I;', 'read_' || t, t);
    execute format('drop policy if exists %I on %I;', 'write_' || t, t);
    -- Public read.
    execute format(
      'create policy %I on %I for select to anon, authenticated using (true);',
      'read_' || t, t
    );
    -- Writes only for logged-in admins.
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true);',
      'write_' || t, t
    );
  end loop;
end $$;

-- Exception: instructors update their own availability from their (login-free)
-- link, so anon may write to instructor_availability.
drop policy if exists write_instructor_availability_anon on instructor_availability;
create policy write_instructor_availability_anon
  on instructor_availability for all to anon using (true) with check (true);

-- Availability submissions: instructors write from their link, admins read.
alter table availability_submissions enable row level security;
drop policy if exists all_availability_submissions on availability_submissions;
create policy all_availability_submissions
  on availability_submissions for all to anon, authenticated
  using (true) with check (true);

-- Instructor progress notes: instructors write from their link, all can read.
alter table instructor_notes enable row level security;
drop policy if exists all_instructor_notes on instructor_notes;
create policy all_instructor_notes
  on instructor_notes for all to anon, authenticated
  using (true) with check (true);

-- Enrollment: public read (builder), admin write.
alter table student_enrollment enable row level security;
drop policy if exists read_student_enrollment on student_enrollment;
create policy read_student_enrollment
  on student_enrollment for select to anon, authenticated using (true);
drop policy if exists write_student_enrollment on student_enrollment;
create policy write_student_enrollment
  on student_enrollment for all to authenticated using (true) with check (true);
