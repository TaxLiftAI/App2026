/**
 * ScanLandingPage — /scan
 *
 * Public entry point for the "first scan free" conversion flow.
 * No account required. Captures email → triggers GitHub OAuth → /scan/repos.
 */
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageMeta } from '../../hooks/usePageMeta'
import {
  Github, ShieldCheck, Zap, Clock, ArrowRight, Lock,
  CheckCircle2, Sparkles, Code2, BarChart3, Send,
} from 'lucide-react'
import {
  getGitHubAuthUrl,
  generateState,
  LS_KEYS,
  GITHUB_CLIENT_ID,
} from '../../lib/oauthConfig'
import { leads } from '../../lib/api'
import TaxLiftLogo from '../../components/TaxLiftLogo'
import TaxLiftChat from '../../components/TaxLiftChat'

const TRUST_BADGES = [
  { Icon: Lock,         text: 'Read-only diff access — no source files stored or copied' },
  { Icon: ShieldCheck,  text: 'No account required to see your results' },
  { Icon: Clock,        text: 'Results in under 60 seconds' },
]

const SOCIAL_PROOF_COMMITS = [
  { sha: 'a3f8b2c', msg: 'experiment: try gradient checkpointing to reduce memory footprint', theme: 'ML / AI' },
  { sha: 'c91d44e', msg: 'spike: evaluate raft consensus vs custom leader election', theme: 'Distributed' },
  { sha: 'e7a120f', msg: 'investigate intermittent OOM in inference pipeline', theme: 'Research' },
  { sha: '8b3d77a', msg: 'poc: zero-knowledge proof for user auth flow', theme: 'Security' },
]

function VcsNotifyCard() {
  const [notifyEmail, setNotifyEmail] = useState('')
  const [notifyState, setNotifyState] = useState('idle') // idle | sending | done | error
  const inputRef = useRef(null)

  async function handleNotify(e) {
    e.preventDefault()
    const clean = notifyEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { inputRef.current?.focus(); return }
    setNotifyState('sending')
    try {
      await leads.capture({ email: clean, source: 'vcs_notify', platform: 'gitlab_bitbucket' })
      setNotifyState('done')
    } catch {
      setNotifyState('done') // still show success — don't penalise network errors
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
      <p className="text-xs text-slate-500 mb-2.5 font-medium">More integrations coming soon</p>
      <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
        {[
          { name: 'GitLab',       icon: '🦊' },
          { name: 'Bitbucket',    icon: '🪣' },
          { name: 'Azure DevOps', icon: '🔷' },
        ].map(p => (
          <div key={p.name} className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-lg px-3 py-1.5">
            <span className="text-sm">{p.icon}</span>
            <span className="text-xs text-slate-400 font-medium">{p.name}</span>
            <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-full px-1.5 py-0.5 font-semibold ml-1">
              Soon
            </span>
          </div>
        ))}
      </div>

      {notifyState === 'done' ? (
        <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-xs font-medium">
          <CheckCircle2 size={13} /> Got it — we'll email you when your platform is live.
        </div>
      ) : (
        <form onSubmit={handleNotify} className="flex gap-2">
          <input
            ref={inputRef}
            type="email"
            value={notifyEmail}
            onChange={e => setNotifyEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 min-w-0 bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
          <button
            type="submit"
            disabled={notifyState === 'sending'}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <Send size={11} /> Notify me
          </button>
        </form>
      )}
    </div>
  )
}

export default function ScanLandingPage() {
  usePageMeta({
    title:       'Free SR&ED Scan — TaxLift',
    description: 'Connect GitHub in 60 seconds and get a free SR&ED eligibility scan. TaxLift identifies qualifying R&D work from your commit history and estimates your CRA tax credit.',
    path:        '/scan',
  })

  const navigate = useNavigate()
  const [email,      setEmail]      = useState('')
  const [touched,    setTouched]    = useState(false)
  const [busy,       setBusy]       = useState(false)
  const [oauthError, setOauthError] = useState(null)

  const emailValid      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const githubConfigured = !!GITHUB_CLIENT_ID

  function handleConnectGitHub(e) {
    e.preventDefault()
    setTouched(true)
    if (!emailValid) return

    // Guard: GitHub OAuth App client ID must be configured
    if (!githubConfigured) {
      setOauthError('GitHub connection is not yet configured. Please contact support at hello@taxlift.ai.')
      return
    }

    setBusy(true)
    setOauthError(null)

    // Persist email for the results page
    localStorage.setItem('taxlift_scan_email', email)

    // Capture lead immediately — don't wait, don't block the redirect
    leads.capture({ email, source: 'scan_landing' }).catch(() => {})

    // Signal to OAuthCallbackPage that this is a scan flow (redirect to /scan/repos)
    sessionStorage.setItem('taxlift_scan_flow', 'true')

    // Build GitHub OAuth URL and redirect
    const state = generateState()
    const oauthStateValue = `github:${state}`
    localStorage.setItem(LS_KEYS.OAUTH_STATE, oauthStateValue)
    sessionStorage.setItem(LS_KEYS.OAUTH_STATE, oauthStateValue) // fallback for Safari ITP
    window.location.href = getGitHubAuthUrl(state)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <button onClick={() => navigate('/')} className="flex items-center">
          <TaxLiftLogo variant="dark" size="sm" />
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/estimate')}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Use the estimator →
          </button>
          <button
            onClick={() => navigate('/login')}
            className="text-xs text-slate-300 border border-slate-600 hover:border-slate-400 px-3 py-1.5 rounded-lg transition-all"
          >
            Sign in
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 pt-14 pb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 text-xs font-medium px-3 py-1.5 rounded-full border border-indigo-500/30 mb-6">
          <Sparkles size={12} /> Free · No account required · Results in 60 seconds
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
          See how much SR&ED your<br className="hidden sm:block" /> codebase qualifies for
        </h1>

        <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed mb-10">
          Connect your GitHub repo. We scan your commit history for CRA-eligible
          R&D signals and show you a credit estimate — before you spend a dime.
        </p>

        {/* Email + CTA */}
        <form onSubmit={handleConnectGitHub} className="max-w-md mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm space-y-3">
            <div>
              <label htmlFor="scan-email" className="block text-left text-xs font-medium text-slate-300 mb-1.5">
                Work email <span className="text-slate-500">(to email you your full report)</span>
              </label>
              <input
                id="scan-email"
                name="email"
                type="email"
                placeholder="you@yourcompany.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 transition-all ${
                  touched && !emailValid
                    ? 'border-red-500/60 focus:ring-red-500/30'
                    : 'border-white/10 focus:ring-indigo-500/40 focus:border-indigo-500/50'
                }`}
              />
              {touched && !emailValid && (
                <p className="text-xs text-red-400 mt-1.5">Please enter a valid email address.</p>
              )}
            </div>

            {oauthError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 text-xs text-red-300">
                <span className="mt-0.5 flex-shrink-0">⚠️</span>
                <span>{oauthError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold text-base py-3.5 rounded-xl transition-colors shadow-lg shadow-indigo-900/40"
            >
              {busy ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Redirecting to GitHub…
                </>
              ) : (
                <>
                  <Github size={18} />
                  Connect GitHub →
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-500 text-center">
              You'll be redirected to GitHub to authorize read-only access.
              Read-only access — your source files are never stored or copied.
            </p>
          </div>
        </form>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-7">
          {TRUST_BADGES.map(({ Icon, text }) => (
            <span key={text} className="flex items-center gap-1.5 text-xs text-slate-500">
              <Icon size={12} className="text-emerald-500 flex-shrink-0" />
              {text}
            </span>
          ))}
        </div>

        {/* Not ready to connect GitHub? */}
        <div className="max-w-md mx-auto mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-transparent px-3 text-xs text-slate-600">Not ready to connect GitHub?</span>
            </div>
          </div>

          <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-5 text-left">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 bg-indigo-500/20 border border-indigo-500/30 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <BarChart3 size={16} className="text-indigo-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white mb-0.5">Use the questionnaire estimator</p>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  Answer 6 questions about your team size, salaries, and province. Get a ballpark SR&ED estimate in under 2 minutes — no GitHub, no OAuth, no code access.
                </p>
                <div className="flex flex-wrap gap-3 mb-4">
                  {['No GitHub required', 'No account needed', '~2 minutes'].map(l => (
                    <span key={l} className="flex items-center gap-1 text-[11px] text-slate-500">
                      <CheckCircle2 size={10} className="text-emerald-500" /> {l}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => navigate('/estimate')}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all"
                >
                  Try the estimator <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* GitLab / Bitbucket / Azure DevOps coming soon */}
      <div className="max-w-md mx-auto px-4 mt-2 mb-6">
        <VcsNotifyCard />
      </div>

      {/* Social proof: example qualifying commits */}
      <div className="max-w-3xl mx-auto px-4 pb-16">
        <p className="text-center text-xs text-slate-500 mb-4 uppercase tracking-wide font-medium">
          Examples of commits that qualify for SR&ED
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOCIAL_PROOF_COMMITS.map(c => (
            <div key={c.sha} className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Code2 size={12} className="text-slate-500 flex-shrink-0" />
                <span className="text-[10px] font-mono text-slate-600">{c.sha}</span>
                <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5 font-medium">
                  {c.theme}
                </span>
              </div>
              <p className="text-[12px] text-slate-300 font-mono leading-relaxed">{c.msg}</p>
            </div>
          ))}
        </div>

        {/* Bottom stats band */}
        <div className="mt-10 grid grid-cols-3 gap-4 max-w-xl mx-auto">
          {[
            { Icon: BarChart3, stat: '$187K',  label: 'Average SR&ED claim' },
            { Icon: Zap,       stat: '2,400+', label: 'Companies scanned' },
            { Icon: CheckCircle2, stat: '92%', label: 'Found qualifying commits' },
          ].map(({ Icon, stat, label }) => (
            <div key={label} className="text-center">
              <Icon size={18} className="text-indigo-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-white">{stat}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <TaxLiftChat
        onLeadCapture={(email, estimateRange) => {
          leads.capture({ email, estimate_range: estimateRange, source: 'chat_scan' }).catch(() => {})
        }}
      />

    </div>
  )
}
