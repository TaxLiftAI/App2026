import { useState } from 'react'
import {
  DollarSign, Pencil, Check, X, Info, Users, AlertCircle,
} from 'lucide-react'
import { USERS, RATE_CARDS } from '../data/mockData'
import { formatCurrency } from '../lib/utils'
import Card, { CardHeader } from '../components/ui/Card'
import Button from '../components/ui/Button'

const EMPLOYMENT_TYPES = ['FTE', 'Contractor']

// Effective billable rate = hourly_rate * (1 + overhead_pct/100)
function effectiveRate(card) {
  if (!card) return null
  return card.hourly_rate_cad * (1 + card.overhead_pct / 100)
}

// Users who need a rate card (any role that writes code)
const BILLABLE_ROLES = ['Admin', 'Reviewer', 'Developer']

function ToastBanner({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
      <Check size={15} />
      {message}
      <button onClick={onDismiss} className="ml-2 text-green-200 hover:text-white">
        <X size={13} />
      </button>
    </div>
  )
}

function RateCardRow({ user, initialCard, onSave }) {
  const [editing, setEditing] = useState(false)
  const [card, setCard] = useState(
    initialCard ?? {
      user_id: user.id,
      employment_type: 'FTE',
      hourly_rate_cad: '',
      overhead_pct: 25,
    }
  )
  const [draft, setDraft] = useState(card)
  const [error, setError] = useState('')

  function startEdit() {
    setDraft({ ...card })
    setEditing(true)
    setError('')
  }

  function cancelEdit() {
    setDraft({ ...card })
    setEditing(false)
    setError('')
  }

  function saveEdit() {
    const rate = parseFloat(draft.hourly_rate_cad)
    const overhead = parseFloat(draft.overhead_pct)
    if (!rate || rate <= 0)      return setError('Hourly rate must be greater than 0.')
    if (isNaN(overhead) || overhead < 0 || overhead > 100)
      return setError('Overhead must be 0–100%.')
    if (draft.employment_type === 'Contractor' && overhead > 0)
      return setError('Contractors have 0% overhead (they bill all-in).')

    const saved = { ...draft, hourly_rate_cad: rate, overhead_pct: overhead }
    setCard(saved)
    setEditing(false)
    setError('')
    onSave(saved)
  }

  const eff = effectiveRate(card.hourly_rate_cad ? card : null)

  return (
    <tr className="hover:bg-gray-50 transition-colors border-b border-gray-100">
      {/* Developer */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {user.display_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{user.display_name}</p>
            <p className="text-[11px] text-gray-400">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-5 py-3.5">
        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded font-medium">{user.role}</span>
      </td>

      {/* Employment Type */}
      <td className="px-5 py-3.5">
        {editing ? (
          <select
            value={draft.employment_type}
            onChange={e => {
              const val = e.target.value
              setDraft(d => ({ ...d, employment_type: val, overhead_pct: val === 'Contractor' ? 0 : 25 }))
            }}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {EMPLOYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        ) : (
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
            card.employment_type === 'Contractor'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {card.employment_type || '—'}
          </span>
        )}
      </td>

      {/* Hourly Rate */}
      <td className="px-5 py-3.5">
        {editing ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">CA$</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={draft.hourly_rate_cad}
              onChange={e => setDraft(d => ({ ...d, hourly_rate_cad: e.target.value }))}
              placeholder="e.g. 95"
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-24 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        ) : (
          <span className="text-sm text-gray-900 tabular-nums font-medium">
            {card.hourly_rate_cad ? `CA$${Number(card.hourly_rate_cad).toFixed(2)}/h` : <span className="text-gray-300">Not set</span>}
          </span>
        )}
      </td>

      {/* Overhead % */}
      <td className="px-5 py-3.5">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.overhead_pct}
              onChange={e => setDraft(d => ({ ...d, overhead_pct: e.target.value }))}
              disabled={draft.employment_type === 'Contractor'}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-16 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
            <span className="text-xs text-gray-400">%</span>
          </div>
        ) : (
          <span className="text-sm text-gray-600 tabular-nums">
            {card.hourly_rate_cad ? `${card.overhead_pct}%` : '—'}
          </span>
        )}
      </td>

      {/* Effective Rate */}
      <td className="px-5 py-3.5">
        <span className={`text-sm font-semibold tabular-nums ${eff ? 'text-emerald-700' : 'text-gray-300'}`}>
          {eff ? `CA$${eff.toFixed(2)}/h` : '—'}
        </span>
        {card.employment_type === 'FTE' && card.hourly_rate_cad && (
          <p className="text-[10px] text-gray-400 mt-0.5">incl. {card.overhead_pct}% overhead</p>
        )}
      </td>

      {/* Actions */}
      <td className="px-5 py-3.5">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={saveEdit}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
            >
              <Check size={11} /> Save
            </button>
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
            >
              <X size={11} /> Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors font-medium"
          >
            <Pencil size={11} /> Edit
          </button>
        )}
        {error && (
          <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
            <AlertCircle size={9} /> {error}
          </p>
        )}
      </td>
    </tr>
  )
}

export default function RateCardPage() {
  const [cards, setCards] = useState({ ...RATE_CARDS })
  const [toast, setToast] = useState('')

  const billableUsers = USERS.filter(u => BILLABLE_ROLES.includes(u.role))

  function handleSave(saved) {
    setCards(prev => ({ ...prev, [saved.user_id]: saved }))
    const user = USERS.find(u => u.id === saved.user_id)
    setToast(`Rate card saved for ${user?.display_name ?? saved.user_id}`)
    setTimeout(() => setToast(''), 3500)
  }

  // Summary totals
  const configured = billableUsers.filter(u => cards[u.id]?.hourly_rate_cad)
  const avgRate = configured.length > 0
    ? configured.reduce((s, u) => s + effectiveRate(cards[u.id]), 0) / configured.length
    : null

  return (
    <div className="space-y-5">
      {/* Header info banner */}
      <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-xs text-indigo-800">
        <Info size={14} className="text-indigo-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold mb-0.5">Rate Card is required for SR&ED credit calculation</p>
          <p className="text-indigo-600 leading-relaxed">
            The Accountant agent uses these rates to calculate eligible wages.{' '}
            <strong>FTE overhead</strong> covers benefits, payroll taxes, and allocated facilities (typically 25–40%).{' '}
            <strong>Contractors</strong> are billed all-in with 0% overhead.
            All rates are in Canadian dollars.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Developers Configured', value: `${configured.length} / ${billableUsers.length}`, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Avg Effective Rate (CAD)', value: avgRate ? `CA$${avgRate.toFixed(2)}/h` : '—', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Contractors', value: configured.filter(u => cards[u.id]?.employment_type === 'Contractor').length, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${item.bg}`}><item.icon size={17} className={item.color} /></div>
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{item.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Rate card table */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Developer Rate Cards</h3>
            <p className="text-xs text-gray-500 mt-0.5">Admin-only · changes are audit-logged</p>
          </div>
          <span className="text-xs text-gray-400">Effective rate = hourly rate × (1 + overhead %)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Developer', 'Role', 'Employment Type', 'Hourly Rate (CAD)', 'Overhead %', 'Effective Rate', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {billableUsers.map(user => (
                <RateCardRow
                  key={user.id}
                  user={user}
                  initialCard={cards[user.id] ?? null}
                  onSave={handleSave}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-2 text-[11px] text-gray-500">
          <Info size={11} />
          Effective rates are used by the Accountant agent to compute SR&ED eligible expenditures.
          Changes take effect on the next financial recalculation.
        </div>
      </Card>

      <ToastBanner message={toast} onDismiss={() => setToast('')} />
    </div>
  )
}
