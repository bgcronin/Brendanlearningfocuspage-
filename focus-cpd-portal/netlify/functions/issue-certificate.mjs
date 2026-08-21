// =============================================================
// issue-certificate — the only server-side code in the portal.
//
// Called by the frontend after a completion is recorded:
//   1. Verifies the caller's Supabase JWT and ownership of the completion
//      (and that a real quiz attempt exists for the course)
//   2. Reserves the certificates row (service role bypasses RLS),
//      retrying on the (rare) certificate-code collision
//   3. Generates the certificate PDF (pdf-lib)
//   4. Uploads it to the private 'certificates' storage bucket
//   5. Emails the PDF to the optometrist via Resend
//
// Idempotent AND retryable: if a certificate already exists for the
// completion it is returned as-is — but if its email previously
// failed (email_sent = false), the email is retried.
// =============================================================
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Brand colours matched to focusvision.com.au
const NAVY = rgb(0x1c / 255, 0x2f / 255, 0x49 / 255)
const TEAL = rgb(0x04 / 255, 0x83 / 255, 0x8c / 255)
const GREY = rgb(0.45, 0.5, 0.55)

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return json(500, { error: 'Server is missing Supabase configuration' })

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // --- 1. Authenticate the caller -------------------------------------
  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Missing authorization token' })

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user) return json(401, { error: 'Invalid or expired session' })
  const user = userData.user

  let completionId
  let forceEmail = false
  try {
    const body = JSON.parse(event.body || '{}')
    completionId = body.completionId
    forceEmail = Boolean(body.forceEmail)
  } catch {
    return json(400, { error: 'Invalid request body' })
  }
  if (!completionId) return json(400, { error: 'completionId is required' })

  // Admins may act on other users' completions (e.g. re-send an email).
  const { data: callerProfile } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  const callerIsAdmin = Boolean(callerProfile?.is_admin)

  // --- 2. Load + verify the completion ---------------------------------
  const { data: completion, error: compError } = await admin
    .from('completions')
    .select('*, courses:course_id(title, presenter, cpd_hours, is_therapeutic, learning_objectives(sort_order, objective)), profiles:user_id(full_name, email)')
    .eq('id', completionId)
    .maybeSingle()
  // 5xx paths log the detail server-side and return a generic message —
  // raw Postgres/API errors leak schema details to any authenticated caller.
  if (compError) {
    console.error('completion query failed:', compError)
    return json(500, { error: 'Could not issue the certificate — please try again' })
  }
  if (!completion) return json(404, { error: 'Completion not found' })
  if (completion.user_id !== user.id && !callerIsAdmin) {
    return json(403, { error: 'This completion belongs to another user' })
  }

  // Belt-and-braces: a graded quiz attempt must exist for the completion's
  // OWNER (not the caller — an admin re-sending another user's certificate
  // has no attempt of their own on that course).
  const { count: attemptCount, error: attemptError } = await admin
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', completion.user_id)
    .eq('course_id', completion.course_id)
  if (attemptError) {
    console.error('attempt check failed:', attemptError)
    return json(500, { error: 'Could not issue the certificate — please try again' })
  }
  if (!attemptCount) return json(403, { error: 'No quiz attempt found for this course' })

  const course = Array.isArray(completion.courses) ? completion.courses[0] : completion.courses
  const profile = Array.isArray(completion.profiles) ? completion.profiles[0] : completion.profiles
  const objectives = (course.learning_objectives ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((o) => o.objective)

  // Course facts come from the SNAPSHOT taken on the completion at pass
  // time, so a later course edit cannot change an issued certificate.
  // (Older completions with no snapshot fall back to the live course.)
  const snap = {
    title: completion.course_title || course.title,
    cpdHours: completion.cpd_hours != null ? completion.cpd_hours : course.cpd_hours,
    isTherapeutic: completion.is_therapeutic ?? course.is_therapeutic,
  }
  const holderName = profile.full_name || profile.email || ''

  const emailPayload = (code, pdfBytes) => ({
    to: profile.email,
    fullName: profile.full_name || 'there',
    courseTitle: snap.title,
    cpdHours: snap.cpdHours,
    isTherapeutic: snap.isTherapeutic,
    certificateCode: code,
    completedAt: completion.completed_at,
    pdfBytes,
  })

  // --- Idempotency: certificate already exists? ------------------------
  const { data: existing } = await admin.from('certificates').select('*').eq('completion_id', completionId).maybeSingle()
  if (existing) {
    // Never email a revoked certificate.
    if (existing.revoked_at) {
      return json(409, { error: 'This certificate has been revoked', certificate: existing, alreadyIssued: true })
    }
    // The certificate stands — retry the email if it never went out,
    // or re-send on demand when an admin asks (forceEmail).
    if (existing.email_sent && !(forceEmail && callerIsAdmin)) {
      return json(200, { certificate: existing, emailSent: true, alreadyIssued: true })
    }
    return json(200, await retryEmail(admin, existing, emailPayload))
  }

  // --- 3. Reserve the certificates row (retry code collisions) ---------
  let certificate = null
  let code = null
  for (let attempt = 0; attempt < 5 && !certificate; attempt++) {
    code = generateCode()
    const { data: inserted, error: insertError } = await admin
      .from('certificates')
      .insert({
        certificate_code: code,
        completion_id: completionId,
        user_id: completion.user_id,
        course_id: completion.course_id,
        holder_name: holderName,
        course_title: snap.title,
        cpd_hours: snap.cpdHours,
        is_therapeutic: snap.isTherapeutic,
        pdf_path: `${completion.user_id}/${code}.pdf`,
        email_sent: false,
      })
      .select()
      .single()
    if (inserted) {
      certificate = inserted
      break
    }
    if (insertError?.message?.includes('certificate_code')) continue // code collision — regenerate
    // A parallel request may have won the race on completion_id — return the winner.
    const { data: raced } = await admin.from('certificates').select('*').eq('completion_id', completionId).maybeSingle()
    if (raced) {
      if (raced.email_sent) return json(200, { certificate: raced, emailSent: true, alreadyIssued: true })
      return json(200, await retryEmail(admin, raced, emailPayload))
    }
    console.error('certificate insert failed:', insertError)
    return json(500, { error: 'Could not create the certificate — please try again' })
  }
  if (!certificate) return json(500, { error: 'Could not generate a unique certificate code — please try again' })

  // --- 4. Generate + store the PDF --------------------------------------
  let pdfBytes
  try {
    pdfBytes = await buildCertificatePdf({
      fullName: holderName,
      courseTitle: snap.title,
      presenter: course.presenter,
      cpdHours: snap.cpdHours,
      isTherapeutic: snap.isTherapeutic,
      objectives,
      completedAt: completion.completed_at,
      certificateCode: code,
    })
    const { error: uploadError } = await admin.storage
      .from('certificates')
      .upload(certificate.pdf_path, Buffer.from(pdfBytes), { contentType: 'application/pdf', upsert: true })
    if (uploadError) throw new Error(uploadError.message)
  } catch (err) {
    // Roll back the row so the next attempt starts clean.
    console.error('certificate PDF generation/upload failed:', err)
    await admin.from('certificates').delete().eq('id', certificate.id)
    return json(500, { error: 'Could not store the certificate PDF — please try again' })
  }

  // --- 5. Email the PDF (failure here must not block the certificate) ---
  let emailSent = false
  let emailError = null
  try {
    await sendEmail(emailPayload(code, pdfBytes))
    emailSent = true
    const { data: updated } = await admin
      .from('certificates')
      .update({ email_sent: true })
      .eq('id', certificate.id)
      .select()
      .single()
    if (updated) certificate = updated
  } catch (err) {
    emailError = err.message
    console.error('Resend email failed:', err)
  }

  return json(200, { certificate, emailSent, emailError })
}

/** Re-send the email for an existing certificate whose email previously failed. */
async function retryEmail(admin, certificate, emailPayload) {
  try {
    const { data: file, error: dlError } = await admin.storage.from('certificates').download(certificate.pdf_path)
    if (dlError) throw new Error(dlError.message)
    const pdfBytes = new Uint8Array(await file.arrayBuffer())
    await sendEmail(emailPayload(certificate.certificate_code, pdfBytes))
    const { data: updated } = await admin
      .from('certificates')
      .update({ email_sent: true })
      .eq('id', certificate.id)
      .select()
      .single()
    return { certificate: updated ?? certificate, emailSent: true, alreadyIssued: true }
  } catch (err) {
    console.error('Resend email retry failed:', err)
    return { certificate, emailSent: false, emailError: err.message, alreadyIssued: true }
  }
}

/* ---------------------------------------------------------------------- */

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
  let suffix = ''
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
  return `FV-${new Date().getFullYear()}-${suffix}`
}

function loadAsset(filename) {
  const candidates = [
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets', filename),
    path.join(process.cwd(), 'netlify', 'functions', 'assets', filename),
  ]
  for (const p of candidates) {
    try {
      return readFileSync(p)
    } catch {
      /* try next */
    }
  }
  return null
}

const loadLogo = () => loadAsset('logo.png')

export async function buildCertificatePdf({ fullName, courseTitle, presenter, cpdHours, isTherapeutic, objectives, completedAt, certificateCode }) {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const page = doc.addPage([841.89, 595.28]) // A4 landscape
  const { width, height } = page.getSize()

  // Poppins to match focusvision.com.au (falls back to Helvetica if the
  // font files are ever missing from the bundle).
  const poppinsRegular = loadAsset('Poppins-Regular.ttf')
  const poppinsSemiBold = loadAsset('Poppins-SemiBold.ttf')
  const helvetica = poppinsRegular
    ? await doc.embedFont(poppinsRegular, { subset: true })
    : await doc.embedFont(StandardFonts.Helvetica)
  const bold = poppinsSemiBold
    ? await doc.embedFont(poppinsSemiBold, { subset: true })
    : await doc.embedFont(StandardFonts.HelveticaBold)
  // The holder name is drawn with the embedded Unicode font (Poppins), NOT
  // a WinAnsi StandardFont: pdf-lib throws "WinAnsi cannot encode" on any
  // character outside Latin-1 (e.g. an accented name), which previously
  // 500'd the whole issuance. `usingUnicodeName` is false only if the font
  // files are missing from the bundle, in which case we ASCII-fold as a
  // last resort so a certificate is always produced.
  const nameFont = bold
  const usingUnicodeName = Boolean(poppinsSemiBold)

  // Borders
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: NAVY, borderWidth: 4 })
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderColor: TEAL, borderWidth: 1 })

  const centerText = (text, y, font, size, color) => {
    const w = font.widthOfTextAtSize(text, size)
    page.drawText(text, { x: (width - w) / 2, y, size, font, color })
  }

  let y = height - 60

  // Logo / brand header
  const logoBytes = loadLogo()
  if (logoBytes) {
    const logo = await doc.embedPng(logoBytes)
    const logoSize = 64
    page.drawImage(logo, { x: (width - logoSize) / 2, y: y - logoSize + 8, width: logoSize, height: logoSize })
    y -= logoSize + 4
  }
  centerText('F O C U S   V I S I O N', y - 12, bold, 16, NAVY)
  y -= 44

  centerText('CERTIFICATE OF COMPLETION', y, bold, 28, NAVY)
  y -= 20
  centerText('C O N T I N U I N G   P R O F E S S I O N A L   D E V E L O P M E N T', y, helvetica, 9, TEAL)
  y -= 38

  centerText('This certifies that', y, helvetica, 11, GREY)
  y -= 30
  // Guard against any un-encodable glyph so a name can never crash issuance.
  const safeName = usingUnicodeName ? fullName : asciiFold(fullName)
  try {
    centerText(safeName || 'Certificate Holder', y, nameFont, 30, NAVY)
  } catch {
    centerText(asciiFold(fullName) || 'Certificate Holder', y, bold, 30, NAVY)
  }
  y -= 30
  centerText('has successfully completed', y, helvetica, 11, GREY)
  y -= 24

  // Course title (wrapped)
  const titleLines = wrapText(courseTitle, bold, 17, width - 220)
  for (const line of titleLines) {
    centerText(line, y, bold, 17, TEAL)
    y -= 22
  }
  y -= 4
  centerText(`Presented by ${presenter}`, y, helvetica, 11, NAVY)
  y -= 30

  // Hours + date
  const hoursText = `CPD HOURS: ${formatHours(cpdHours)}${isTherapeutic ? '  (THERAPEUTIC)' : ''}`
  const dateText = `COMPLETED: ${formatDate(completedAt)}`
  const gap = 50
  const hw = bold.widthOfTextAtSize(hoursText, 12)
  const dw = bold.widthOfTextAtSize(dateText, 12)
  const totalW = hw + gap + dw
  page.drawLine({ start: { x: (width - totalW) / 2 - 20, y: y + 18 }, end: { x: (width + totalW) / 2 + 20, y: y + 18 }, thickness: 0.5, color: rgb(0.85, 0.87, 0.89) })
  page.drawText(hoursText, { x: (width - totalW) / 2, y, size: 12, font: bold, color: NAVY })
  page.drawText(dateText, { x: (width - totalW) / 2 + hw + gap, y, size: 12, font: bold, color: NAVY })
  page.drawLine({ start: { x: (width - totalW) / 2 - 20, y: y - 10 }, end: { x: (width + totalW) / 2 + 20, y: y - 10 }, thickness: 0.5, color: rgb(0.85, 0.87, 0.89) })
  y -= 34

  // Learning objectives — render as many as fit above the footer (y=48)
  // rather than a fixed cap, and never draw over the footer.
  if (objectives.length) {
    centerText('LEARNING OBJECTIVES', y, bold, 9, NAVY)
    y -= 16
    const maxObjectiveWidth = width - 280
    const FLOOR = 64 // keep clear of the footer drawn at y=48
    let shown = 0
    for (const objective of objectives) {
      const lines = wrapText(`•  ${objective}`, helvetica, 9, maxObjectiveWidth)
      if (y - lines.length * 13 < FLOOR) break // out of room
      for (const line of lines) {
        page.drawText(line, { x: (width - maxObjectiveWidth) / 2, y, size: 9, font: helvetica, color: GREY, maxWidth: maxObjectiveWidth })
        y -= 13
      }
      shown++
    }
    if (shown < objectives.length && y - 12 >= FLOOR) {
      page.drawText(`…and ${objectives.length - shown} more`, { x: (width - maxObjectiveWidth) / 2, y, size: 8, font: helvetica, color: GREY })
    }
  }

  // Footer
  page.drawText('Focus Vision Clinic  ·  87 Ipswich Road, Woolloongabba QLD  ·  focusvision.com.au', {
    x: 48, y: 48, size: 8, font: helvetica, color: GREY,
  })
  const idText = `Certificate ID: ${certificateCode}`
  const idW = bold.widthOfTextAtSize(idText, 9)
  page.drawText(idText, { x: width - 48 - idW, y: 48, size: 9, font: bold, color: NAVY })

  return doc.save()
}

function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

// Last-resort transliteration used only if the Unicode font files are
// missing from the bundle: strip diacritics, drop anything still outside
// Latin-1 so a WinAnsi StandardFont can encode it.
export function asciiFold(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\xFF]/g, '')
    .trim()
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' })
}

function formatHours(h) {
  const n = Number(h)
  return Number.isInteger(n) ? `${n}.0` : `${n}`
}

async function sendEmail({ to, fullName, courseTitle, cpdHours, isTherapeutic, certificateCode, completedAt, pdfBytes }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) throw new Error('Resend is not configured (RESEND_API_KEY / RESEND_FROM)')

  const siteUrl = process.env.SITE_URL || process.env.URL || 'https://focusvision.com.au'
  const firstName = fullName.split(' ')[0]

  const html = `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #334155;">
    <div style="background: #1c2f49; padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="color: #ffffff; font-size: 20px; font-weight: bold; letter-spacing: 4px;">FOCUS VISION</div>
      <div style="color: #c2dbe3; font-size: 11px; letter-spacing: 3px; margin-top: 4px;">CPD PORTAL</div>
    </div>
    <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 32px;">
      <h1 style="color: #1c2f49; font-size: 20px; margin: 0 0 16px;">Congratulations, ${escapeHtml(firstName)}! 🎓</h1>
      <p style="line-height: 1.6; margin: 0 0 16px;">
        You've successfully completed <strong>${escapeHtml(courseTitle)}</strong> and earned
        <strong>${formatHours(cpdHours)} ${isTherapeutic ? 'therapeutic ' : ''}CPD hours</strong>.
      </p>
      <p style="line-height: 1.6; margin: 0 0 16px;">
        Your certificate is attached to this email as a PDF. It's also permanently available to
        re-download any time from <a href="${siteUrl}/my-cpd" style="color: #04838c;">My CPD Record</a>.
      </p>
      <table style="width: 100%; background: #f4f1ed; border-radius: 8px; padding: 8px; border-collapse: separate; margin: 0 0 16px;">
        <tr><td style="padding: 6px 14px; color: #64748b; font-size: 13px;">Certificate ID</td><td style="padding: 6px 14px; font-family: monospace; font-weight: bold; color: #1c2f49; text-align: right;">${certificateCode}</td></tr>
        <tr><td style="padding: 6px 14px; color: #64748b; font-size: 13px;">Completed</td><td style="padding: 6px 14px; font-weight: bold; color: #1c2f49; text-align: right;">${formatDate(completedAt)}</td></tr>
      </table>
      <p style="line-height: 1.6; font-size: 13px; color: #64748b; margin: 0;">
        Anyone can verify this certificate at <a href="${siteUrl}/verify" style="color: #04838c;">${siteUrl.replace(/^https?:\/\//, '')}/verify</a>
        using the ID above.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;" />
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        Focus Vision Clinic · 87 Ipswich Road, Woolloongabba QLD · focusvision.com.au
      </p>
    </div>
  </div>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Your CPD certificate — ${courseTitle}`,
      html,
      attachments: [
        {
          filename: `Focus-Vision-CPD-Certificate-${certificateCode}.pdf`,
          content: Buffer.from(pdfBytes).toString('base64'),
        },
      ],
    }),
  })
  if (!res.ok) {
    // Log the provider detail server-side; the thrown message is surfaced to
    // the client as emailError, so keep it generic.
    const body = await res.text().catch(() => '')
    console.error(`Resend API error ${res.status}:`, body)
    throw new Error('The certificate email could not be sent — you can still download the PDF from My CPD Record')
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
