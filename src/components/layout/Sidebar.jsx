import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, GitMerge, FileText, BarChart3,
  Users, ScrollText, Plug, LogOut, ShieldCheck, DollarSign,
  UserCircle2, SlidersHorizontal, TrendingUp, Activity, ShieldAlert, Vault, HelpCircle, Settings, Keyboard, Building2,
  Award,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { canDo } from '../../lib/utils'

const NAV = [
  { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard, action: null },
  { to: '/clusters',     label: 'Clusters',     icon: GitMerge,        action: 'viewClusters' },
  { to: '/grants',       label: 'Grants',       icon: Award,           action: null, badge: 'Plus' },
  { to: '/reports',      label: 'Reports',      icon: BarChart3,       action: 'viewReports' },
  { to: '/users',        label: 'Users',        icon: Users,           action: 'viewUsers' },
  { to: '/audit-log',   label: 'Audit Log',    icon: ScrollText,      action: 'viewAuditLog' },
  { to: '/integrations', label: 'Integrations', icon: Plug,            action: 'viewIntegrations' },
  { to: '/rate-card',    label: 'Rate Card',    icon: DollarSign,          action: 'viewRateCard'    },
  { to: '/dev-portal',  label: 'My Portal',    icon: UserCircle2,         action: 'viewDevPortal'   },
  { to: '/heuristics',  label: 'Heuristics',   icon: SlidersHorizontal,   action: 'viewHeuristics'  },
  { to: '/analytics',       label: 'Analytics',       icon: TrendingUp,   action: 'viewAnalytics'      },
  { to: '/activity',        label: 'Activity Log',    icon: Activity,     action: 'viewActivity'       },
  { to: '/audit-readiness', label: 'Audit Readiness', icon: ShieldAlert,  action: 'viewAuditReadiness' },
  { to: '/vault',           label: 'Document Vault',  icon: Vault,        action: 'viewVault'          },
  { to: '/quiz',            label: 'Eligibility Quiz', icon: HelpCircle,  action: null                 },
  { to: '/cpa-portal',      label: 'CPA Portal',       icon: Building2,   action: 'viewCPAPortal'      },
  { to: '/settings',        label: 'Settings',         icon: Settings,    action: null                 },
]

export default function Sidebar() {
  const { currentUser, logout } = useAuth()

  const navItems = NAV.filter(item =>
    item.action === null || (currentUser && canDo(item.action, currentUser.role))
  )

  return (
    <aside className="w-60 h-screen bg-slate-900 flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <ShieldCheck size={16} className="text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-base tracking-tight">TaxLift</span>
            <p className="text-slate-400 text-[10px] leading-none mt-0.5">R&D Tax Platform</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
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
        ))}
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
              {currentUser.display_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{currentUser.display_name}</p>
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
