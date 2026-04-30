import { useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { RoleBadge } from '../ui/Badge'
import NotificationPanel from '../ui/NotificationPanel'

const PAGE_TITLES = {
  '/dashboard':    'Dashboard',
  '/clusters':     'Activity Clusters',
  '/reports':      'Financial Reports',
  '/users':        'User Management',
  '/audit-log':   'Audit Log',
  '/integrations': 'Integrations',
  '/rate-card':    'Rate Card',
  '/dev-portal':   'My Portal',
  '/heuristics':   'Heuristic Configuration',
  '/analytics':        'Analytics',
  '/activity':         'Activity Log',
  '/audit-readiness':  'Audit Readiness',
  '/vault':            'Document Vault',
  '/quiz':             'SR\u0026ED Eligibility Quiz',
  '/settings':         'Settings',
  '/cpa-portal':       'CPA Partner Portal',
}

export default function Header({ onOpenSearch }) {
  const { currentUser } = useAuth()
  const { pathname } = useLocation()

  const base = '/' + pathname.split('/')[1]
  const title = PAGE_TITLES[base] ?? 'TaxLift'

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 fixed top-0 left-60 right-0 z-30">
      <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-2">
        {/* ⌘K search trigger */}
        <button
          onClick={onOpenSearch}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors text-xs"
        >
          <Search size={12} />
          <span>Search</span>
          <kbd className="ml-1 flex items-center gap-0.5 font-mono text-[10px] text-gray-300">
            <span>⌘</span><span>K</span>
          </kbd>
        </button>
        <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400 font-medium px-2">
          🇨🇦 Proudly Canadian
        </span>
        {currentUser && <RoleBadge role={currentUser.role} />}
        <NotificationPanel />
      </div>
    </header>
  )
}
