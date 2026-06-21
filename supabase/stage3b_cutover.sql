-- ============================================================================
-- STAGE 3b CUTOVER — final lockdown. Drops ALL anon access so the public key
-- can no longer read camper data or write anything. Run ONLY after:
--   1. instructor emails are loaded,
--   2. Auth redirect URLs are configured,
--   3. signups are re-enabled,
--   4. magic-link login is smoke-tested.
-- Deploy the matching code change (saveStaffNotes -> save_staff_note RPC,
-- remove home "find your name" fallback) together with this.
-- ============================================================================

-- Instructors write their own students' staff_notes via a checked RPC
-- (column-level writes are awkward under RLS; an RPC keeps it explicit).
create or replace function public.save_staff_note(p_student uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin()
     or exists (select 1 from public.schedule_slots s
                where s.student_id = p_student and s.instructor_id = public.my_instructor_id())
  then
    update public.students set staff_notes = p_note where id = p_student;
  else
    raise exception 'not authorized to edit this camper';
  end if;
end $$;
grant execute on function public.save_staff_note(uuid, text) to authenticated;

-- Drop every remaining anon / overly-broad policy. After this, access is only
-- via admin_all_* (admins) and ins_*/auth_read_* (logged-in instructors).
drop policy if exists read_instructors on public.instructors;
drop policy if exists read_students on public.students;
drop policy if exists staff_notes_anon_update on public.students;
drop policy if exists read_weeks on public.weeks;
drop policy if exists read_swim_levels on public.swim_levels;
drop policy if exists read_schedule_slots on public.schedule_slots;
drop policy if exists read_instructor_availability on public.instructor_availability;
drop policy if exists write_instructor_availability_anon on public.instructor_availability;
drop policy if exists all_instructor_notes on public.instructor_notes;
drop policy if exists read_student_enrollment on public.student_enrollment;
drop policy if exists read_import_logs on public.import_logs;
drop policy if exists insert_availability_requests on public.availability_requests;
drop policy if exists read_availability_requests on public.availability_requests;
drop policy if exists all_availability_submissions on public.availability_submissions;

-- Reference data instructors still need to read after anon is gone.
-- (auth_read_weeks / auth_read_swim_levels already added in 3a.)

-- Anything an instructor must read but isn't covered by an ins_* policy should
-- be added here before running in production.
