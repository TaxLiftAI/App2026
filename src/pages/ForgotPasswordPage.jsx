/**
 * ForgotPasswordPage — /forgot-password
 * Accepts an email, sends a reset link.
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Zap, ArrowLeft, Mail, Loader2, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const navigate        = useNavigate()
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email) return
    setLoading(true); setError('')
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      // Always show success (prevents email enumeration)
      setSent(true)
    } catch {
      setError('Network error — please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <span className="font-bold text-gray-900 tracking-tight">TaxLift</span>
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 w-full max-w-sm">
        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={28} className="text-emerald-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Check your inbox</h1>
            <p className="text-sm text-gray-500 mb-6">
              If <strong>{email}</strong> has a TaxLift account, we've sent a password reset link. It expires in 1 hour.
            </p>
            <p className="text-xs text-gray-400">
              Didn't get it? Check your spam folder or{' '}
              <button onClick={() => setSent(false)} className="text-indigo-500 hover:underline">try again</button>.
            </p>
          </div>
        ) : (
          <>
            <button onClick={() => navigate('/login')} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-6 transition-colors">
              <ArrowLeft size={13} /> Back to login
            </button>
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-5">
              <Mail size={22} className="text-indigo-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Forgot your password?</h1>
            <p className="text-sm text-gray-500 mb-7">Enter your email and we'll send you a reset link.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email address</label>
                <input
                  type="email" required autoFocus
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit" disabled={loading || !email}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
              >
                {loading ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Remember your password?{' '}
        <Link to="/login" className="text-indigo-500 hover:underline">Log in</Link>
      </p>
    </div>
  )
}
