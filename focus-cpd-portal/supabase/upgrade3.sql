-- ============================================================
-- Focus Vision CPD Portal — UPGRADE 3
-- Adds: certificate revocation + guarded admin promotion (set_admin).
--
-- Run this if your database predates the current migration.sql
-- (after upgrade.sql and upgrade2.sql). Fresh projects running the
-- current migration.sql do NOT need this file.
-- ============================================================

-- 1. Certificate revocation.
alter table public.certificates
  add column revoked_at timestamptz,
  add column revoked_reason text not null default '';

-- Admins may revoke/reinstate — and ONLY that (column-level grant).
revoke update on public.certificates from authenticated;
grant update (revoked_at, revoked_reason) on public.certificates to authenticated;

create policy "certificates_admin_update" on public.certificates
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 2. Public verification reports revocation.
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
  select c.certificate_code, p.full_name, co.title, co.cpd_hours, co.is_therapeutic, cm.completed_at, c.issued_at,
         (c.revoked_at is not null) as revoked
  from public.certificates c
  join public.profiles    p  on p.id  = c.user_id
  join public.courses     co on co.id = c.course_id
  join public.completions cm on cm.id = c.completion_id
  where upper(c.certificate_code) = upper(trim(cert_code));
$$;

grant execute on function public.verify_certificate(text) to anon, authenticated;

-- 3. Guarded admin promotion/demotion.
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
