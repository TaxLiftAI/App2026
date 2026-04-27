import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { ShieldCheck, ChevronDown, Loader2, AlertCircle, FlaskConical } from 'lucide-react'
import { useAuth, DEMO_PERSONAS } from '../context/AuthContext'
import Button from '../components/ui/Button'

export default function LoginPage() {
  const { currentUser, isDemoMode, loginWithCredentials, loginDemo, authError } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // After loginDemo commits state, navigate to dashboard.
  // useEffect fires post-commit, guaranteeing currentUser is set
  // by the time ProtectedRoute renders (avoids the race condition
  // where navigate() fires before React commits setCurrentUser).
  useEffect(() => {
    if (currentUser && isDemoMode) {
      navigate('/dashboard', { replace: true })
    }
  }, [currentUser, isDemoMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mode: 'real' | 'demo'
  // ?mode=demo in the URL (linked from the homepage demo CTA) auto-selects demo tab
  const [mode, setMode]           = useState(() => searchParams.get('mode') === 'demo' ? 'demo' : 'real')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [localError, setLocalError] = useState(null)

  // Demo persona picker
  const [demoUserId, setDemoUserId] = useState(DEMO_PERSONAS[0].userId)

  async function handleRealLogin(e) {
    e.preventDefault()
    if (!email || !password) {
      setLocalError('Please enter your email and password.')
      return
    }
    setLocalError(null)
    setLoading(true)
    const result = await loginWithCredentials(email, password)
    setLoading(false)
    if (result.ok) navigate(result.onboarding_completed ? '/dashboard' : '/onboarding')
  }

  function handleDemoLogin() {
    loginDemo(demoUserId)
    // navigate is intentionally omitted — loginDemo sets currentUser, which causes
    // the /login route element (currentUser ? <Navigate to="/dashboard"> : <LoginPage>)
    // to redirect automatically on the next render, avoiding the race condition
    // where navigate fires before the state update commits.
  }

  const displayError = localError || authError

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-500 rounded-2xl mb-4 shadow-lg shadow-indigo-500/30">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">TaxLift</h1>
          <p className="text-slate-400 text-sm mt-1">R&D Tax Credit Compliance Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-7">

          {/* Mode toggle */}
          <div className="flex rounded-lg bg-gray-100 p-1 mb-5">
            <button
              onClick={() => { setMode('real'); setLocalError(null) }}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                mode === 'real'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setMode('demo'); setLocalError(null) }}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1 ${
                mode === 'demo'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FlaskConical size={11} />
              Demo mode
            </button>
          </div>

          {/* Error banner */}
          {displayError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs mb-4">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{displayError}</span>
            </div>
          )}

          {/* ── Real login form ── */}
          {mode === 'real' && (
            <form onSubmit={handleRealLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-xs font-medium text-gray-700">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-[11px] text-indigo-600 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <Button
                type="submit"
                className="w-full justify-center"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Signing in…
                  </span>
                ) : 'Sign in'}
              </Button>

              {/* Hint to switch to demo */}
              <p className="text-center text-[11px] text-gray-400">
                No account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('demo')}
                  className="text-indigo-600 hover:underline font-medium"
                >
                  Try demo mode
                </button>
              </p>
            </form>
          )}

          {/* ── Demo login form ── */}
          {mode === 'demo' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="login-demo-account" className="block text-xs font-medium text-gray-700 mb-1.5">
                  Demo account
                </label>
                <div className="relative">
                  <select
                    id="login-demo-account"
                    name="demoAccount"
                    value={demoUserId}
                    onChange={e => setDemoUserId(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-8"
                  >
                    {DEMO_PERSONAS.map(p => (
                      <option key={p.userId} value={p.userId}>{p.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <Button className="w-full justify-center" onClick={handleDemoLogin}>
                Enter demo
              </Button>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
            {mode === 'real' && (
              <p className="text-xs text-gray-500 text-center">
                Don\u2019t have an account?{' '}
                <Link to="/signup" className="text-indigo-600 hover:underline font-medium">
                  Create one free →
                </Link>
              </p>
            )}
            <p className="text-[10px] text-gray-400 text-center leading-relaxed">
              {mode === 'demo'
                ? 'Demo mode uses synthetic data. No data is sent to a server.'
                : 'Default dev credentials: admin@taxlift.dev / Admin1234!'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
