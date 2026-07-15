import { supabase } from './supabase'

/** Create a short-lived signed URL for a file in a private bucket. */
export async function signedUrl(bucket, path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

/**
 * Open a private-bucket file in a new tab, popup-blocker-safe. The tab is
 * opened synchronously inside the click handler (before we await the signed
 * URL) so Safari/iOS don't block it; the URL is set once it resolves.
 */
export async function openSigned(bucket, path, expiresIn = 300) {
  const win = window.open('', '_blank')
  try {
    const url = await signedUrl(bucket, path, expiresIn)
    if (win) {
      win.opener = null
      win.location = url
    } else {
      window.location.assign(url) // popups fully blocked — navigate instead
    }
  } catch (e) {
    if (win) win.close()
    throw e
  }
}

/**
 * Convert a pasted YouTube/Vimeo link into an embeddable iframe src.
 * Returns '' for anything that is not an https(s) YouTube/Vimeo video, so an
 * admin cannot store a `javascript:`/`data:`/arbitrary-host iframe source.
 */
export function toEmbedUrl(url) {
  if (!url) return ''
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1)
      return id ? `https://www.youtube.com/embed/${id}` : ''
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname.startsWith('/embed/')) return url
      if (u.pathname.startsWith('/shorts/')) return `https://www.youtube.com/embed/${u.pathname.split('/')[2]}`
      if (u.pathname.startsWith('/live/')) return `https://www.youtube.com/embed/${u.pathname.split('/')[2]}`
      const v = u.searchParams.get('v')
      return v ? `https://www.youtube.com/embed/${v}` : '' // playlist/channel isn't embeddable
    }
    if (host === 'vimeo.com') {
      const segs = u.pathname.split('/').filter(Boolean)
      const id = segs[0]
      if (!id || !/^\d+$/.test(id)) return ''
      // Unlisted videos share as vimeo.com/{id}/{privacy-hash}; the player
      // needs ?h={hash} or it refuses to play.
      const hash = segs[1]
      return `https://player.vimeo.com/video/${id}${hash ? `?h=${encodeURIComponent(hash)}` : ''}`
    }
    if (host === 'player.vimeo.com') return url
  } catch {
    /* not a URL */
  }
  return '' // unrecognised host — not an allowed embed target
}

export function formatDate(iso) {
  if (!iso) return '—'
  // Pinned to Brisbane so on-screen dates always match the PDF certificate.
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' })
}

export function formatHours(h) {
  const n = Number(h)
  return Number.isInteger(n) ? `${n}.0` : `${n}`
}

/** Download an array of objects as a CSV file. */
export function downloadCsv(filename, rows, columns) {
  const esc = (v) => {
    let s = v === null || v === undefined ? '' : String(v)
    // Neutralise spreadsheet formula injection: a leading =, +, -, @, tab or
    // CR in a user-controlled field (name, practice, AHPRA…) would otherwise
    // execute when the CSV is opened in Excel/Sheets.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map((c) => esc(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => esc(c.value(r))).join(',')).join('\n')
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/** PostgREST one-to-one embeds can arrive as object or single-item array. */
export function one(rel) {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null
}

/**
 * Fetch EVERY row of a query in pages. PostgREST silently caps a single
 * response at 1000 rows, which was quietly truncating the admin dashboards,
 * the CPD audit CSV and the analytics. `build` must return a fresh query
 * (filters/order applied, no .range()) each time it's called.
 */
export async function fetchAllRows(build, pageSize = 1000) {
  const all = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    all.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return { data: all, error: null }
}
