import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, GitMerge, FileText, BarChart3,
  Users, ScrollText, Plug, LogOut, ShieldCheck, DollarSign,
  UserCircle2, SlidersHorizontal, TrendingUp, Activity, ShieldAlert, Vault, HelpCircle, Settings, Keyboard, Building2,
  Award, Trello, ChevronDown, ChevronUp, Target, CheckCircle2, Circle, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { canDo } from '../../lib/utils'
import TaxLiftLogo from '../TaxLiftLogo'
import { useClusters, useIntegrations } from '../../hooks'

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

const CLAIM_STEPS = [
  { label: 'Connect source',     to: '/integrations',            key: 'hasIntegration' },
  { label: 'Clusters detected',  to: '/clusters',                key: 'hasClusters'    },
  { label: 'Narratives drafted', to: '/clusters',                key: 'hasNarrative'   },
  { label: 'CPA package ready',  to: '/clusters?status=Drafted', key: 'hasApproved'    },
]

function ClaimProgressWidget() {
  const navigate = useNavigate()
  const { data: clusters     = [] } = useClusters()
  const { data: integrations = [] } = useIntegrations()

  const hasIntegration = integrations.some(i => i.status === 'healthy')
  const hasClusters    = clusters.length > 0
  const hasNarrative   = clusters.some(c => ['Drafted', 'Approved'].includes(c.status))
  const hasApproved    = clusters.some(c => c.status === 'Approved')

  const done      = [hasIntegration, hasClusters, hasNarrative, hasApproved]
  const doneCount = done.filter(Boolean).length
  const allDone   = doneCount === done.length
  const nextIdx   = done.findIndex(d => !d)

  return (
    <div className="mx-3 mb-3 bg-slate-800 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Claim progress</span>
        <span className={`text-[10px] font-bold ${allDone ? 'text-green-400' : 'text-indigo-400'}`}>
          {doneCount}/4
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-700 rounded-full mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-indigo-500'}`}
          style={{ width: `${(doneCount / 4) * 100}%` }}
        />
      </div>

      <div className="space-y-1">
        {CLAIM_STEPS.map((step, i) => {
          const isDone = done[i]
          const isNext = i === nextIdx
          return (
            <button
              key={step.key}
              onClick={() => navigate(step.to)}
              className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                isNext
                  ? 'bg-indigo-600/20 hover:bg-indigo-600/30'
                  : 'hover:bg-slate-700/50'
              }`}
            >
              {isDone ? (
                <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
              ) : (
                <Circle size={13} className={`flex-shrink-0 ${isNext ? 'text-indigo-400' : 'text-slate-600'}`} />
              )}
              <span className={`flex-1 text-[11px] leading-tight ${
                isDone ? 'text-slate-500 line-through' :
                isNext ? 'text-white font-medium'      :
                         'text-slate-500'
              }`}>
                {step.label}
              </span>
              {isNext && <ChevronRight size={11} className="text-indigo-400 flex-shrink-0" />}
            </button>
          )
        })}
      </div>

      {allDone && (
        <div className="mt-2 pt-2 border-t border-slate-700 text-center">
          <span className="text-[10px] text-green-400 font-medium">🎉 Package ready to send!</span>
        </div>
      )}
    </div>
  )
}

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

      {/* Claim progress stepper — client users only */}
      {!isCPA && <ClaimProgressWidget />}

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
