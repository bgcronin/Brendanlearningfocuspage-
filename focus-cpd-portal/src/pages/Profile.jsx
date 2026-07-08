import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Loading } from '../components/Protected'

/**
 * Self-service profile editing. The full name entered here is what
 * appears on future certificates, so typos made at registration can
 * be fixed without contacting the clinic.
 */
export default function Profile() {
  const { profile, profileLoading, refreshProfile } = useAuth()
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile && !form) {
      setForm({
        full_name: profile.full_name,
        practice_name: profile.practice_name,
        ahpra_number: profile.ahpra_number,
      })
    }
  }, [profile, form])

  if (profileLoading || !form) return <Loading />

  const set = (k) => (e) => {
    setSaved(false)
    setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setSaved(false)
    if (!form.full_name.trim()) {
      setError('Full name is required — it appears on your certificates.')
      return
    }
    setBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        practice_name: form.practice_name.trim(),
        ahpra_number: form.ahpra_number.trim(),
      })
      .eq('id', profile.id)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    await refreshProfile()
    setSaved(true)
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold text-navy">My profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your full name appears on new certificates — keep it accurate.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input bg-slate-50 text-slate-500" value={profile.email} disabled />
            <p className="mt-1 text-xs text-slate-400">Contact Focus Vision to change your email address.</p>
          </div>
          <div>
            <label className="label" htmlFor="full_name">Full name</label>
            <input id="full_name" required className="input" value={form.full_name} onChange={set('full_name')} />
          </div>
          <div>
            <label className="label" htmlFor="practice_name">Practice name</label>
            <input id="practice_name" className="input" value={form.practice_name} onChange={set('practice_name')} />
          </div>
          <div>
            <label className="label" htmlFor="ahpra">
              AHPRA registration number <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input id="ahpra" className="input" value={form.ahpra_number} onChange={set('ahpra_number')} placeholder="OPT0000000000" />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Profile saved.</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400">
          Note: certificates that have already been issued keep the name they were issued with.
        </p>
      </div>
    </div>
  )
}
