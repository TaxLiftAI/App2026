import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, GitMerge, FileText, BarChart3,
  Users, ScrollText, Plug, LogOut, ShieldCheck, DollarSign,
  UserCircle2, SlidersHorizontal, TrendingUp, Activity, ShieldAlert, Vault, HelpCircle, Settings, Keyboard, Building2,
  Award, Trello, ChevronDown, ChevronUp, Target,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { canDo } from '../../lib/utils'
import TaxLiftLogo from '../TaxLiftLogo'

// ── Core nav — client / internal users ────────────────────────────────────────
const CORE_NAV = [
  { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard, action: null },
  { to: '/integrations', label: 'Integrations', icon: Plug,            action: 'viewIntegrations' },
  { to: '/clusters',     label: 'Clusters',     icon: GitMerge,        action: 'viewClusters' },
  { to: '/reports',      label: 'Reports',      icon: BarChart3,       action: 'viewReports' },
  { to: '/settings',     label: 'Settings',     icon: Settings,        action: null },
]

// ── More nav — secondary / advanced features, collapsed by default ────────────
const MORE_NAV = [
  { to: '/grants',        label: 'Grants',          icon: Award,             action: null,                badge: 'Plus' },
  { to: '/vault',         label: 'Document Vault',  icon: Vault,             action: 'viewVault'          },
  { to: '/audit-readiness', label: 'Audit Readiness', icon: ShieldAlert,     action: 'viewAuditReadiness' },
  { to: '/analytics',     label: 'Analytics',       icon: TrendingUp,        action: 'viewAnalytics'      },
  { to: '/users',         label: 'Users',           icon: Users,             action: 'viewUsers'          },
  { to: '/admin/sales',  label: 'Sales CRM',       icon: Target,            action: 'viewUsers'          },
  { to: '/cpa-portal',    label: 'CPA Portal',      icon: Building2,         action: 'viewCPAPortal'      },
  { to: '/jira-sprint',   label: 'Sprint Report',   icon: Trello,            action: null,                badge: 'New' },
  { to: '/rate-card',     label: 'Rate Card',       icon: DollarSign,        action: 'viewRateCard'       },
  { to: '/dev-portal',    label: 'My Portal',       icon: UserCircle2,       action: 'viewDevPortal'      },
  { to: '/heuristics',    label: 'Heuristics',      icon: SlidersHorizontal, action: 'viewHeuristics'     },
  { to: '/analytics',     label: 'Analytics',       icon: TrendingUp,        action: 'viewAnalytics'      },
  { to: '/activity',      label: 'Activity Log',    icon: Activity,          action: 'viewActivity'       },
  { to: '/audit-log',     label: 'Audit Log',       icon: ScrollText,        action: 'viewAuditLog'       },
  { to: '/quiz',          label: 'Eligibility Quiz', icon: HelpCircle,       action: null                 },
]

// ── CPA nav — focused on portfolio management, no client-facing noise ──────────
// CPAs are redirected away from /dashboard, so Dashboard is intentionally absent.
const CPA_CORE_NAV = [
  { to: '/cpa-portal',           label: 'Client Portfolio', icon: Building2,      action: 'viewCPAPortal' },
  { to: '/cpa-portal/referrals', label: 'Referrals & Fees', icon: DollarSign,     action: 'viewCPAPortal' },
  { to: '/settings',             label: 'Settings',         icon: Settings,        action: null            },
]

function NavItem({ to, label, icon: Icon, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`
      }
    >
      <Icon size={16} />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300 uppercase tracking-wide">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { currentUser, logout } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)

  const isCPA = currentUser?.role === 'CPA'
  const allowed = (action) => action === null || (currentUser && canDo(action, currentUser.role))

  // CPA users get a focused nav with no More section.
  // Everyone else gets the standard core + collapsible More.
  const coreItems = isCPA
    ? CPA_CORE_NAV
    : CORE_NAV.filter(item => allowed(item.action))

  // Deduplicate more nav (analytics appears twice) and filter by permission.
  // Hidden entirely for CPAs — all their tools are already in core.
  const moreItems = isCPA
    ? []
    : MORE_NAV
        .filter((item, idx, arr) => arr.findIndex(i => i.to === item.to) === idx)
        .filter(item => allowed(item.action))

  return (
    <aside className="w-60 h-screen bg-slate-900 flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <TaxLiftLogo variant="dark" size="sm" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* Core items */}
        <div className="space-y-0.5">
          {coreItems.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </div>

        {/* More toggle */}
        {moreItems.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setMoreOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-800"
            >
              <span className="flex-1 text-left uppercase tracking-wider">More</span>
              {moreOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {moreOpen && (
              <div className="mt-0.5 space-y-0.5">
                {moreItems.map(item => (
                  <NavItem key={item.to} {...item} />
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Shortcuts hint */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 text-xs">
          <Keyboard size={12} />
          <span>Press</span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-300">?</kbd>
          <span>for shortcuts</span>
        </div>
      </div>

      {/* User */}
      {currentUser && (
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {(currentUser.display_name ?? currentUser.name)?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {currentUser.display_name ?? currentUser.name}
              </p>
              <p className="text-slate-400 text-[10px] truncate">{currentUser.role}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
