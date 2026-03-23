import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import CommandPalette from '../ui/CommandPalette'
import KeyboardShortcutsModal from '../ui/KeyboardShortcutsModal'
import { INTEGRATIONS } from '../../data/mockData'

// ── Integration degraded / expired banner ─────────────────────────────────────
function IntegrationBanner({ onDismiss }) {
  const degradedIntegrations = INTEGRATIONS.filter(
    i => i.status === 'degraded' || i.status === 'expired'
  )

  if (degradedIntegrations.length === 0) return null

  const names = degradedIntegrations.map(
    i => i.integration.charAt(0).toUpperCase() + i.integration.slice(1)
  )

  const isSingle = names.length === 1
  const label = isSingle ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const hasExpired = degradedIntegrations.some(i => i.status === 'expired')

  return (
    <div className="fixed top-14 left-60 right-0 z-20 h-10 bg-amber-50 border-b border-amber-200 flex items-center gap-3 px-5">
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
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [paletteOpen, setPaletteOpen]   = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Global Cmd+K / Ctrl+K and ? listeners
  useEffect(() => {
    function handle(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
        return
      }
      // ? opens shortcuts (only when not typing in an input/textarea)
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (e.key === '?' && tag !== 'input' && tag !== 'textarea') {
        e.preventDefault()
        setShortcutsOpen(o => !o)
      }
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [])

  const hasDegraded = INTEGRATIONS.some(
    i => i.status === 'degraded' || i.status === 'expired'
  )
  const showBanner = hasDegraded && !bannerDismissed

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <Header onOpenSearch={() => setPaletteOpen(true)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {showBanner && (
        <IntegrationBanner onDismiss={() => setBannerDismissed(true)} />
      )}

      {/* pt-14 = header height (3.5rem). When banner shows, add h-10 (2.5rem) → pt-24 = 6rem */}
      <main className={`ml-60 ${showBanner ? 'pt-24' : 'pt-14'}`}>
        <div className="p-6 max-w-screen-2xl">
          {children}
        </div>
      </main>
    </div>
  )
}
