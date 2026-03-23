import { useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, DollarSign, Clock, AlertTriangle, CheckCircle2, Target } from 'lucide-react'
import { CLUSTERS, getDashboardStats, getCreditTrend } from '../data/mockData'
import { formatCurrency, formatHours } from '../lib/utils'
import Card from '../components/ui/Card'

// ── Mock YoY data ─────────────────────────────────────────────────────────────
const YOY_DATA = [
  { period: 'Q1 2025', current: 28400,  prior: 19200,  hours: 312 },
  { period: 'Q2 2025', current: 34100,  prior: 22700,  hours: 398 },
  { period: 'Q3 2025', current: 31800,  prior: 25100,  hours: 371 },
  { period: 'Q4 2025', current: 53200,  prior: 30400,  hours: 621 },
  { period: 'Q1 2026', current: 63000,  prior: 28400,  hours: 735 },
]

const MONTHLY_CREDIT = [
  { month: 'Oct',  credit: 12400, clusters: 2 },
  { month: 'Nov',  credit: 18700, clusters: 3 },
  { month: 'Dec',  credit: 22100, clusters: 4 },
  { month: 'Jan',  credit: 53820, clusters: 7 },
  { month: 'Feb',  credit: 9180,  clusters: 3 },
  { month: 'Mar',  credit: 0,     clusters: 2 },
]

const DEV_HOURS = [
  { name: 'Jordan Kim',   hours: 487, credit: 42900 },
  { name: 'Priya Sharma', hours: 312, credit: 26400 },
  { name: 'Marcus Reid',  hours: 89,  credit: 7800  },
  { name: 'Sarah Chen',   hours: 67,  credit: 5400  },
]

const STATUS_COLORS_PIE = {
  New:        '#94a3b8',
  Interviewed:'#60a5fa',
  Drafted:    '#f59e0b',
  Approved:   '#10b981',
  Rejected:   '#f87171',
}

// ── Filing deadline countdown ──────────────────────────────────────────────────
function useFilingCountdown() {
  const deadline = new Date('2026-06-30T00:00:00Z')
  const now = new Date()
  const diffMs = deadline - now
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  const urgency = days < 60 ? 'red' : days < 120 ? 'amber' : 'green'
  return { days, urgency, deadline }
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green:  'bg-green-50 text-green-600',
    amber:  'bg-amber-50 text-amber-600',
    red:    'bg-red-50 text-red-600',
  }
  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 leading-none">{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </Card>
  )
}

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  fontSize: 12,
  padding: '8px 12px',
}

function CurrencyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={CUSTOM_TOOLTIP_STYLE}>
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

function HoursTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={CUSTOM_TOOLTIP_STYLE}>
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString()}h
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const stats = getDashboardStats()
  const { days, urgency } = useFilingCountdown()

  // Status breakdown for pie
  const statusData = useMemo(() => {
    const counts = { New: 0, Interviewed: 0, Drafted: 0, Approved: 0, Rejected: 0 }
    CLUSTERS.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++ })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [])

  // Credit from approved clusters
  const approvedCredit = CLUSTERS
    .filter(c => c.status === 'Approved' && c.estimated_credit_cad)
    .reduce((sum, c) => sum + c.estimated_credit_cad, 0)

  const pendingCredit = CLUSTERS
    .filter(c => ['Drafted', 'Interviewed'].includes(c.status) && c.estimated_credit_cad)
    .reduce((sum, c) => sum + c.estimated_credit_cad, 0)

  const yoyGrowth = Math.round(((YOY_DATA.at(-1).current - YOY_DATA.at(-1).prior) / YOY_DATA.at(-1).prior) * 100)

  const urgencyColors = {
    red:   { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   num: 'text-red-600' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', num: 'text-amber-600' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', num: 'text-green-600' },
  }
  const uc = urgencyColors[urgency]

  return (
    <div className="space-y-6">

      {/* Filing deadline banner */}
      <div className={`rounded-xl border px-5 py-4 flex items-center gap-4 ${uc.bg} ${uc.border}`}>
        <AlertTriangle size={20} className={uc.text} />
        <div className="flex-1">
          <p className={`text-sm font-semibold ${uc.text}`}>SR&ED Filing Deadline: June 30, 2026</p>
          <p className="text-xs text-gray-500 mt-0.5">18-month window from fiscal year end · Enhanced T661 project-level reporting required for public corporations</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-3xl font-bold tabular-nums ${uc.num}`}>{days}</p>
          <p className={`text-xs font-medium ${uc.text}`}>days remaining</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={CheckCircle2}
          label="Approved Credit (CAD)"
          value={formatCurrency(approvedCredit)}
          sub={`${CLUSTERS.filter(c => c.status === 'Approved').length} clusters approved`}
          color="green"
        />
        <StatCard
          icon={Target}
          label="Pending Credit (CAD)"
          value={formatCurrency(pendingCredit)}
          sub="Awaiting review / approval"
          color="amber"
        />
        <StatCard
          icon={Clock}
          label="Total QRE Hours"
          value={formatHours(stats.totalHours)}
          sub={`${stats.total} clusters · ${CLUSTERS.filter(c => c.aggregate_time_hours).length} with hours logged`}
          color="indigo"
        />
        <StatCard
          icon={TrendingUp}
          label="YoY Credit Growth"
          value={`+${yoyGrowth}%`}
          sub="vs. same period prior year"
          color="indigo"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* YoY credit trend */}
        <Card className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Year-over-Year Credit Trend (CAD)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={YOY_DATA} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="curGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="priorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="prior" name="Prior Year" stroke="#94a3b8" strokeWidth={2} fill="url(#priorGrad)" dot={false} />
              <Area type="monotone" dataKey="current" name="Current Year" stroke="#6366f1" strokeWidth={2} fill="url(#curGrad)" dot={{ r: 3, fill: '#6366f1' }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Status breakdown pie */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Cluster Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
                dataKey="value"
              >
                {statusData.map(entry => (
                  <Cell key={entry.name} fill={STATUS_COLORS_PIE[entry.name] ?? '#e5e7eb'} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, name]} contentStyle={CUSTOM_TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {statusData.filter(s => s.value > 0).map(s => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS_PIE[s.name] }} />
                  <span className="text-gray-600">{s.name}</span>
                </div>
                <span className="font-medium text-gray-900 tabular-nums">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Monthly credit bar */}
        <Card className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Credit Captured (CAD) — FY 2026</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MONTHLY_CREDIT} margin={{ top: 4, right: 8, bottom: 0, left: 8 }} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CurrencyTooltip />} />
              <Bar dataKey="credit" name="Credit (CAD)" radius={[4, 4, 0, 0]}>
                {MONTHLY_CREDIT.map((entry, i) => (
                  <Cell key={i} fill={entry.credit > 0 ? '#6366f1' : '#e2e8f0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Developer hours breakdown */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">QRE Hours by Developer</h3>
          <div className="space-y-3">
            {DEV_HOURS.map(d => {
              const maxH = DEV_HOURS[0].hours
              const pct = Math.round((d.hours / maxH) * 100)
              return (
                <div key={d.name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-gray-700">{d.name}</span>
                    <span className="text-xs text-gray-500 tabular-nums">{d.hours}h</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{formatCurrency(d.credit)} estimated credit</p>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Top clusters table */}
      <Card padding={false}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Top Clusters by Credit Value</h3>
          <span className="text-xs text-gray-400">Approved only</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Business Component', 'Status', 'Risk Score', 'Hours', 'Credit (CAD)', 'Eligibility %'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {CLUSTERS
                .filter(c => c.estimated_credit_cad)
                .sort((a, b) => b.estimated_credit_cad - a.estimated_credit_cad)
                .slice(0, 5)
                .map(c => (
                  <tr key={c.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900 max-w-xs truncate">{c.business_component}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700 tabular-nums">{Math.round(c.risk_score * 100)}%</td>
                    <td className="px-5 py-3 text-sm text-gray-600 tabular-nums">{c.aggregate_time_hours ? `${c.aggregate_time_hours}h` : '—'}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-indigo-700 tabular-nums">{formatCurrency(c.estimated_credit_cad)}</td>
                    <td className="px-5 py-3 text-sm text-gray-600 tabular-nums">{c.eligibility_percentage != null ? `${c.eligibility_percentage}%` : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  )
}
