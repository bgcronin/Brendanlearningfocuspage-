-- ============================================================
-- Focus Vision CPD Portal — Supabase migration
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor).
-- Safe to run on a fresh project.
-- (Already ran an older version? Run upgrade.sql instead.)
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null default '',
  email         text not null default '',
  practice_name text not null default '',
  ahpra_number  text not null default '',
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, practice_name, ahpra_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'practice_name', ''),
    coalesce(new.raw_user_meta_data ->> 'ahpra_number', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper used throughout RLS. SECURITY DEFINER so it can read
-- profiles without recursive policy checks.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ------------------------------------------------------------
-- COURSES + CONTENT
-- ------------------------------------------------------------
create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  presenter   text not null default '',
  categories  text[] not null default '{}',
  cpd_hours   numeric(4,2) not null default 1.0 check (cpd_hours > 0),
  -- Minimum percentage of quiz questions the learner must answer
  -- correctly to complete the course and be issued a certificate.
  -- A certificate asserts "successfully completed", so a pass is required.
  pass_mark   int not null default 70 check (pass_mark between 0 and 100),
  -- Counts toward the therapeutic (scheduled medicines) CPD hours that
  -- therapeutically endorsed optometrists must complete. Shown on the
  -- certificate and totalled separately in My CPD Record.
  is_therapeutic boolean not null default false,
  video_type  text not null default 'embed' check (video_type in ('embed', 'upload')),
  -- For 'embed': the Vimeo/YouTube URL. For 'upload': the storage path in the course-videos bucket.
  video_url   text not null default '',
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.learning_objectives (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses (id) on delete cascade,
  sort_order int not null default 0,
  objective  text not null
);

create table public.prereading_documents (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  title        text not null,
  storage_path text not null, -- path in the 'prereading' bucket
  sort_order   int not null default 0
);

create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses (id) on delete cascade,
  sort_order    int not null default 0,
  question_text text not null,
  options       jsonb not null check (jsonb_array_length(options) = 4),
  correct_index int not null check (correct_index between 0 and 3),
  explanation   text not null default ''
);

-- ------------------------------------------------------------
-- ATTEMPTS / COMPLETIONS / CERTIFICATES
-- ------------------------------------------------------------
-- Every quiz submission is logged here, including retakes.
-- Rows are created ONLY by the submit_quiz() function below —
-- scores are graded server-side and cannot be forged.
create table public.attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  score      int not null check (score >= 0),
  total      int not null check (total > 0),
  created_at timestamptz not null default now(),
  check (score <= total)
);

create table public.attempt_answers (
  id             uuid primary key default gen_random_uuid(),
  attempt_id     uuid not null references public.attempts (id) on delete cascade,
  question_id    uuid not null references public.questions (id) on delete cascade,
  selected_index int not null check (selected_index between 0 and 3),
  is_correct     boolean not null
);

-- One completion per user per course — the first one stands.
-- ON DELETE RESTRICT: a course with recorded completions cannot be
-- deleted (CPD records and certificates must remain valid forever).
create table public.completions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  course_id    uuid not null references public.courses (id) on delete restrict,
  attempt_id   uuid references public.attempts (id) on delete set null,
  score        int not null check (score >= 0),
  total        int not null check (total > 0),
  -- Course facts snapshotted at completion time. The CPD record must
  -- reflect what was earned; a later course edit must not rewrite history.
  course_title   text not null default '',
  cpd_hours      numeric(4,2),
  is_therapeutic boolean not null default false,
  -- Optional learning reflection written by the optometrist after
  -- completing the course (supports the OBA CPD portfolio requirement).
  reflection   text not null default '',
  completed_at timestamptz not null default now(),
  unique (user_id, course_id),
  check (score <= total)
);

-- Rows inserted only by the issue-certificate Netlify Function (service role).
-- The holder name and course facts are SNAPSHOTTED here at issue time:
-- the certificate (and public verification) must forever reflect what was
-- issued, not the live profile/course, which a later rename or course edit
-- would otherwise silently rewrite.
create table public.certificates (
  id               uuid primary key default gen_random_uuid(),
  certificate_code text not null unique,
  completion_id    uuid not null unique references public.completions (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  course_id        uuid not null references public.courses (id) on delete restrict,
  -- Snapshots (immutable record of what the certificate was issued for).
  holder_name      text not null default '',
  course_title     text not null default '',
  cpd_hours        numeric(4,2),
  is_therapeutic   boolean not null default false,
  pdf_path         text not null, -- path in the 'certificates' bucket
  email_sent       boolean not null default false, -- lets the function retry a failed email
  -- Set by an admin to invalidate a certificate issued in error.
  -- The row is kept so /verify can report "revoked" rather than "not found".
  revoked_at       timestamptz,
  revoked_reason   text not null default '',
  issued_at        timestamptz not null default now()
);

-- Indexes on foreign keys used in joins and RLS checks.
create index learning_objectives_course_idx on public.learning_objectives (course_id);
create index prereading_documents_course_idx on public.prereading_documents (course_id);
create index questions_course_idx on public.questions (course_id);
create index attempts_user_course_idx on public.attempts (user_id, course_id);
create index attempts_course_idx on public.attempts (course_id);
create index attempt_answers_attempt_idx on public.attempt_answers (attempt_id);
create index attempt_answers_question_idx on public.attempt_answers (question_id);
create index completions_course_idx on public.completions (course_id);
create index certificates_user_idx on public.certificates (user_id);
create index certificates_course_idx on public.certificates (course_id);

-- ------------------------------------------------------------
-- QUIZ: safe question view + server-side grading
-- ------------------------------------------------------------
-- Learners take the quiz from this view, which never exposes
-- correct_index or explanation. The base questions table is
-- readable by admins only.
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

-- Grades a submission server-side, logs the attempt + answers, and
-- records the completion if it's the user's first for the course.
-- p_answers: {"<question_id>": <selected_index 0-3>, ...}
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

  -- Drafts can only be taken by admins (or retaken by users who
  -- completed the course before it was unpublished).
  if not v_published and not v_has_completion and not public.is_admin() then
    raise exception 'Course not available';
  end if;

  select count(*) into v_total from public.questions where course_id = p_course_id;
  if v_total = 0 then
    raise exception 'This course has no quiz questions';
  end if;

  -- Every question must have a valid answer (0-3).
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

  -- Pass = score percentage at or above the course's pass mark.
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

  -- A completion (and therefore a certificate) is recorded ONLY on a
  -- passing attempt, and only the first pass stands. Course facts are
  -- snapshotted onto the completion so a later course edit cannot rewrite
  -- an optometrist's CPD record.
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

  -- Correct answers + explanations are revealed only once the learner has
  -- passed (now or previously) — otherwise a failing attempt would hand
  -- over the answer key for a trivial retake.
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

-- ------------------------------------------------------------
-- PUBLIC CERTIFICATE VERIFICATION (no login required)
-- ------------------------------------------------------------
create or replace function public.verify_certificate(cert_code text)
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
  -- Reads the SNAPSHOT on the certificate, not the live profile/course:
  -- a rename or course edit after issue must not change what verification
  -- reports. completed_at comes from the (immutable) completion.
  select c.certificate_code, c.holder_name, c.course_title, c.cpd_hours, c.is_therapeutic, cm.completed_at, c.issued_at,
         (c.revoked_at is not null) as revoked
  from public.certificates c
  join public.completions cm on cm.id = c.completion_id
  where upper(c.certificate_code) = upper(trim(cert_code));
$$;

grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ------------------------------------------------------------
-- ADMIN: grant/revoke admin access (guarded, server-side)
-- ------------------------------------------------------------
-- profiles.is_admin has no client update grant, so promotion happens
-- only through this SECURITY DEFINER function, callable by admins.
create or replace function public.set_admin(target uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  if target = auth.uid() and not make_admin then
    raise exception 'You cannot remove your own admin access';
  end if;
  update public.profiles set is_admin = make_admin where id = target;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

revoke execute on function public.set_admin(uuid, boolean) from anon, public;
grant execute on function public.set_admin(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.courses              enable row level security;
alter table public.learning_objectives  enable row level security;
alter table public.prereading_documents enable row level security;
alter table public.questions            enable row level security;
alter table public.attempts             enable row level security;
alter table public.attempt_answers      enable row level security;
alter table public.completions          enable row level security;
alter table public.certificates         enable row level security;

-- profiles: read own (admins read all); update own — but only the
-- non-privileged columns (column-level grant prevents self-promotion to admin).
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

revoke update on public.profiles from authenticated;
grant update (full_name, practice_name, ahpra_number) on public.profiles to authenticated;

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- courses: logged-in users see published courses; admins see and manage everything.
create policy "courses_select" on public.courses
  for select to authenticated
  using (published or public.is_admin());

-- Users keep read access to courses they've completed even if the
-- course is later unpublished (so My CPD Record stays intact).
create policy "courses_select_completed" on public.courses
  for select to authenticated
  using (exists (select 1 from public.completions cm where cm.course_id = id and cm.user_id = auth.uid()));

create policy "courses_admin_write" on public.courses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Course child tables: readable when the parent course is visible; admin-writable.
create policy "objectives_select" on public.learning_objectives
  for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and (c.published or public.is_admin())));

create policy "objectives_admin_write" on public.learning_objectives
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "prereading_select" on public.prereading_documents
  for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and (c.published or public.is_admin())));

create policy "prereading_admin_write" on public.prereading_documents
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- questions: ADMIN-ONLY. Learners read via the quiz_questions view,
-- which hides correct_index and explanation; grading happens in
-- submit_quiz() so answers are never sent to the browser pre-submit.
create policy "questions_select_admin" on public.questions
  for select to authenticated
  using (public.is_admin());

create policy "questions_admin_write" on public.questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- attempts / attempt_answers / completions: READ-ONLY from the client
-- (own rows; admins read all). Inserts happen only inside submit_quiz()
-- (SECURITY DEFINER), so scores and completions cannot be forged.
create policy "attempts_select" on public.attempts
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "attempt_answers_select" on public.attempt_answers
  for select to authenticated
  using (exists (select 1 from public.attempts a where a.id = attempt_id and (a.user_id = auth.uid() or public.is_admin())));

create policy "completions_select" on public.completions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- The only client-side write to completions: users may edit the
-- reflection on their own rows. A column-level grant limits the
-- update to the reflection column — scores/dates stay immutable.
revoke update on public.completions from authenticated;
grant update (reflection) on public.completions to authenticated;

create policy "completions_update_own_reflection" on public.completions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- certificates: read own (admins all). Inserted only by the service role
-- (Netlify Function), which bypasses RLS — no insert policy on purpose.
create policy "certificates_select" on public.certificates
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Admins may revoke/reinstate certificates — and ONLY that: a
-- column-level grant limits updates to the revocation columns.
revoke update on public.certificates from authenticated;
grant update (revoked_at, revoked_reason) on public.certificates to authenticated;

create policy "certificates_admin_update" on public.certificates
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- STORAGE BUCKETS + POLICIES
-- ------------------------------------------------------------
-- Size limits + MIME allow-lists are enforced by Supabase Storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('course-videos', 'course-videos', false, 1073741824, -- 1 GB
   array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']),
  ('prereading',    'prereading',    false, 20971520,   -- 20 MB
   array['application/pdf']),
  ('certificates',  'certificates',  false, 10485760,   -- 10 MB
   array['application/pdf'])
on conflict (id) do nothing;

-- Videos + pre-reading: any logged-in user can view; only admins manage.
create policy "content_read" on storage.objects
  for select to authenticated
  using (bucket_id in ('course-videos', 'prereading'));

create policy "content_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('course-videos', 'prereading') and public.is_admin());

create policy "content_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('course-videos', 'prereading') and public.is_admin());

create policy "content_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('course-videos', 'prereading') and public.is_admin());

-- Certificates: files live at {user_id}/{certificate_code}.pdf.
-- Users can read their own; admins can read all; only the service role writes.
create policy "certificates_read_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'certificates'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ------------------------------------------------------------
-- DONE. Next steps:
--   1. Run seed.sql for example courses.
--   2. Make yourself an admin:
--      update public.profiles set is_admin = true where email = 'you@focusvision.com.au';
-- ------------------------------------------------------------
