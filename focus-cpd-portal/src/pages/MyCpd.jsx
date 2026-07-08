import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Loading } from '../components/Protected'
import ReflectionEditor from '../components/ReflectionEditor'
import { signedUrl, formatDate, formatHours, one } from '../lib/helpers'

export default function MyCpd() {
  const { session, profile } = useAuth()
  const [rows, setRows] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)
  const [openReflectionId, setOpenReflectionId] = useState(null)

  useEffect(() => {
    supabase
      .from('completions')
      .select('*, courses:course_id(title, presenter, cpd_hours, is_therapeutic), certificates(id, certificate_code, pdf_path, revoked_at, issued_at)')
      .eq('user_id', session.user.id)
      .order('completed_at', { ascending: false })
      .then(({ data }) => setRows(data ?? []))
  }, [session.user.id])

  const totals = useMemo(() => {
    let all = 0
    let therapeutic = 0
    for (const r of rows ?? []) {
      if (one(r.certificates)?.revoked_at) continue // revoked credits don't count
      const course = one(r.courses)
      const h = Number(course?.cpd_hours ?? 0)
      all += h
      if (course?.is_therapeutic) therapeutic += h
    }
    return { all, therapeutic }
  }, [rows])

  async function download(cert) {
    setDownloadingId(cert.id)
    try {
      const url = await signedUrl('certificates', cert.pdf_path, 300)
      window.open(url, '_blank', 'noopener')
    } catch {
      alert('Could not download the certificate. Please try again.')
    } finally {
      setDownloadingId(null)
    }
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
            <div className="text-xs font-semibold uppercase tracking-wider text-teal-light">Total CPD hours</div>
            <div className="text-2xl font-bold">{formatHours(totals.all)}</div>
          </div>
          <div className="rounded-lg bg-teal px-5 py-3 text-white">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Therapeutic hours</div>
            <div className="text-2xl font-bold">{formatHours(totals.therapeutic)}</div>
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
                const course = one(r.courses)
                const cert = one(r.certificates)
                const reflectionOpen = openReflectionId === r.id
                return (
                  <Fragment key={r.id}>
                    <tr className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-navy">{course?.title}</div>
                        <div className="text-xs text-slate-400">{course?.presenter}</div>
                        <button
                          onClick={() => setOpenReflectionId(reflectionOpen ? null : r.id)}
                          className="mt-1 text-xs font-semibold text-teal hover:underline"
                        >
                          {reflectionOpen ? 'Hide reflection' : r.reflection ? 'View reflection' : '+ Add reflection'}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(r.completed_at)}</td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-navy">{formatHours(course?.cpd_hours ?? 0)}</span>
                        {course?.is_therapeutic && (
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
                          <span className="text-xs text-slate-400">Pending</span>
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
