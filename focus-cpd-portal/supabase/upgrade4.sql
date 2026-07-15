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
--   5. Soft-delete for quiz questions (attempt history survives edits).
--   6. Completion/certificate records survive account deletion (RESTRICT).
--   7. Retains read access to completed-then-unpublished courses.
--   8. Keeps profiles.email in sync with the account email.
--   9. Engagement tracking + a submit_quiz gate (pre-reading/video first).
--  10. Storage RLS: drafts stay private; revoked certificates can't be
--      re-downloaded.
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
  v_is_preview     boolean := false;
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

  if not v_has_completion and not public.is_admin() then
    if not exists (
      select 1 from public.course_progress cp
      where cp.user_id = v_user and cp.course_id = p_course_id
        and cp.video_started_at is not null
        and (cp.prereading_confirmed_at is not null
             or not exists (select 1 from public.prereading_documents pd where pd.course_id = p_course_id))
    ) then
      raise exception 'Please work through the course material before taking the quiz.';
    end if;
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

  -- Admin previewing an unpublished course: log the attempt, no completion.
  v_is_preview := (not v_published) and public.is_admin() and not v_has_completion;

  insert into public.attempts (user_id, course_id, score, total)
  values (v_user, p_course_id, v_score, v_total)
  returning id into v_attempt_id;

  insert into public.attempt_answers (attempt_id, question_id, selected_index, is_correct)
  select v_attempt_id, q.id,
         (p_answers ->> q.id::text)::int,
         (p_answers ->> q.id::text)::int = q.correct_index
  from public.questions q
  where q.course_id = p_course_id;

  if v_passed and not v_has_completion and not v_is_preview then
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
    'is_preview',          v_is_preview,
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

-- 6. Soft-delete for quiz questions (preserve attempt_answers history).
alter table public.questions add column if not exists archived boolean not null default false;

create or replace view public.quiz_questions
with (security_invoker = off) as
  select q.id, q.course_id, q.sort_order, q.question_text, q.options
  from public.questions q
  join public.courses c on c.id = q.course_id
  where not q.archived
    and (c.published
     or public.is_admin()
     or exists (select 1 from public.completions cm
                where cm.course_id = c.id and cm.user_id = auth.uid()));
revoke all on public.quiz_questions from anon;
grant select on public.quiz_questions to authenticated;

-- 7. Records survive account deletion (RESTRICT, not CASCADE).
alter table public.completions  drop constraint if exists completions_user_id_fkey;
alter table public.completions  add  constraint completions_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete restrict;
alter table public.certificates drop constraint if exists certificates_user_id_fkey;
alter table public.certificates add  constraint certificates_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete restrict;

-- 8. Retain read access to completed-then-unpublished courses (was only in
--    the fresh migration, never the upgrade path).
drop policy if exists "courses_select_completed" on public.courses;
create policy "courses_select_completed" on public.courses
  for select to authenticated
  using (exists (select 1 from public.completions cm where cm.course_id = id and cm.user_id = auth.uid()));

-- 9. Keep profiles.email in sync with the account email.
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;
drop trigger if exists on_auth_user_email_change on auth.users;
create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row when (new.email is distinct from old.email)
  execute function public.handle_user_email_change();

-- 10. Engagement tracking + gate (submit_quiz above already enforces it).
create table if not exists public.course_progress (
  user_id                 uuid not null references public.profiles (id) on delete cascade,
  course_id               uuid not null references public.courses (id) on delete cascade,
  prereading_confirmed_at timestamptz,
  video_started_at        timestamptz,
  primary key (user_id, course_id)
);
alter table public.course_progress enable row level security;
drop policy if exists "course_progress_select" on public.course_progress;
create policy "course_progress_select" on public.course_progress
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create or replace function public.mark_engagement(p_course_id uuid, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_kind not in ('prereading', 'video') then raise exception 'Invalid engagement kind'; end if;
  insert into public.course_progress (user_id, course_id, prereading_confirmed_at, video_started_at)
  values (v_user, p_course_id,
          case when p_kind = 'prereading' then now() end,
          case when p_kind = 'video' then now() end)
  on conflict (user_id, course_id) do update set
    prereading_confirmed_at = coalesce(public.course_progress.prereading_confirmed_at, excluded.prereading_confirmed_at),
    video_started_at        = coalesce(public.course_progress.video_started_at, excluded.video_started_at);
end;
$$;
revoke execute on function public.mark_engagement(uuid, text) from anon, public;
grant execute on function public.mark_engagement(uuid, text) to authenticated;

-- 11. Scope draft content + block revoked-certificate downloads (storage RLS).
drop policy if exists "content_read" on storage.objects;
create policy "content_read" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('course-videos', 'prereading')
    and exists (
      select 1 from public.courses c
      where c.id = ((storage.foldername(name))[1])::uuid
        and (c.published or public.is_admin()
             or exists (select 1 from public.completions cm
                        where cm.course_id = c.id and cm.user_id = auth.uid()))
    )
  );

drop policy if exists "certificates_read_own" on storage.objects;
create policy "certificates_read_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'certificates'
    and (
      public.is_admin()
      or exists (select 1 from public.certificates c
                 where c.pdf_path = name and c.user_id = auth.uid() and c.revoked_at is null)
    )
  );

-- 12. set_admin: never allow the last admin to be demoted (two admins
-- demoting each other concurrently could previously leave zero admins).
create or replace function public.set_admin(target uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  if target = auth.uid() and not make_admin then
    raise exception 'You cannot remove your own admin access';
  end if;
  if not make_admin then
    perform 1 from public.profiles where is_admin for update;
    select count(*) into v_remaining from public.profiles
    where is_admin and id <> target;
    if v_remaining = 0 then
      raise exception 'Cannot remove the last admin — promote someone else first';
    end if;
  end if;
  update public.profiles set is_admin = make_admin where id = target;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

revoke execute on function public.set_admin(uuid, boolean) from anon, public;
grant execute on function public.set_admin(uuid, boolean) to authenticated;

-- 13. Atomic replacement of a course's learning objectives (admin-only).
create or replace function public.replace_objectives(p_course_id uuid, p_objectives text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  delete from public.learning_objectives where course_id = p_course_id;
  insert into public.learning_objectives (course_id, sort_order, objective)
  select p_course_id, ord, obj
  from unnest(p_objectives) with ordinality as t(obj, ord)
  where btrim(obj) <> '';
end;
$$;

revoke execute on function public.replace_objectives(uuid, text[]) from anon, public;
grant execute on function public.replace_objectives(uuid, text[]) to authenticated;

-- 14. Objectives + pre-reading stay readable for completed-then-unpublished
-- courses (matching courses_select_completed and the quiz view).
drop policy if exists "objectives_select" on public.learning_objectives;
create policy "objectives_select" on public.learning_objectives
  for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and (c.published or public.is_admin()))
         or exists (select 1 from public.completions cm where cm.course_id = course_id and cm.user_id = auth.uid()));

drop policy if exists "prereading_select" on public.prereading_documents;
create policy "prereading_select" on public.prereading_documents
  for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and (c.published or public.is_admin()))
         or exists (select 1 from public.completions cm where cm.course_id = course_id and cm.user_id = auth.uid()));
