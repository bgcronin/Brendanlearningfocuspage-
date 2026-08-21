import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Loading } from '../../components/Protected'

const emptyQuestion = () => ({
  id: crypto.randomUUID(),
  question_text: '',
  options: ['', '', '', ''],
  correct_index: 0,
  explanation: '',
})

export default function CourseEditor() {
  const params = useParams()
  const isNew = !params.id
  const navigate = useNavigate()

  // For new courses, generate the ID up-front so storage uploads can be
  // organised under the course folder before the row exists.
  const [courseId] = useState(() => params.id ?? crypto.randomUUID())
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [course, setCourse] = useState({
    title: '',
    description: '',
    presenter: '',
    categories: '',
    cpd_hours: '1.0',
    pass_mark: '70',
    is_therapeutic: false,
    video_type: 'embed',
    video_url: '',
    published: false,
  })
  const [objectives, setObjectives] = useState([''])
  const [questions, setQuestions] = useState([emptyQuestion()])
  const [deletedQuestionIds, setDeletedQuestionIds] = useState([])
  const [docs, setDocs] = useState([]) // {id?, title, storage_path}
  const [deletedDocs, setDeletedDocs] = useState([]) // {id, storage_path}
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [completionCount, setCompletionCount] = useState(0)
  const [replacedVideoPaths, setReplacedVideoPaths] = useState([]) // removed from storage only on successful save
  // Unsaved-changes guard: snapshot of the loaded state; compared on leave.
  const cleanSnapshot = useRef('')
  const savedOk = useRef(false)

  useEffect(() => {
    if (isNew) return
    async function load() {
      const { data: c } = await supabase
        .from('courses')
        .select('*, learning_objectives(*), prereading_documents(*), questions(*)')
        .eq('id', courseId)
        .maybeSingle()
      if (!c) {
        setError('Course not found.')
        setLoading(false)
        return
      }
      setCourse({
        title: c.title,
        description: c.description,
        presenter: c.presenter,
        categories: (c.categories ?? []).join(', '),
        cpd_hours: String(c.cpd_hours),
        pass_mark: String(c.pass_mark ?? 70),
        is_therapeutic: c.is_therapeutic,
        video_type: c.video_type,
        video_url: c.video_url,
        published: c.published,
      })
      const obj = [...c.learning_objectives].sort((a, b) => a.sort_order - b.sort_order).map((o) => o.objective)
      setObjectives(obj.length ? obj : [''])
      const qs = [...c.questions]
        .filter((q) => !q.archived) // archived questions are kept for history, not editing
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((q) => ({ id: q.id, question_text: q.question_text, options: q.options, correct_index: q.correct_index, explanation: q.explanation }))
      setQuestions(qs.length ? qs : [emptyQuestion()])
      setDocs([...c.prereading_documents].sort((a, b) => a.sort_order - b.sort_order))
      setLoading(false)

      // How many optometrists have already completed this course? Their
      // certificates are snapshotted, but editing warns against surprises.
      const { count } = await supabase
        .from('completions')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', courseId)
      setCompletionCount(count ?? 0)
    }
    load()
  }, [courseId, isNew])

  const set = (k) => (e) => setCourse((c) => ({ ...c, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  /* ---------- unsaved-changes guard ---------- */
  const serialized = JSON.stringify({ course, objectives, questions, docs })
  useEffect(() => {
    // First render after load (or immediately for a new course) = clean state.
    if (!loading && cleanSnapshot.current === '') cleanSnapshot.current = serialized
  }, [loading, serialized])
  const isDirty = () => cleanSnapshot.current !== '' && serialized !== cleanSnapshot.current && !savedOk.current

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (isDirty()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  })

  function leave() {
    if (isDirty() && !confirm('Discard your unsaved changes to this course?')) return
    navigate('/admin/courses')
  }

  /* ---------- uploads ---------- */
  const MAX_VIDEO_BYTES = 1024 * 1024 * 1024 // 1 GB — matches the bucket limit
  const MAX_PDF_BYTES = 20 * 1024 * 1024 // 20 MB — matches the bucket limit

  async function uploadVideo(file) {
    setError('')
    if (file.size > MAX_VIDEO_BYTES) {
      return setError('Video is larger than 1 GB. For files this size, host it on Vimeo/YouTube (unlisted) and use an embed link instead.')
    }
    setUploadingVideo(true)
    try {
      const previousPath = course.video_type === 'upload' ? course.video_url : ''
      const ext = file.name.split('.').pop()
      const path = `${courseId}/video-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('course-videos').upload(path, file, { upsert: true })
      if (error) throw error
      setCourse((c) => ({ ...c, video_type: 'upload', video_url: path }))
      // Delete the replaced video only AFTER a successful Save — otherwise a
      // cancelled or failed save would leave the live course pointing at a
      // file we already destroyed.
      if (previousPath && previousPath !== path) {
        setReplacedVideoPaths((p) => [...p, previousPath])
      }
    } catch (err) {
      setError(`Video upload failed: ${err.message}`)
    } finally {
      setUploadingVideo(false)
    }
  }

  async function uploadDoc(file) {
    setError('')
    if (file.size > MAX_PDF_BYTES) {
      return setError('PDF is larger than 20 MB — please compress it and try again.')
    }
    setUploadingDoc(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${courseId}/${Date.now()}-${safeName}`
      const { error } = await supabase.storage.from('prereading').upload(path, file)
      if (error) throw error
      setDocs((d) => [...d, { title: file.name.replace(/\.pdf$/i, ''), storage_path: path }])
    } catch (err) {
      setError(`Document upload failed: ${err.message}`)
    } finally {
      setUploadingDoc(false)
    }
  }

  function removeDoc(index) {
    const doc = docs[index]
    if (doc.id) setDeletedDocs((d) => [...d, doc])
    setDocs((d) => d.filter((_, i) => i !== index))
  }

  function removeQuestion(index) {
    const q = questions[index]
    setDeletedQuestionIds((ids) => [...ids, q.id])
    setQuestions((qs) => qs.filter((_, i) => i !== index))
  }

  /* ---------- save ---------- */
  async function save() {
    setError('')
    if (!course.title.trim()) return setError('Title is required.')
    if (!course.presenter.trim()) return setError('Presenter is required.')
    const hours = parseFloat(course.cpd_hours)
    if (!hours || hours <= 0) return setError('CPD hours must be a positive number.')
    const passMark = parseInt(course.pass_mark, 10)
    if (Number.isNaN(passMark) || passMark < 0 || passMark > 100) return setError('Pass mark must be between 0 and 100.')
    const cleanQuestions = questions.filter((q) => q.question_text.trim())
    for (const q of cleanQuestions) {
      if (q.options.some((o) => !o.trim())) return setError('Every question needs 4 answer options.')
    }
    // A published course must be completable: a learner walks video → quiz.
    if (course.published) {
      if (cleanQuestions.length === 0) return setError('Add at least one quiz question before publishing this course.')
      const hasVideo = course.video_type === 'embed' ? course.video_url.trim() : course.video_url
      if (!hasVideo) return setError('Add a lecture video (embed link or uploaded file) before publishing this course.')
    }

    setSaving(true)
    try {
      // 1. Course row
      const { error: courseError } = await supabase.from('courses').upsert({
        id: courseId,
        title: course.title.trim(),
        description: course.description.trim(),
        presenter: course.presenter.trim(),
        categories: course.categories.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        cpd_hours: hours,
        pass_mark: passMark,
        is_therapeutic: course.is_therapeutic,
        video_type: course.video_type,
        video_url: course.video_url.trim(),
        published: course.published,
      })
      if (courseError) throw courseError

      // 2. Learning objectives — replaced atomically server-side (a separate
      // delete + insert could lose all objectives if the second call failed).
      const { error: objError } = await supabase.rpc('replace_objectives', {
        p_course_id: courseId,
        p_objectives: objectives.map((o) => o.trim()).filter(Boolean),
      })
      if (objError) throw objError

      // 3. Questions — upsert by stable id so existing attempt history is preserved.
      // Removed questions are ARCHIVED (soft-deleted), not hard-deleted, so the
      // attempt_answers that reference them survive as assessment history.
      if (deletedQuestionIds.length) {
        const { error: qArchiveError } = await supabase.from('questions').update({ archived: true }).in('id', deletedQuestionIds)
        if (qArchiveError) throw qArchiveError
      }
      if (cleanQuestions.length) {
        const { error: qError } = await supabase.from('questions').upsert(
          cleanQuestions.map((q, i) => ({
            id: q.id,
            course_id: courseId,
            sort_order: i + 1,
            question_text: q.question_text.trim(),
            options: q.options.map((o) => o.trim()),
            correct_index: q.correct_index,
            explanation: q.explanation.trim(),
          })),
        )
        if (qError) throw qError
      }

      // 4. Pre-reading documents
      for (const doc of deletedDocs) {
        const { error: docDeleteError } = await supabase.from('prereading_documents').delete().eq('id', doc.id)
        if (docDeleteError) throw docDeleteError
        await supabase.storage.from('prereading').remove([doc.storage_path]).catch(() => {})
      }
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i]
        const row = { course_id: courseId, title: doc.title.trim() || 'Pre-reading document', storage_path: doc.storage_path, sort_order: i + 1 }
        const { error: dError } = doc.id
          ? await supabase.from('prereading_documents').update(row).eq('id', doc.id)
          : await supabase.from('prereading_documents').insert(row)
        if (dError) throw dError
      }

      // Course saved — now safe to delete any replaced video file(s).
      if (replacedVideoPaths.length) {
        await supabase.storage.from('course-videos').remove(replacedVideoPaths).catch(() => {})
        setReplacedVideoPaths([])
      }

      savedOk.current = true
      navigate('/admin/courses')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={leave} className="text-sm font-semibold text-teal hover:underline">← Back to courses</button>
      <h1 className="mt-2 text-3xl font-semibold text-navy">{isNew ? 'New course' : 'Edit course'}</h1>

      {completionCount > 0 && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">{completionCount} optometrist{completionCount === 1 ? '' : 's'}</span> {completionCount === 1 ? 'has' : 'have'} already completed this course.
          Certificates already issued keep the title, CPD hours and therapeutic status they were issued with — editing those
          fields here only affects <span className="font-semibold">new</span> completions and the course page.
        </div>
      )}

      {/* Details */}
      <section className="card mt-6 space-y-4 p-6">
        <h2 className="font-semibold text-navy">Course details</h2>
        <div>
          <label className="label">Title</label>
          <input className="input" value={course.title} onChange={set('title')} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-28" value={course.description} onChange={set('description')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="label">Presenter</label>
            <input className="input" value={course.presenter} onChange={set('presenter')} placeholder="Dr Brendan Cronin" />
          </div>
          <div>
            <label className="label">Categories <span className="font-normal text-slate-400">(comma-separated)</span></label>
            <input className="input" value={course.categories} onChange={set('categories')} placeholder="cornea, refractive" />
          </div>
          <div>
            <label className="label">CPD hours</label>
            <input className="input" type="number" step="0.25" min="0.25" value={course.cpd_hours} onChange={set('cpd_hours')} />
            <p className="mt-1 text-xs text-slate-400">Appears on the certificate.</p>
          </div>
        </div>
        <div className="sm:w-48">
          <label className="label">Pass mark (%)</label>
          <input className="input" type="number" step="1" min="0" max="100" value={course.pass_mark} onChange={set('pass_mark')} />
          <p className="mt-1 text-xs text-slate-400">Minimum quiz score to complete the course and be issued a certificate.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 pt-1">
          <input type="checkbox" checked={course.is_therapeutic} onChange={set('is_therapeutic')} className="h-5 w-5 accent-[#04838c]" />
          <span className="text-sm font-semibold text-navy">Therapeutic CPD</span>
          <span className="text-xs text-slate-400">— counts toward scheduled-medicines hours; shown on the certificate</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 pt-1">
          <input type="checkbox" checked={course.published} onChange={set('published')} className="h-5 w-5 accent-[#04838c]" />
          <span className="text-sm font-semibold text-navy">Published</span>
          <span className="text-xs text-slate-400">— unpublished courses are drafts only admins can see</span>
        </label>
      </section>

      {/* Video */}
      <section className="card mt-4 space-y-4 p-6">
        <h2 className="font-semibold text-navy">Video lecture</h2>
        <div className="flex gap-4">
          {['embed', 'upload'].map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                checked={course.video_type === t}
                onChange={() => setCourse((c) => ({ ...c, video_type: t, video_url: '' }))}
                className="h-4 w-4 accent-[#04838c]"
              />
              <span className="text-sm font-medium text-slate-700">{t === 'embed' ? 'Embed link (Vimeo / YouTube unlisted)' : 'Upload video file'}</span>
            </label>
          ))}
        </div>
        {course.video_type === 'embed' ? (
          <div>
            <label className="label">Video URL</label>
            <input className="input" value={course.video_url} onChange={set('video_url')} placeholder="https://vimeo.com/123456789" />
          </div>
        ) : (
          <div>
            {course.video_url && (
              <p className="mb-2 rounded-lg bg-teal-pale px-3 py-2 text-sm text-teal-dark">
                Uploaded: <span className="font-mono text-xs">{course.video_url}</span>
              </p>
            )}
            <input
              type="file"
              accept="video/*"
              disabled={uploadingVideo}
              onChange={(e) => e.target.files[0] && uploadVideo(e.target.files[0])}
              className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-teal file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-teal-dark"
            />
            {uploadingVideo && <p className="mt-2 text-sm text-slate-500">Uploading video…</p>}
          </div>
        )}
      </section>

      {/* Pre-reading */}
      <section className="card mt-4 space-y-4 p-6">
        <h2 className="font-semibold text-navy">Pre-reading documents <span className="text-sm font-normal text-slate-400">(optional PDFs)</span></h2>
        {docs.map((doc, i) => (
          <div key={doc.id ?? doc.storage_path} className="flex items-center gap-3">
            <input
              className="input flex-1"
              value={doc.title}
              onChange={(e) => setDocs((d) => d.map((x, xi) => (xi === i ? { ...x, title: e.target.value } : x)))}
              placeholder="Document title"
            />
            <button onClick={() => removeDoc(i)} className="btn-danger shrink-0">Remove</button>
          </div>
        ))}
        <input
          type="file"
          accept="application/pdf"
          disabled={uploadingDoc}
          onChange={(e) => {
            if (e.target.files[0]) uploadDoc(e.target.files[0])
            e.target.value = ''
          }}
          className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-teal file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-teal-dark"
        />
        {uploadingDoc && <p className="text-sm text-slate-500">Uploading document…</p>}
      </section>

      {/* Learning objectives */}
      <section className="card mt-4 space-y-3 p-6">
        <h2 className="font-semibold text-navy">Learning objectives <span className="text-sm font-normal text-slate-400">(shown on the course page and certificate)</span></h2>
        {objectives.map((o, i) => (
          <div key={i} className="flex items-center gap-3">
            <input
              className="input flex-1"
              value={o}
              onChange={(e) => setObjectives((obj) => obj.map((x, xi) => (xi === i ? e.target.value : x)))}
              placeholder={`Objective ${i + 1}`}
            />
            <button
              onClick={() => setObjectives((obj) => obj.filter((_, xi) => xi !== i))}
              className="btn-danger shrink-0"
              disabled={objectives.length === 1}
            >
              Remove
            </button>
          </div>
        ))}
        <button onClick={() => setObjectives((o) => [...o, ''])} className="btn-secondary !py-2 text-sm">+ Add objective</button>
      </section>

      {/* Questions */}
      <section className="mt-4 space-y-4">
        <h2 className="px-1 font-semibold text-navy">Quiz questions</h2>
        {questions.map((q, qi) => (
          <div key={q.id} className="card space-y-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <label className="label !mb-0 pt-2">Question {qi + 1}</label>
              <button onClick={() => removeQuestion(qi)} className="btn-danger" disabled={questions.length === 1}>Remove</button>
            </div>
            <textarea
              className="input min-h-20"
              value={q.question_text}
              onChange={(e) => setQuestions((qs) => qs.map((x, xi) => (xi === qi ? { ...x, question_text: e.target.value } : x)))}
              placeholder="Question text"
            />
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={q.correct_index === oi}
                    onChange={() => setQuestions((qs) => qs.map((x, xi) => (xi === qi ? { ...x, correct_index: oi } : x)))}
                    className="h-4 w-4 shrink-0 accent-[#04838c]"
                    title="Mark as correct answer"
                  />
                  <input
                    className="input"
                    value={opt}
                    onChange={(e) =>
                      setQuestions((qs) =>
                        qs.map((x, xi) => (xi === qi ? { ...x, options: x.options.map((o, ooi) => (ooi === oi ? e.target.value : o)) } : x)),
                      )
                    }
                    placeholder={`Option ${String.fromCharCode(65 + oi)}${q.correct_index === oi ? ' (correct)' : ''}`}
                  />
                </div>
              ))}
              <p className="text-xs text-slate-400">Select the radio button next to the correct answer.</p>
            </div>
            <div>
              <label className="label">Explanation <span className="font-normal text-slate-400">(optional — shown after submission)</span></label>
              <textarea
                className="input min-h-16"
                value={q.explanation}
                onChange={(e) => setQuestions((qs) => qs.map((x, xi) => (xi === qi ? { ...x, explanation: e.target.value } : x)))}
              />
            </div>
          </div>
        ))}
        <button onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])} className="btn-secondary">+ Add question</button>
      </section>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-6">
        <button onClick={leave} className="btn-secondary">Cancel</button>
        <button onClick={save} disabled={saving || uploadingVideo || uploadingDoc} className="btn-primary">
          {saving ? 'Saving…' : 'Save course'}
        </button>
      </div>
    </div>
  )
}
