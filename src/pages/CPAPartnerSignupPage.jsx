/**
 * CPA Partner Signup Page  —  /cpa/partner-signup
 *
 * Public-facing landing page for CPAs who received the TaxLift partner 1-pager.
 * Explains the commission model, collects signup info, and returns a unique
 * referral link the CPA can share with clients.
 */
import { useState } from 'react'
import { CheckCircle2, ChevronRight, DollarSign, Users, Shield, Zap, Star } from 'lucide-react'
import { BASE_URL } from '../lib/api'

const PROVINCES = [
  'AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT',
]

// ── CPA referral flat-fee tiers (mirrors stripe.js CPA_REFERRAL_TIERS) ────────
// Flat fee avoids CPA Canada Rule 205 independence concerns with % contingency.
// Fee is paid when the CPA-ready T661 package is delivered to the CPA.
const CPA_TIERS = [
  { maxCredit:   75_000, label: '$0 – $75K credit',    fee:   750 },
  { maxCredit:  150_000, label: '$75K – $150K credit', fee: 1_500 },
  { maxCredit:  300_000, label: '$150K – $300K credit',fee: 3_000 },
  { maxCredit:  600_000, label: '$300K – $600K credit',fee: 5_500 },
  { maxCredit: Infinity, label: '$600K+ credit',       fee: 9_000 },
]
const CPA_PLUS_BONUS = 750  // additional if client is on Plus plan

// ── Commission calculator ─────────────────────────────────────────────────────
function calc(clients, tierIndex = 1) {
  const tier       = CPA_TIERS[tierIndex]
  const perClient  = tier.fee
  const total      = clients * perClient
  const withPlus   = clients * (perClient + CPA_PLUS_BONUS)
  return { perClient, total, withPlus }
}

// ── Stat box ──────────────────────────────────────────────────────────────────
function Stat({ value, label }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-extrabold text-indigo-600">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}

// ── Confirmed state ───────────────────────────────────────────────────────────
function ConfirmedView({ refCode, refUrl, name }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(refUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">You're in, {name?.split(' ')[0]}!</h1>
        <p className="text-gray-500 mb-8">
          Welcome to the TaxLift Partner Program. Your referral link is ready — share it with clients
          to earn a flat referral fee ($750–$9,000) when each T661 package is delivered.
        </p>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 mb-6 text-left">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Your referral link</p>
          <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg px-3 py-2">
            <code className="text-sm text-indigo-700 flex-1 overflow-x-auto whitespace-nowrap">{refUrl}</code>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Referral code: <strong className="text-gray-600">{refCode}</strong></p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 text-left space-y-3 mb-8">
          <p className="text-sm font-semibold text-gray-800">What happens next</p>
          {[
            'Check your email — your welcome kit is on the way',
            'Share your referral link with any client filing SR&ED',
            'Our team will reach out within 1 business day with your partner agreement',
            'Commissions start from day one — no minimum thresholds',
          ].map(step => (
            <div key={step} className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle2 size={15} className="text-indigo-500 flex-shrink-0 mt-0.5" />
              {step}
            </div>
          ))}
        </div>

        <a
          href="mailto:partners@taxlift.ai"
          className="text-sm text-indigo-600 hover:underline"
        >
          Questions? Email partners@taxlift.ai →
        </a>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CPAPartnerSignupPage() {
  const [form, setForm] = useState({
    full_name: '', email: '', firm_name: '',
    province: 'ON', phone: '', client_count: '',
  })
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [confirmed, setConfirmed] = useState(null)   // { refCode, refUrl }
  const [clients,    setClients]    = useState(3)   // commission calculator
  const [tierIndex,  setTierIndex]  = useState(1)   // which credit tier

  const commission = calc(clients, tierIndex)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/api/v1/cpa/partner-signup`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Signup failed')
      setConfirmed({ refCode: data.referral_code, refUrl: data.referral_url })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (confirmed) {
    return <ConfirmedView {...confirmed} name={form.full_name} />
  }

  return (
    <div className="min-h-screen bg-white">

      {/* ── Nav ── */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-lg font-bold text-indigo-600 tracking-tight">TaxLift</a>
        <span className="text-sm text-gray-500">CPA Partner Program</span>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 text-xs font-semibold text-indigo-700 mb-6">
          <Star size={12} />
          Flat referral fee — paid when the T661 package is delivered
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
          Refer clients to TaxLift.<br />
          <span className="text-indigo-600">Earn $750 – $9,000 per referral.</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10">
          TaxLift automates SR&ED documentation for your software clients — saving 40+ hours of back-and-forth
          and generating CPA-ready T661 packages. You refer, they engage, you earn a flat fee — no independence concerns.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-xl mx-auto mb-12">
          <Stat value="$750–$9K" label="flat fee per referral" />
          <Stat value="$175K" label="avg SR&ED credit filed" />
          <Stat value="40 hrs" label="saved per client claim" />
        </div>
      </section>

      {/* ── How it works + Form ── */}
      <section className="max-w-5xl mx-auto px-6 pb-20 grid md:grid-cols-2 gap-12 items-start">

        {/* Left — benefits + calculator */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-6">How the program works</h2>
          <div className="space-y-5 mb-10">
            {[
              {
                icon: Users,
                title: 'Refer Canadian software companies',
                body: 'Any Canadian-controlled private corporation doing software R&D qualifies for SR&ED. If they\'re building something technical, they likely have a claim.',
              },
              {
                icon: Zap,
                title: 'TaxLift does all the documentation',
                body: 'We scan their GitHub/Jira history, generate T661 technical narratives, and produce a complete audit-ready package — no manual work for you or your client.',
              },
              {
                icon: DollarSign,
                title: 'You earn a flat referral fee per client',
                body: 'Fees range from $750 to $9,000 per referral based on the client\'s SR&ED credit size. Paid when TaxLift delivers the CPA-ready T661 package — not contingent on CRA assessment, so there are no Rule 205 independence issues.',
              },
              {
                icon: Shield,
                title: 'Your clients stay protected at audit',
                body: 'Every TaxLift package includes commit-level evidence hashed with SHA-256. CRA audits become a document dump, not a scramble.',
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={16} className="text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">{title}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Commission calculator */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
            <p className="text-sm font-semibold text-gray-800 mb-4">Referral fee calculator</p>

            {/* Tier picker */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 block mb-2">Client's estimated SR&amp;ED credit</label>
              <div className="grid grid-cols-1 gap-1">
                {CPA_TIERS.map((tier, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setTierIndex(i)}
                    className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg transition-colors ${
                      tierIndex === i
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'bg-white border border-indigo-100 text-gray-600 hover:border-indigo-300'
                    }`}
                  >
                    <span>{tier.label}</span>
                    <span className={tierIndex === i ? 'text-indigo-200' : 'text-indigo-600 font-semibold'}>
                      ${tier.fee.toLocaleString('en-CA')} fee
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Client count */}
            <div className="flex items-center gap-4 mb-4">
              <label className="text-xs text-gray-600 whitespace-nowrap">Clients at this tier:</label>
              <input
                type="range" min={1} max={20} value={clients}
                onChange={e => setClients(Number(e.target.value))}
                className="flex-1 accent-indigo-600"
              />
              <span className="text-sm font-bold text-indigo-700 w-6 text-right">{clients}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-4 text-center border border-indigo-100">
                <p className="text-2xl font-extrabold text-indigo-700">
                  ${commission.total.toLocaleString('en-CA')}
                </p>
                <p className="text-xs text-gray-500 mt-1">Starter clients</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center border border-indigo-100">
                <p className="text-2xl font-extrabold text-gray-900">
                  ${commission.withPlus.toLocaleString('en-CA')}
                </p>
                <p className="text-xs text-gray-500 mt-1">Plus clients (+$750 each)</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Flat fee paid per client when their T661 package is delivered · no % contingency
            </p>
          </div>
        </div>

        {/* Right — signup form */}
        <div>
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Apply as a partner</h2>
            <p className="text-sm text-gray-500 mb-6">
              Takes 2 minutes. You'll get your referral link immediately.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
                <input
                  name="full_name" type="text" required
                  value={form.full_name} onChange={handleChange}
                  placeholder="Jane Smith, CPA"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work email *</label>
                <input
                  name="email" type="email" required
                  value={form.email} onChange={handleChange}
                  placeholder="jane@smithcpa.ca"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPA firm name *</label>
                <input
                  name="firm_name" type="text" required
                  value={form.firm_name} onChange={handleChange}
                  placeholder="Smith & Associates CPA"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                  <select
                    name="province"
                    value={form.province} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
                  <input
                    name="phone" type="tel"
                    value={form.phone} onChange={handleChange}
                    placeholder="416-555-0100"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  How many software clients do you have? (approx.)
                </label>
                <select
                  name="client_count"
                  value={form.client_count} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Select range</option>
                  <option value="1-5">1–5</option>
                  <option value="6-15">6–15</option>
                  <option value="16-30">16–30</option>
                  <option value="30+">30+</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-sm"
              >
                {loading ? 'Submitting…' : 'Get my referral link'}
                {!loading && <ChevronRight size={16} />}
              </button>

              <p className="text-xs text-center text-gray-400">
                By applying you agree to our{' '}
                <a href="/partners" className="text-indigo-600 hover:underline">Partner Terms</a>.
                No spam — ever.
              </p>
            </form>
          </div>

          {/* Social proof */}
          <div className="mt-6 space-y-3">
            {[
              { quote: 'My client got $218K back. The package TaxLift generated saved us 2 weeks of prep.', name: 'M. Chen, CPA, Toronto' },
              { quote: 'Referring TaxLift is now a standard part of my SR&ED conversation with every software client.', name: 'R. Patel, CPA, Vancouver' },
            ].map(({ quote, name }) => (
              <div key={name} className="bg-gray-50 border border-gray-100 rounded-xl px-5 py-4">
                <p className="text-sm text-gray-700 italic mb-2">"{quote}"</p>
                <p className="text-xs text-gray-500 font-medium">— {name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-gray-50 border-t border-gray-100 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-8 text-center">Common questions</h2>
          <div className="space-y-6">
            {[
              ['When do I get paid?', 'Your referral fee is paid within 14 days of the T661 package being delivered to the client\'s CPA. We use e-Transfer for Canadian partners or wire transfer for international.'],
              ['How much can I earn per referral?', 'Flat fees range from $750 (client credit under $75K) to $9,000 (credit over $600K). Plus clients add an extra $750. The fee is based on TaxLift\'s conservative scan estimate, not the final CRA assessment.'],
              ['Does this conflict with CPA Canada Rule 205?', 'No — specifically because it\'s a flat fee, not a percentage of the credit claimed. The fee is paid at T661 delivery, before CRA processes the claim, so there\'s no financial stake in the outcome. We recommend disclosing the arrangement to clients as you would any referral relationship.'],
              ['What if my client is already using TaxLift?', 'If they signed up without a referral code, email us at partners@taxlift.ai and we\'ll sort it out manually.'],
              ['Do I need to be a licensed CPA?', 'The program is open to CPAs, CMAs, CGAs, and tax consultants actively advising Canadian businesses. We may ask for your CPA registration number.'],
              ['What counts as SR&ED for my clients?', 'Generally: software companies doing something technically uncertain — new algorithms, performance optimization, machine learning, novel integrations. If they\'re solving hard engineering problems, they likely qualify.'],
            ].map(([q, a]) => (
              <div key={q} className="border-b border-gray-200 pb-6">
                <p className="font-semibold text-gray-900 mb-2">{q}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-6 text-center text-sm text-gray-400">
        <p>© {new Date().getFullYear()} TaxLift AI · <a href="mailto:partners@taxlift.ai" className="text-indigo-500 hover:underline">partners@taxlift.ai</a></p>
      </footer>

    </div>
  )
}
