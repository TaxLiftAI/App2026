import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, X, Zap, Clock } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import CommandPalette from '../ui/CommandPalette'
import KeyboardShortcutsModal from '../ui/KeyboardShortcutsModal'
import { useIntegrations } from '../../hooks'
import { useAuth } from '../../context/AuthContext'
import { billing as billingApi } from '../../lib/api'

// ── Trial expiry banner ───────────────────────────────────────────────────────
const TRIAL_DAYS = 14
const DISMISS_KEY = 'taxlift_trial_banner_dismissed_date'

function TrialBanner({ createdAt, onDismiss, topOffset }) {
  const navigate   = useNavigate()
  const [loading, setLoading] = useState(false)

  if (!createdAt) return null
  const msElapsed  = Date.now() - new Date(createdAt).getTime()
  const daysElapsed = Math.floor(msElapsed / 86_400_000)
  const daysLeft   = TRIAL_DAYS - daysElapsed
  if (daysLeft <= 0) return null   // trial over — don't nag, let upgrade gate do the work

  const urgent = daysLeft <= 3

  async function handleUpgrade() {
    setLoading(true)
    try {
      const result = await billingApi.createCheckoutSession(
        'starter',
        `${window.location.origin}/settings?tab=billing&upgraded=1`,
        `${window.location.origin}/settings?tab=billing`
      )
      if (result?.url) { window.location.href = result.url; return }
    } catch { /* fall through */ }
    setLoading(false)
    navigate('/settings?tab=billing')
  }

  return (
    <div
      className={`fixed left-60 right-0 z-20 h-10 flex items-center gap-3 px-5 border-b ${
        urgent
          ? 'bg-red-50 border-red-200'
          : 'bg-indigo-50 border-indigo-200'
      }`}
      style={{ top: topOffset }}
    >
      {urgent ? (
        <Clock size={13} className="text-red-600 flex-shrink-0" />
      ) : (
        <Zap size={13} className="text-indigo-600 flex-shrink-0" />
      )}
      <p className={`text-xs flex-1 ${urgent ? 'text-red-800' : 'text-indigo-800'}`}>
        {urgent ? (
          <><span className="font-bold">Only {daysLeft} day{daysLeft !== 1 ? 's' : ''} left on your free trial.</span> Upgrade now to keep your narratives and CPA package.</>
        ) : (
          <>Your free trial ends in <span className="font-bold">{daysLeft} days</span> — upgrade to unlock AI narratives, CPA export, and more.</>
        )}
      </p>
      <button
        onClick={handleUpgrade}
        disabled={loading}
        className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
          urgent
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
        }`}
      >
        <Zap size={11} />
        {loading ? 'Loading…' : 'Upgrade now'}
      </button>
      <button onClick={onDismiss} className={`flex-shrink-0 p-0.5 rounded transition-colors ${urgent ? 'text-red-400 hover:text-red-700' : 'text-indigo-400 hover:text-indigo-700'}`}>
        <X size={13} />
      </button>
    </div>
  )
}

// ── Integration degraded / expired banner ─────────────────────────────────────
function IntegrationBanner({ integrations = [], onDismiss }) {
  const degradedIntegrations = integrations.filter(
    i => i.status === 'degraded' || i.status === 'expired'
  )

  if (degradedIntegrations.length === 0) return null

  const names = degradedIntegrations.map(
    i => (i.integration?.charAt(0)?.toUpperCase() ?? '') + (i.integration?.slice(1) ?? '')
  )

  const isSingle = names.length === 1
  const label = isSingle ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const hasExpired = degradedIntegrations.some(i => i.status === 'expired')

  return (
    <div className="fixed left-60 right-0 z-20 h-10 bg-amber-50 border-b border-amber-200 flex items-center gap-3 px-5" style={{ top: 56 }}>
      <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
      <p className="text-xs text-amber-800 flex-1">
        <span className="font-semibold">{label}</span>
        {' '}{isSingle ? 'integration is' : 'integrations are'}{' '}
        <span className={hasExpired ? 'text-red-700 font-semibold' : ''}>
          {hasExpired ? 'expired' : 'degraded'}
        </span>
        {' '}— some clusters may be missing data.{' '}
        <Link to="/integrations" className="font-semibold underline hover:text-amber-900 transition-colors">
          Re-authorise now →
        </Link>
      </p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-amber-500 hover:text-amber-800 transition-colors flex-shrink-0 p-0.5 rounded"
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function Layout({ children }) {
  const [intBannerDismissed,   setIntBannerDismissed]   = useState(false)
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(() => {
    // Dismiss resets daily so urgency stays fresh
    try {
      const stored = sessionStorage.getItem(DISMISS_KEY)
      return stored === new Date().toDateString()
    } catch { return false }
  })
  const [paletteOpen,   setPaletteOpen]   = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const { data: integrations = [] } = useIntegrations()
  const { currentUser } = useAuth()

  // Global Cmd+K / Ctrl+K and ? listeners
  useEffect(() => {
    function handle(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
        return
      }
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (e.key === '?' && tag !== 'input' && tag !== 'textarea') {
        e.preventDefault()
        setShortcutsOpen(o => !o)
      }
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [])

  const isFreeUser   = (currentUser?.subscription_tier ?? 'free') === 'free'
  const hasDegraded  = integrations.some(i => i.status === 'degraded' || i.status === 'expired')
  const showIntBanner   = hasDegraded && !intBannerDismissed
  const showTrialBanner = isFreeUser && !trialBannerDismissed && !!currentUser?.created_at

  // Stack banners below the fixed header (top: 56px = 3.5rem)
  const HEADER_H  = 56
  const BANNER_H  = 40
  const intTop    = HEADER_H
  const trialTop  = HEADER_H + (showIntBanner ? BANNER_H : 0)
  const bannerCount = (showIntBanner ? 1 : 0) + (showTrialBanner ? 1 : 0)
  const mainPt    = HEADER_H + bannerCount * BANNER_H

  function dismissTrial() {
    try { sessionStorage.setItem(DISMISS_KEY, new Date().toDateString()) } catch { /* ignore */ }
    setTrialBannerDismissed(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <Header onOpenSearch={() => setPaletteOpen(true)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {showIntBanner && (
        <IntegrationBanner
          integrations={integrations}
          onDismiss={() => setIntBannerDismissed(true)}
        />
      )}
      {showTrialBanner && (
        <TrialBanner
          createdAt={currentUser?.created_at}
          topOffset={trialTop}
          onDismiss={dismissTrial}
        />
      )}

      <main className="ml-60" style={{ paddingTop: mainPt }}>
        <div className="p-6 max-w-screen-2xl">
          {children}
        </div>
      </main>
    </div>
  )
}
