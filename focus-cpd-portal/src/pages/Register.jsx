import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { normalizeAhpra } from '../lib/helpers'
import useDocumentHead from '../lib/useDocumentHead'

export default function Register() {
  useDocumentHead({ title: 'Create your free account', description: "Register for free CPD for optometrists: presentations by Focus Vision's corneal, cataract and refractive specialists, with instant emailed certificates." })
  const [form, setForm] = useState({ full_name: '', email: '', practice_name: '', ahpra_number: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const ahpra = normalizeAhpra(form.ahpra_number)
    if (ahpra.error) {
      setError(ahpra.error)
      return
    }
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: form.full_name.trim(),
          practice_name: form.practice_name.trim(),
          ahpra_number: ahpra.value,
        },
      },
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    // If email confirmation is disabled in Supabase, signUp returns a live
    // session — go straight in rather than telling them to check email.
    if (data?.session) {
      navigate('/courses', { replace: true })
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-pale">
          <svg className="h-7 w-7 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-semibold text-navy">Check your email</h1>
        <p className="mt-2 text-sm text-slate-500">
          We&apos;ve sent a verification link to <span className="font-semibold text-navy">{form.email}</span>.
          Click it to activate your account, then sign in.
        </p>
        <Link to="/login" className="btn-secondary mt-6">Back to sign in</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold text-navy">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">For optometrists completing CPD with Focus Vision.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="full_name">Full name</label>
            <input id="full_name" required className="input" value={form.full_name} onChange={set('full_name')} placeholder="e.g. Jane Citizen" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="input" value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label className="label" htmlFor="practice_name">Practice name</label>
            <input id="practice_name" required className="input" value={form.practice_name} onChange={set('practice_name')} />
          </div>
          <div>
            <label className="label" htmlFor="ahpra">
              AHPRA registration number <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input id="ahpra" className="input" value={form.ahpra_number} onChange={set('ahpra_number')} placeholder="OPT0000000000" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={8} className="input" value={form.password} onChange={set('password')} />
            <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Creating account…' : 'Create account'}
          </button>
          <p className="text-center text-xs leading-relaxed text-slate-400">
            By creating an account you agree to our{' '}
            <Link to="/privacy" className="font-semibold text-teal hover:underline">Privacy Policy</Link>, which
            explains how we handle your details and CPD records.
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-teal hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
