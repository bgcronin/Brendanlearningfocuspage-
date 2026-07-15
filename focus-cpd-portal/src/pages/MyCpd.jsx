import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Loading } from '../components/Protected'
import ReflectionEditor from '../components/ReflectionEditor'
import { openSigned, formatDate, formatHours, one } from '../lib/helpers'

// The CPD record reads the course facts SNAPSHOTTED onto the completion at
// pass time (immutable), falling back to the live course only for older
// rows that predate the snapshot.
function courseFacts(r) {
  const course = one(r.courses)
  const hasSnap = r.cpd_hours != null
  return {
    title: r.course_title || course?.title,
    presenter: course?.presenter,
    hours: Number(hasSnap ? r.cpd_hours : course?.cpd_hours ?? 0),
    therapeutic: hasSnap ? r.is_therapeutic : course?.is_therapeutic,
  }
}

export default function MyCpd() {
  const { session, profile } = useAuth()
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [downloadingId, setDownloadingId] = useState(null)
  const [generatingId, setGeneratingId] = useState(null)
  const [openReflectionId, setOpenReflectionId] = useState(null)

  useEffect(() => {
    setLoadError('')
    supabase
      .from('completions')
      .select('*, courses:course_id(title, presenter, cpd_hours, is_therapeutic), certificates(id, certificate_code, pdf_path, revoked_at, issued_at)')
      .eq('user_id', session.user.id)
      .order('completed_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setLoadError('We couldn’t load your CPD record. Please try again.')
        else setRows(data ?? [])
      })
  }, [session.user.id, reloadKey])

  // Recover a completion whose certificate never issued (e.g. the email/
  // generation failed at the time). The function is idempotent.
  async function generateCert(completionId) {
    setGeneratingId(completionId)
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/issue-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ completionId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not generate the certificate')
      setReloadKey((k) => k + 1)
    } catch (err) {
      alert(err.message)
    } finally {
      setGeneratingId(null)
    }
  }

  const totals = useMemo(() => {
    // OBA CPD registration period: 1 December – 30 November (Brisbane time).
    // The headline tiles report THIS period — the number that matters for
    // registration — with all-time shown underneath.
    const nowBrisbane = new Date(Date.now() + 10 * 3600 * 1000) // UTC+10, no DST
    const y = nowBrisbane.getUTCFullYear()
    const periodStartYear = nowBrisbane.getUTCMonth() + 1 >= 12 ? y : y - 1
    const periodStart = Date.parse(`${periodStartYear}-12-01T00:00:00+10:00`)
    const t = { period: 0, periodTherapeutic: 0, all: 0, therapeutic: 0, periodStartYear }
    for (const r of rows ?? []) {
      if (one(r.certificates)?.revoked_at) continue // revoked credits don't count
      const f = courseFacts(r)
      t.all += f.hours
      if (f.therapeutic) t.therapeutic += f.hours
      if (Date.parse(r.completed_at) >= periodStart) {
        t.period += f.hours
        if (f.therapeutic) t.periodTherapeutic += f.hours
      }
    }
    return t
  }, [rows])

  async function download(cert) {
    setDownloadingId(cert.id)
    try {
      await openSigned('certificates', cert.pdf_path, 300)
    } catch {
      alert('Could not download the certificate. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-slate-600">{loadError}</p>
        <button onClick={() => setReloadKey((k) => k + 1)} className="btn-primary mt-4">Try again</button>
      </div>
    )
  }
  if (!rows) return <Loading />

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-navy">My CPD Record</h1>
          <p className="mt-1 text-slate-500">{profile?.full_name} · every certificate is permanently re-downloadable here.</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-lg bg-navy px-5 py-3 text-white">
            <div className="text-xs font-semibold uppercase tracking-wider text-teal-light">CPD hours · this period</div>
            <div className="text-2xl font-bold">{formatHours(totals.period)}</div>
            <div className="mt-0.5 text-[10px] text-teal-light/80">
              since 1 Dec {totals.periodStartYear} · all-time {formatHours(totals.all)}
            </div>
          </div>
          <div className="rounded-lg bg-teal px-5 py-3 text-white">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Therapeutic · this period</div>
            <div className="text-2xl font-bold">{formatHours(totals.periodTherapeutic)}</div>
            <div className="mt-0.5 text-[10px] text-white/70">
              all-time {formatHours(totals.therapeutic)}
            </div>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-8 p-12 text-center">
          <p className="text-slate-500">You haven&apos;t completed any courses yet.</p>
          <Link to="/courses" className="btn-primary mt-4">Browse the catalogue</Link>
        </div>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5">Course</th>
                <th className="px-5 py-3.5">Completed</th>
                <th className="px-5 py-3.5">CPD hours</th>
                <th className="px-5 py-3.5">Score</th>
                <th className="px-5 py-3.5">Certificate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const facts = courseFacts(r)
                const cert = one(r.certificates)
                const reflectionOpen = openReflectionId === r.id
                return (
                  <Fragment key={r.id}>
                    <tr className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-navy">{facts.title}</div>
                        <div className="text-xs text-slate-400">{facts.presenter}</div>
                        <button
                          onClick={() => setOpenReflectionId(reflectionOpen ? null : r.id)}
                          className="mt-1 text-xs font-semibold text-teal hover:underline"
                        >
                          {reflectionOpen ? 'Hide reflection' : r.reflection ? 'View reflection' : '+ Add reflection'}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(r.completed_at)}</td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-navy">{formatHours(facts.hours)}</span>
                        {facts.therapeutic && (
                          <div className="mt-1 inline-flex rounded-full bg-teal-pale px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-dark">
                            Therapeutic
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{r.score} / {r.total}</td>
                      <td className="px-5 py-4">
                        {cert?.revoked_at ? (
                          <div>
                            <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">Revoked</span>
                            <div className="mt-1 text-[10px] text-slate-400">Contact Focus Vision Clinic</div>
                          </div>
                        ) : cert ? (
                          <button
                            onClick={() => download(cert)}
                            disabled={downloadingId === cert.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-1.5 text-xs font-bold text-white transition hover:bg-teal-dark disabled:opacity-50"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
                            </svg>
                            {downloadingId === cert.id ? 'Preparing…' : 'Download PDF'}
                          </button>
                        ) : (
                          <button
                            onClick={() => generateCert(r.id)}
                            disabled={generatingId === r.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-teal/40 px-3 py-1.5 text-xs font-bold text-teal-dark transition hover:bg-teal-pale disabled:opacity-50"
                            title="Your completion is recorded — generate the certificate PDF and email it to yourself."
                          >
                            {generatingId === r.id ? 'Generating…' : 'Generate certificate'}
                          </button>
                        )}
                        {cert && <div className="mt-1 font-mono text-[10px] text-slate-400">{cert.certificate_code}</div>}
                      </td>
                    </tr>
                    {reflectionOpen && (
                      <tr className="border-b border-slate-100 bg-slate-50/60 last:border-0">
                        <td colSpan={5} className="px-5 py-4">
                          <div className="max-w-2xl">
                            <div className="text-xs font-bold uppercase tracking-wider text-navy">Learning reflection</div>
                            <ReflectionEditor
                              completionId={r.id}
                              initial={r.reflection ?? ''}
                              compact
                              onSaved={(text) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, reflection: text } : x)))}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
