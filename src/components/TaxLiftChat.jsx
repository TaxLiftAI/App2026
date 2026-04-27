/**
 * TaxLiftChat.jsx  —  Conversion-optimised chatbot v4
 *
 * New in v4:
 *   1. Branching opener  — founder vs CPA, two separate flows
 *   2. Provincial top-up — province selector after federal estimate card
 *   3. VCS path          — GitLab / Bitbucket / no-VCS branch at CTA
 *   4. Sample T661 chip  — opens PDF, closes quality objection for both audiences
 *   5. No-CPA path       — seed-stage founders who don't have a CPA yet
 *
 * Place TaxLift_Sample_T661_Package.pdf in webapp/public/ as sample-t661.pdf
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, X, Send, ArrowRight, Zap, TrendingUp, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEADLINE  = new Date('2026-06-30T23:59:59')
const DAYS_LEFT = Math.max(0, Math.ceil((DEADLINE - new Date()) / 86_400_000))
const SESSION_KEY = 'tl_chat_v4'
const SAMPLE_T661_URL = '/sample-t661.pdf'

const SOCIAL_PROOF = [
  '372 Canadian founders found unclaimed credits last month',
  'Average first-time claim: $94,000 cash refund',
  'TaxLift users recover 40% more than consultant estimates',
  '20,000+ Canadian companies file SR&ED every year',
]

const INDUSTRY_FLAVOUR = {
  saas:     'SaaS and cloud infrastructure qualifies heavily — novel API design, algorithm development, and performance engineering all count.',
  ai:       'AI/ML projects are among the strongest SR&ED candidates — model training pipelines, custom architectures, and data preprocessing all qualify.',
  hardware: 'Embedded software and firmware qualify alongside the hardware R&D itself — both labour and materials are claimable.',
  other:    'Most software-forward teams qualify — if you solved a technical problem that wasn\'t solvable off the shelf, that work is claimable.',
}

const SPEND_ESTIMATES = {
  under_100: { label: 'Under $100K',   low: 17_000,  high: 35_000,  range: '$17K – $35K',   colour: 'from-green-500 to-emerald-600' },
  s100_300:  { label: '$100K – $300K', low: 35_000,  high: 105_000, range: '$35K – $105K',  colour: 'from-indigo-500 to-violet-600' },
  s300_600:  { label: '$300K – $600K', low: 105_000, high: 210_000, range: '$105K – $210K', colour: 'from-violet-500 to-purple-600' },
  over_600:  { label: 'Over $600K',    low: 210_000, high: null,    range: '$210K+',         colour: 'from-purple-600 to-indigo-700' },
}

// Provincial SR&ED credits (rate applied to federal low/high as rough multiplier)
const PROVINCES = {
  ontario:  { name: 'Ontario',         rate: 0.08,  credit: 'OITC',  note: '8% Ontario Innovation Tax Credit'      },
  quebec:   { name: 'Quebec',          rate: 0.25,  credit: 'CRDP',  note: '30% Quebec R&D credit on salaries'     },
  bc:       { name: 'BC',             rate: 0.10,  credit: 'BC R&D', note: '10% BC Scientific Research credit'    },
  manitoba: { name: 'Manitoba',        rate: 0.15,  credit: 'MRDTC', note: '15% Manitoba R&D Tax Credit'          },
  other:    { name: 'Alberta / Other', rate: 0,     credit: null,    note: 'No additional provincial SR&ED credit' },
}

function fmtRange(low, high) {
  const fmt = n => n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`
  return high ? `${fmt(low)} – ${fmt(high)}` : `${fmt(low)}+`
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

function useScrollDepth(threshold = 0.45) {
  const [passed, setPassed] = useState(false)
  useEffect(() => {
    const fn = () => {
      const pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)
      if (pct >= threshold) setPassed(true)
    }
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [threshold])
  return passed
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-[5px] px-3 py-2.5">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.85s' }} />
      ))}
    </div>
  )
}

function Avatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600
                    flex items-center justify-center flex-shrink-0 shadow-sm">
      <Zap size={12} className="text-white" />
    </div>
  )
}

function RichText({ text }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} className="font-bold">{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

function BotBubble({ text, highlight }) {
  return (
    <div className="flex items-start gap-2 max-w-[90%]">
      <Avatar />
      <div className={`rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line
        ${highlight ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-200' : 'bg-gray-100 text-gray-800'}`}>
        <RichText text={text} />
      </div>
    </div>
  )
}

function UserBubble({ text }) {
  return (
    <div className="flex justify-end">
      <div className="bg-indigo-50 border border-indigo-100 text-indigo-900
                      rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm max-w-[80%] leading-relaxed font-medium">
        {text}
      </div>
    </div>
  )
}

// Federal estimate card
function EstimateCard({ estimate, industry }) {
  return (
    <div className="flex items-start gap-2 max-w-[90%]">
      <Avatar />
      <div className={`bg-gradient-to-br ${estimate.colour} rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg shadow-indigo-200 min-w-[210px]`}>
        <p className="text-white/80 text-[11px] font-medium uppercase tracking-wide mb-0.5">Federal SR&amp;ED refund</p>
        <p className="text-white text-2xl font-extrabold tracking-tight leading-none mb-1">{estimate.range}</p>
        <p className="text-white/75 text-[11px]">Refundable ITC · cash refund · CCPC rate</p>
        {industry && (
          <div className="mt-2 pt-2 border-t border-white/20">
            <p className="text-white/80 text-[11px]">
              <TrendingUp size={10} className="inline mr-1" />
              {industry === 'ai' ? 'AI/ML — high eligibility' :
               industry === 'saas' ? 'SaaS — strong candidate' :
               industry === 'hardware' ? 'Hardware/Embedded — qualifies' : 'Tech — likely eligible'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Provincial top-up card
function ProvincialCard({ estimate, province }) {
  const provLow  = Math.round(estimate.low  * province.rate / 1_000) * 1_000
  const provHigh = estimate.high ? Math.round(estimate.high * province.rate / 1_000) * 1_000 : null
  const totalLow  = estimate.low  + provLow
  const totalHigh = estimate.high ? estimate.high + provHigh : null

  if (province.rate === 0) return (
    <div className="flex items-start gap-2 max-w-[90%]">
      <Avatar />
      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-gray-700 leading-relaxed">
        Alberta and most other provinces don't have a separate SR&ED credit — your federal refund is your total. Still substantial.
      </div>
    </div>
  )

  return (
    <div className="flex items-start gap-2 max-w-[92%]">
      <Avatar />
      <div className="bg-white border border-indigo-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm min-w-[230px]">
        <p className="text-gray-500 text-[11px] font-medium uppercase tracking-wide mb-2">
          {province.name} top-up applied
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Federal ITC</span>
            <span className="font-semibold text-gray-800">{estimate.range}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-indigo-600 font-medium">+ {province.credit}</span>
            <span className="font-semibold text-indigo-600">+{fmtRange(provLow, provHigh)}</span>
          </div>
          <div className="flex justify-between gap-4 pt-1 border-t border-gray-100">
            <span className="text-gray-800 font-bold">Total estimate</span>
            <span className="font-extrabold text-gray-900 text-base">{fmtRange(totalLow, totalHigh)}</span>
          </div>
        </div>
        <p className="text-gray-400 text-[10px] mt-2">{province.note}</p>
      </div>
    </div>
  )
}

function ProgressBar({ step, total }) {
  const pct = Math.round((step / total) * 100)
  return (
    <div className="px-4 py-1.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
      <div className="flex-1 h-1 bg-indigo-100 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-indigo-500 font-medium flex-shrink-0">{step}/{total}</span>
    </div>
  )
}

function ExitOverlay({ onStay, onCapture, estimate }) {
  const [email, setEmail] = useState('')
  const [err, setErr]     = useState('')
  const [sent, setSent]   = useState(false)
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 100) }, [])

  function submit(e) {
    e?.preventDefault()
    const c = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) { setErr('Enter a valid email'); return }
    setSent(true); onCapture(c)
  }

  if (sent) return (
    <div className="absolute inset-0 z-10 bg-white/97 flex flex-col items-center justify-center px-6 text-center gap-3">
      <span className="text-3xl">🎉</span>
      <p className="text-gray-800 font-semibold text-sm">Check your inbox — breakdown on its way.</p>
      <button onClick={onStay} className="text-indigo-600 text-sm font-medium underline underline-offset-2">Continue chatting</button>
    </div>
  )

  return (
    <div className="absolute inset-0 z-10 bg-white/97 flex flex-col items-center justify-center px-5 text-center gap-3">
      <span className="text-3xl">⏳</span>
      <p className="text-gray-800 font-bold text-sm">
        {estimate ? `Don't leave your **${estimate.range}** estimate behind.` : "Don't leave without your SR&ED estimate."}
      </p>
      <p className="text-gray-500 text-xs">We'll email the full breakdown so you can review it later.</p>
      <form onSubmit={submit} className="w-full flex flex-col gap-2">
        <input ref={ref} type="email" value={email}
          onChange={e => { setEmail(e.target.value); setErr('') }}
          placeholder="you@company.com"
          className={`w-full px-3 py-2.5 text-sm rounded-xl border outline-none
            focus:ring-2 focus:ring-indigo-400 focus:border-transparent
            ${err ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`} />
        {err && <p className="text-red-500 text-xs text-left pl-1">{err}</p>}
        <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">
          Send me my estimate →
        </button>
      </form>
      <button onClick={onStay} className="text-gray-400 text-xs hover:text-gray-600">No thanks, close</button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function TaxLiftChat({ onLeadCapture }) {
  const navigate  = useNavigate()
  const bottomRef = useRef(null)
  const emailRef  = useRef(null)
  const scrolled  = useScrollDepth(0.45)

  const [open,         setOpen]         = useState(false)
  const [messages,     setMessages]     = useState([])
  const [chips,        setChips]        = useState([])
  const [typing,       setTyping]       = useState(false)
  const [hasOpened,    setHasOpened]    = useState(false)
  const [unread,       setUnread]       = useState(false)
  const [step,         setStep]         = useState(0)
  const [totalSteps,   setTotalSteps]   = useState(5)
  const [estimate,     setEstimate]     = useState(null)
  const [province,     setProvince]     = useState(null)
  const [industry,     setIndustry]     = useState(null)
  const [visitorType,  setVisitorType]  = useState(null)   // 'founder' | 'cpa'
  const [emailMode,    setEmailMode]    = useState(false)
  const [emailVal,     setEmailVal]     = useState('')
  const [emailSent,    setEmailSent]    = useState(false)
  const [emailError,   setEmailError]   = useState('')
  const [showExit,     setShowExit]     = useState(false)
  const [proofIdx,     setProofIdx]     = useState(0)
  const [midFlow,      setMidFlow]      = useState(false)

  // Rotate social proof
  useEffect(() => {
    const t = setInterval(() => setProofIdx(i => (i + 1) % SOCIAL_PROOF.length), 4_000)
    return () => clearInterval(t)
  }, [])

  // Auto-trigger: 8 s or 45% scroll
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) || hasOpened) return
    const t = setTimeout(() => { if (!open) { setUnread(true); sessionStorage.setItem(SESSION_KEY, '1') } }, 8_000)
    return () => clearTimeout(t)
  }, [open, hasOpened])

  useEffect(() => {
    if (!scrolled || hasOpened || sessionStorage.getItem(SESSION_KEY)) return
    setUnread(true); sessionStorage.setItem(SESSION_KEY, '1')
  }, [scrolled, hasOpened])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing, chips, emailMode])
  useEffect(() => { if (emailMode) setTimeout(() => emailRef.current?.focus(), 200) }, [emailMode])

  // ── Message helpers ───────────────────────────────────────────────────────
  const pushBotMessages = useCallback((texts, { onDone, highlight = false } = {}) => {
    const arr = Array.isArray(texts) ? texts : [texts]
    setChips([])
    let delay = 250
    arr.forEach((text, i) => {
      const rt = Math.min(text.replace(/\*\*/g, '').length * 16, 1_200)
      setTimeout(() => {
        setTyping(true)
        setTimeout(() => {
          setTyping(false)
          setMessages(prev => [...prev, { role: 'bot', text, highlight: highlight && i === 0 }])
          if (i === arr.length - 1) onDone?.()
        }, rt)
      }, delay)
      delay += rt + 400
    })
  }, [])

  const pushUser = useCallback(text => {
    setMessages(prev => [...prev, { role: 'user', text }])
    setChips([])
    setMidFlow(true)
  }, [])

  const pushCard = useCallback((type, data, onDone) => {
    setMessages(prev => [...prev, { role: 'card', cardType: type, ...data }])
    setTimeout(onDone, 350)
  }, [])

  // ── Phase 0: Branching opener ─────────────────────────────────────────────
  function startOpener() {
    setStep(1)
    pushBotMessages([
      "👋 Welcome to TaxLift —",
      "Are you exploring SR&ED for your own company, or are you a CPA / accountant?",
    ], {
      onDone: () => setChips([
        { label: '🚀 Founder / CTO — checking eligibility',   onClick: () => chooseFounder() },
        { label: '🧮 CPA / Accountant — exploring a partner', onClick: () => chooseCpa()     },
      ]),
    })
  }

  // ── CPA flow ──────────────────────────────────────────────────────────────
  function chooseCpa() {
    pushUser('CPA / Accountant — exploring a partner')
    setVisitorType('cpa')
    setTotalSteps(3)
    setStep(2)
    pushBotMessages([
      "Great — TaxLift is a white-label documentation platform for CPA firms. Your clients connect GitHub, we generate the T661 package, your team reviews and files.",
      "What's your main question about the partnership?",
    ], {
      onDone: () => setChips([
        { label: '📄 Show me a sample T661 output',      onClick: () => handleCpaQ('sample')    },
        { label: '⚖️  Am I liable if CRA disputes it?',  onClick: () => handleCpaQ('liability') },
        { label: '🏷️  Does my client know it\'s TaxLift?', onClick: () => handleCpaQ('whitelabel') },
        { label: '💰  What does the CPA seat cost?',     onClick: () => handleCpaQ('pricing')   },
        { label: '⏱️  How long to onboard?',             onClick: () => handleCpaQ('onboard')   },
      ]),
    })
  }

  function handleCpaQ(topic) {
    const qa = {
      sample: {
        user: 'Show me a sample T661 output',
        msgs: [
          "Here's a real sample package generated for a fictitious Toronto CCPC — includes Part 2 narratives for Lines 242, 244, and 246, financial schedule, developer hours, and the SHA-256 evidence chain.",
          "Click below to open the PDF. Most CPAs tell us the output quality exceeds what they were producing manually.",
        ],
        chips: [
          { label: '📄 Open sample T661 package', onClick: openSampleT661, primary: true },
          { label: '🔙 Other questions',           onClick: showCpaCTA                    },
        ],
      },
      liability: {
        user: 'Am I liable if CRA disputes it?',
        msgs: [
          "No — TaxLift is documentation software. **You review and file the claim.** The professional liability stays with the CPA who signs off, exactly as it does today.",
          "TaxLift's tamper-evident SHA-256 evidence chain is specifically designed to support CRA review. Each claim is timestamped and linked to actual commits — giving you a defensible paper trail.",
          "Think of it as replacing the 40 hours of documentation prep with a 2-hour review. The expertise and professional judgment remains entirely yours.",
        ],
        chips: [{ label: '📄 See sample output', onClick: openSampleT661, primary: true }, { label: '🔙 Other questions', onClick: showCpaCTA }],
      },
      whitelabel: {
        user: "Does my client know it's TaxLift?",
        msgs: [
          "That's your choice. The T661 package is delivered as a PDF — you can present it under your firm's name.",
          "Many partner firms white-label TaxLift entirely. Your client sees a seamless service from you. TaxLift operates in the background.",
        ],
        chips: [{ label: '📅 Book a partner demo', onClick: goToDemo, primary: true }, { label: '🔙 Other questions', onClick: showCpaCTA }],
      },
      pricing: {
        user: 'What does the CPA seat cost?',
        msgs: [
          "Seat pricing depends on your firm size and client volume — we confirm it on a 20-minute call so we can scope it properly.",
          "What I can tell you: it's a flat annual fee (no percentage of client refunds), and most firms recover the cost within their first two claims.",
          "Your clients pay TaxLift $999 flat. You earn **$300 per referred client** — no percentage, no Rule 205 issues.",
        ],
        chips: [{ label: '📅 Book a 20-min call', onClick: goToDemo, primary: true }, { label: '🔙 Other questions', onClick: showCpaCTA }],
      },
      onboard: {
        user: 'How long to onboard?',
        msgs: [
          "Under 20 minutes for your first client. You connect their GitHub via read-only OAuth, TaxLift scans in 24–48 hours, and you get the T661 package to review.",
          "No integration work, no new tools to learn. The output lands in your inbox as a PDF.",
        ],
        chips: [{ label: '📅 See it live — 20-min demo', onClick: goToDemo, primary: true }, { label: '📄 See sample output', onClick: openSampleT661 }],
      },
    }
    const q = qa[topic]
    if (!q) return
    pushUser(q.user)
    setStep(3)
    pushBotMessages(q.msgs, { onDone: () => setChips(q.chips) })
  }

  function showCpaCTA() {
    setStep(3)
    pushBotMessages(
      ["Ready to see it live? A 20-minute demo shows you the full T661 package quality and the partner economics."],
      {
        onDone: () => setChips([
          { label: '📅 Book a partner demo', onClick: goToDemo, primary: true },
          { label: '📄 See sample T661 first', onClick: openSampleT661          },
          { label: '🔙 More questions',        onClick: chooseCpa               },
        ]),
      }
    )
  }

  // ── Founder flow ──────────────────────────────────────────────────────────
  function chooseFounder() {
    pushUser('Founder / CTO — checking eligibility')
    setVisitorType('founder')
    setTotalSteps(6)
    setStep(2)
    pushBotMessages([
      `**${SOCIAL_PROOF[0]}.**\n\nMost didn't realise they qualified. Let's check if you do.`,
      "What does your team primarily build?",
    ], {
      onDone: () => setChips([
        { label: '⚡ SaaS / Cloud / APIs',     onClick: () => handleIndustry('saas',     'SaaS / Cloud / APIs')   },
        { label: '🤖 AI / ML / Data',           onClick: () => handleIndustry('ai',       'AI / ML / Data')        },
        { label: '🔧 Hardware / Embedded',       onClick: () => handleIndustry('hardware', 'Hardware / Embedded')   },
        { label: '💻 Other software / tech',     onClick: () => handleIndustry('other',    'Other software / tech') },
        { label: "🤷 Not sure I qualify",        onClick: handleEligibilityQuiz                                     },
      ]),
    })
  }

  function handleIndustry(id, label) {
    pushUser(label)
    setIndustry(id)
    setStep(3)
    pushBotMessages(
      [`${INDUSTRY_FLAVOUR[id]}\n\nHow much did your engineering team cost last year? (salary + contractors combined)`],
      {
        onDone: () => setChips(
          Object.entries(SPEND_ESTIMATES).map(([id, est]) => ({
            label: est.label, onClick: () => handleSpend(id, est.label),
          }))
        ),
      }
    )
  }

  function handleSpend(spendId, label) {
    pushUser(label)
    setStep(4)
    const est = SPEND_ESTIMATES[spendId]
    setEstimate(est)
    pushBotMessages(['Based on your engineering spend, here\'s your estimated **federal** SR&ED refund:'], {
      onDone: () => pushCard('estimate', { estimate: est, industry }, () => {
        pushBotMessages(['Which province is your company based in?'], {
          onDone: () => setChips([
            { label: '🏙️ Ontario',         onClick: () => handleProvince('ontario',  'Ontario')  },
            { label: '🍁 Quebec',           onClick: () => handleProvince('quebec',   'Quebec')   },
            { label: '🌊 BC',              onClick: () => handleProvince('bc',       'BC')       },
            { label: '🌾 Manitoba',         onClick: () => handleProvince('manitoba', 'Manitoba') },
            { label: '🏔️ Alberta / Other', onClick: () => handleProvince('other',    'Alberta / Other') },
          ]),
        })
      }),
    })
  }

  // ── Province → top-up card ────────────────────────────────────────────────
  function handleProvince(provId, label) {
    pushUser(label)
    setStep(5)
    const prov = PROVINCES[provId]
    setProvince(prov)

    if (prov.rate > 0) {
      pushBotMessages([`Good news — ${prov.name} has an additional SR&ED credit. Here's your updated total:`], {
        onDone: () => pushCard('provincial', { estimate, province: prov }, () => {
          afterProvince(prov)
        }),
      })
    } else {
      pushBotMessages(
        ["Alberta and most other provinces don't have a separate SR&ED credit — your federal refund is the full amount. Still significant."],
        { onDone: () => afterProvince(prov) }
      )
    }
  }

  function afterProvince(prov) {
    pushBotMessages(
      [
        DAYS_LEFT > 0
          ? `⏰ FY 2024 claims close in **${DAYS_LEFT} days** (June 30) — this is cash in your account, not a deduction.`
          : `⚠️ This year's deadline has passed, but TaxLift looks back 18 months. Prior years are still on the table.`,
        "Have you filed SR&ED before?",
      ],
      {
        highlight: true,
        onDone: () => setChips([
          { label: "🆕 Never filed SR&ED",           onClick: () => handleFiled('never')  },
          { label: "📁 Filed before — want more",    onClick: () => handleFiled('before') },
          { label: "🤝 My CPA handles it",           onClick: () => handleFiled('cpa')    },
          { label: "👤 I don't have a CPA yet",      onClick: () => handleFiled('nocpa')  },
        ]),
      }
    )
  }

  // ── Filed context ─────────────────────────────────────────────────────────
  function handleFiled(ctx) {
    const labels = {
      never:  'Never filed SR&ED',
      before: 'Filed before — want more',
      cpa:    'My CPA handles it',
      nocpa:  "I don't have a CPA yet",
    }
    pushUser(labels[ctx])
    setStep(6)

    const msgs = {
      never: [
        "Even better — you can claim **retroactively up to 18 months** across 3 open CRA fiscal years.",
        "Most first-time filers are surprised by how much has accumulated. TaxLift shows you exactly what qualifies, year by year.",
      ],
      before: [
        "TaxLift users recover **40% more on average** than their previous consultant — because our GitHub scan catches eligible work that narrative-based reviews miss.",
        "Connect once and we'll show you what was left on the table.",
      ],
      cpa: [
        "TaxLift doesn't replace your CPA — it eliminates **95% of their prep time.**",
        "Your CPA gets a T661-ready package: Part 2 narratives, financial schedule, and a tamper-evident evidence chain. What took them weeks now takes an afternoon.",
      ],
      nocpa: [
        "No problem — **you don't need an SR&ED specialist.** Any CPA can review and file TaxLift's output.",
        "If you don't have a CPA at all, TaxLift can connect you with one of our partner firms. They handle the review and filing — you still pay the flat $999, and the CPA fees are a fraction of what a traditional SR&ED consultant charges.",
      ],
    }

    pushBotMessages(msgs[ctx], { onDone: showFounderCTA })
  }

  // ── Founder CTA ───────────────────────────────────────────────────────────
  function showFounderCTA() {
    const range = estimate?.range || 'your estimate'
    pushBotMessages(
      [`Connect GitHub in **2 minutes** — read-only access, no code stored, no credit card.`],
      {
        onDone: () => setChips([
          { label: `→ Get my ${range} estimate — free`, onClick: goToScan,                        primary: true },
          { label: '💻 We use GitLab / Bitbucket',       onClick: handleVcs                                     },
          { label: '📄 Show me a sample T661 first',     onClick: openSampleT661                               },
          { label: '📅 Book a 20-min walkthrough',        onClick: goToDemo                                     },
          { label: '🔒 Will CRA audit me?',              onClick: () => handleFaq('audit')                     },
          { label: '📊 How accurate is this?',           onClick: () => handleFaq('accuracy')                  },
        ]),
      }
    )
  }

  // ── VCS path ──────────────────────────────────────────────────────────────
  function handleVcs() {
    pushUser('We use GitLab / Bitbucket')
    pushBotMessages([
      "**GitLab and Bitbucket are both fully supported** — connect via OAuth in the same 2-minute flow.",
      "Azure DevOps and Jira are also supported. If you use a different VCS or no VCS, TaxLift has a manual log upload path — you can export your commit history as a CSV and we'll process it.",
      "Which one are you on?",
    ], {
      onDone: () => setChips([
        { label: 'GitLab',              onClick: () => { pushUser('GitLab');       goToScan() }, primary: true },
        { label: 'Bitbucket',           onClick: () => { pushUser('Bitbucket');    goToScan() }, primary: true },
        { label: 'Azure DevOps / Jira', onClick: () => { pushUser('Azure DevOps'); goToScan() }, primary: true },
        { label: 'No VCS / manual',     onClick: handleNoVcs                                                   },
      ]),
    })
  }

  function handleNoVcs() {
    pushUser('No VCS / manual')
    pushBotMessages([
      "No problem — you can export developer time logs, Jira tickets, or a simple spreadsheet of engineering work. TaxLift's manual upload flow walks you through the format.",
      "It takes a bit longer than the GitHub connect path, but we've successfully processed claims this way.",
    ], {
      onDone: () => setChips([
        { label: '→ Try the manual upload path', onClick: () => { navigate('/scan'); setOpen(false) }, primary: true },
        { label: '📅 Walk me through it on a call', onClick: goToDemo },
      ]),
    })
  }

  // ── Eligibility quiz ──────────────────────────────────────────────────────
  function handleEligibilityQuiz() {
    pushUser("Not sure I qualify")
    setStep(3)
    pushBotMessages([
      "Quick check. Did your team write code to solve a technical problem where the answer wasn't obvious upfront?",
      "Examples: a recommendation engine, a custom data pipeline, real-time sync logic, an ML model, a novel API — anything where engineers experimented before landing on the answer.",
    ], {
      onDone: () => setChips([
        { label: "✅ Yes — that sounds like us", onClick: () => handleEligible(true)  },
        { label: "❌ Not really",                onClick: () => handleEligible(false) },
      ]),
    })
  }

  function handleEligible(yes) {
    pushUser(yes ? "Yes — that sounds like us" : "Not really")
    if (yes) {
      pushBotMessages([
        "**You almost certainly qualify.** That's the core SR&ED test — technological uncertainty + systematic investigation.",
        "How much did your engineering team cost last year?",
      ], {
        onDone: () => setChips(
          Object.entries(SPEND_ESTIMATES).map(([id, est]) => ({
            label: est.label, onClick: () => handleSpend(id, est.label),
          }))
        ),
      })
    } else {
      pushBotMessages([
        "Understood. Most teams underestimate what qualifies — a 20-minute call with our team often finds work you didn't think counted.",
      ], {
        onDone: () => setChips([
          { label: '📅 Book a free eligibility call', onClick: goToDemo, primary: true },
          { label: '🔙 Check my spend anyway',         onClick: () => {
            pushUser('Check my spend anyway')
            setChips(Object.entries(SPEND_ESTIMATES).map(([id, est]) => ({
              label: est.label, onClick: () => handleSpend(id, est.label),
            })))
          }},
        ]),
      })
    }
  }

  // ── FAQ ───────────────────────────────────────────────────────────────────
  function handleFaq(topic) {
    const faqMap = {
      audit: {
        user: 'Will CRA audit me?',
        msgs: [
          "SR&ED is a **legitimate, government-run program** — 20,000+ Canadian companies file every year.",
          "TaxLift's tamper-evident SHA-256 chain is built specifically for CRA review. Every claim is timestamped and linked to actual commits.",
          "If an audit happens, your CPA has a complete, defensible documentation package ready. Most clients pass with zero follow-up questions.",
        ],
      },
      accuracy: {
        user: 'How accurate is this estimate?',
        msgs: [
          "The range shown is **conservative by design** — it's based on your spend range, not your exact spend.",
          "After the GitHub scan, TaxLift identifies qualifying commits at the commit level. Post-scan estimates are typically accurate to within ±8%.",
          "On average, TaxLift users qualify **68–82% of their engineering spend** as SR&ED.",
        ],
      },
    }
    const faq = faqMap[topic]
    if (!faq) return
    pushUser(faq.user)
    pushBotMessages(faq.msgs, {
      onDone: () => setChips([
        { label: '→ Get my estimate — free', onClick: goToScan, primary: true },
        { label: '📅 Book a demo',            onClick: goToDemo               },
        { label: '🔙 Back',                   onClick: showFounderCTA          },
      ]),
    })
  }

  // ── Email capture ─────────────────────────────────────────────────────────
  function goToScan() {
    setChips([])
    if (emailSent) { navigate('/scan'); setOpen(false); return }
    pushBotMessages(
      [`Last step — where should we send your full SR&ED breakdown?\nWe'll email it before you connect GitHub.`],
      { onDone: () => setEmailMode(true) }
    )
  }

  function submitEmail(e) {
    e?.preventDefault()
    const clean = emailVal.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { setEmailError('Enter a valid email'); return }
    setEmailError(''); setEmailMode(false); setEmailSent(true)
    onLeadCapture?.(clean, estimate?.range)
    pushUser(clean)
    pushBotMessages(
      [`We'll send your breakdown to **${clean}** 🎉\n\nNow let's get your exact number — GitHub connect takes 2 minutes.`],
      {
        onDone: () => setChips([
          { label: '→ Connect GitHub now', onClick: () => { navigate('/scan'); setOpen(false) }, primary: true },
        ]),
      }
    )
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function openSampleT661() {
    window.open(SAMPLE_T661_URL, '_blank', 'noopener,noreferrer')
  }

  function goToDemo() {
    const url = import.meta.env.VITE_CALENDLY_URL ?? 'https://calendly.com/taxlift/free-review'
    window.open(url, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  function handleClose() {
    if (midFlow && !emailSent && step >= 3) { setShowExit(true) } else { setOpen(false) }
  }

  function handleOpen() {
    setOpen(true); setUnread(false); setShowExit(false)
    sessionStorage.setItem(SESSION_KEY, '1')
    if (!hasOpened) { setHasOpened(true); startOpener() }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating bubble */}
      <button onClick={handleOpen} aria-label="Open TaxLift chat"
        className={`fixed bottom-5 right-5 z-[100] flex items-center gap-2 pl-4 pr-5 py-3 rounded-full shadow-xl
          bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700
          active:scale-95 transition-all duration-200
          ${open ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}>
        {unread && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse z-10" />}
        <MessageCircle className="text-white w-5 h-5 flex-shrink-0" />
        <span className="text-white text-sm font-semibold whitespace-nowrap hidden sm:block">
          {unread ? 'See what your commits are worth →' : 'Chat with TaxLift'}
        </span>
      </button>

      {/* Chat window */}
      <div aria-label="TaxLift chat assistant"
        className={`fixed bottom-5 right-5 z-[100] w-[385px] max-w-[calc(100vw-1.5rem)]
          rounded-2xl shadow-2xl overflow-hidden flex flex-col bg-white
          transition-all duration-300 origin-bottom-right
          ${open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'}`}
        style={{ maxHeight: 'min(640px, calc(100vh - 5rem))', height: 'min(640px, calc(100vh - 5rem))' }}>

        {/* Exit overlay */}
        {showExit && <ExitOverlay estimate={estimate} onStay={() => { setShowExit(false); setOpen(false) }} onCapture={email => { setEmailSent(true); onLeadCapture?.(email, estimate?.range) }} />}

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shadow-inner">
            <Zap size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight">TaxLift AI</p>
            <p className="text-indigo-200 text-[10px] leading-tight truncate transition-all duration-700">
              {step === 0
                ? SOCIAL_PROOF[proofIdx]
                : DAYS_LEFT > 0
                  ? `⏰ ${DAYS_LEFT} days to June 30 SR&ED deadline`
                  : 'SR&ED assistant · always free to check'}
            </p>
          </div>
          <button onClick={handleClose} aria-label="Close chat"
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X size={17} />
          </button>
        </div>

        {/* Progress bar */}
        {step > 0 && <ProgressBar step={step} total={totalSteps} />}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth">
          {messages.map((m, i) => {
            if (m.role === 'card' && m.cardType === 'estimate')
              return <EstimateCard key={i} estimate={m.estimate} industry={m.industry} />
            if (m.role === 'card' && m.cardType === 'provincial')
              return <ProvincialCard key={i} estimate={m.estimate} province={m.province} />
            if (m.role === 'bot') return <BotBubble key={i} text={m.text} highlight={m.highlight} />
            return <UserBubble key={i} text={m.text} />
          })}
          {typing && (
            <div className="flex items-start gap-2">
              <Avatar />
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm"><TypingDots /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Email input */}
        {emailMode && !emailSent && (
          <form onSubmit={submitEmail} className="px-3 pb-3 pt-2 border-t border-gray-100 flex-shrink-0 bg-white">
            <div className="flex gap-2">
              <input ref={emailRef} type="email" value={emailVal}
                onChange={e => { setEmailVal(e.target.value); setEmailError('') }}
                placeholder="you@company.com"
                className={`flex-1 px-3 py-2.5 text-sm rounded-xl border outline-none
                  focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                  ${emailError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`} />
              <button type="submit" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white
                rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors active:scale-95">
                <Send size={14} />
              </button>
            </div>
            {emailError && <p className="text-red-500 text-xs mt-1 pl-1">{emailError}</p>}
            <button type="button" onClick={() => { setEmailMode(false); navigate('/scan'); setOpen(false) }}
              className="mt-1.5 text-xs text-gray-400 hover:text-gray-600 pl-1 underline underline-offset-2">
              Skip — take me to GitHub connect
            </button>
          </form>
        )}

        {/* Chips */}
        {chips.length > 0 && !emailMode && (
          <div className="bg-white px-3 pb-3 pt-2 flex flex-col gap-1.5 border-t border-gray-100 flex-shrink-0">
            {chips.map((chip, i) => (
              <button key={i} onClick={chip.onClick}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium
                  flex items-center justify-between gap-2 transition-all duration-150 active:scale-[0.98]
                  ${chip.primary
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200'
                    : 'border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300'}`}>
                <span>{chip.label}</span>
                <ArrowRight size={14} className="flex-shrink-0 opacity-60" />
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-1.5 flex-shrink-0">
          <p className="text-center text-[10px] text-gray-400">
            🔒 Read-only GitHub · No code stored · CRA-compliant · $999 flat
          </p>
        </div>
      </div>
    </>
  )
}
