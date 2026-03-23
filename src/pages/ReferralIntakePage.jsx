/**
 * ReferralIntakePage — /start?ref=:token
 *
 * Public co-branded landing page that a founder sees when they click a CPA's
 * referral link. No login required.
 *
 * Decodes the ?ref= token to extract:
 *   - firmName    — displayed as "Referred by [Firm]"
 *   - partnerName — CPA partner's name for the trust signal
 *   - refCode     — passed through to the estimator via ?ref=
 *
 * When the token is absent or invalid, falls back gracefully to a generic
 * TaxLift intake page with no referral attribution.
 *
 * Flow:
 *   /start?ref=TOKEN → this page → "Get your free estimate →" → /estimate?ref=TOKEN
 */
import { useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle2, DollarSign, Clock, Shield, Building2,
  ArrowRight, ChevronDown, ChevronUp, Star, Zap, FileText,
  Users, Lightbulb, Calculator, Award, GitMerge,
} from 'lucide-react'
import { decodeReferralToken } from '../data/mockData'

// ─── SR&ED explainer content ──────────────────────────────────────────────────
const SRED_FAQS = [
  {
    q: 'What is SR&ED?',
    a: 'The Scientific Research & Experimental Development (SR&ED) program is Canada\'s largest federal tax incentive. It refunds up to 35% of qualifying R&D expenditures — including developer salaries, contractor costs, and overhead.',
  },
  {
    q: 'Does my company qualify?',
    a: 'If your team writes code that solves problems no existing library or documentation fully answers, or if you\'ve built systems that required genuine trial-and-error to make work, you very likely qualify. Typical qualifiers include AI/ML work, performance optimization, novel architecture design, and debugging technically uncertain problems.',
  },
  {
    q: 'What\'s the typical credit size?',
    a: 'Canadian-Controlled Private Corporations (CCPCs) can recover up to 35% of qualifying labour as a refundable tax credit. A startup spending $500K on engineering might recover $80K–$175K annually, depending on the portion of work that qualifies.',
  },
  {
    q: 'Do I need to do anything special to qualify?',
    a: 'The work just needs to have happened — but you do need documentation to prove it. That\'s exactly what TaxLift automates: it scans your GitHub commits and Jira tickets to identify qualifying activities and builds the required documentation.',
  },
  {
    q: 'How does the CPA come in?',
    a: 'Your CPA reviews and files the T661 form with your T2 corporate tax return. TaxLift prepares the full package — cluster narratives, evidence, and a draft T661 — and hands it off to your CPA to complete and file. TaxLift does not file with the CRA on your behalf.',
  },
]

// ─── Stat tile ────────────────────────────────────────────────────────────────
function StatTile({ value, label, icon: Icon, color }) {
  return (
    <div className={`flex flex-col items-center text-center p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20`}>
      <Icon size={20} className={color} />
      <p className="text-2xl font-black text-white mt-2 leading-none">{value}</p>
      <p className="text-xs text-white/70 mt-1 font-medium">{label}</p>
    </div>
  )
}

// ─── How it works step ────────────────────────────────────────────────────────
function HowItWorksStep({ n, icon: Icon, title, body }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
          <Icon size={16} className="text-indigo-600" />
        </div>
        <div className="w-px flex-1 bg-indigo-100 mt-2" />
      </div>
      <div className="pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Step {n}</span>
        </div>
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────
function FAQ({ item }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full py-4 text-left gap-4 hover:text-indigo-700 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900">{item.q}</span>
        {open ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <p className="text-sm text-gray-500 pb-4 leading-relaxed">{item.a}</p>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ReferralIntakePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const refToken = searchParams.get('ref')

  // Decode referral token — gracefully handle missing/invalid tokens
  const referral = useMemo(() => {
    if (!refToken) return null
    return decodeReferralToken(refToken)
  }, [refToken])

  const firmName    = referral?.firmName    ?? null
  const partnerName = referral?.partnerName ?? null
  const refCode     = searchParams.get('ref') ?? null

  function goToEstimator() {
    const dest = refCode ? `/estimate?ref=${encodeURIComponent(refCode)}` : '/estimate'
    navigate(dest)
  }

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 sm:py-20">

          {/* Referral attribution badge */}
          {firmName && (
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm text-indigo-200 font-medium mb-8">
              <Building2 size={14} className="text-indigo-300" />
              Referred by <strong className="text-white">{firmName}</strong>
            </div>
          )}

          {/* Headline */}
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-1.5 bg-indigo-500/30 border border-indigo-400/40 rounded-full px-3 py-1">
                <Zap size={12} className="text-yellow-300" />
                <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wide">Free SR&ED analysis</span>
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-6">
              Your engineering work could be worth{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-blue-300">
                $50K–$500K in tax credits
              </span>
            </h1>

            <p className="text-lg text-slate-300 leading-relaxed mb-8 max-w-2xl">
              Canada's SR&ED program refunds up to 35% of qualifying R&D spend — but most startups leave it on the table because claiming it feels painful.
              {' '}
              {firmName
                ? <><strong className="text-white">{firmName}</strong> referred you to TaxLift, which automates the documentation so your CPA can file with confidence.</>
                : 'TaxLift automates the documentation so your CPA can file with confidence.'
              }
            </p>

            <button
              onClick={goToEstimator}
              className="inline-flex items-center gap-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-base px-7 py-4 rounded-2xl transition-all hover:shadow-lg hover:shadow-indigo-500/30 group"
            >
              Get your free SR&ED estimate
              <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
            <p className="text-xs text-slate-400 mt-3">Takes 5 minutes · No credit card · No commitment</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-12 max-w-lg">
            <StatTile value="35%"    label="Max refundable ITC rate"    icon={DollarSign} color="text-green-300" />
            <StatTile value="5 min"  label="To your first estimate"     icon={Clock}      color="text-blue-300"  />
            <StatTile value="$0"     label="Upfront cost"               icon={Shield}     color="text-indigo-300" />
          </div>
        </div>
      </div>

      {/* ── CPA trust signal ─────────────────────────────────────────────────── */}
      {firmName && (
        <div className="bg-indigo-50 border-b border-indigo-100">
          <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Building2 size={18} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-900">{firmName}</p>
                {partnerName && <p className="text-xs text-indigo-600">{partnerName}</p>}
              </div>
            </div>
            <div className="flex-1 h-px bg-indigo-200 hidden sm:block" />
            <div className="text-xs text-indigo-700 max-w-md leading-relaxed">
              <strong>{firmName}</strong> will review your SR&ED package and file the T661 with your T2 return.
              TaxLift prepares the documentation — your CPA handles the filing.
            </div>
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-16">

        {/* What qualifies */}
        <section>
          <h2 className="text-2xl font-black text-gray-900 mb-2">What work qualifies?</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            SR&ED isn't just for research labs. If your engineers solved problems that weren't solved by documentation, you likely qualify.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: GitMerge,   title: 'Novel software development', body: 'Building systems where the right approach was genuinely uncertain — new protocols, novel architectures, custom algorithms.' },
              { icon: Lightbulb,  title: 'Experimental ML / AI',       body: 'Training models, tuning hyperparameters, developing custom neural architectures, or researching inference optimization.' },
              { icon: Zap,        title: 'Performance research',       body: 'Systematic investigation into latency, throughput, or scalability when the solution path was unclear at the outset.' },
              { icon: Shield,     title: 'Security R&D',               body: 'Novel approaches to encryption, zero-knowledge proofs, cryptographic protocols, or threat modelling.' },
              { icon: Calculator, title: 'Algorithm design',           body: 'Developing heuristics, approximation algorithms, or optimization approaches that advance beyond the current knowledge base.' },
              { icon: FileText,   title: 'Technical uncertainty',      body: 'Debugging, investigating, or resolving problems where the root cause or solution was systematically unknown.' },
            ].map(item => {
              const Icon = item.icon
              return (
                <div key={item.title} className="flex gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* How it works */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">How it works</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Connect your tools, let TaxLift do the documentation, then hand it to your CPA.
            </p>
            <div>
              <HowItWorksStep n={1} icon={Zap}      title="Get a free estimate (5 min)" body="Answer a few quick questions about your team size, tech stack, and R&D activities. See your estimated credit immediately." />
              <HowItWorksStep n={2} icon={GitMerge} title="Connect GitHub & Jira"        body="TaxLift scans your commit history and tickets for SR&ED signals and automatically surfaces qualifying activities as clusters." />
              <HowItWorksStep n={3} icon={FileText}  title="Review & approve"            body="You review the AI-drafted narratives for each cluster, approve or edit them, and attach evidence documents." />
              <HowItWorksStep n={4} icon={Users}     title="CPA reviews and files"       body={firmName ? `${firmName} receives your complete T661 package and files it with your T2 return.` : 'Your CPA receives your complete T661 package and files it with your T2 return.'} />
            </div>
          </div>

          {/* Social proof */}
          <div className="space-y-5">
            <h2 className="text-2xl font-black text-gray-900 mb-2">What founders say</h2>
            {[
              { name: 'Sarah Chen', title: 'CTO, Acme Corp', quote: 'We had no idea our ML infrastructure work qualified. TaxLift found $116K across 10 clusters in a single afternoon.', stars: 5 },
              { name: 'Daniel Park', title: 'CEO, NovaSystems', quote: 'The GitHub integration is incredible. It found commits I\'d completely forgotten about and turned them into proper SR&ED narratives.', stars: 5 },
              { name: 'Amara Diallo', title: 'Head of Engineering, BrightPath AI', quote: 'We used to dread SR&ED season. Now our CPA gets a package ready to review rather than a stack of emails to chase down.', stars: 5 },
            ].map(review => (
              <div key={review.name} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: review.stars }).map((_, i) => (
                    <Star key={i} size={13} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-700 italic leading-relaxed mb-3">"{review.quote}"</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-bold text-indigo-600">{review.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{review.name}</p>
                    <p className="text-[10px] text-gray-400">{review.title}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Shield,  label: 'CRA-compliant documentation' },
                { icon: Award,   label: 'CPA-reviewed process'         },
                { icon: Clock,   label: 'Claim ready in days, not months' },
              ].map(badge => {
                const Icon = badge.icon
                return (
                  <div key={badge.label} className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <Icon size={16} className="text-indigo-500 mb-1.5" />
                    <p className="text-[10px] font-medium text-gray-600 leading-tight">{badge.label}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-2xl font-black text-gray-900 mb-6">Common questions</h2>
          <div className="bg-white border border-gray-200 rounded-2xl px-6 divide-y divide-gray-100">
            {SRED_FAQS.map(item => <FAQ key={item.q} item={item} />)}
          </div>
        </section>

        {/* CTA block */}
        <section className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-3xl p-10 text-center">
          <h2 className="text-3xl font-black text-white mb-3">
            See how much your team could recover
          </h2>
          <p className="text-indigo-200 text-base mb-8 max-w-md mx-auto leading-relaxed">
            Takes 5 minutes. No commitment.
            {firmName && <> Your estimate goes straight to <strong className="text-white">{firmName}</strong> for review.</>}
          </p>
          <button
            onClick={goToEstimator}
            className="inline-flex items-center gap-3 bg-white text-indigo-700 font-bold text-base px-8 py-4 rounded-2xl hover:bg-indigo-50 transition-colors shadow-lg group"
          >
            Get your free SR&ED estimate
            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
          {firmName && (
            <p className="text-xs text-indigo-300 mt-4">
              Referred by {firmName}
              {partnerName && ` · ${partnerName}`}
            </p>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 py-6 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap text-xs text-gray-400">
          <p>© {new Date().getFullYear()} TaxLift Technologies Inc. · Toronto, ON</p>
          <p>TaxLift prepares SR&ED documentation. Your CPA files with the CRA.</p>
        </div>
      </div>
    </div>
  )
}
