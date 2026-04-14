/**
 * UnsubscribePage — /unsubscribe
 *
 * CASL-required unsubscribe page. Handles:
 *   ?done=1           — already unsubscribed (redirected here from GET /api/leads/unsubscribe)
 *   ?email=abc@...    — pre-fills the email field
 *
 * Posts to POST /api/v1/leads/unsubscribe
 */
import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ShieldCheck, CheckCircle2, Mail } from 'lucide-react'

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams()
  const done           = searchParams.get('done') === '1'
  const initialEmail   = searchParams.get('email') ?? ''

  const [email,       setEmail]       = useState(initialEmail)
  const [submitted,   setSubmitted]   = useState(done)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/v1/leads/unsubscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? 'Something went wrong')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-16">

      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <ShieldCheck size={16} className="text-white" />
        </div>
        <span className="font-bold text-gray-900 text-lg">TaxLift</span>
      </Link>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 w-full max-w-md">

        {submitted ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={24} className="text-emerald-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">You're unsubscribed</h1>
            <p className="text-sm text-gray-500 mb-6">
              We've removed <strong>{email || 'your address'}</strong> from all TaxLift marketing emails.
              You'll still receive transactional emails (password resets, billing receipts).
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Changed your mind? You can always re-subscribe from your account settings.
            </p>
            <Link
              to="/"
              className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              ← Back to TaxLift
            </Link>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={22} className="text-gray-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 text-center mb-1">Unsubscribe</h1>
            <p className="text-sm text-gray-500 text-center mb-6">
              Enter your email address and we'll remove you from all TaxLift marketing and drip emails.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Processing…' : 'Unsubscribe me'}
              </button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-4">
              You'll still receive transactional emails (password resets, billing receipts).
            </p>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-6">
        TaxLift AI · 100 King Street West, Toronto, ON M5X 1B1
      </p>
    </div>
  )
}
