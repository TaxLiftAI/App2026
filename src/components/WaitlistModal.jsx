/**
 * WaitlistModal — lead capture form for marketing CTAs.
 *
 * Props:
 *   isOpen       {boolean}
 *   onClose      {function}
 *   defaultPlan  {string}   — pre-selects plan dropdown ('starter'|'growth'|'enterprise'|'')
 *   source       {string}   — tracking source tag ('hero'|'pricing'|'cpa_section'|...)
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Loader2, CheckCircle2, ArrowRight } from 'lucide-react'
import { leads } from '../lib/api'

const PLAN_OPTIONS = [
  { value: '',           label: 'Not sure yet' },
  { value: 'starter',   label: 'SR&ED Filing Package — $999 flat fee' },
  { value: 'plus',      label: 'CPA Partner Seat — custom pricing' },
  { value: 'enterprise', label: 'Enterprise — Custom' },
]

export default function WaitlistModal({ isOpen, onClose, defaultPlan = '', source = 'marketing' }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', company: '', plan_interest: defaultPlan })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')

  // Reset when reopened or defaultPlan changes
  useEffect(() => {
    if (isOpen) {
      setForm(f => ({ ...f, plan_interest: defaultPlan }))
      setSuccess(false)
      setError('')
    }
  }, [isOpen, defaultPlan])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!isOpen) return null

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.email.trim()) { setError('Email is required'); return }

    setLoading(true)
    try {
      await leads.capture({ ...form, source })
      setSuccess(true)
    } catch (err) {
      setError(err?.message ?? 'Something went wrong — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Join the waitlist"
      >
        <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          <div className="p-8">
            {success ? (
              /* Success state — keep user in the funnel */
              <div className="text-center">
                <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-500" />
                <h2 className="mb-2 text-2xl font-bold text-slate-900">You're on the list!</h2>
                <p className="mb-6 text-slate-600">
                  We'll reach out to <strong>{form.email}</strong> within 24 hours. While you wait,
                  run your free SR&ED scan — no account needed.
                </p>
                <button
                  onClick={() => { onClose(); navigate('/scan') }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 mb-3"
                >
                  Start your free scan now <ArrowRight size={15} />
                </button>
                <button
                  onClick={onClose}
                  className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  I'll do it later
                </button>
              </div>
            ) : (
              /* Form state */
              <>
                <h2 className="mb-1 text-2xl font-bold text-slate-900">Get early access</h2>
                <p className="mb-6 text-sm text-slate-500">
                  Join the waitlist — we're onboarding firms on a rolling basis.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Full name
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={set('name')}
                      placeholder="Margaret Chen"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Work email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={set('email')}
                      placeholder="margaret@crowe.ca"
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Firm / company
                    </label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={set('company')}
                      placeholder="Crowe MacKay LLP"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Plan interest
                    </label>
                    <select
                      value={form.plan_interest}
                      onChange={set('plan_interest')}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {PLAN_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {error && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    Join the waitlist
                  </button>

                  <p className="text-center text-xs text-slate-400">
                    No spam. Unsubscribe at any time.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
