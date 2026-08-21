-- ============================================================
-- Focus Vision CPD Portal — UPGRADE 2
-- Adds: therapeutic CPD classification + learning reflections.
--
-- Run this if your database was created with an earlier
-- migration.sql (or was upgraded via upgrade.sql). Fresh projects
-- running the current migration.sql do NOT need this file.
-- Safe to re-run, and safe to run before upgrade3/upgrade4.
-- ============================================================

-- 1. Therapeutic (scheduled medicines) CPD classification per course.
alter table public.courses
  add column if not exists is_therapeutic boolean not null default false;

-- 2. Optional learning reflection per completion (OBA CPD portfolio).
alter table public.completions
  add column if not exists reflection text not null default '';

-- Users may update ONLY the reflection on their own completions.
revoke update on public.completions from authenticated;
grant update (reflection) on public.completions to authenticated;

drop policy if exists "completions_update_own_reflection" on public.completions;
create policy "completions_update_own_reflection" on public.completions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3. public.verify_certificate is NOT redefined here. This file used to
-- recreate it (7 columns, no `revoked` field); if that stale version was
-- applied after upgrade3, revoked certificates verified as GENUINE, because
-- the frontend gates its "revoked" warning on the missing column. The
-- function is owned by the latest upgrade file (upgrade4.sql — snapshot +
-- revocation aware); run the upgrade files in order and it ends up correct
-- regardless of what was installed before.
