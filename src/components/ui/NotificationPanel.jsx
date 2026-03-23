import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, X, CheckCheck, AlertTriangle, MessageSquare, AtSign,
  Clock, ShieldAlert, FileText, Calendar, TrendingUp, Zap,
  ChevronRight, Inbox,
} from 'lucide-react'
import { NOTIFICATIONS } from '../../data/mockData'

// ─── Type metadata ─────────────────────────────────────────────────────────────
const TYPE_META = {
  pending_approval:   { icon: Clock,         color: 'text-amber-500',  bg: 'bg-amber-50',   label: 'Approval Needed' },
  mention:            { icon: AtSign,         color: 'text-indigo-500', bg: 'bg-indigo-50',  label: 'Mention' },
  readiness_warning:  { icon: ShieldAlert,    color: 'text-red-500',    bg: 'bg-red-50',     label: 'Readiness Warning' },
  stale_context:      { icon: AlertTriangle,  color: 'text-orange-500', bg: 'bg-orange-50',  label: 'Stale Context' },
  new_comment:        { icon: MessageSquare,  color: 'text-blue-500',   bg: 'bg-blue-50',    label: 'New Comment' },
  audit_risk:         { icon: ShieldAlert,    color: 'text-red-600',    bg: 'bg-red-50',     label: 'Audit Risk' },
  narrative_ready:    { icon: FileText,       color: 'text-teal-500',   bg: 'bg-teal-50',    label: 'Narrative Ready' },
  interview_scheduled:{ icon: Calendar,       color: 'text-purple-500', bg: 'bg-purple-50',  label: 'Interview' },
  credit_milestone:   { icon: TrendingUp,     color: 'text-green-500',  bg: 'bg-green-50',   label: 'Milestone' },
  cluster_overdue:    { icon: Zap,            color: 'text-rose-500',   bg: 'bg-rose-50',    label: 'Overdue' },
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

// ─── Relative time ─────────────────────────────────────────────────────────────
function relativeTime(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// ─── Priority dot ──────────────────────────────────────────────────────────────
function PriorityDot({ priority }) {
  const color = { high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-gray-300' }[priority]
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color} flex-shrink-0 mt-1.5`} />
}

// ─── Single notification row ───────────────────────────────────────────────────
function NotifRow({ notif, onRead, onAction, onDismiss }) {
  const meta = TYPE_META[notif.type] ?? TYPE_META['new_comment']
  const Icon = meta.icon

  return (
    <div
      className={`group relative flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.read ? 'bg-indigo-50/40' : ''}`}
      onClick={() => { onRead(notif.id); onAction(notif.action_href) }}
    >
      {/* unread indicator strip */}
      {!notif.read && (
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500 rounded-r" />
      )}

      {/* icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full ${meta.bg} flex items-center justify-center mt-0.5`}>
        <Icon size={14} className={meta.color} />
      </div>

      {/* body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs leading-snug ${notif.read ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
            {notif.title}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <PriorityDot priority={notif.priority} />
            <span className="text-[10px] text-gray-400 whitespace-nowrap">{relativeTime(notif.created_at)}</span>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{notif.body}</p>

        <div className="flex items-center justify-between mt-1.5">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${meta.bg} ${meta.color}`}>
            {meta.label}
          </span>
          <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {notif.action_label} <ChevronRight size={10} />
          </span>
        </div>
      </div>

      {/* dismiss button */}
      <button
        onClick={e => { e.stopPropagation(); onDismiss(notif.id) }}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 mt-0.5"
        title="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ tab }) {
  const messages = {
    all:      { icon: Inbox,      title: 'All caught up!',        sub: 'No notifications to show.' },
    unread:   { icon: Bell,       title: 'No unread notifications', sub: 'You\'re fully up to date.' },
    actions:  { icon: CheckCheck, title: 'No action required',    sub: 'Nothing needs your attention right now.' },
  }
  const { icon: Icon, title, sub } = messages[tab] ?? messages.all
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <Icon size={18} className="text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function NotificationPanel() {
  const navigate   = useNavigate()
  const panelRef   = useRef(null)
  const buttonRef  = useRef(null)

  const [open, setOpen]       = useState(false)
  const [tab, setTab]         = useState('all')   // 'all' | 'unread' | 'actions'
  const [notifs, setNotifs]   = useState(
    () => [...NOTIFICATIONS].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
                new Date(b.created_at) - new Date(a.created_at)
    )
  )

  const unreadCount  = notifs.filter(n => !n.read).length
  const actionCount  = notifs.filter(n => !n.read && n.priority === 'high').length

  const visible = notifs.filter(n => {
    if (tab === 'unread')  return !n.read
    if (tab === 'actions') return !n.read && n.priority === 'high'
    return true
  })

  // Close on outside click
  useEffect(() => {
    function handle(e) {
      if (
        panelRef.current  && !panelRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Keyboard: Escape closes
  useEffect(() => {
    function handle(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [])

  const markRead = useCallback((id) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const dismiss = useCallback((id) => {
    setNotifs(prev => prev.filter(n => n.id !== id))
  }, [])

  const handleAction = useCallback((href) => {
    setOpen(false)
    navigate(href)
  }, [navigate])

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        className={`relative p-1.5 rounded-lg transition-colors ${
          open ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 80px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-gray-700" />
              <span className="text-sm font-semibold text-gray-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors font-medium"
                >
                  <CheckCheck size={11} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50/60">
            {[
              { id: 'all',     label: 'All',            count: notifs.length },
              { id: 'unread',  label: 'Unread',         count: unreadCount },
              { id: 'actions', label: 'Action Required', count: actionCount },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors border-b-2 ${
                  tab === t.id
                    ? 'border-indigo-500 text-indigo-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full ${
                    tab === t.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto divide-y divide-gray-50" style={{ maxHeight: '420px' }}>
            {visible.length === 0 ? (
              <EmptyState tab={tab} />
            ) : (
              visible.map(n => (
                <NotifRow
                  key={n.id}
                  notif={n}
                  onRead={markRead}
                  onAction={handleAction}
                  onDismiss={dismiss}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              {notifs.length} total · {unreadCount} unread
            </span>
            <button
              onClick={() => { setOpen(false); navigate('/activity') }}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5"
            >
              View activity log <ChevronRight size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
