import { formatDate, formatHours } from '../lib/helpers'
import logoColor from '../assets/logo-color.png'

/**
 * On-screen certificate, visually matched to the generated PDF so the
 * optometrist can screenshot it at the moment of completion.
 */
export default function Certificate({ fullName, courseTitle, presenter, cpdHours, isTherapeutic = false, objectives = [], completedAt, certificateCode }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-sm border-[6px] border-navy bg-white p-2 shadow-lg">
        <div className="border border-teal px-6 py-8 text-center sm:px-12">
          <img src={logoColor} alt="Focus Vision" className="mx-auto h-16 w-16 object-contain sm:h-20 sm:w-20" />
          <div className="mt-2 text-lg font-extrabold tracking-[0.25em] text-navy sm:text-xl">FOCUS VISION</div>

          <div className="mt-6 text-2xl font-bold uppercase tracking-widest text-navy sm:text-3xl">
            Certificate of Completion
          </div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.3em] text-teal">
            Continuing Professional Development
          </div>

          <p className="mt-8 text-sm text-slate-500">This certifies that</p>
          <p className="mt-1 font-serif text-3xl text-navy sm:text-4xl">{fullName}</p>

          <p className="mt-5 text-sm text-slate-500">has successfully completed</p>
          <p className="mx-auto mt-1 max-w-xl text-lg font-bold text-teal-dark sm:text-xl">{courseTitle}</p>

          <p className="mt-4 text-sm text-slate-600">
            Presented by <span className="font-semibold text-navy">{presenter}</span>
          </p>

          <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-8 border-y border-slate-200 py-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">CPD Hours</div>
              <div className="text-lg font-semibold text-navy">
                {formatHours(cpdHours)}
                {isTherapeutic && <span className="ml-1.5 align-middle text-[10px] font-bold uppercase tracking-wider text-teal">(Therapeutic)</span>}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">Completed</div>
              <div className="text-lg font-semibold text-navy">{formatDate(completedAt)}</div>
            </div>
          </div>

          {objectives.length > 0 && (
            <div className="mx-auto mt-6 max-w-xl text-left">
              <div className="text-center text-xs font-bold uppercase tracking-widest text-navy">Learning Objectives</div>
              <ul className="mt-2 space-y-1">
                {objectives.map((o, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-600">
                    <span className="text-teal">•</span>
                    <span>{typeof o === 'string' ? o : o.objective}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-col items-center justify-between gap-1 border-t border-slate-200 pt-4 text-[11px] text-slate-400 sm:flex-row">
            <span>Focus Vision Clinic · 87 Ipswich Road, Woolloongabba QLD</span>
            <span>
              Certificate ID: <span className="font-mono font-semibold text-navy">{certificateCode || 'Pending'}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
