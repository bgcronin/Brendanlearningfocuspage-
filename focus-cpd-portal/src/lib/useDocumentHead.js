import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE = 'https://cpd.focusvision.com.au'
const DEFAULT_TITLE = 'Focus Vision CPD Portal'
const DEFAULT_DESCRIPTION =
  'Free online CPD for optometrists from Focus Vision Brisbane: video presentations by corneal, cataract and refractive specialists, short quizzes, instant emailed CPD certificates, a permanent CPD record, and public certificate verification.'

function setDescription(content) {
  let el = document.head.querySelector('meta[name="description"]')
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', 'description')
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!href) {
    if (el) el.remove()
    return
  }
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

// Only ever touches a robots tag this hook created (data-route), so the
// build-time VITE_NOINDEX tag for previews/staging is left alone.
function setRouteRobots(content) {
  let el = document.head.querySelector('meta[name="robots"][data-route]')
  if (!content) {
    if (el) el.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', 'robots')
    el.setAttribute('data-route', '')
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * Per-route <head> for the SPA: title, meta description, a canonical that is
 * this route's own URL (no query string), and an optional robots directive.
 * Public pages call it with their own title/description; the not-found route
 * passes { canonical: false, robots: 'noindex' }.
 */
export default function useDocumentHead({ title, description, canonical = true, robots } = {}) {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = title ? `${title} | ${DEFAULT_TITLE}` : DEFAULT_TITLE
    setDescription(description || DEFAULT_DESCRIPTION)
    setCanonical(canonical ? SITE + pathname : null)
    setRouteRobots(robots || null)
    return () => setRouteRobots(null)
  }, [title, description, canonical, robots, pathname])
}
