import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Loading } from '../../components/Protected'
import AdminNav from '../../components/AdminNav'
import { formatDate, formatHours } from '../../lib/helpers'

export default function AdminCourses() {
  const [courses, setCourses] = useState(null)
  const [duplicatingId, setDuplicatingId] = useState(null)
  const [loadError, setLoadError] = useState('')

  async function load() {
    setLoadError('')
    const { data, error } = await supabase
      .from('courses')
      .select('*, questions(id, archived), prereading_documents(id)')
      .order('created_at', { ascending: false })
    if (error) {
      setLoadError('We couldn’t load courses. Please try again.')
      return
    }
    setCourses(data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function togglePublish(course) {
    // A course can only be published if a learner can actually complete it.
    if (!course.published) {
      const liveQuestions = (course.questions ?? []).filter((q) => !q.archived).length
      const hasVideo = course.video_type === 'embed' ? (course.video_url || '').trim() : course.video_url
      if (!liveQuestions || !hasVideo) {
        return alert(
          `"${course.title}" can't be published yet — it needs at least one quiz question and a lecture video. Open it in the editor to add them.`,
        )
      }
    }
    const { error } = await supabase.from('courses').update({ published: !course.published }).eq('id', course.id)
    if (error) alert(error.message)
    else load()
  }

  async function remove(course) {
    // Courses with recorded completions can never be deleted — CPD records
    // and certificates must remain valid forever. Unpublish instead.
    const { count, error: countError } = await supabase
      .from('completions')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', course.id)
    if (countError) return alert(countError.message)
    if (count > 0) {
      return alert(
        `"${course.title}" has ${count} recorded completion${count === 1 ? '' : 's'}, so it can't be deleted — ` +
        'optometrists must keep their CPD records and certificates. Unpublish it instead to hide it from the catalogue.',
      )
    }

    if (!confirm(`Delete "${course.title}"? This removes its questions, objectives, pre-reading records and uploaded files.`)) return
    const { error } = await supabase.from('courses').delete().eq('id', course.id)
    if (error) return alert(error.message)

    // Best-effort cleanup of uploaded files (video + pre-reading PDFs).
    for (const bucket of ['course-videos', 'prereading']) {
      try {
        const { data: files } = await supabase.storage.from(bucket).list(course.id)
        if (files?.length) {
          await supabase.storage.from(bucket).remove(files.map((f) => `${course.id}/${f.name}`))
        }
      } catch {
        /* orphaned files are harmless */
      }
    }
    load()
  }

  /** Duplicate a course as an unpublished draft — content, objectives,
   *  questions, and (best-effort) uploaded files. */
  async function duplicate(course) {
    setDuplicatingId(course.id)
    try {
      const { data: c, error: loadError } = await supabase
        .from('courses')
        .select('*, learning_objectives(*), prereading_documents(*), questions(*)')
        .eq('id', course.id)
        .maybeSingle()
      if (loadError || !c) throw new Error(loadError?.message || 'Could not load the course')

      const newId = crypto.randomUUID()
      const warnings = []

      // Uploaded video: copy the storage object into the new course's folder.
      let videoUrl = c.video_url
      if (c.video_type === 'upload' && c.video_url) {
        const newPath = `${newId}/${c.video_url.split('/').pop()}`
        const { error: copyError } = await supabase.storage.from('course-videos').copy(c.video_url, newPath)
        if (copyError) {
          videoUrl = ''
          warnings.push('The uploaded video could not be copied — re-upload it in the new course.')
        } else {
          videoUrl = newPath
        }
      }

      const { error: insertError } = await supabase.from('courses').insert({
        id: newId,
        title: `${c.title} (copy)`,
        description: c.description,
        presenter: c.presenter,
        categories: c.categories,
        cpd_hours: c.cpd_hours,
        is_therapeutic: c.is_therapeutic,
        video_type: c.video_type,
        video_url: videoUrl,
        published: false,
      })
      if (insertError) throw insertError

      if (c.learning_objectives.length) {
        const { error } = await supabase.from('learning_objectives').insert(
          c.learning_objectives.map((o) => ({ course_id: newId, sort_order: o.sort_order, objective: o.objective })),
        )
        if (error) throw error
      }

      if (c.questions.length) {
        const { error } = await supabase.from('questions').insert(
          c.questions.map((q) => ({
            course_id: newId,
            sort_order: q.sort_order,
            question_text: q.question_text,
            options: q.options,
            correct_index: q.correct_index,
            explanation: q.explanation,
          })),
        )
        if (error) throw error
      }

      for (const doc of c.prereading_documents) {
        const newPath = `${newId}/${doc.storage_path.split('/').pop()}`
        const { error: copyError } = await supabase.storage.from('prereading').copy(doc.storage_path, newPath)
        if (copyError) {
          warnings.push(`Pre-reading "${doc.title}" could not be copied — re-upload it in the new course.`)
          continue
        }
        const { error } = await supabase.from('prereading_documents').insert({
          course_id: newId,
          title: doc.title,
          storage_path: newPath,
          sort_order: doc.sort_order,
        })
        if (error) throw error
      }

      if (warnings.length) alert(`Course duplicated as a draft, with warnings:\n\n${warnings.join('\n')}`)
      load()
    } catch (err) {
      alert(`Could not duplicate the course: ${err.message}`)
    } finally {
      setDuplicatingId(null)
    }
  }

  if (loadError) {
    return (
      <div>
        <AdminNav />
        <div className="card mx-auto max-w-md p-8 text-center">
          <p className="text-slate-600">{loadError}</p>
          <button onClick={load} className="btn-primary mt-4">Try again</button>
        </div>
      </div>
    )
  }
  if (!courses) return <Loading />

  return (
    <div>
      <AdminNav />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-navy">Courses</h1>
          <p className="mt-1 text-slate-500">Create, edit, duplicate, publish and unpublish CPD courses.</p>
        </div>
        <Link to="/admin/courses/new" className="btn-primary">+ New course</Link>
      </div>

      {courses.length === 0 ? (
        <div className="card mt-8 p-12 text-center text-slate-500">No courses yet — create your first one.</div>
      ) : (
        <div className="mt-6 space-y-3">
          {courses.map((c) => (
            <div key={c.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      c.published ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {c.published ? 'Published' : 'Draft'}
                  </span>
                  {(c.categories ?? []).map((cat) => <span key={cat} className="badge capitalize">{cat}</span>)}
                </div>
                <h2 className="mt-1.5 truncate font-semibold text-navy">{c.title}</h2>
                <p className="text-sm text-slate-400">
                  {c.presenter} · {formatHours(c.cpd_hours)} hrs{c.is_therapeutic ? ' (therapeutic)' : ''} · {c.questions.filter((q) => !q.archived).length} questions ·{' '}
                  {c.prereading_documents.length} pre-reading · created {formatDate(c.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link to={`/admin/courses/${c.id}`} className="btn-secondary !px-4 !py-2 text-sm">Edit</Link>
                <button onClick={() => togglePublish(c)} className="btn-secondary !px-4 !py-2 text-sm">
                  {c.published ? 'Unpublish' : 'Publish'}
                </button>
                <button onClick={() => duplicate(c)} disabled={duplicatingId === c.id} className="btn-secondary !px-4 !py-2 text-sm disabled:opacity-50">
                  {duplicatingId === c.id ? 'Duplicating…' : 'Duplicate'}
                </button>
                <button onClick={() => remove(c)} className="btn-danger">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
