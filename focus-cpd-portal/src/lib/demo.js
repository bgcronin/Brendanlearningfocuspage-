// =============================================================
// DEMO MODE — a fully in-browser mock of the Supabase client.
// Used only when the app is built with VITE_DEMO=1, so the portal
// can be previewed with sample data and no Supabase project.
// Not used at all in the real deployment.
// =============================================================

const now = () => new Date().toISOString()
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString()
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`)

/* ------------------------- sample data ------------------------- */
const DEMO_USER = { id: 'demo-user', email: 'demo@focusvision.com.au' }

const db = {
  profiles: [
    {
      id: 'demo-user',
      full_name: 'Dr Demo Optometrist',
      email: DEMO_USER.email,
      practice_name: 'Demo Eyecare, Brisbane',
      ahpra_number: 'OPT0001234567',
      is_admin: true, // so the demo shows the admin area too
      created_at: daysAgo(30),
    },
    {
      id: 'demo-user-2',
      full_name: 'Dr Sam Sample',
      email: 'sam@sampleeyecare.com.au',
      practice_name: 'Sample Eyecare, Toowong',
      ahpra_number: 'OPT0007654321',
      is_admin: false,
      created_at: daysAgo(12),
    },
  ],
  courses: [
    {
      id: 'course-1',
      title: 'Keratoconus: Diagnosis and Modern Management',
      description:
        'A practical update on detecting early keratoconus in primary care, interpreting corneal tomography, and current management options including corneal cross-linking and specialty contact lenses.',
      presenter: 'Dr Brendan Cronin',
      categories: ['cornea'],
      cpd_hours: 1.5,
      is_therapeutic: false,
      video_type: 'embed',
      video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      published: true,
      created_at: daysAgo(10),
    },
    {
      id: 'course-2',
      title: 'Glaucoma Essentials: OCT Interpretation for Optometrists',
      description:
        'How to read RNFL and ganglion cell analysis reports with confidence, recognise red and green disease, and decide when to refer. Includes case-based examples of common artefacts.',
      presenter: 'Dr David Gunn',
      categories: ['glaucoma'],
      cpd_hours: 1.0,
      is_therapeutic: true,
      video_type: 'embed',
      video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      published: true,
      created_at: daysAgo(20),
    },
    {
      id: 'course-3',
      title: 'Refractive Surgery Co-Management: LASIK, PRK and ICL',
      description:
        'What every optometrist needs to know when advising patients about refractive surgery: candidacy, comparing LASIK, TransPRK, lenticule extraction and ICL, and post-operative co-management.',
      presenter: 'Dr Brendan Cronin',
      categories: ['refractive'],
      cpd_hours: 1.5,
      is_therapeutic: false,
      video_type: 'embed',
      video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      published: true,
      created_at: daysAgo(5),
    },
  ],
  learning_objectives: [
    { id: 'lo-1', course_id: 'course-1', sort_order: 1, objective: 'Identify early tomographic signs of keratoconus on Pentacam and OCT imaging' },
    { id: 'lo-2', course_id: 'course-1', sort_order: 2, objective: 'Describe the indications, technique and outcomes of corneal cross-linking' },
    { id: 'lo-3', course_id: 'course-1', sort_order: 3, objective: 'Outline a co-management and referral pathway for progressive keratoconus' },
    { id: 'lo-4', course_id: 'course-2', sort_order: 1, objective: 'Interpret RNFL and ganglion cell OCT reports systematically' },
    { id: 'lo-5', course_id: 'course-2', sort_order: 2, objective: 'Recognise common OCT artefacts and sources of red/green disease' },
    { id: 'lo-6', course_id: 'course-2', sort_order: 3, objective: 'Apply referral criteria for glaucoma suspects in primary care' },
    { id: 'lo-7', course_id: 'course-3', sort_order: 1, objective: 'Assess patient candidacy for laser vision correction and ICL' },
    { id: 'lo-8', course_id: 'course-3', sort_order: 2, objective: 'Compare the indications and limitations of LASIK, TransPRK, lenticule extraction and ICL' },
    { id: 'lo-9', course_id: 'course-3', sort_order: 3, objective: 'Implement an evidence-based post-operative co-management schedule' },
  ],
  prereading_documents: [
    { id: 'doc-1', course_id: 'course-1', title: 'Pre-reading: Corneal Cross-Linking Overview', storage_path: 'demo/crosslinking.pdf', sort_order: 1 },
  ],
  questions: [
    {
      id: 'q-1', course_id: 'course-1', sort_order: 1,
      question_text: 'Which tomographic finding is most suggestive of early keratoconus?',
      options: ['Symmetric bow-tie astigmatism', 'Inferior corneal steepening with posterior elevation', 'Diffuse corneal thickening', 'Central corneal flattening'],
      correct_index: 1,
      explanation: 'Inferior steepening combined with posterior corneal elevation is a hallmark of early ectatic change, often before slit-lamp signs appear.',
    },
    {
      id: 'q-2', course_id: 'course-1', sort_order: 2,
      question_text: 'The primary goal of corneal cross-linking is to:',
      options: ['Improve uncorrected visual acuity', 'Flatten the cornea for refractive benefit', 'Halt progression of ectasia', 'Eliminate the need for contact lenses'],
      correct_index: 2,
      explanation: 'Cross-linking stiffens the corneal stroma to stop progression. Any flattening or visual improvement is a secondary benefit.',
    },
    {
      id: 'q-3', course_id: 'course-1', sort_order: 3,
      question_text: 'A 19-year-old with documented progression of keratoconus should be:',
      options: ['Reviewed again in 12 months', 'Fitted with soft torics and monitored', 'Referred promptly for cross-linking assessment', 'Advised to start topical steroids'],
      correct_index: 2,
      explanation: 'Young age and documented progression are strong indications for prompt cross-linking referral.',
    },
    {
      id: 'q-4', course_id: 'course-2', sort_order: 1,
      question_text: '"Red disease" on OCT refers to:',
      options: ['True glaucomatous loss', 'Abnormal classification due to artefact or normal variation', 'Inflammatory optic neuropathy', 'Poor signal strength only'],
      correct_index: 1,
      explanation: 'Red disease is a falsely abnormal result — e.g. high myopia or segmentation error flagged red without true pathology.',
    },
    {
      id: 'q-5', course_id: 'course-2', sort_order: 2,
      question_text: 'Which parameter is generally the earliest structural indicator of glaucomatous damage?',
      options: ['Central corneal thickness', 'Macular ganglion cell complex thinning', 'Cup-to-disc ratio on photos', 'Peripapillary atrophy'],
      correct_index: 1,
      explanation: 'Ganglion cell complex analysis frequently shows thinning before visual field defects develop.',
    },
    {
      id: 'q-6', course_id: 'course-3', sort_order: 1,
      question_text: 'Which patient is generally the best candidate for ICL rather than LASIK?',
      options: ['-2.00 D myope with normal topography', '-10.00 D myope with thin corneas', '+1.00 D hyperope aged 60', 'Patient with active keratoconus wanting spectacle independence'],
      correct_index: 1,
      explanation: 'High myopia with insufficient corneal tissue for ablation is the classic ICL indication.',
    },
    {
      id: 'q-7', course_id: 'course-3', sort_order: 2,
      question_text: 'Following uncomplicated LASIK, the typical minimum dry eye management period is:',
      options: ['No management needed', '1 week of lubricants', '3–6 months of lubricant support', 'Lifelong punctal plugs'],
      correct_index: 2,
      explanation: 'Corneal nerve recovery takes months; most patients need lubricant support for 3–6 months post-LASIK.',
    },
  ],
  attempts: [
    { id: 'attempt-1', user_id: 'demo-user', course_id: 'course-2', score: 2, total: 2, created_at: daysAgo(7) },
  ],
  attempt_answers: [
    { id: 'ans-1', attempt_id: 'attempt-1', question_id: 'q-4', selected_index: 1, is_correct: true },
    { id: 'ans-2', attempt_id: 'attempt-1', question_id: 'q-5', selected_index: 1, is_correct: true },
  ],
  completions: [
    {
      id: 'completion-1', user_id: 'demo-user', course_id: 'course-2', attempt_id: 'attempt-1',
      score: 2, total: 2, reflection: 'Great refresher on GCC analysis — I will add ganglion cell maps to my glaucoma suspect workups.',
      completed_at: daysAgo(7),
    },
  ],
  certificates: [
    {
      id: 'cert-1', certificate_code: 'FV-2026-DEMO42', completion_id: 'completion-1',
      user_id: 'demo-user', course_id: 'course-2', pdf_path: 'demo-user/FV-2026-DEMO42.pdf',
      email_sent: true, revoked_at: null, revoked_reason: '', issued_at: daysAgo(7),
    },
  ],
}

/* --------------------- tiny query builder --------------------- */
// Child relations: rows in <table> whose <fk> equals the parent row's id.
const childRelations = {
  courses: { learning_objectives: 'course_id', prereading_documents: 'course_id', questions: 'course_id' },
  completions: { certificates: 'completion_id' },
}
// Parent relations referenced as alias:fk_column(...)
const parentTables = { courses: 'courses', profiles: 'profiles' }

function splitTopLevel(str) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of str) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

function resolveEmbeds(tableName, rows, selectStr) {
  if (!selectStr || selectStr === '*') return rows
  const tokens = splitTopLevel(selectStr).filter((t) => t !== '*' && t.includes('('))
  if (!tokens.length) return rows
  return rows.map((row) => {
    const out = { ...row }
    for (const token of tokens) {
      const name = token.slice(0, token.indexOf('(')).trim()
      if (name.includes(':')) {
        // parent embed, e.g. courses:course_id(...)
        const [alias, fk] = name.split(':')
        const target = parentTables[alias]
        if (target) out[alias] = db[target].find((r) => r.id === row[fk]) ?? null
      } else {
        // child embed, e.g. questions(...)
        const fk = (childRelations[tableName] || {})[name]
        if (fk) out[name] = db[name].filter((r) => r[fk] === row.id).map((r) => ({ ...r }))
      }
    }
    return out
  })
}

class Query {
  constructor(table) {
    this.table = table
    this.action = 'select'
    this.filters = []
    this.selectStr = '*'
    this.orderBy = null
    this.singleMode = null
    this.payload = null
    this.returning = false
    this.countMode = false
  }
  select(cols = '*', opts = {}) {
    if (this.action === 'select') this.selectStr = cols
    else this.returning = true
    if (opts.count) this.countMode = true
    return this
  }
  insert(rows) { this.action = 'insert'; this.payload = rows; return this }
  upsert(rows) { this.action = 'upsert'; this.payload = rows; return this }
  update(patch) { this.action = 'update'; this.payload = patch; return this }
  delete() { this.action = 'delete'; return this }
  eq(col, val) { this.filters.push((r) => r[col] === val); return this }
  in(col, vals) { this.filters.push((r) => vals.includes(r[col])); return this }
  order(col, opts = {}) { this.orderBy = { col, ascending: opts.ascending !== false }; return this }
  maybeSingle() { this.singleMode = 'maybe'; return this }
  single() { this.singleMode = 'strict'; return this }

  _rows() {
    // quiz_questions is a view over questions that hides the answers.
    if (this.table === 'quiz_questions') {
      return db.questions.map(({ correct_index, explanation, ...safe }) => safe)
    }
    return db[this.table]
  }

  _matching() {
    return this._rows().filter((r) => this.filters.every((f) => f(r)))
  }

  _run() {
    const rows = this._rows()
    if (this.action === 'select') {
      let result = this._matching().map((r) => ({ ...r }))
      result = resolveEmbeds(this.table, result, this.selectStr)
      if (this.orderBy) {
        const { col, ascending } = this.orderBy
        result.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (ascending ? 1 : -1))
      }
      return this._finish(result)
    }
    if (this.action === 'insert' || this.action === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload]
      const inserted = []
      for (const item of list) {
        const existing = this.action === 'upsert' && item.id ? rows.find((r) => r.id === item.id) : null
        if (existing) {
          Object.assign(existing, item)
          inserted.push({ ...existing })
          continue
        }
        if (this.table === 'completions') {
          const dup = rows.find((r) => r.user_id === item.user_id && r.course_id === item.course_id)
          if (dup) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
        }
        const row = {
          id: item.id ?? uuid(),
          ...(this.table === 'completions' ? { completed_at: now() } : {}),
          ...(this.table === 'attempts' || this.table === 'courses' ? { created_at: now() } : {}),
          ...item,
        }
        rows.push(row)
        inserted.push({ ...row })
      }
      return this._finish(inserted)
    }
    if (this.action === 'update') {
      const matched = this._matching()
      matched.forEach((r) => Object.assign(r, this.payload))
      return this._finish(matched.map((r) => ({ ...r })))
    }
    if (this.action === 'delete') {
      const matched = new Set(this._matching().map((r) => r.id))
      if (this.table === 'courses') {
        // mimic ON DELETE RESTRICT — completed courses can't be deleted
        if (db.completions.some((r) => matched.has(r.course_id))) {
          return { data: null, error: { code: '23503', message: 'update or delete on table "courses" violates foreign key constraint on table "completions"' } }
        }
      }
      db[this.table] = db[this.table].filter((r) => !matched.has(r.id))
      if (this.table === 'courses') {
        // mimic ON DELETE CASCADE for content tables
        for (const t of ['learning_objectives', 'prereading_documents', 'questions', 'attempts']) {
          db[t] = db[t].filter((r) => !matched.has(r.course_id))
        }
      }
      return this._finish([])
    }
    return { data: null, error: { message: 'Unsupported demo operation' } }
  }

  _finish(result) {
    if (this.singleMode) {
      const row = result[0] ?? null
      if (!row && this.singleMode === 'strict') return { data: null, error: { message: 'Row not found' } }
      return { data: row, error: null }
    }
    if (this.countMode) return { data: result, count: result.length, error: null }
    return { data: result, error: null }
  }

  then(resolve, reject) {
    try {
      resolve(this._run())
    } catch (err) {
      if (reject) reject(err)
      else resolve({ data: null, error: { message: err.message } })
    }
  }
}

/* --------------------------- auth ------------------------------ */
function makeAuth() {
  let session = { user: DEMO_USER, access_token: 'demo-token' }
  const listeners = new Set()
  const notify = (event) => listeners.forEach((cb) => cb(event, session))
  return {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: (cb) => {
      listeners.add(cb)
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
    },
    signInWithPassword: async () => {
      session = { user: DEMO_USER, access_token: 'demo-token' }
      notify('SIGNED_IN')
      return { data: { session }, error: null }
    },
    signUp: async () => {
      session = { user: DEMO_USER, access_token: 'demo-token' }
      notify('SIGNED_IN')
      return { data: { session }, error: null }
    },
    signOut: async () => {
      session = null
      notify('SIGNED_OUT')
      return { error: null }
    },
    getUser: async () => ({ data: { user: DEMO_USER }, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    resend: async () => ({ data: {}, error: null }),
    updateUser: async () => ({ data: { user: DEMO_USER }, error: null }),
  }
}

/* -------------------------- storage ---------------------------- */
function placeholderTab(title, message) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>
  <body style="font-family:Poppins,system-ui,sans-serif;background:#f4f1ed;display:flex;align-items:center;justify-content:center;min-height:96vh;margin:0">
    <div style="background:#fff;border-radius:16px;max-width:460px;padding:40px;text-align:center;box-shadow:0 8px 30px rgba(28,47,73,.12)">
      <div style="font-weight:700;letter-spacing:4px;color:#1c2f49;font-size:18px">FOCUS VISION</div>
      <div style="color:#04838c;font-size:11px;letter-spacing:3px;margin-top:4px">CPD PORTAL — DEMO</div>
      <h1 style="color:#1c2f49;font-size:19px;margin:24px 0 12px">${title}</h1>
      <p style="color:#475569;line-height:1.6;margin:0">${message}</p>
    </div>
  </body></html>`
  return URL.createObjectURL(new Blob([html], { type: 'text/html' }))
}

const demoStorage = {
  from: (bucket) => ({
    createSignedUrl: async (path) => ({
      data: {
        signedUrl:
          bucket === 'certificates'
            ? placeholderTab('Certificate PDF (simulated)', 'In the live portal this downloads the branded PDF certificate, generated on the server and emailed to the optometrist. Demo mode has no server — but the on-screen certificate you just saw is identical to the PDF.')
            : placeholderTab('Pre-reading PDF (simulated)', `In the live portal this opens the uploaded PDF (<code>${path}</code>) from secure storage.`),
      },
      error: null,
    }),
    upload: async () => ({ data: { path: 'demo-upload' }, error: null }),
    remove: async () => ({ data: [], error: null }),
    list: async () => ({ data: [], error: null }),
    copy: async () => ({ data: {}, error: null }),
  }),
}

/* ----------------------------- rpc ----------------------------- */
async function rpc(fn, args = {}) {
  if (fn === 'set_admin') {
    if (args.target === DEMO_USER.id && !args.make_admin) {
      return { data: null, error: { message: 'You cannot remove your own admin access' } }
    }
    const p = db.profiles.find((x) => x.id === args.target)
    if (!p) return { data: null, error: { message: 'User not found' } }
    p.is_admin = args.make_admin
    return { data: null, error: null }
  }
  if (fn === 'submit_quiz') {
    // Mirrors the server-side grading function.
    const courseId = args.p_course_id
    const answers = args.p_answers || {}
    const questions = db.questions.filter((q) => q.course_id === courseId)
    if (!questions.length) return { data: null, error: { message: 'This course has no quiz questions' } }
    if (questions.some((q) => answers[q.id] === undefined || answers[q.id] === null)) {
      return { data: null, error: { message: 'All questions must be answered' } }
    }

    const results = [...questions]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((q) => ({
        question_id: q.id,
        selected_index: answers[q.id],
        correct_index: q.correct_index,
        is_correct: answers[q.id] === q.correct_index,
        explanation: q.explanation,
      }))
    const score = results.filter((r) => r.is_correct).length
    const total = questions.length

    const attempt = { id: uuid(), user_id: DEMO_USER.id, course_id: courseId, score, total, created_at: now() }
    db.attempts.push(attempt)
    db.attempt_answers.push(...results.map((r) => ({
      id: uuid(), attempt_id: attempt.id, question_id: r.question_id,
      selected_index: r.selected_index, is_correct: r.is_correct,
    })))

    let completion = db.completions.find((c) => c.user_id === DEMO_USER.id && c.course_id === courseId)
    let isFirst = false
    if (!completion) {
      completion = { id: uuid(), user_id: DEMO_USER.id, course_id: courseId, attempt_id: attempt.id, score, total, reflection: '', completed_at: now() }
      db.completions.push(completion)
      isFirst = true
    }

    return {
      data: {
        attempt_id: attempt.id,
        score,
        total,
        is_first_completion: isFirst,
        completion_id: completion.id,
        completed_at: completion.completed_at,
        results,
      },
      error: null,
    }
  }
  if (fn === 'verify_certificate') {
    const code = String(args.cert_code || '').trim().toUpperCase()
    const cert = db.certificates.find((c) => c.certificate_code.toUpperCase() === code)
    if (!cert) return { data: [], error: null }
    const profile = db.profiles.find((p) => p.id === cert.user_id)
    const course = db.courses.find((c) => c.id === cert.course_id)
    const completion = db.completions.find((c) => c.id === cert.completion_id)
    return {
      data: [{
        certificate_code: cert.certificate_code,
        full_name: profile?.full_name,
        course_title: course?.title,
        cpd_hours: course?.cpd_hours,
        is_therapeutic: course?.is_therapeutic ?? false,
        completed_at: completion?.completed_at,
        issued_at: cert.issued_at,
        revoked: Boolean(cert.revoked_at),
      }],
      error: null,
    }
  }
  return { data: null, error: { message: `Unknown RPC ${fn}` } }
}

/* ------------------- fake the Netlify Function ------------------ */
function patchFetch() {
  const realFetch = window.fetch.bind(window)
  window.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('/.netlify/functions/issue-certificate')) {
      await new Promise((r) => setTimeout(r, 900)) // simulate generation time
      const { completionId } = JSON.parse(opts?.body || '{}')
      const existing = db.certificates.find((c) => c.completion_id === completionId)
      const completion = db.completions.find((c) => c.id === completionId)
      if (!completion) return new Response(JSON.stringify({ error: 'Completion not found' }), { status: 404 })
      if (existing?.revoked_at) {
        return new Response(JSON.stringify({ error: 'This certificate has been revoked', certificate: existing, alreadyIssued: true }), { status: 409 })
      }
      const certificate = existing ?? {
        id: uuid(),
        certificate_code: `FV-${new Date().getFullYear()}-DEMO${Math.floor(10 + Math.random() * 89)}`,
        completion_id: completionId,
        user_id: completion.user_id,
        course_id: completion.course_id,
        pdf_path: `${completion.user_id}/demo.pdf`,
        email_sent: true,
        revoked_at: null,
        revoked_reason: '',
        issued_at: now(),
      }
      if (!existing) db.certificates.push(certificate)
      return new Response(JSON.stringify({ certificate, emailSent: true, alreadyIssued: Boolean(existing) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return realFetch(url, opts)
  }
}

/* --------------------------- client ----------------------------- */
export function createDemoClient() {
  patchFetch()
  return {
    auth: makeAuth(),
    from: (table) => new Query(table),
    storage: demoStorage,
    rpc,
  }
}
