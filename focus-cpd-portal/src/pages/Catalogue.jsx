import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Loading } from '../components/Protected'
import { formatHours } from '../lib/helpers'

export default function Catalogue() {
  const { session } = useAuth()
  const [courses, setCourses] = useState(null)
  const [completions, setCompletions] = useState({})
  const [filter, setFilter] = useState('all')
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    async function load() {
      setLoadError('')
      const [{ data: courseData, error: cErr }, { data: completionData }] = await Promise.all([
        supabase
          .from('courses')
          .select('*, learning_objectives(id, sort_order, objective)')
          .eq('published', true)
          .order('created_at', { ascending: false }),
        supabase.from('completions').select('course_id').eq('user_id', session.user.id),
      ])
      if (cErr) {
        setLoadError('We couldn’t load the catalogue. Please try again.')
        return
      }
      setCourses(courseData ?? [])
      setCompletions(Object.fromEntries((completionData ?? []).map((c) => [c.course_id, true])))
    }
    load()
  }, [session.user.id, reloadKey])

  const categories = useMemo(() => {
    const set = new Set()
    for (const c of courses ?? []) for (const cat of c.categories ?? []) set.add(cat)
    return [...set].sort()
  }, [courses])

  if (loadError) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-slate-600">{loadError}</p>
        <button onClick={() => setReloadKey((k) => k + 1)} className="btn-primary mt-4">Try again</button>
      </div>
    )
  }
  if (!courses) return <Loading />

  const visible = filter === 'all' ? courses : courses.filter((c) => (c.categories ?? []).includes(filter))

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-navy">Course catalogue</h1>
          <p className="mt-1 text-slate-500">CPD education from Focus Vision Clinic to support your self-directed CPD.</p>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterChip>
          {categories.map((cat) => (
            <FilterChip key={cat} active={filter === cat} onClick={() => setFilter(cat)}>
              {cat}
            </FilterChip>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="mt-12 text-center text-slate-500">No courses in this category yet.</p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((course) => (
            <Link key={course.id} to={`/courses/${course.id}`} className="card group flex flex-col p-6 transition hover:shadow-md">
              <div className="flex flex-wrap items-center gap-2">
                {(course.categories ?? []).map((cat) => (
                  <span key={cat} className="badge capitalize">{cat}</span>
                ))}
                {course.is_therapeutic && (
                  <span className="inline-flex items-center rounded-full bg-navy px-2.5 py-0.5 text-xs font-semibold text-white">
                    Therapeutic CPD
                  </span>
                )}
                {completions[course.id] && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    ✓ Completed
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-lg font-bold leading-snug text-navy group-hover:text-teal-dark">{course.title}</h2>
              <p className="mt-1 text-sm font-medium text-teal">{course.presenter}</p>
              <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-500">{course.description}</p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                <span className="font-semibold text-navy">{formatHours(course.cpd_hours)} CPD hours</span>
                <span className="font-semibold text-teal group-hover:underline">
                  {completions[course.id] ? 'Review →' : 'Start course →'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition ${
        active ? 'bg-navy text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-teal-pale'
      }`}
    >
      {children}
    </button>
  )
}
