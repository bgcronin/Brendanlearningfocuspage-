import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Loading } from '../../components/Protected'
import AdminNav from '../../components/AdminNav'
import { signedUrl, formatDate, formatHours, downloadCsv, one } from '../../lib/helpers'

const PAGE_SIZE = 25

export default function AdminDashboard() {
  const [rows, setRows] = useState(null)
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [busyId, setBusyId] = useState(null) // completion id with an action in flight

  async function load() {
    const { data } = await supabase
      .from('completions')
      .select(
        '*, profiles:user_id(full_name, email, practice_name, ahpra_number), courses:course_id(title, cpd_hours, is_therapeutic), certificates(id, certificate_code, pdf_path, email_sent, revoked_at, revoked_reason, issued_at)',
      )
      .order('completed_at', { ascending: false })
    setRows(data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  const courses = useMemo(() => {
    const map = new Map()
    for (const r of rows ?? []) {
      const c = one(r.courses)
      if (c) map.set(r.course_id, c.title)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  const filtered = useMemo(() => {
    let out = rows ?? []
    if (courseFilter !== 'all') out = out.filter((r) => r.course_id === courseFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      out = out.filter((r) => {
        const p = one(r.profiles)
        return [p?.full_name, p?.email, p?.practice_name, p?.ahpra_number].some((f) => (f ?? '').toLowerCase().includes(q))
      })
    }
    if (from) out = out.filter((r) => r.completed_at >= `${from}T00:00:00`)
    if (to) out = out.filter((r) => r.completed_at <= `${to}T23:59:59`)
    return out
  }, [rows, search, courseFilter, from, to])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  function exportCsv() {
    downloadCsv(
      `focus-cpd-completions-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered,
      [
        { label: 'Name', value: (r) => one(r.profiles)?.full_name ?? '' },
        { label: 'Email', value: (r) => one(r.profiles)?.email ?? '' },
        { label: 'Practice', value: (r) => one(r.profiles)?.practice_name ?? '' },
        { label: 'AHPRA', value: (r) => one(r.profiles)?.ahpra_number ?? '' },
        { label: 'Course', value: (r) => one(r.courses)?.title ?? '' },
        { label: 'CPD hours', value: (r) => one(r.courses)?.cpd_hours ?? '' },
        { label: 'Therapeutic', value: (r) => (one(r.courses)?.is_therapeutic ? 'Yes' : 'No') },
        { label: 'Completed at', value: (r) => r.completed_at },
        { label: 'Score', value: (r) => `${r.score}/${r.total}` },
        { label: 'Certificate ID', value: (r) => one(r.certificates)?.certificate_code ?? '' },
        { label: 'Certificate issued', value: (r) => (one(r.certificates) ? 'Yes' : 'No') },
        { label: 'Certificate revoked', value: (r) => (one(r.certificates)?.revoked_at ? 'Yes' : 'No') },
      ],
    )
  }

  async function downloadPdf(r, cert) {
    setBusyId(r.id)
    try {
      const url = await signedUrl('certificates', cert.pdf_path, 300)
      window.open(url, '_blank', 'noopener')
    } catch {
      alert('Could not download the certificate PDF.')
    } finally {
      setBusyId(null)
    }
  }

  async function resendEmail(r) {
    const p = one(r.profiles)
    if (!confirm(`Re-send the certificate email to ${p?.email}?`)) return
    setBusyId(r.id)
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/issue-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ completionId: r.id, forceEmail: true }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not send the email')
      alert(body.emailSent ? `Email sent to ${p?.email}.` : `Email failed: ${body.emailError || 'unknown error'}`)
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function toggleRevoked(r, cert) {
    if (cert.revoked_at) {
      if (!confirm(`Reinstate certificate ${cert.certificate_code}? It will verify as genuine again.`)) return
      setBusyId(r.id)
      const { error } = await supabase.from('certificates').update({ revoked_at: null, revoked_reason: '' }).eq('id', cert.id)
      setBusyId(null)
      if (error) return alert(error.message)
    } else {
      const reason = prompt(
        `Revoke certificate ${cert.certificate_code}?\n\nIt will show as REVOKED on the public verification page and the optometrist won't be able to download it. Enter a reason (kept for your records):`,
      )
      if (reason === null) return
      setBusyId(r.id)
      const { error } = await supabase
        .from('certificates')
        .update({ revoked_at: new Date().toISOString(), revoked_reason: reason.trim() })
        .eq('id', cert.id)
      setBusyId(null)
      if (error) return alert(error.message)
    }
    load()
  }

  if (!rows) return <Loading />

  return (
    <div>
      <AdminNav />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-navy">Completions dashboard</h1>
          <p className="mt-1 text-slate-500">
            {filtered.length === rows.length
              ? `${rows.length} completion${rows.length === 1 ? '' : 's'} recorded.`
              : `${filtered.length} of ${rows.length} completions match your filters.`}
          </p>
        </div>
        <button onClick={exportCsv} disabled={filtered.length === 0} className="btn-primary">
          Export CSV{filtered.length !== rows.length ? ' (filtered)' : ''}
        </button>
      </div>

      {/* Filters */}
      <div className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label">Search</label>
          <input className="input" placeholder="Name, email, practice, AHPRA…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
        </div>
        <div className="sm:w-64">
          <label className="label">Course</label>
          <select className="input" value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setPage(0) }}>
            <option value="all">All courses</option>
            {courses.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0) }} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => { setTo(e.target.value); setPage(0) }} />
        </div>
        {(search || courseFilter !== 'all' || from || to) && (
          <button
            onClick={() => { setSearch(''); setCourseFilter('all'); setFrom(''); setTo(''); setPage(0) }}
            className="btn-secondary !py-2.5 text-sm"
          >
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card mt-6 p-12 text-center text-slate-500">
          {rows.length === 0 ? 'No completions yet.' : 'No completions match your filters.'}
        </div>
      ) : (
        <>
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Optometrist</th>
                  <th className="px-5 py-3.5">Practice</th>
                  <th className="px-5 py-3.5">Course</th>
                  <th className="px-5 py-3.5">Completed</th>
                  <th className="px-5 py-3.5">Score</th>
                  <th className="px-5 py-3.5">Hours</th>
                  <th className="px-5 py-3.5">Certificate</th>
                  <th className="px-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const p = one(r.profiles)
                  const c = one(r.courses)
                  const cert = one(r.certificates)
                  const busy = busyId === r.id
                  return (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-navy">{p?.full_name}</div>
                        <div className="text-xs text-slate-400">{p?.email}</div>
                        {p?.ahpra_number && <div className="text-xs text-slate-400">AHPRA: {p.ahpra_number}</div>}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{p?.practice_name || '—'}</td>
                      <td className="px-5 py-4 font-medium text-navy">{c?.title}</td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(r.completed_at)}</td>
                      <td className="px-5 py-4 text-slate-600">{r.score} / {r.total}</td>
                      <td className="px-5 py-4 font-semibold text-navy">
                        {formatHours(c?.cpd_hours ?? 0)}
                        {c?.is_therapeutic && (
                          <div className="mt-1 inline-flex rounded-full bg-teal-pale px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-dark">Therapeutic</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {cert ? (
                          <div>
                            {cert.revoked_at ? (
                              <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700" title={cert.revoked_reason || undefined}>
                                Revoked
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Issued</span>
                            )}
                            {!cert.email_sent && !cert.revoked_at && (
                              <span className="ml-1 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Email failed</span>
                            )}
                            <div className="mt-1 font-mono text-[10px] text-slate-400">{cert.certificate_code}</div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Pending</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {cert && (
                          <div className="flex flex-col items-start gap-1 text-xs font-semibold">
                            {!cert.revoked_at && (
                              <>
                                <button onClick={() => downloadPdf(r, cert)} disabled={busy} className="text-teal hover:underline disabled:opacity-50">Download PDF</button>
                                <button onClick={() => resendEmail(r)} disabled={busy} className="text-teal hover:underline disabled:opacity-50">Re-send email</button>
                              </>
                            )}
                            <button onClick={() => toggleRevoked(r, cert)} disabled={busy} className={`hover:underline disabled:opacity-50 ${cert.revoked_at ? 'text-emerald-700' : 'text-red-600'}`}>
                              {cert.revoked_at ? 'Reinstate' : 'Revoke'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} className="btn-secondary !py-2 text-sm disabled:opacity-50">← Previous</button>
              <span className="text-slate-500">Page {safePage + 1} of {pageCount}</span>
              <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} className="btn-secondary !py-2 text-sm disabled:opacity-50">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
