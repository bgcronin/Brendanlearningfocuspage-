import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate, formatHours } from '../lib/helpers'
import useDocumentHead from '../lib/useDocumentHead'

export default function VerifyCertificate() {
  useDocumentHead({ title: 'Verify a CPD certificate', description: 'Check the authenticity of a Focus Vision CPD certificate by entering its unique certificate ID. No login required.' })
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null) // null | 'notfound' | record
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setResult(null)
    const { data, error } = await supabase.rpc('verify_certificate', { cert_code: code })
    setBusy(false)
    if (error) {
      setError('Something went wrong — please try again.')
      return
    }
    setResult(data && data.length > 0 ? data[0] : 'notfound')
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold text-navy">Verify a certificate</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter a Focus Vision CPD certificate ID (e.g. <span className="font-mono">FV-2026-A1B2C3</span>) to confirm it&apos;s genuine.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex gap-2">
          <input
            className="input font-mono uppercase"
            placeholder="FV-XXXX-XXXXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <button type="submit" disabled={busy} className="btn-primary shrink-0">
            {busy ? 'Checking…' : 'Verify'}
          </button>
        </form>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {result === 'notfound' && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-700">Not found</p>
            <p className="mt-1 text-sm text-red-600">
              No certificate matches that ID. Check for typos, or contact Focus Vision Clinic if you believe this is an error.
            </p>
          </div>
        )}

        {result && result !== 'notfound' && result.revoked && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5">
            <p className="font-bold text-red-700">Certificate revoked</p>
            <p className="mt-1 text-sm text-red-600">
              Certificate <span className="font-mono font-semibold">{result.certificate_code}</span> was issued but has
              since been revoked by Focus Vision Clinic and is no longer valid. Contact the clinic if you believe this
              is an error.
            </p>
          </div>
        )}

        {result && result !== 'notfound' && !result.revoked && (
          <div className="mt-6 rounded-lg border border-teal/30 bg-teal-pale p-5">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-teal" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="font-bold text-teal-dark">Certificate verified</p>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Certificate ID</dt><dd className="font-mono font-semibold text-navy">{result.certificate_code}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Name</dt><dd className="font-semibold text-navy">{result.full_name}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Course</dt><dd className="text-right font-semibold text-navy">{result.course_title}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">CPD hours</dt><dd className="font-semibold text-navy">{formatHours(result.cpd_hours)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Therapeutic CPD</dt><dd className="font-semibold text-navy">{result.is_therapeutic ? 'Yes' : 'No'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Completed</dt><dd className="font-semibold text-navy">{formatDate(result.completed_at)}</dd></div>
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}
