-- ============================================================
-- Focus Vision CPD Portal — UPGRADE script
-- Run this ONLY if you already ran the ORIGINAL migration.sql.
-- Fresh projects should run the new migration.sql instead.
--
-- What this does:
--   1. Course deletion no longer destroys CPD records (RESTRICT)
--   2. Adds score/answer sanity checks
--   3. certificates.email_sent — lets the function retry failed emails
--   4. Hides quiz answers from the browser (quiz_questions view) and
--      moves grading server-side (submit_quiz function)
--   5. Removes client insert access to attempts/completions
--   6. Storage bucket size + MIME limits
--   7. Indexes on foreign keys
-- ============================================================

-- 1. Course deletion must not cascade into CPD records.
alter table public.completions
  drop constraint completions_course_id_fkey,
  add constraint completions_course_id_fkey
    foreign key (course_id) references public.courses (id) on delete restrict;

alter table public.certificates
  drop constraint certificates_course_id_fkey,
  add constraint certificates_course_id_fkey
    foreign key (course_id) references public.courses (id) on delete restrict;

-- 2. Sanity checks (existing rows must already satisfy these).
alter table public.attempts
  add constraint attempts_score_nonneg check (score >= 0),
  add constraint attempts_total_pos    check (total > 0),
  add constraint attempts_score_lte    check (score <= total);

alter table public.completions
  add constraint completions_score_nonneg check (score >= 0),
  add constraint completions_total_pos    check (total > 0),
  add constraint completions_score_lte    check (score <= total);

alter table public.attempt_answers
  add constraint attempt_answers_selected_range check (selected_index between 0 and 3);

-- 3. Email retry flag. Existing certificates are assumed sent.
alter table public.certificates
  add column email_sent boolean not null default false;
update public.certificates set email_sent = true;

-- 4. Quiz questions view (no answers exposed) + server-side grading.
drop policy "questions_select" on public.questions;

create policy "questions_select_admin" on public.questions
  for select to authenticated
  using (public.is_admin());

create view public.quiz_questions
with (security_invoker = off) as
  select q.id, q.course_id, q.sort_order, q.question_text, q.options
  from public.questions q
  join public.courses c on c.id = q.course_id
  where c.published
     or public.is_admin()
     or exists (select 1 from public.completions cm
                where cm.course_id = c.id and cm.user_id = auth.uid());

revoke all on public.quiz_questions from anon;
grant select on public.quiz_questions to authenticated;

create or replace function public.submit_quiz(p_course_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user           uuid := auth.uid();
  v_published      boolean;
  v_has_completion boolean;
  v_score          int;
  v_total          int;
  v_attempt_id     uuid;
  v_completion     public.completions%rowtype;
  v_is_first       boolean := false;
  v_results        jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select published into v_published from public.courses where id = p_course_id;
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

  insert into public.attempts (user_id, course_id, score, total)
  values (v_user, p_course_id, v_score, v_total)
  returning id into v_attempt_id;

  insert into public.attempt_answers (attempt_id, question_id, selected_index, is_correct)
  select v_attempt_id, q.id,
         (p_answers ->> q.id::text)::int,
         (p_answers ->> q.id::text)::int = q.correct_index
  from public.questions q
  where q.course_id = p_course_id;

  if not v_has_completion then
    insert into public.completions (user_id, course_id, attempt_id, score, total)
    values (v_user, p_course_id, v_attempt_id, v_score, v_total)
    on conflict (user_id, course_id) do nothing
    returning * into v_completion;
    if v_completion.id is not null then
      v_is_first := true;
    end if;
  end if;

  if not v_is_first then
    select * into v_completion from public.completions
    where user_id = v_user and course_id = p_course_id;
  end if;

  select jsonb_agg(jsonb_build_object(
           'question_id',    q.id,
           'selected_index', (p_answers ->> q.id::text)::int,
           'correct_index',  q.correct_index,
           'is_correct',     (p_answers ->> q.id::text)::int = q.correct_index,
           'explanation',    q.explanation
         ) order by q.sort_order)
    into v_results
  from public.questions q
  where q.course_id = p_course_id;

  return jsonb_build_object(
    'attempt_id',          v_attempt_id,
    'score',               v_score,
    'total',               v_total,
    'is_first_completion', v_is_first,
    'completion_id',       v_completion.id,
    'completed_at',        v_completion.completed_at,
    'results',             v_results
  );
end;
$$;

revoke execute on function public.submit_quiz(uuid, jsonb) from anon, public;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- 5. Client-side inserts are no longer allowed (submit_quiz handles them).
drop policy "attempts_insert_own" on public.attempts;
drop policy "attempt_answers_insert_own" on public.attempt_answers;
drop policy "completions_insert_own" on public.completions;

-- 6. Storage bucket limits.
update storage.buckets
   set file_size_limit = 1073741824,
       allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
 where id = 'course-videos';

update storage.buckets
   set file_size_limit = 20971520,
       allowed_mime_types = array['application/pdf']
 where id = 'prereading';

update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['application/pdf']
 where id = 'certificates';

-- 7. Indexes.
create index if not exists learning_objectives_course_idx on public.learning_objectives (course_id);
create index if not exists prereading_documents_course_idx on public.prereading_documents (course_id);
create index if not exists questions_course_idx on public.questions (course_id);
create index if not exists attempts_user_course_idx on public.attempts (user_id, course_id);
create index if not exists attempts_course_idx on public.attempts (course_id);
create index if not exists attempt_answers_attempt_idx on public.attempt_answers (attempt_id);
create index if not exists attempt_answers_question_idx on public.attempt_answers (question_id);
create index if not exists completions_course_idx on public.completions (course_id);
create index if not exists certificates_user_idx on public.certificates (user_id);
create index if not exists certificates_course_idx on public.certificates (course_id);
