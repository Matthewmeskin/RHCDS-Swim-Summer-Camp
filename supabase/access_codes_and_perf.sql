-- Country Day Camp Swim Portal — access codes + performance (stage 4)
-- Run in the Supabase SQL editor (project ref: aaioiktrlkyexmcbobzx).
-- Idempotent / safe to re-run. Captures the name+code instructor login and the
-- RLS performance pass that supersede the email magic-link flow in schema.sql.

-- ---------------------------------------------------------------------------
-- 1. Instructor login fields
-- ---------------------------------------------------------------------------
alter table public.instructors add column if not exists access_code text;
alter table public.instructors add column if not exists login_email text;
alter table public.instructors add column if not exists auth_user_id uuid;

create unique index if not exists instructors_login_email_key
  on public.instructors (lower(login_email)) where login_email is not null;

-- ---------------------------------------------------------------------------
-- 2. Access-code helpers
-- ---------------------------------------------------------------------------

-- Human-friendly code: no 0/O/1/I to avoid confusion on a printed card.
create or replace function public.gen_access_code(n int default 6)
returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random()*32)::int, 1), '')
  from generate_series(1, n);
$$;

-- Admin-only: create or rotate an instructor's access code, provisioning a
-- matching Supabase auth user (login id = <slug>@swimcamp.local, password = code).
create or replace function public.admin_set_instructor_code(p_instructor uuid, p_code text default null)
returns text language plpgsql security definer set search_path = public, extensions, auth as $$
declare v_slug text; v_login text; v_code text; v_uid uuid; v_existing uuid; v_idata jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select slug, auth_user_id into v_slug, v_existing from public.instructors where id = p_instructor;
  if v_slug is null then raise exception 'instructor not found'; end if;
  v_login := lower(v_slug) || '@swimcamp.local';
  v_code := coalesce(nullif(p_code, ''), public.gen_access_code());

  if v_existing is null then
    select id into v_existing from auth.users where lower(email) = v_login limit 1;
  end if;

  if v_existing is null then
    v_uid := gen_random_uuid();
    v_idata := jsonb_build_object('sub', v_uid::text, 'email', v_login, 'email_verified', true, 'phone_verified', false);
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_login,
      crypt(v_code, gen_salt('bf')), now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid::text, v_uid, v_idata, 'email', now(), now(), now());
  else
    v_uid := v_existing;
    update auth.users set encrypted_password = crypt(v_code, gen_salt('bf')), email = v_login,
      email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = v_uid;
    if not exists (select 1 from auth.identities where user_id = v_uid and provider = 'email') then
      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (v_uid::text, v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', v_login, 'email_verified', true, 'phone_verified', false),
        'email', now(), now(), now());
    end if;
  end if;

  update public.instructors set login_email = v_login, access_code = v_code, auth_user_id = v_uid where id = p_instructor;
  return v_code;
end $$;

-- Admin-only: provision codes for every active instructor missing one.
create or replace function public.admin_setup_all_codes()
returns int language plpgsql security definer set search_path = public, extensions, auth as $$
declare r record; cnt int := 0;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  for r in select id from public.instructors where active is true and (access_code is null or auth_user_id is null) loop
    perform public.admin_set_instructor_code(r.id, null);
    cnt := cnt + 1;
  end loop;
  return cnt;
end $$;

-- Public: map a typed name -> login id, only when a code exists. The code is the
-- secret; the name is not. Lets the sign-in form avoid client/DB slug drift.
create or replace function public.instructor_login_email(p_name text)
returns text language sql stable security definer set search_path = public as $$
  select login_email from public.instructors
  where login_email is not null and access_code is not null
    and lower(trim(name)) = lower(trim(p_name))
  limit 1;
$$;

revoke execute on function public.admin_set_instructor_code(uuid, text) from anon;
revoke execute on function public.admin_setup_all_codes() from anon;
grant execute on function public.admin_set_instructor_code(uuid, text) to authenticated;
grant execute on function public.admin_setup_all_codes() to authenticated;
grant execute on function public.gen_access_code(int) to authenticated;
grant execute on function public.instructor_login_email(text) to anon, authenticated;

-- Admins also carry a role claim so middleware can gate /admin without a DB call:
--   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
--   where lower(email) in (select lower(email) from public.admins);

-- ---------------------------------------------------------------------------
-- 3. RLS performance: evaluate helper functions once per query (InitPlan)
--    instead of once per row, by wrapping calls in a scalar subselect.
-- ---------------------------------------------------------------------------
alter function public.is_admin() stable;
alter function public.my_instructor_id() stable;

alter policy admins_manage on public.admins using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy admins_select on public.admins using ((select public.is_admin()));
alter policy admin_all_availability_requests on public.availability_requests using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy admin_all_availability_submissions on public.availability_submissions using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy admin_all_import_logs on public.import_logs using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy admin_all_instructor_availability on public.instructor_availability using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy admin_all_instructor_notes on public.instructor_notes using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy admin_all_instructors on public.instructors using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy admin_all_schedule_slots on public.schedule_slots using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy admin_all_student_enrollment on public.student_enrollment using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy admin_all_students on public.students using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy admin_all_swim_levels on public.swim_levels using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy admin_all_weeks on public.weeks using ((select public.is_admin())) with check ((select public.is_admin()));

alter policy ins_insert_requests on public.availability_requests with check ((instructor_id = (select public.my_instructor_id())));
alter policy ins_read_requests on public.availability_requests using ((instructor_id = (select public.my_instructor_id())));
alter policy ins_rw_submissions on public.availability_submissions using ((instructor_id = (select public.my_instructor_id()))) with check ((instructor_id = (select public.my_instructor_id())));
alter policy ins_rw_availability on public.instructor_availability using ((instructor_id = (select public.my_instructor_id()))) with check ((instructor_id = (select public.my_instructor_id())));
alter policy ins_rw_notes on public.instructor_notes using ((instructor_id = (select public.my_instructor_id()))) with check ((instructor_id = (select public.my_instructor_id())));
alter policy ins_read_own_instructor on public.instructors using ((id = (select public.my_instructor_id())));
alter policy ins_read_schedule_slots on public.schedule_slots using ((instructor_id = (select public.my_instructor_id())));
alter policy ins_read_students on public.students using ((exists (
  select 1 from public.schedule_slots s
  where s.student_id = students.id and s.instructor_id = (select public.my_instructor_id())
)));
