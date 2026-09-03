import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useDocumentHead from '../lib/useDocumentHead'

export default function Login() {
  useDocumentHead({ title: 'Log in', description: 'Log in to the Focus Vision CPD Portal to watch presentations, complete quizzes and download your CPD certificates.' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [unverified, setUnverified] = useState(false)
  const [resendState, setResendState] = useState('') // '' | 'sending' | 'sent' | error message
  const navigate = useNavigate()
  const location = useLocation()

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setUnverified(false)
    setResendState('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      if (error.message === 'Email not confirmed') {
        setUnverified(true)
        setError('Please verify your email first — check your inbox for the confirmation link.')
      } else {
        setError(error.message)
      }
      return
    }
    navigate(location.state?.from || '/courses', { replace: true })
  }

  async function resendVerification() {
    setResendState('sending')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    })
    setResendState(error ? error.message : 'sent')
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold text-navy">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">CPD education for optometrists.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {unverified && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {resendState === 'sent' ? (
                'Verification email re-sent — check your inbox.'
              ) : (
                <>
                  Didn&apos;t get the email?{' '}
                  <button type="button" onClick={resendVerification} disabled={resendState === 'sending'} className="font-bold underline">
                    {resendState === 'sending' ? 'Sending…' : 'Resend verification email'}
                  </button>
                  {resendState && resendState !== 'sending' && resendState !== 'sent' && (
                    <span className="block text-red-600">{resendState}</span>
                  )}
                </>
              )}
            </div>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className="font-semibold text-teal hover:underline">Forgot your password?</Link>
        </p>
        <p className="mt-4 text-center text-sm text-slate-500">
          New to the portal?{' '}
          <Link to="/register" className="font-semibold text-teal hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  )
}
