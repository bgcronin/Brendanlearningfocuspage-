import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Loading } from '../components/Protected'
import Certificate from '../components/Certificate'
import ReflectionEditor from '../components/ReflectionEditor'
import { signedUrl, openSigned, toEmbedUrl, formatDate, formatHours } from '../lib/helpers'

export default function CoursePage() {
  const { id } = useParams()
  const { session, profile } = useAuth()

  const [course, setCourse] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [completion, setCompletion] = useState(null)
  const [certificate, setCertificate] = useState(null)
  const [step, setStep] = useState('overview') // overview | prereading | video | quiz | result
  const [prereadConfirmed, setPrereadConfirmed] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null) // { score, total, isFirstCompletion, results }
  const [certError, setCertError] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [emailState, setEmailState] = useState('') // '' | 'sent' | 'failed'

  useEffect(() => {
    async function load() {
      setNotFound(false)
      setLoadError('')
      // Questions come from the quiz_questions view — correct answers and
      // explanations are never sent to the browser before submission.
      const [{ data: c, error: cErr }, { data: qs, error: qErr }] = await Promise.all([
        supabase
          .from('courses')
          .select('*, learning_objectives(*), prereading_documents(*)')
          .eq('id', id)
          .maybeSingle(),
        supabase.from('quiz_questions').select('*').eq('course_id', id),
      ])
      // Distinguish "the course genuinely doesn't exist" from a transient
      // fetch failure — the latter must not read as "Course not found".
      if (cErr) {
        setLoadError('We couldn’t load this course. Check your connection and try again.')
        return
      }
      if (!c) {
        setNotFound(true)
        return
      }
      if (qErr) {
        setLoadError('We couldn’t load this course’s quiz. Please try again.')
        return
      }
      c.learning_objectives.sort((a, b) => a.sort_order - b.sort_order)
      c.prereading_documents.sort((a, b) => a.sort_order - b.sort_order)
      c.questions = (qs ?? []).sort((a, b) => a.sort_order - b.sort_order)
      setCourse(c)

      const { data: comp } = await supabase
        .from('completions')
        .select('*')
        .eq('course_id', id)
        .eq('user_id', session.user.id)
        .maybeSingle()
      setCompletion(comp ?? null)
      if (comp) {
        const { data: cert } = await supabase
          .from('certificates')
          .select('*')
          .eq('completion_id', comp.id)
          .maybeSingle()
        setCertificate(cert ?? null)
      }
    }
    load()
  }, [id, session.user.id, reloadKey])

  const steps = useMemo(() => {
    if (!course) return []
    return ['overview', ...(course.prereading_documents.length ? ['prereading'] : []), 'video', 'quiz']
  }, [course])

  if (notFound) {
    return (
      <div className="py-24 text-center text-slate-500">
        Course not found. <Link to="/courses" className="text-teal hover:underline">Back to catalogue</Link>
      </div>
    )
  }
  if (loadError) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-slate-600">{loadError}</p>
        <button onClick={() => setReloadKey((k) => k + 1)} className="btn-primary mt-4">Try again</button>
        <div className="mt-3">
          <Link to="/courses" className="text-sm font-semibold text-teal hover:underline">Back to catalogue</Link>
        </div>
      </div>
    )
  }
  if (!course) return <Loading />

  async function issueCertificate(completionId) {
    setIssuing(true)
    setCertError('')
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/issue-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ completionId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Certificate generation failed')
      setCertificate(body.certificate)
      setEmailState(body.emailSent ? 'sent' : 'failed')
    } catch (err) {
      setCertError(err.message)
    } finally {
      setIssuing(false)
    }
  }

  async function submitQuiz() {
    setSubmitting(true)
    try {
      // Grading, attempt logging and completion recording all happen
      // server-side in one call — scores can't be tampered with.
      const { data, error } = await supabase.rpc('submit_quiz', {
        p_course_id: course.id,
        p_answers: answers,
      })
      if (error) throw error

      const isFirstCompletion = data.is_first_completion
      if (isFirstCompletion) {
        const comp = { id: data.completion_id, completed_at: data.completed_at }
        setCompletion(comp)
        // A completion (and certificate) is only recorded on a passing
        // attempt, so this fires exactly when the learner has just passed.
        issueCertificate(comp.id)
      }

      setResult({
        score: data.score,
        total: data.total,
        passed: data.passed,
        passMark: data.pass_mark,
        isFirstCompletion,
        results: data.results ?? [],
      })
      setStep('result')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      alert(`Could not submit quiz: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  // Record engagement so the server will accept the quiz submission. The
  // real enforcement is the submit_quiz gate; this just writes the markers.
  async function markEngagement(kind) {
    try {
      await supabase.rpc('mark_engagement', { p_course_id: id, p_kind: kind })
    } catch {
      /* best effort — the gate re-checks server-side */
    }
  }

  const stepIndex = steps.indexOf(step)

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/courses" className="text-sm font-semibold text-teal hover:underline">← Back to catalogue</Link>

      {completion && step !== 'result' && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          You completed this course on {formatDate(completion.completed_at)} — your original certificate stands.
          You&apos;re welcome to review the content or retake the quiz; retakes are logged but don&apos;t change your record.
        </div>
      )}

      {step !== 'result' && (
        <div className="mt-6 flex items-center gap-1">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full ${i <= stepIndex ? 'bg-teal' : 'bg-slate-200'}`}
                title={s}
              />
            </div>
          ))}
        </div>
      )}

      {step === 'overview' && (
        <Overview course={course} onStart={() => setStep(steps[1])} completion={completion} />
      )}

      {step === 'prereading' && (
        <Prereading
          docs={course.prereading_documents}
          confirmed={prereadConfirmed}
          setConfirmed={setPrereadConfirmed}
          onNext={() => {
            markEngagement('prereading')
            setStep('video')
          }}
        />
      )}

      {step === 'video' && (
        <VideoStep
          course={course}
          onSeen={() => markEngagement('video')}
          onNext={() => setStep('quiz')}
          onBack={() => setStep(stepIndex > 0 ? steps[stepIndex - 1] : 'overview')}
        />
      )}

      {step === 'quiz' && (
        <Quiz
          questions={course.questions}
          answers={answers}
          setAnswers={setAnswers}
          submitting={submitting}
          passMark={course.pass_mark}
          onSubmit={submitQuiz}
          onBack={() => setStep('video')}
        />
      )}

      {step === 'result' && result && (
        <ResultStep
          course={course}
          result={result}
          completion={completion}
          certificate={certificate}
          certError={certError}
          issuing={issuing}
          emailState={emailState}
          onRetryCertificate={() => completion && issueCertificate(completion.id)}
          onRetake={() => {
            setResult(null)
            setAnswers({})
            setStep('quiz')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          profile={profile}
        />
      )}
    </div>
  )
}

/* ---------------- Overview ---------------- */
function Overview({ course, onStart, completion }) {
  return (
    <div className="card mt-6 p-8">
      <div className="flex flex-wrap gap-2">
        {(course.categories ?? []).map((c) => <span key={c} className="badge capitalize">{c}</span>)}
        {course.is_therapeutic && (
          <span className="inline-flex items-center rounded-full bg-navy px-2.5 py-0.5 text-xs font-semibold text-white">Therapeutic CPD</span>
        )}
      </div>
      <h1 className="mt-3 text-3xl font-semibold text-navy">{course.title}</h1>
      <p className="mt-2 font-medium text-teal">Presented by {course.presenter}</p>
      <p className="mt-4 leading-relaxed text-slate-600">{course.description}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Fact label="CPD hours" value={`${formatHours(course.cpd_hours)}${course.is_therapeutic ? ' (therapeutic)' : ''}`} />
        <Fact label="Quiz questions" value={course.questions.length} />
        <Fact label="Pre-reading" value={course.prereading_documents.length || 'None'} />
      </div>

      {course.learning_objectives.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold text-navy">Learning objectives</h2>
          <ul className="mt-2 space-y-2">
            {course.learning_objectives.map((o) => (
              <li key={o.id} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                <span className="mt-0.5 text-teal">✓</span>
                <span>{o.objective}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={onStart} className="btn-primary mt-8 w-full sm:w-auto">
        {completion ? 'Review course' : 'Start course'}
      </button>
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div className="rounded-lg bg-teal-pale px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-teal-dark">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-navy">{value}</div>
    </div>
  )
}

/* ---------------- Pre-reading ---------------- */
function Prereading({ docs, confirmed, setConfirmed, onNext }) {
  async function openDoc(doc) {
    try {
      await openSigned('prereading', doc.storage_path)
    } catch {
      alert('Could not open the document. Please try again.')
    }
  }

  return (
    <div className="card mt-6 p-8">
      <h1 className="text-2xl font-semibold text-navy">Pre-reading</h1>
      <p className="mt-1 text-sm text-slate-500">Please review the following material before watching the lecture.</p>

      <ul className="mt-5 space-y-2">
        {docs.map((doc) => (
          <li key={doc.id}>
            <button
              onClick={() => openDoc(doc)}
              className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left transition hover:border-teal hover:bg-teal-pale"
            >
              <svg className="h-6 w-6 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6zm7 1.5L18.5 9H13V3.5z" />
              </svg>
              <span className="font-semibold text-navy">{doc.title}</span>
              <span className="ml-auto text-sm font-semibold text-teal">Open PDF →</span>
            </button>
          </li>
        ))}
      </ul>

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg bg-slate-50 p-4">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-5 w-5 rounded border-slate-300 text-teal accent-[#04838c]"
        />
        <span className="text-sm text-slate-700">I confirm that I have read the pre-reading material for this course.</span>
      </label>

      <button onClick={onNext} disabled={!confirmed} className="btn-primary mt-6">
        Continue to lecture →
      </button>
    </div>
  )
}

/* ---------------- Video ---------------- */
function VideoStep({ course, onSeen, onNext, onBack }) {
  const [uploadUrl, setUploadUrl] = useState(null)
  const [error, setError] = useState('')
  const embedUrl = course.video_type === 'embed' ? toEmbedUrl(course.video_url) : ''
  // An embed URL that isn't a recognised YouTube/Vimeo video, or an "upload"
  // course with no file, would otherwise render a blank frame / endless spinner.
  const missing =
    (course.video_type === 'embed' && !embedUrl) ||
    (course.video_type === 'upload' && !course.video_url)

  // Record that the learner reached the video (engagement gate).
  useEffect(() => {
    onSeen?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (course.video_type === 'upload' && course.video_url) {
      signedUrl('course-videos', course.video_url, 3 * 3600)
        .then(setUploadUrl)
        .catch(() => setError('We couldn’t load the video. Please refresh and try again.'))
    }
  }, [course])

  return (
    <div className="card mt-6 p-8">
      <h1 className="text-2xl font-semibold text-navy">Video lecture</h1>
      <p className="mt-1 text-sm text-slate-500">Watch the full lecture, then continue to the quiz.</p>

      <div className="mt-5 overflow-hidden rounded-lg bg-black">
        {missing ? (
          <p className="p-8 text-center text-sm text-slate-300">
            This lecture video isn’t available yet. Please check back soon, or contact Focus Vision.
          </p>
        ) : course.video_type === 'embed' ? (
          <div className="aspect-video">
            <iframe
              src={embedUrl}
              title={course.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : error ? (
          <p className="p-8 text-center text-sm text-red-300">{error}</p>
        ) : uploadUrl ? (
          <video src={uploadUrl} controls className="aspect-video w-full" />
        ) : (
          <div className="flex aspect-video items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="btn-secondary">← Back</button>
        <button onClick={onNext} className="btn-primary">Continue to quiz →</button>
      </div>
    </div>
  )
}

/* ---------------- Quiz ---------------- */
function Quiz({ questions, answers, setAnswers, submitting, passMark, onSubmit, onBack }) {
  const noQuestions = questions.length === 0
  const allAnswered = !noQuestions && questions.every((q) => answers[q.id] !== undefined)

  if (noQuestions) {
    return (
      <div className="mt-6">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-semibold text-navy">Quiz unavailable</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            This course doesn’t have any quiz questions yet, so it can’t be completed. Please check back soon, or contact Focus Vision.
          </p>
          <button onClick={onBack} className="btn-secondary mt-6">← Back to video</button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold text-navy">Quiz</h1>
        <p className="mt-1 text-sm text-slate-500">
          Answer all {questions.length} questions, then submit. You need <span className="font-semibold text-navy">{passMark ?? 70}% or more</span> to
          complete the course and receive your certificate. You can retake the quiz as many times as you need.
        </p>
      </div>

      <div className="mt-4 space-y-4">
        {questions.map((q, qi) => (
          <div key={q.id} className="card p-6">
            <p className="font-semibold text-navy">
              <span className="mr-2 text-teal">Q{qi + 1}.</span>
              {q.question_text}
            </p>
            <div className="mt-4 space-y-2">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                    answers[q.id] === oi ? 'border-teal bg-teal-pale' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === oi}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                    className="h-4 w-4 accent-[#04838c]"
                  />
                  <span className="text-sm text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button onClick={onBack} className="btn-secondary">← Back to video</button>
        <button onClick={onSubmit} disabled={!allAnswered || submitting} className="btn-primary">
          {submitting ? 'Submitting…' : 'Submit answers'}
        </button>
      </div>
      {!allAnswered && <p className="mt-2 text-right text-xs text-slate-400">Answer every question to submit.</p>}
    </div>
  )
}

/* ---------------- Result + certificate ---------------- */
function ResultStep({ course, result, completion, certificate, certError, issuing, emailState, onRetryCertificate, onRetake, profile }) {
  const [downloading, setDownloading] = useState(false)
  const questionById = Object.fromEntries(course.questions.map((q) => [q.id, q]))
  const pct = Math.round((result.score / result.total) * 100)
  // A brand-new pass issues a certificate; a retake leaves the original
  // completion untouched; a fail with no prior completion means "try again".
  const isRetakeOfCompleted = !result.isFirstCompletion && completion
  const isFail = !result.passed && !completion

  async function downloadPdf() {
    if (!certificate) return
    setDownloading(true)
    try {
      await openSigned('certificates', certificate.pdf_path, 300)
    } catch {
      alert('Could not download the certificate. Please try again from My CPD Record.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="card p-8 text-center">
        <h1 className="text-3xl font-semibold text-navy">
          {result.isFirstCompletion
            ? 'Congratulations — course complete! 🎓'
            : isFail
              ? 'Not quite yet'
              : 'Quiz submitted'}
        </h1>
        <p className="mt-2 text-slate-600">
          You scored <span className="font-semibold text-navy">{result.score} / {result.total}</span> ({pct}%).
          {isRetakeOfCompleted && (
            <> This retake has been logged. Your original completion from {formatDate(completion.completed_at)} stands.</>
          )}
          {isFail && (
            <> You need <span className="font-semibold text-navy">{result.passMark}%</span> to complete the course and receive your certificate.</>
          )}
        </p>
        {result.isFirstCompletion && (
          <p className="mt-1 text-sm text-slate-500">
            {issuing
              ? 'Generating your certificate and emailing it to you…'
              : certificate && emailState === 'sent'
                ? 'Your certificate has been emailed to you and is always available under My CPD Record.'
                : certificate
                  ? 'Your certificate is ready and always available under My CPD Record.'
                  : ''}
          </p>
        )}
        {isFail && (
          <div className="mt-5">
            <p className="text-sm text-slate-500">
              Review the questions you missed below, then retake the quiz. There&apos;s no limit on attempts.
            </p>
            <button onClick={onRetake} className="btn-primary mt-4">Retake quiz</button>
          </div>
        )}
      </div>

      {/* Certificate — only on a passing first completion */}
      {result.isFirstCompletion && (
        <>
          {certError && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              Your completion is recorded, but the certificate couldn&apos;t be generated: {certError}{' '}
              <button onClick={onRetryCertificate} className="font-bold underline">Try again</button>
            </div>
          )}
          {!certError && certificate && emailState === 'failed' && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              Your certificate was created, but the email couldn&apos;t be sent.
              You can download it below, or{' '}
              <button onClick={onRetryCertificate} disabled={issuing} className="font-bold underline">
                {issuing ? 'resending…' : 'resend the email'}
              </button>.
            </div>
          )}
          {completion && (
            <Certificate
              fullName={profile?.full_name || ''}
              courseTitle={course.title}
              presenter={course.presenter}
              cpdHours={course.cpd_hours}
              isTherapeutic={course.is_therapeutic}
              objectives={course.learning_objectives}
              completedAt={completion.completed_at}
              certificateCode={certificate?.certificate_code}
            />
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={downloadPdf} disabled={!certificate || downloading} className="btn-primary">
              {downloading ? 'Preparing…' : 'Download PDF certificate'}
            </button>
            <Link to="/my-cpd" className="btn-secondary">Go to My CPD Record</Link>
          </div>
          <p className="text-center text-xs text-slate-400">
            Your certificate has also been emailed to you and is always saved under My CPD Record.
          </p>
        </>
      )}

      {/* Learning reflection (optional, editable any time) */}
      {completion && (
        <div className="card p-8">
          <h2 className="text-xl font-semibold text-navy">Learning reflection <span className="text-sm font-normal text-slate-400">(optional)</span></h2>
          <div className="mt-2">
            <ReflectionEditor completionId={completion.id} initial={completion.reflection ?? ''} />
          </div>
        </div>
      )}

      {/* Answer review — correct answers + explanations are returned by the
          server only once the learner has passed, so a failed attempt can't
          harvest the answer key for a trivial retake. */}
      <div className="card p-8">
        <h2 className="text-xl font-semibold text-navy">Your answers</h2>
        {isFail && (
          <p className="mt-1 text-sm text-slate-500">
            Correct answers and explanations are shown once you pass. For now, here are the questions you missed.
          </p>
        )}
        <div className="mt-4 space-y-5">
          {(result.results ?? []).map((r, qi) => {
            const q = questionById[r.question_id]
            if (!q) return null
            const revealed = r.correct_index !== null && r.correct_index !== undefined
            return (
              <div key={r.question_id} className="border-b border-slate-100 pb-5 last:border-0 last:pb-0">
                <p className="font-semibold text-navy">
                  <span className="mr-2 text-teal">Q{qi + 1}.</span>
                  {q.question_text}
                </p>
                <p className={`mt-2 text-sm font-medium ${r.is_correct ? 'text-emerald-700' : 'text-red-600'}`}>
                  {r.is_correct ? '✓ Correct' : '✗ Incorrect'} — you answered: {q.options[r.selected_index]}
                </p>
                {!r.is_correct && revealed && (
                  <p className="mt-1 text-sm text-slate-600">
                    Correct answer: <span className="font-semibold">{q.options[r.correct_index]}</span>
                  </p>
                )}
                {r.explanation && (
                  <p className="mt-2 rounded-lg bg-teal-pale px-3 py-2 text-sm text-slate-700">{r.explanation}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
