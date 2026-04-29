/**
 * SignupPage — /signup
 *
 * New account creation. Entry points:
 *   1. CheckoutSuccessPage  → /signup?plan=plus&from=checkout
 *   2. PricingPage          → /signup?plan=starter
 *   3. ScanResultsPage      → /signup (after lock CTA)
 *   4. Direct navigation    → /signup
 *
 * On success:
 *   - Associates any pending free scan with the new user_id
 *   - Redirects to /quick-connect (onboarding) or /dashboard
 *
 * URL params:
 *   plan        — plan the user just purchased (shown in header)
 *   from        — 'checkout' shows a "payment confirmed" badge
 *   estimate    — credit estimate from scan (shown as motivation)
 */
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  ShieldCheck, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle,
  Sparkles, ArrowRight, Zap,
} from 'lucide-react'
import { useAuth }                   from '../context/AuthContext'
import { referrals as referralsApi } from '../lib/api'
import TaxLiftLogo from '../components/TaxLiftLogo'

const PLAN_LABELS = {
  starter:    'Starter',
  plus:       'Plus',
  enterprise: 'Enterprise',
}

function fmtK(n) {
  const v = Number(n) || 0
  if (!v) return null
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${Math.round(v / 1_000)}K`
  return `$${Math.round(v).toLocaleString('en-CA')}`
}

// Password strength indicator
function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8)                       score++
  if (pw.length >= 12)                      score++
  if (/[A-Z]/.test(pw))                     score++
  if (/[0-9]/.test(pw))                     score++
  if (/[^A-Za-z0-9]/.test(pw))             score++
  if (score <= 1) return { score, label: 'Weak',   color: 'bg-red-500'    }
  if (score <= 2) return { score, label: 'Fair',   color: 'bg-amber-400'  }
  if (score <= 3) return { score, label: 'Good',   color: 'bg-indigo-500' }
  return              { score, label: 'Strong', color: 'bg-emerald-500' }
}

export default function SignupPage() {
  usePageMeta({
    title:       'Create Account — TaxLift SR&ED Platform',
    description: 'Sign up for TaxLift and start your free SR&ED eligibility scan. No credit card required. Connect GitHub or Jira and get your first credit estimate in minutes.',
    path:        '/signup',
  })

  const navigate      = useNavigate()
  const [params]      = useSearchParams()
  const { register, currentUser } = useAuth()

  const plan         = params.get('plan') ?? ''
  const fromCheckout = params.get('from') === 'checkout'
  const estimateRaw  = params.get('estimate')
  const isCpaSignup  = params.get('type') === 'cpa'
  const refToken     = params.get('ref') ?? ''         // CPA referral token

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser) navigate('/dashboard', { replace: true })
  }, [currentUser, navigate])

  // Pre-fill email from scan flow (not for CPA signups — different user journey)
  const [fullName,    setFullName]    = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email,       setEmail]       = useState(() =>
    isCpaSignup ? '' : (localStorage.getItem('taxlift_scan_email') ?? '')
  )
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPw,      setShowPw]      = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const strength = passwordStrength(password)
  const planLabel = PLAN_LABELS[plan] ?? null
  const creditHigh = estimateRaw ? fmtK(Math.round(Number(estimateRaw) * 1.35)) : null

  // Derive credit from scan results if no URL param
  const [scanEstimate, setScanEstimate] = useState(null)
  useEffect(() => {
    if (estimateRaw) return
    try {
      const raw = sessionStorage.getItem('taxlift_scan_results')
        ?? localStorage.getItem('taxlift_scan_results_backup')
      if (raw) {
        const scan = JSON.parse(raw)
        if (scan?.estimated_credit) setScanEstimate(scan.estimated_credit)
      }
    } catch { /* ignore */ }
  }, [estimateRaw])

  const displayCredit = creditHigh ?? (scanEstimate ? fmtK(Math.round(scanEstimate * 1.35)) : null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!fullName.trim())  return setError('Please enter your full name.')
    if (!email.trim())     return setError('Please enter your email address.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm)  return setError('Passwords don\u2019t match.')

    setLoading(true)
    const result = await register({
      email:      email.trim().toLowerCase(),
      password,
      full_name:  fullName.trim(),
      firm_name:  companyName.trim(),
      // Pass cpa role when signing up via the partner CTA on CpaReviewPage
      ...(isCpaSignup ? { role: 'cpa' } : {}),
    })
    setLoading(false)

    if (!result.ok) {
      setError(result.error ?? 'Registration failed. Please try again.')
      return
    }

    // Record referral attribution if a ref token was present in the URL
    if (refToken) {
      referralsApi.intake({
        ref_token:    refToken,
        company_name: companyName.trim() || email.trim(),
        email:        email.trim().toLowerCase(),
        full_name:    fullName.trim(),
      }).catch(() => {}) // fire-and-forget
    }

    // Associate pending free scan with the new account
    try {
      const raw = sessionStorage.getItem('taxlift_scan_results')
        ?? localStorage.getItem('taxlift_scan_results_backup')
      if (raw) {
        const scan = JSON.parse(raw)
        if (scan?.scanId && result.user?.id) {
          fetch(`/api/v1/scan/free/${scan.scanId}/associate`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: result.user.id }),
          }).catch(() => {})
        }
      }
    } catch { /* ignore */ }

    // CPA partners go straight to their portal; everyone else → onboarding
    navigate(isCpaSignup ? '/cpa-portal' : '/quick-connect', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <TaxLiftLogo variant="dark" size="lg" className="mb-3" />
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isCpaSignup ? 'Join as a CPA Partner' : fromCheckout ? 'Create your account' : 'Get started free'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isCpaSignup
              ? 'Earn referral commissions on every SR\u0026ED client you send to TaxLift'
              : fromCheckout
                ? 'Your payment is confirmed — set up your account to access TaxLift'
                : 'SR\u0026ED tax credit automation for Canadian tech companies'}
          </p>
        </div>

        {/* Payment confirmed badge */}
        {fromCheckout && (
          <div className="flex items-center gap-2.5 bg-emerald-900/40 border border-emerald-700/50 rounded-xl px-4 py-3 mb-5">
            <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-emerald-300 text-xs font-semibold">
                Payment confirmed{planLabel ? ` — ${planLabel} plan active` : ''}
              </p>
              <p className="text-emerald-400/70 text-[11px] mt-0.5">
                A receipt has been sent to your email. Create your account below.
              </p>
            </div>
          </div>
        )}

        {/* CPA partner motivation banner */}
        {isCpaSignup && (
          <div className="flex items-start gap-2.5 bg-indigo-900/40 border border-indigo-700/50 rounded-xl px-4 py-3 mb-5">
            <Sparkles size={14} className="text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-300 leading-relaxed">
              <p className="font-semibold text-white mb-0.5">Free to join. Commissions for life.</p>
              Earn <strong className="text-white">0.8% of credits recovered</strong> for every client you refer.
              On a $200K claim, that's $1,600 — for one email.
            </div>
          </div>
        )}

        {/* Scan credit motivation banner */}
        {!fromCheckout && !isCpaSignup && displayCredit && (
          <div className="flex items-center gap-2.5 bg-indigo-900/40 border border-indigo-700/50 rounded-xl px-4 py-3 mb-5">
            <Sparkles size={14} className="text-indigo-400 flex-shrink-0" />
            <p className="text-indigo-300 text-xs">
              Your scan found up to <span className="font-bold text-white">{displayCredit}</span> in estimated SR\u0026ED credits.
              Create an account to unlock your full package.
            </p>
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-7">

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs mb-5">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* Full name */}
            <div>
              <label htmlFor="signup-name" className="block text-xs font-medium text-gray-700 mb-1.5">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                id="signup-name"
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder="Jane Smith"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Company name */}
            <div>
              <label htmlFor="signup-company" className="block text-xs font-medium text-gray-700 mb-1.5">
                Company name
              </label>
              <input
                id="signup-company"
                name="companyName"
                type="text"
                autoComplete="organization"
                placeholder="Acme Corp"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="signup-email" className="block text-xs font-medium text-gray-700 mb-1.5">
                Work email <span className="text-red-500">*</span>
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="jane@acmecorp.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signup-password" className="block text-xs font-medium text-gray-700 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {/* Strength bar */}
              {password && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 flex gap-0.5 h-1">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-colors ${
                          strength.score >= i ? strength.color : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-400">{strength.label}</span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="signup-confirm" className="block text-xs font-medium text-gray-700 mb-1.5">
                Confirm password <span className="text-red-500">*</span>
              </label>
              <input
                id="signup-confirm"
                name="confirmPassword"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className={`w-full bg-gray-50 border rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  confirm && confirm !== password
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200'
                }`}
              />
              {confirm && confirm !== password && (
                <p className="text-xs text-red-500 mt-1">Passwords don\u2019t match</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 rounded-xl transition-colors mt-2 shadow-md shadow-indigo-900/30"
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Creating account…</>
                : isCpaSignup
                  ? <><Zap size={15} /> Create CPA partner account <ArrowRight size={14} /></>
                  : <><Zap size={15} /> Create account &amp; continue <ArrowRight size={14} /></>
              }
            </button>

            {/* Terms note */}
            <p className="text-[10px] text-gray-400 text-center leading-relaxed">
              By creating an account you agree to TaxLift\u2019s{' '}
              <a href="https://taxlift.ai/terms" target="_blank" rel="noreferrer" className="underline hover:text-gray-600">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="https://taxlift.ai/privacy" target="_blank" rel="noreferrer" className="underline hover:text-gray-600">
                Privacy Policy
              </a>.
            </p>
          </form>

          {/* Divider */}
          <div className="mt-5 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-600 hover:underline font-medium">
                Sign in →
              </Link>
            </p>
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-5 flex items-center justify-center gap-6 text-slate-500 text-[11px]">
          {[
            '\u2713 14-day free trial',
            '\u2713 No credit card required',
            '\u2713 CRA compliant',
          ].map(t => <span key={t}>{t}</span>)}
        </div>

      </div>
    </div>
  )
}
