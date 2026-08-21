import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { supabase, IS_DEMO } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import logoWhite from '../assets/logo-white.png'

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-semibold transition ${
    isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`

export default function Layout({ children }) {
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col">
      {IS_DEMO && (
        <div className="bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-navy">
          Demo mode — sample data only. Sign-in accepts anything; emails &amp; PDF downloads are simulated. No Supabase connected.
        </div>
      )}
      <header className="bg-navy">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to={session ? '/courses' : '/login'} className="flex items-center gap-3">
            <img src={logoWhite} alt="Focus Vision" className="h-10 w-10 object-contain" />
            <div className="leading-tight">
              <div className="font-bold tracking-wide text-white">FOCUS VISION</div>
              <div className="text-xs font-medium uppercase tracking-widest text-teal-light">CPD Portal</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {session && (
              <>
                <NavLink to="/courses" className={navLinkClass}>Courses</NavLink>
                <NavLink to="/my-cpd" className={navLinkClass}>My CPD Record</NavLink>
                <NavLink to="/profile" className={navLinkClass}>Profile</NavLink>
              </>
            )}
            <NavLink to="/verify" className={navLinkClass}>Verify Certificate</NavLink>
            {profile?.is_admin && <NavLink to="/admin" className={navLinkClass}>Admin</NavLink>}
            {session ? (
              <button onClick={signOut} className="ml-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
                Sign out
              </button>
            ) : (
              <NavLink to="/login" className={navLinkClass}>Sign in</NavLink>
            )}
          </nav>

          {/* Mobile menu button */}
          <button
            className="rounded-lg p-2 text-white md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {menuOpen ? <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <nav className="flex flex-col gap-1 border-t border-white/10 px-4 py-3 md:hidden" onClick={() => setMenuOpen(false)}>
            {session && (
              <>
                <NavLink to="/courses" className={navLinkClass}>Courses</NavLink>
                <NavLink to="/my-cpd" className={navLinkClass}>My CPD Record</NavLink>
                <NavLink to="/profile" className={navLinkClass}>Profile</NavLink>
              </>
            )}
            <NavLink to="/verify" className={navLinkClass}>Verify Certificate</NavLink>
            {profile?.is_admin && <NavLink to="/admin" className={navLinkClass}>Admin</NavLink>}
            {session ? (
              <button onClick={signOut} className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white">
                Sign out
              </button>
            ) : (
              <NavLink to="/login" className={navLinkClass}>Sign in</NavLink>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Focus Vision Clinic · Woolloongabba QLD</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="font-medium text-teal hover:underline">Privacy Policy</Link>
            <a href="https://www.focusvision.com.au" target="_blank" rel="noreferrer" className="font-medium text-teal hover:underline">
              focusvision.com.au
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
