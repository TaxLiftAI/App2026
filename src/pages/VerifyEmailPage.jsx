/**
 * VerifyEmailPage — /verify-email?token=xxx
 *
 * Handles the link from the verification email.
 * States: loading → success | expired | invalid
 */
import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Clock, Zap, ArrowRight, Loader2, RefreshCw } from 'lucide-react'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const token          = searchParams.get('token')

  const [state,   setState]   = useState('loading')  // loading | success | already | expired | invalid | no_token
  const [message, setMessage] = useState('')
  const [resending, setResending] = useState(false)
  const [resent,    setResent]    = useState(false)

  useEffect(() => {
    if (!token) { setState('no_token'); return }

    fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.already) { setState('already'); setMessage(data.message); return }
        if (data.ok)                 { setState('success'); setMessage(data.message); return }
        if (data.expired)            { setState('expired'); setMessage(data.message); return }
        setState('invalid'); setMessage(data.message || 'Invalid verification link.')
      })
      .catch(() => { setState('invalid'); setMessage('Network error — please try again.') })
  }, [token])

  async function handleResend() {
    setResending(true)
    try {
      const res = await api.post('/api/auth/resend-verification')
      if (res.ok) { setResent(true) }
    } catch {
      // user not authenticated — redirect to login so they can log in and resend from banner
      navigate('/login')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <button onClick={() => navigate('/')} className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <span className="font-bold text-gray-900 tracking-tight">TaxLift</span>
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 w-full max-w-md text-center">

        {state === 'loading' && (
          <>
            <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <Loader2 size={28} className="text-indigo-500 animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Verifying your email…</h1>
            <p className="text-sm text-gray-500">Just a moment.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={28} className="text-emerald-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Email verified!</h1>
            <p className="text-sm text-gray-500 mb-8">{message || "Your account is now fully active. Let\u2019s build your SR&ED claim."}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              Go to dashboard <ArrowRight size={15} />
            </button>
          </>
        )}

        {state === 'already' && (
          <>
            <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={28} className="text-indigo-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Already verified</h1>
            <p className="text-sm text-gray-500 mb-8">{message}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              Go to dashboard <ArrowRight size={15} />
            </button>
          </>
        )}

        {state === 'expired' && (
          <>
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <Clock size={28} className="text-amber-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Link expired</h1>
            <p className="text-sm text-gray-500 mb-8">
              This verification link is more than 48 hours old. Request a new one and we'll send a fresh link right away.
            </p>
            {resent ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium">
                ✓ New verification email sent — check your inbox.
              </div>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
              >
                {resending ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <><RefreshCw size={15} /> Resend verification email</>}
              </button>
            )}
          </>
        )}

        {(state === 'invalid' || state === 'no_token') && (
          <>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <XCircle size={28} className="text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {state === 'no_token' ? 'No token provided' : 'Invalid link'}
            </h1>
            <p className="text-sm text-gray-500 mb-8">
              {state === 'no_token'
                ? 'This page requires a verification token from your email. Check your inbox for the verification email from TaxLift.'
                : (message || 'This link is invalid or has already been used. Log in and request a new verification email from your account banner.')}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
              >
                Log in to your account
              </button>
              <button
                onClick={() => navigate('/')}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Back to homepage
              </button>
            </div>
          </>
        )}

      </div>

      <p className="mt-6 text-xs text-gray-400">
        Need help?{' '}
        <a href="mailto:hello@taxlift.ai" className="text-indigo-500 hover:underline">hello@taxlift.ai</a>
      </p>
    </div>
  )
}
