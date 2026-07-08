-- ============================================================
-- Focus Vision CPD Portal — UPGRADE 2
-- Adds: therapeutic CPD classification + learning reflections.
--
-- Run this if your database was created with an earlier
-- migration.sql (or was upgraded via upgrade.sql). Fresh projects
-- running the current migration.sql do NOT need this file.
-- ============================================================

-- 1. Therapeutic (scheduled medicines) CPD classification per course.
alter table public.courses
  add column is_therapeutic boolean not null default false;

-- 2. Optional learning reflection per completion (OBA CPD portfolio).
alter table public.completions
  add column reflection text not null default '';

-- Users may update ONLY the reflection on their own completions.
revoke update on public.completions from authenticated;
grant update (reflection) on public.completions to authenticated;

create policy "completions_update_own_reflection" on public.completions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3. Public verification now also reports the therapeutic flag.
-- (Return type changes, so the function must be dropped first.)
drop function if exists public.verify_certificate(text);

create function public.verify_certificate(cert_code text)
returns table (
  certificate_code text,
  full_name        text,
  course_title     text,
  cpd_hours        numeric,
  is_therapeutic   boolean,
  completed_at     timestamptz,
  issued_at        timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.certificate_code, p.full_name, co.title, co.cpd_hours, co.is_therapeutic, cm.completed_at, c.issued_at
  from public.certificates c
  join public.profiles    p  on p.id  = c.user_id
  join public.courses     co on co.id = c.course_id
  join public.completions cm on cm.id = c.completion_id
  where upper(c.certificate_code) = upper(trim(cert_code));
$$;

grant execute on function public.verify_certificate(text) to anon, authenticated;
