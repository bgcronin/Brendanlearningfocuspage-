import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Loading } from '../../components/Protected'
import AdminNav from '../../components/AdminNav'
import { formatHours, fetchAllRows } from '../../lib/helpers'

/**
 * Course analytics: completions, attempts, average scores, and
 * per-question miss rates (high miss rates often mean a badly
 * worded question rather than a knowledge gap).
 */
export default function AdminAnalytics() {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [openCourseId, setOpenCourseId] = useState(null)

  useEffect(() => {
    async function load() {
      setLoadError('')
      // Paged so attempt_answers (≈10 rows per attempt) isn't silently
      // truncated at 1000 rows, which would skew every miss rate.
      const [co, cm, at, an] = await Promise.all([
        fetchAllRows(() => supabase.from('courses').select('*, questions(id, sort_order, question_text)').order('created_at', { ascending: false })),
        fetchAllRows(() => supabase.from('completions').select('course_id, score, total')),
        fetchAllRows(() => supabase.from('attempts').select('course_id, score, total')),
        fetchAllRows(() => supabase.from('attempt_answers').select('question_id, is_correct')),
      ])
      if (co.error || cm.error || at.error || an.error) {
        setLoadError('We couldn’t load analytics. Please try again.')
        return
      }
      setData({ courses: co.data ?? [], completions: cm.data ?? [], attempts: at.data ?? [], answers: an.data ?? [] })
    }
    load()
  }, [reloadKey])

  const stats = useMemo(() => {
    if (!data) return null
    const byQuestion = {}
    for (const a of data.answers) {
      const s = (byQuestion[a.question_id] ??= { answered: 0, wrong: 0 })
      s.answered += 1
      if (!a.is_correct) s.wrong += 1
    }
    return data.courses.map((course) => {
      const comps = data.completions.filter((c) => c.course_id === course.id)
      const atts = data.attempts.filter((a) => a.course_id === course.id)
      const avgPct = (rows) =>
        rows.length ? Math.round((rows.reduce((s, r) => s + (r.total ? r.score / r.total : 0), 0) / rows.length) * 100) : null
      return {
        course,
        completions: comps.length,
        attempts: atts.length,
        avgCompletionPct: avgPct(comps),
        avgAttemptPct: avgPct(atts),
        questions: [...course.questions]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((q) => {
            const s = byQuestion[q.id] ?? { answered: 0, wrong: 0 }
            return { ...q, answered: s.answered, missRate: s.answered ? Math.round((s.wrong / s.answered) * 100) : null }
          }),
      }
    })
  }, [data])

  if (loadError) {
    return (
      <div>
        <AdminNav />
        <div className="card mx-auto max-w-md p-8 text-center">
          <p className="text-slate-600">{loadError}</p>
          <button onClick={() => setReloadKey((k) => k + 1)} className="btn-primary mt-4">Try again</button>
        </div>
      </div>
    )
  }
  if (!stats) return <Loading />

  const totals = {
    completions: stats.reduce((s, r) => s + r.completions, 0),
    attempts: stats.reduce((s, r) => s + r.attempts, 0),
  }

  return (
    <div>
      <AdminNav />
      <h1 className="text-3xl font-semibold text-navy">Analytics</h1>
      <p className="mt-1 text-slate-500">
        {totals.completions} completion{totals.completions === 1 ? '' : 's'} · {totals.attempts} quiz attempt{totals.attempts === 1 ? '' : 's'} across {stats.length} course{stats.length === 1 ? '' : 's'}.
      </p>

      <div className="mt-6 space-y-3">
        {stats.map(({ course, completions, attempts, avgCompletionPct, avgAttemptPct, questions }) => {
          const open = openCourseId === course.id
          return (
            <div key={course.id} className="card">
              <button onClick={() => setOpenCourseId(open ? null : course.id)} className="flex w-full flex-col gap-3 p-5 text-left sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${course.published ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {course.published ? 'Published' : 'Draft'}
                    </span>
                    {course.is_therapeutic && (
                      <span className="inline-flex items-center rounded-full bg-teal-pale px-2.5 py-0.5 text-xs font-semibold text-teal-dark">Therapeutic</span>
                    )}
                  </div>
                  <h2 className="mt-1.5 font-semibold text-navy">{course.title}</h2>
                  <p className="text-xs text-slate-400">{course.presenter} · {formatHours(course.cpd_hours)} hrs</p>
                </div>
                <div className="flex shrink-0 gap-6 text-center">
                  <Stat label="Completions" value={completions} />
                  <Stat label="Attempts" value={attempts} />
                  <Stat label="Avg first score" value={avgCompletionPct === null ? '—' : `${avgCompletionPct}%`} />
                  <Stat label="Avg all attempts" value={avgAttemptPct === null ? '—' : `${avgAttemptPct}%`} />
                </div>
                <span className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {open && (
                <div className="border-t border-slate-100 px-5 py-4">
                  {questions.length === 0 ? (
                    <p className="text-sm text-slate-400">No questions on this course.</p>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wider text-slate-400">
                          <th className="py-2 pr-4">Question</th>
                          <th className="py-2 pr-4">Answered</th>
                          <th className="py-2">Miss rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {questions.map((q, i) => (
                          <tr key={q.id} className="border-t border-slate-100">
                            <td className="max-w-xl py-2.5 pr-4 text-slate-700">
                              <span className="mr-2 font-semibold text-teal">Q{i + 1}.</span>
                              {q.question_text}
                            </td>
                            <td className="py-2.5 pr-4 text-slate-600">{q.answered}</td>
                            <td className="py-2.5">
                              {q.missRate === null ? (
                                <span className="text-slate-400">—</span>
                              ) : (
                                <span className={`font-semibold ${q.missRate >= 50 ? 'text-red-600' : q.missRate >= 25 ? 'text-amber-600' : 'text-emerald-700'}`}>
                                  {q.missRate}%
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <p className="mt-3 text-xs text-slate-400">
                    A consistently high miss rate can mean the question (or its options) needs rewording.
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-lg font-semibold text-navy">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  )
}
