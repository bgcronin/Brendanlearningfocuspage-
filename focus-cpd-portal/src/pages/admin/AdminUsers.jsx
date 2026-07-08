import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/Protected'
import AdminNav from '../../components/AdminNav'
import { formatDate, downloadCsv } from '../../lib/helpers'

export default function AdminUsers() {
  const { session } = useAuth()
  const [users, setUsers] = useState(null)
  const [completionCounts, setCompletionCounts] = useState({})
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function load() {
    const [{ data: profiles }, { data: completions }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('completions').select('user_id'),
    ])
    setUsers(profiles ?? [])
    const counts = {}
    for (const c of completions ?? []) counts[c.user_id] = (counts[c.user_id] ?? 0) + 1
    setCompletionCounts(counts)
  }

  useEffect(() => {
    load()
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users ?? []
    return (users ?? []).filter((u) =>
      [u.full_name, u.email, u.practice_name, u.ahpra_number].some((f) => (f ?? '').toLowerCase().includes(q)),
    )
  }, [users, search])

  function exportCsv() {
    downloadCsv(
      `focus-cpd-users-${new Date().toISOString().slice(0, 10)}.csv`,
      visible,
      [
        { label: 'Full name', value: (u) => u.full_name ?? '' },
        { label: 'Email', value: (u) => u.email ?? '' },
        { label: 'Practice', value: (u) => u.practice_name ?? '' },
        { label: 'AHPRA number', value: (u) => u.ahpra_number ?? '' },
        { label: 'Registered', value: (u) => u.created_at },
        { label: 'Completions', value: (u) => completionCounts[u.id] ?? 0 },
        { label: 'Admin', value: (u) => (u.is_admin ? 'Yes' : 'No') },
      ],
    )
  }

  async function toggleAdmin(u) {
    const promoting = !u.is_admin
    const message = promoting
      ? `Make ${u.full_name || u.email} an admin? They'll be able to manage courses, view all completions and revoke certificates.`
      : `Remove admin access for ${u.full_name || u.email}?`
    if (!confirm(message)) return
    setBusyId(u.id)
    const { error } = await supabase.rpc('set_admin', { target: u.id, make_admin: promoting })
    setBusyId(null)
    if (error) return alert(error.message)
    setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, is_admin: promoting } : x)))
  }

  if (!users) return <Loading />

  return (
    <div>
      <AdminNav />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-navy">Users</h1>
          <p className="mt-1 text-slate-500">
            {users.length} registered · {users.filter((u) => u.is_admin).length} admin{users.filter((u) => u.is_admin).length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="input sm:max-w-xs"
            placeholder="Search name, email, practice, AHPRA…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={exportCsv} disabled={visible.length === 0} className="btn-primary shrink-0">
            Export CSV{search.trim() ? ' (filtered)' : ''}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card mt-8 p-12 text-center text-slate-500">No users match your search.</div>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5">Optometrist</th>
                <th className="px-5 py-3.5">Practice</th>
                <th className="px-5 py-3.5">AHPRA</th>
                <th className="px-5 py-3.5">Joined</th>
                <th className="px-5 py-3.5">Completions</th>
                <th className="px-5 py-3.5">Role</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-navy">{u.full_name || '—'}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{u.practice_name || '—'}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-600">{u.ahpra_number || '—'}</td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(u.created_at)}</td>
                  <td className="px-5 py-4 text-slate-600">{completionCounts[u.id] ?? 0}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {u.is_admin ? (
                        <span className="inline-flex items-center rounded-full bg-navy px-2.5 py-0.5 text-xs font-semibold text-white">Admin</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">Optometrist</span>
                      )}
                      {u.id !== session.user.id && (
                        <button
                          onClick={() => toggleAdmin(u)}
                          disabled={busyId === u.id}
                          className="text-xs font-semibold text-teal hover:underline disabled:opacity-50"
                        >
                          {busyId === u.id ? 'Saving…' : u.is_admin ? 'Remove admin' : 'Make admin'}
                        </button>
                      )}
                      {u.id === session.user.id && <span className="text-xs text-slate-400">(you)</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
