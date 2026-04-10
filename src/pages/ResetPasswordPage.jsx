/**
 * ResetPasswordPage — /reset-password?token=xxx
 * Validates the reset token on mount, then lets the user set a new password.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Zap, KeyRound, Loader2, CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const navigate             = useNavigate()
  const [params]             = useSearchParams()
  const token                = params.get('token') || ''

  // 'validating' | 'form' | 'success' | 'expired' | 'invalid'
  const [stage, setStage]    = useState('validating')
  const [password, setPassword]   = useState('')
  const [confirm,  setConfirm]    = useState('')
  const [showPw,   setShowPw]     = useState(false)
  const [showCf,   setShowCf]     = useState(false)
  const [loading,  setLoading]    = useState(false)
  const [error,    setError]      = useState('')

  // On mount: validate token exists (we don't ping backend to avoid enumeration;
  // actual validity is checked on submit)
  useEffect(() => {
    if (!token) { setStage('invalid'); return }
    // Small delay so the spinner isn't jarring
    const t = setTimeout(() => setStage('form'), 400)
    return () => clearTimeout(t)
  }, [token])

  function validate() {
    if (password.length < 8)          return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(password))      return 'Include at least one uppercase letter.'
    if (!/[0-9]/.test(password))      return 'Include at least one number.'
    if (password !== confirm)          return 'Passwords do not match.'
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const msg = validate()
    if (msg) { setError(msg); return }
    setLoading(true); setError('')
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'TOKEN_EXPIRED') { setStage('expired'); return }
        setError(data.message || 'Something went wrong. Please try again.')
        return
      }
      setStage('success')
    } catch {
      setError('Network error — please try again.')
    } finally { setLoading(false) }
  }

  // ── Shared chrome ─────────────────────────────────────────────────────────────
  const Logo = () => (
    <button onClick={() => navigate('/')} className="flex items-center gap-2 mb-10">
      <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
        <Zap size={16} className="text-white" />
      </div>
      <span className="font-bold text-gray-900 tracking-tight">TaxLift</span>
    </button>
  )

  const Card = ({ children }) => (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <Logo />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 w-full max-w-sm">
        {children}
      </div>
      <p className="mt-6 text-xs text-gray-400">
        Remember your password?{' '}
        <Link to="/login" className="text-indigo-500 hover:underline">Log in</Link>
      </p>
    </div>
  )

  // ── Validating ────────────────────────────────────────────────────────────────
  if (stage === 'validating') return (
    <Card>
      <div className="flex flex-col items-center py-4">
        <Loader2 size={28} className="animate-spin text-indigo-600 mb-4" />
        <p className="text-sm text-gray-500">Checking your reset link…</p>
      </div>
    </Card>
  )

  // ── No token ──────────────────────────────────────────────────────────────────
  if (stage === 'invalid') return (
    <Card>
      <div className="text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={28} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid link</h1>
        <p className="text-sm text-gray-500 mb-6">
          This password reset link is missing or malformed. Please request a new one.
        </p>
        <Link
          to="/forgot-password"
          className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
        >
          Request new link
        </Link>
      </div>
    </Card>
  )

  // ── Expired ───────────────────────────────────────────────────────────────────
  if (stage === 'expired') return (
    <Card>
      <div className="text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={28} className="text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Link expired</h1>
        <p className="text-sm text-gray-500 mb-6">
          Password reset links are valid for 1 hour. This one has expired — request a fresh link below.
        </p>
        <Link
          to="/forgot-password"
          className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
        >
          Request new link
        </Link>
      </div>
    </Card>
  )

  // ── Success ───────────────────────────────────────────────────────────────────
  if (stage === 'success') return (
    <Card>
      <div className="text-center">
        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={28} className="text-emerald-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Password updated!</h1>
        <p className="text-sm text-gray-500 mb-6">
          Your password has been changed. You can now sign in with your new credentials.
        </p>
        <Link
          to="/login"
          className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
        >
          Go to login
        </Link>
      </div>
    </Card>
  )

  // ── Password form ─────────────────────────────────────────────────────────────
  return (
    <Card>
      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-5">
        <KeyRound size={22} className="text-indigo-600" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Set new password</h1>
      <p className="text-sm text-gray-500 mb-7">
        Choose a strong password — at least 8 characters with one uppercase letter and one number.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New password */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">New password</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              required autoFocus
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Confirm password</label>
          <div className="relative">
            <input
              type={showCf ? 'text' : 'password'}
              required
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError('') }}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowCf(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showCf ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Strength indicator */}
        {password.length > 0 && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[
                password.length >= 8,
                /[A-Z]/.test(password),
                /[0-9]/.test(password),
                /[^A-Za-z0-9]/.test(password),
              ].map((met, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${met ? 'bg-indigo-500' : 'bg-gray-200'}`}
                />
              ))}
            </div>
            <p className="text-[10px] text-gray-400">
              {(() => {
                const score = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length
                return ['Too short', 'Weak', 'Fair', 'Strong', 'Very strong'][score]
              })()}
            </p>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password || !confirm}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
        >
          {loading ? <><Loader2 size={15} className="animate-spin" /> Updating…</> : 'Update password'}
        </button>
      </form>
    </Card>
  )
}
