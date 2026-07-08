import { useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Optional learning reflection attached to a completion — supports the
 * OBA CPD portfolio requirement ("what I learned / how I'll apply it").
 * Users can only update the reflection column on their own completions
 * (enforced by RLS + a column-level grant).
 */
export default function ReflectionEditor({ completionId, initial = '', compact = false, onSaved }) {
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setBusy(true)
    setError('')
    setSaved(false)
    const { error } = await supabase
      .from('completions')
      .update({ reflection: text.trim() })
      .eq('id', completionId)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setSaved(true)
    onSaved?.(text.trim())
  }

  return (
    <div>
      {!compact && (
        <p className="text-sm text-slate-500">
          A short note on what you learned and how you&apos;ll apply it in practice — useful for your
          CPD portfolio. Only you (and Focus Vision staff) can see it.
        </p>
      )}
      <textarea
        className="input mt-3 min-h-24"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setSaved(false)
        }}
        placeholder="e.g. I'll start reviewing posterior elevation maps when screening young astigmats…"
      />
      <div className="mt-2 flex items-center gap-3">
        <button onClick={save} disabled={busy || text.trim() === (initial ?? '').trim()} className="btn-primary !px-4 !py-2 text-sm">
          {busy ? 'Saving…' : 'Save reflection'}
        </button>
        {saved && <span className="text-sm font-medium text-emerald-700">Saved.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}
