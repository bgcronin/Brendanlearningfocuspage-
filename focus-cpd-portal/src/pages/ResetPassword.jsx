import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Loading } from '../components/Protected'

/**
 * Landing page for the Supabase password-recovery email link.
 * The link signs the user in automatically (recovery session);
 * this page just sets the new password.
 */
export default function ResetPassword() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session === undefined) return <Loading />

  if (!session) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold text-navy">Reset link invalid or expired</h1>
        <p className="mt-2 text-sm text-slate-500">
          Password reset links only work once and expire after a short time. Please request a new one.
        </p>
        <Link to="/forgot-password" className="btn-primary mt-6">Request a new link</Link>
      </div>
    )
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/courses', { replace: true })
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold text-navy">Choose a new password</h1>
        <p className="mt-1 text-sm text-slate-500">You&apos;re signed in — set your new password below.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="password">New password</label>
            <input id="password" type="password" required minLength={8} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm new password</label>
            <input id="confirm" type="password" required minLength={8} className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
