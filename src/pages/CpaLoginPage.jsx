/**
 * CpaLoginPage — /cpa/login
 *
 * Separate login entry-point for CPA partner firms.
 * Visually distinct from the client LoginPage to avoid confusion.
 * On success, routes to /cpa-portal (multi-client CPA dashboard).
 *
 * Auth flow:
 *   Real mode  → POST /auth/login (same endpoint, role:'CPA' returned)
 *   Demo mode  → loginCpaDemo() → sets a CPA persona from CPA_FIRM mock data
 */
import { useState, useEffect } from 'react'
import { useNavigate, Link }   from 'react-router-dom'
import {
  Building2, Loader2, AlertCircle, ArrowRight,
  ShieldCheck, Users, DollarSign, CheckCircle2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// ── What CPAs see on the left panel ───────────────────────────────────────────
const PARTNER_PERKS = [
  { icon: Users,        text: 'Single dashboard across all referred clients'         },
  { icon: ShieldCheck,  text: 'Audit-ready T661 packages — no prep work required'   },
  { icon: DollarSign,   text: 'Flat referral fee $750–$9,000 per client — paid at package delivery' },
  { icon: CheckCircle2, text: 'Co-branded packages under your firm name'            },
]

export default function CpaLoginPage() {
  const { currentUser, loginWithCredentials, loginCpaDemo, authError } = useAuth()
  const navigate = useNavigate()

  // Redirect if already authenticated as CPA
  useEffect(() => {
    if (currentUser?.role === 'CPA') navigate('/cpa-portal', { replace: true })
  }, [currentUser]) // eslint-disable-line

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [localError, setLocalError] = useState(null)
  const [mode,       setMode]       = useState('real') // 'real' | 'demo'

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) { setLocalError('Please enter your email and password.'); return }
    setLocalError(null)
    setLoading(true)
    const result = await loginWithCredentials(email, password)
    setLoading(false)
    if (result.ok) navigate('/cpa-portal')
  }

  function handleDemoLogin() {
    if (loginCpaDemo) {
      loginCpaDemo()
      // Don't navigate here — loginCpaDemo schedules an async state update.
      // The useEffect above fires once currentUser is committed and navigates correctly.
    }
  }

  const displayError = localError || authError

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex">

      {/* ── Left panel — value prop ── */}
      <div className="hidden lg:flex flex-col justify-center px-16 w-[44%] text-white">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-base leading-none">TaxLift</p>
            <p className="text-slate-400 text-xs mt-0.5">Partner Portal</p>
          </div>
        </div>

        <h2 className="text-3xl font-extrabold leading-tight mb-3">
          One login.<br />All your SR&amp;ED clients.
        </h2>
        <p className="text-slate-300 text-sm leading-relaxed mb-10 max-w-xs">
          TaxLift prepares the complete T661 package. You review, sign, and file.
          No more chasing engineers for documentation.
        </p>

        <div className="space-y-4">
          {PARTNER_PERKS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-indigo-300" />
              </div>
              <p className="text-sm text-slate-200">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck size={13} />
          <span>Not a partner yet?</span>
          <Link to="/partners" className="text-indigo-400 hover:text-indigo-300 underline">
            Apply for free →
          </Link>
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2 text-white">
              <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center">
                <Building2 size={18} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm leading-none">TaxLift</p>
                <p className="text-slate-400 text-[11px]">Partner Portal</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-7">
            <h1 className="text-lg font-bold text-gray-900 mb-1">CPA Firm Sign In</h1>
            <p className="text-xs text-gray-500 mb-5">
              Access your partner dashboard and client packages
            </p>

            {/* Mode toggle */}
            <div className="flex rounded-lg bg-gray-100 p-1 mb-5 gap-1">
              {['real', 'demo'].map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setLocalError(null) }}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                    mode === m
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m === 'real' ? 'Sign in' : 'Demo mode'}
                </button>
              ))}
            </div>

            {/* Error */}
            {displayError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs mb-4">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{displayError}</span>
              </div>
            )}

            {/* Real login */}
            {mode === 'real' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Firm email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="partner@yourfirm.ca"
                    autoComplete="email"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                >
                  {loading ? (
                    <><Loader2 size={14} className="animate-spin" /> Signing in…</>
                  ) : (
                    <>Sign in to Partner Portal <ArrowRight size={14} /></>
                  )}
                </button>

                <p className="text-center text-[11px] text-gray-400">
                  Not a partner yet?{' '}
                  <Link to="/partners" className="text-indigo-600 hover:underline font-medium">
                    Apply free →
                  </Link>
                </p>
              </form>
            )}

            {/* Demo login */}
            {mode === 'demo' && (
              <div className="space-y-4">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-indigo-800 mb-1">Demo: Hartwell & Associates CPA</p>
                  <p className="text-[11px] text-indigo-600 leading-relaxed">
                    3 referred clients · $247K credit pipeline · $5,500 referral fee earned
                  </p>
                </div>
                <button
                  onClick={handleDemoLogin}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                >
                  Enter CPA demo <ArrowRight size={14} />
                </button>
                <p className="text-[11px] text-gray-400 text-center">
                  Uses synthetic data. Nothing is sent to a server.
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-5 pt-4 border-t border-gray-100 text-center">
              <p className="text-[11px] text-gray-400">
                Not a CPA?{' '}
                <Link to="/login" className="text-indigo-600 hover:underline">
                  Client login →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
