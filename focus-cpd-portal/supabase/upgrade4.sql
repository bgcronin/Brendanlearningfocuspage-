-- ============================================================
-- Focus Vision CPD Portal — UPGRADE 4
-- Security & integrity hardening (pre-launch audit fixes).
--
-- Run this if your database predates the current migration.sql
-- (after upgrade.sql, upgrade2.sql and upgrade3.sql). Fresh projects
-- running the current migration.sql do NOT need this file.
--
-- What this does:
--   1. Re-locks profile columns so users cannot self-promote to admin
--      (the column grant only ever existed in the fresh migration).
--   2. Adds a per-course quiz pass mark; a completion + certificate is
--      recorded only on a passing attempt.
--   3. Snapshots course facts onto completions, and the holder name +
--      course facts onto certificates, so a later rename or course edit
--      cannot rewrite an issued certificate or a CPD record.
--   4. Public verification now reads the certificate snapshot.
-- Safe to re-run.
-- ============================================================

-- 1. HIGH: prevent self-promotion to admin on upgraded databases.
-- Supabase grants UPDATE on public tables to `authenticated` by default;
-- only this revoke + column grant stops `update profiles set is_admin=true`.
revoke update on public.profiles from authenticated;
grant update (full_name, practice_name, ahpra_number) on public.profiles to authenticated;

-- 2. Per-course pass mark.
alter table public.courses
  add column if not exists pass_mark int not null default 70;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'courses_pass_mark_range'
  ) then
    alter table public.courses
      add constraint courses_pass_mark_range check (pass_mark between 0 and 100);
  end if;
end $$;

-- 3a. Snapshot columns on completions (course facts at completion time).
alter table public.completions
  add column if not exists course_title text not null default '',
  add column if not exists cpd_hours numeric(4,2),
  add column if not exists is_therapeutic boolean not null default false;

-- Backfill existing completions from their current course.
update public.completions cm set
  course_title   = co.title,
  cpd_hours      = co.cpd_hours,
  is_therapeutic = co.is_therapeutic
from public.courses co
where co.id = cm.course_id
  and (cm.course_title = '' or cm.cpd_hours is null);

-- 3b. Snapshot columns on certificates (name + course facts at issue time).
alter table public.certificates
  add column if not exists holder_name text not null default '',
  add column if not exists course_title text not null default '',
  add column if not exists cpd_hours numeric(4,2),
  add column if not exists is_therapeutic boolean not null default false;

-- Backfill existing certificates so verification keeps working. Existing
-- certs snapshot the CURRENT name/course — the best available record.
update public.certificates c set
  holder_name    = coalesce(p.full_name, ''),
  course_title   = co.title,
  cpd_hours      = co.cpd_hours,
  is_therapeutic = co.is_therapeutic
from public.profiles p, public.courses co
where p.id = c.user_id and co.id = c.course_id
  and (c.holder_name = '' or c.cpd_hours is null);

-- 4. Replace submit_quiz with the pass-mark + snapshot version.
create or replace function public.submit_quiz(p_course_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user           uuid := auth.uid();
  v_published      boolean;
  v_pass_mark      int;
  v_title          text;
  v_hours          numeric(4,2);
  v_therapeutic    boolean;
  v_has_completion boolean;
  v_score          int;
  v_total          int;
  v_passed         boolean;
  v_reveal         boolean;
  v_attempt_id     uuid;
  v_completion     public.completions%rowtype;
  v_is_first       boolean := false;
  v_results        jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select published, pass_mark, title, cpd_hours, is_therapeutic
    into v_published, v_pass_mark, v_title, v_hours, v_therapeutic
  from public.courses where id = p_course_id;
  if not found then
    raise exception 'Course not found';
  end if;

  select exists (
    select 1 from public.completions
    where user_id = v_user and course_id = p_course_id
  ) into v_has_completion;

  if not v_published and not v_has_completion and not public.is_admin() then
    raise exception 'Course not available';
  end if;

  select count(*) into v_total from public.questions where course_id = p_course_id;
  if v_total = 0 then
    raise exception 'This course has no quiz questions';
  end if;

  if exists (
    select 1 from public.questions q
    where q.course_id = p_course_id
      and ((p_answers ->> q.id::text) is null
           or (p_answers ->> q.id::text) !~ '^[0-3]$')
  ) then
    raise exception 'All questions must be answered';
  end if;

  select count(*) into v_score
  from public.questions q
  where q.course_id = p_course_id
    and (p_answers ->> q.id::text)::int = q.correct_index;

  v_passed := (v_score::numeric * 100 / v_total) >= v_pass_mark;

  insert into public.attempts (user_id, course_id, score, total)
  values (v_user, p_course_id, v_score, v_total)
  returning id into v_attempt_id;

  insert into public.attempt_answers (attempt_id, question_id, selected_index, is_correct)
  select v_attempt_id, q.id,
         (p_answers ->> q.id::text)::int,
         (p_answers ->> q.id::text)::int = q.correct_index
  from public.questions q
  where q.course_id = p_course_id;

  if v_passed and not v_has_completion then
    insert into public.completions
      (user_id, course_id, attempt_id, score, total, course_title, cpd_hours, is_therapeutic)
    values
      (v_user, p_course_id, v_attempt_id, v_score, v_total, v_title, v_hours, v_therapeutic)
    on conflict (user_id, course_id) do nothing
    returning * into v_completion;
    if v_completion.id is not null then
      v_is_first := true;
    end if;
  end if;

  if not v_is_first and v_has_completion then
    select * into v_completion from public.completions
    where user_id = v_user and course_id = p_course_id;
  end if;

  v_reveal := v_passed or v_has_completion;

  select jsonb_agg(jsonb_build_object(
           'question_id',    q.id,
           'selected_index', (p_answers ->> q.id::text)::int,
           'is_correct',     (p_answers ->> q.id::text)::int = q.correct_index,
           'correct_index',  case when v_reveal then q.correct_index else null end,
           'explanation',    case when v_reveal then q.explanation else '' end
         ) order by q.sort_order)
    into v_results
  from public.questions q
  where q.course_id = p_course_id;

  return jsonb_build_object(
    'attempt_id',          v_attempt_id,
    'score',               v_score,
    'total',               v_total,
    'pass_mark',           v_pass_mark,
    'passed',              v_passed,
    'is_first_completion', v_is_first,
    'completion_id',       v_completion.id,
    'completed_at',        v_completion.completed_at,
    'results',             v_results
  );
end;
$$;

revoke execute on function public.submit_quiz(uuid, jsonb) from anon, public;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- 5. Public verification reads the certificate snapshot (not live joins).
drop function if exists public.verify_certificate(text);

create function public.verify_certificate(cert_code text)
returns table (
  certificate_code text,
  full_name        text,
  course_title     text,
  cpd_hours        numeric,
  is_therapeutic   boolean,
  completed_at     timestamptz,
  issued_at        timestamptz,
  revoked          boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.certificate_code, c.holder_name, c.course_title, c.cpd_hours, c.is_therapeutic, cm.completed_at, c.issued_at,
         (c.revoked_at is not null) as revoked
  from public.certificates c
  join public.completions cm on cm.id = c.completion_id
  where upper(c.certificate_code) = upper(trim(cert_code));
$$;

grant execute on function public.verify_certificate(text) to anon, authenticated;
