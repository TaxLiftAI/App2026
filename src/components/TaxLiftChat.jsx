/**
 * TaxLiftChat.jsx  —  Conversion-optimised floating chatbot for taxlift.ai
 *
 * Flow:
 *   1. Hook  →  provocative opener (auto-triggers at 8 s or 50% scroll)
 *   2. Qualify  →  engineering spend range → personalised $ estimate
 *   3. Context  →  have you filed before? (shapes CTA copy)
 *   4. Email capture  →  inline input at peak engagement
 *   5. CTA  →  "Get my $XX,000 estimate" → /scan
 *   Side-branches: audit fear, CPA objection, accuracy, what-is-sred
 *
 * Props:
 *   onOpenCalendly   () => void   — opens the Calendly modal
 *   onLeadCapture    (email, estimate) => void   — optional, POST to your CRM
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, X, ChevronRight, Send, ArrowRight, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEADLINE   = new Date('2026-06-30T23:59:59')
const DAYS_LEFT  = Math.max(0, Math.ceil((DEADLINE - new Date()) / 86_400_000))

// Spend ranges → estimate copy + dollar figures used in CTAs
const SPEND_ESTIMATES = {
  'under_100': {
    label:    'Under $100K',
    low:  17_000,
    high: 35_000,
    copy: 'Based on that spend, you could qualify for',
    range: '$17,000 – $35,000',
  },
  '100_300': {
    label:    '$100K – $300K',
    low:  35_000,
    high: 105_000,
    copy: 'Based on that spend, you could qualify for',
    range: '$35,000 – $105,000',
  },
  '300_600': {
    label:    '$300K – $600K',
    low: 105_000,
    high: 210_000,
    copy: "That's a significant claim — you could qualify for",
    range: '$105,000 – $210,000',
  },
  'over_600': {
    label:    'Over $600K',
    low: 210_000,
    high: null,
    copy: "At that level your SR&ED claim could exceed",
    range: '$210,000+',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtK(n) {
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`
}

function useScrollDepth(threshold = 0.5) {
  const [passed, setPassed] = useState(false)
  useEffect(() => {
    function onScroll() {
      const doc  = document.documentElement
      const pct  = (window.scrollY) / (doc.scrollHeight - doc.clientHeight)
      if (pct >= threshold) setPassed(true)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
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
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.85s' }}
        />
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

function BotBubble({ text, highlight }) {
  return (
    <div className="flex items-start gap-2 max-w-[88%]">
      <Avatar />
      <div className={`rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line
        ${highlight
          ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-200'
          : 'bg-gray-100 text-gray-800'}`}>
        {text}
      </div>
    </div>
  )
}

function UserBubble({ text }) {
  return (
    <div className="flex justify-end">
      <div className="bg-indigo-50 border border-indigo-100 text-indigo-900
                      rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm
                      max-w-[80%] leading-relaxed font-medium">
        {text}
      </div>
    </div>
  )
}

function ProgressBar({ step, total = 4 }) {
  const pct = Math.round((step / total) * 100)
  return (
    <div className="px-4 py-1.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
      <div className="flex-1 h-1 bg-indigo-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-indigo-500 font-medium flex-shrink-0">
        {step}/{total}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function TaxLiftChat({ onOpenCalendly, onLeadCapture }) {
  const navigate   = useNavigate()
  const bottomRef  = useRef(null)
  const emailRef   = useRef(null)
  const scrolled   = useScrollDepth(0.45)

  // ── State ─────────────────────────────────────────────────────────────────
  const [open,        setOpen]        = useState(false)
  const [messages,    setMessages]    = useState([])
  const [chips,       setChips]       = useState([])
  const [typing,      setTyping]      = useState(false)
  const [hasOpened,   setHasOpened]   = useState(false)
  const [unread,      setUnread]      = useState(false)
  const [step,        setStep]        = useState(0)       // progress bar
  const [estimate,    setEstimate]    = useState(null)    // SPEND_ESTIMATES entry
  const [emailMode,   setEmailMode]   = useState(false)   // show email input
  const [emailVal,    setEmailVal]    = useState('')
  const [emailSent,   setEmailSent]   = useState(false)
  const [emailError,  setEmailError]  = useState('')
  const [phase,       setPhase]       = useState('hook')  // hook|spend|context|cta|faq

  // ── Auto-trigger: 8 s on desktop, or after 45% scroll ─────────────────────
  useEffect(() => {
    if (sessionStorage.getItem('chat_v2_prompted') || hasOpened) return
    const trigger = () => {
      if (!open) setUnread(true)
      sessionStorage.setItem('chat_v2_prompted', '1')
    }
    const t = setTimeout(trigger, 8_000)
    return () => clearTimeout(t)
  }, [open, hasOpened])

  useEffect(() => {
    if (!scrolled || hasOpened || sessionStorage.getItem('chat_v2_prompted')) return
    setUnread(true)
    sessionStorage.setItem('chat_v2_prompted', '1')
  }, [scrolled, hasOpened])

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing, chips, emailMode])

  useEffect(() => {
    if (emailMode) setTimeout(() => emailRef.current?.focus(), 200)
  }, [emailMode])

  // ── Message streaming helper ───────────────────────────────────────────────
  const pushBotMessages = useCallback((texts, { onDone, highlight = false } = {}) => {
    const arr = Array.isArray(texts) ? texts : [texts]
    setChips([])

    let delay = 300
    arr.forEach((text, i) => {
      const readTime = Math.min(text.length * 22, 1_400)
      setTimeout(() => {
        setTyping(true)
        setTimeout(() => {
          setTyping(false)
          setMessages(prev => [...prev, { role: 'bot', text, highlight: highlight && i === 0 }])
          if (i === arr.length - 1) onDone?.()
        }, readTime)
      }, delay)
      delay += readTime + 500
    })

    return delay  // total duration
  }, [])

  const pushImmediate = useCallback((texts, opts = {}) => {
    const arr = Array.isArray(texts) ? texts : [texts]
    setMessages(prev => [
      ...prev,
      ...arr.map((text, i) => ({
        role: 'bot',
        text,
        highlight: opts.highlight && i === 0,
      })),
    ])
    opts.onDone?.()
  }, [])

  const pushUser = useCallback(text => {
    setMessages(prev => [...prev, { role: 'user', text }])
    setChips([])
  }, [])

  // ── Phase: hook ───────────────────────────────────────────────────────────
  function startHook(immediate = false) {
    setStep(1)
    setPhase('hook')
    const msgs = [
      "👋 Quick question before you scroll away —",
      "Canadian tech companies left **$2.1B** in SR&ED credits unclaimed last year.\n\nMost didn't realise they qualified.",
      "How much did your engineering team cost last year?\n(salary + contractors combined)",
    ]
    const fn = immediate ? pushImmediate : pushBotMessages
    fn(msgs, {
      onDone: () =>
        setChips([
          { label: 'Under $100K',     id: 'under_100' },
          { label: '$100K – $300K',   id: '100_300'   },
          { label: '$300K – $600K',   id: '300_600'   },
          { label: 'Over $600K',      id: 'over_600'  },
        ].map(c => ({ ...c, onClick: () => handleSpend(c.id, c.label) }))),
    })
  }

  // ── Phase: spend selected → estimate ──────────────────────────────────────
  function handleSpend(spendId, label) {
    pushUser(label)
    setStep(2)
    setPhase('spend')
    const est = SPEND_ESTIMATES[spendId]
    setEstimate(est)

    pushBotMessages(
      [
        `${est.copy} **${est.range}** in federal SR&ED credits — as a cash refund, not just a deduction.`,
        DAYS_LEFT > 0
          ? `⏰ FY 2024 claims close in **${DAYS_LEFT} days** (June 30). If you haven't filed yet, the clock is running.`
          : `⚠️ This year's deadline has passed — but TaxLift can look back up to 18 months, so prior years may still be open.`,
        "Have you filed SR&ED before?",
      ],
      {
        highlight: true,
        onDone: () =>
          setChips([
            { label: "🆕 Never filed SR&ED",          onClick: () => handleFiled('never')      },
            { label: "📁 Filed before — want more",   onClick: () => handleFiled('before')     },
            { label: "🤝 My CPA handles it",          onClick: () => handleFiled('cpa')        },
          ]),
      },
    )
  }

  // ── Phase: context → CTA ──────────────────────────────────────────────────
  function handleFiled(ctx) {
    const labels = {
      never:  'Never filed SR&ED',
      before: 'Filed before — want more',
      cpa:    'My CPA handles it',
    }
    pushUser(labels[ctx])
    setStep(3)
    setPhase('context')

    const ctxMsgs = {
      never: [
        "Even better — you can claim retroactively up to 18 months across 3 open CRA fiscal years.",
        "Most first-time filers are surprised by how much they've accumulated. TaxLift will show you exactly what qualifies across all open years.",
      ],
      before: [
        "The average TaxLift user recovers **40% more** than their previous consultant found — because our GitHub scan catches eligible work that narrative-based reviews miss.",
        "Connect once and we'll show you what was left on the table.",
      ],
      cpa: [
        "Great — TaxLift doesn't replace your CPA. We eliminate 95% of their prep time.",
        "Your CPA gets a T661-ready package: Part 2 narratives (Lines 242/244/246), financial schedule, and a tamper-evident evidence chain. What took them weeks now takes an afternoon.",
        "Many CPA firms white-label TaxLift and pass the time savings to their clients.",
      ],
    }

    pushBotMessages(ctxMsgs[ctx], { onDone: () => showCTA() })
  }

  // ── CTA phase ─────────────────────────────────────────────────────────────
  function showCTA() {
    setStep(4)
    setPhase('cta')
    const range = estimate?.range || 'your SR&ED estimate'
    pushBotMessages(
      [`To see your exact number, connect GitHub — read-only, takes 2 minutes, no credit card.`],
      {
        onDone: () =>
          setChips([
            { label: `→ Get my ${range} estimate — free`, onClick: goToScan, primary: true },
            { label: '📅 Book a 20-min walkthrough',      onClick: goToDemo                },
            { label: '🔒 Will CRA audit me?',             onClick: () => handleFaq('audit')    },
            { label: '📊 How accurate is the estimate?',  onClick: () => handleFaq('accuracy') },
          ]),
      },
    )
  }

  // ── FAQ side-branches ─────────────────────────────────────────────────────
  function handleFaq(topic) {
    const faqMap = {
      audit: {
        user: 'Will CRA audit me?',
        msgs: [
          "SR&ED is a legitimate, government-run program — 20,000+ Canadian companies file every year.",
          "TaxLift's tamper-evident SHA-256 evidence chain is specifically designed to survive a CRA review. Every claim is timestamped, hashed, and linked to your actual commits.",
          "Audit rates are low. And if one does happen, your CPA has the documentation package ready to go.",
        ],
      },
      accuracy: {
        user: 'How accurate is the estimate?',
        msgs: [
          "The estimate shown is based on your spend range — it's conservative by design.",
          "Your actual refund depends on which commits qualify under CRA's three-part test (technological uncertainty, systematic investigation, advancement). TaxLift's scan identifies qualifying work at the commit level — the estimate after scanning is much more precise.",
          "On average, TaxLift users qualify 68–82% of their engineering spend as SR&ED.",
        ],
      },
      sred: {
        user: 'What exactly is SR&ED?',
        msgs: [
          "SR&ED (Scientific Research & Experimental Development) is Canada's largest R&D tax incentive — $4B+ paid out annually.",
          "If your team wrote code to solve a technical problem that wasn't solvable off the shelf, the salaries and contractor fees you paid while doing that work qualify for a federal cash refund.",
          "For Canadian private corps (CCPCs), the refundable rate is 35% on the first $3M of qualifying spend. That's real cash — not just a deduction.",
        ],
      },
    }

    const faq = faqMap[topic]
    if (!faq) return
    pushUser(faq.user)
    pushBotMessages(faq.msgs, {
      onDone: () =>
        setChips([
          { label: `→ Get my estimate`,         onClick: goToScan,                          primary: true },
          { label: '📅 Book a demo',             onClick: goToDemo                                        },
          { label: '🔙 Back to my options',      onClick: showCTA                                         },
        ]),
    })
  }

  // ── Email capture ─────────────────────────────────────────────────────────
  function goToScan() {
    setChips([])
    if (emailSent) { navigate('/scan'); setOpen(false); return }

    pushBotMessages(
      [`Last step — where should we send your SR&ED breakdown? We'll email you the numbers before you connect GitHub.`],
      { onDone: () => setEmailMode(true) },
    )
  }

  function submitEmail(e) {
    e?.preventDefault()
    const clean = emailVal.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setEmailError('Please enter a valid email')
      return
    }
    setEmailError('')
    setEmailMode(false)
    setEmailSent(true)
    onLeadCapture?.(clean, estimate?.range)

    pushUser(clean)
    pushBotMessages(
      [`Got it — we'll send your breakdown to ${clean} 🎉\n\nNow let's get your exact number. Connecting GitHub takes 2 minutes.`],
      {
        onDone: () =>
          setChips([
            { label: '→ Connect GitHub now', onClick: () => { navigate('/scan'); setOpen(false) }, primary: true },
          ]),
      },
    )
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function goToDemo() {
    setOpen(false)
    onOpenCalendly?.()
  }

  function handleOpen() {
    setOpen(true)
    setUnread(false)
    sessionStorage.setItem('chat_v2_prompted', '1')
    if (!hasOpened) {
      setHasOpened(true)
      startHook(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating bubble ─────────────────────────────────────────────── */}
      <button
        onClick={handleOpen}
        aria-label="Open TaxLift chat"
        className={`
          fixed bottom-5 right-5 z-[100]
          flex items-center gap-2 pl-4 pr-5 py-3
          rounded-full shadow-xl
          bg-gradient-to-r from-indigo-600 to-violet-600
          hover:from-indigo-700 hover:to-violet-700
          active:scale-95 transition-all duration-200
          ${open ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}
        `}
      >
        {unread && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full
                           border-2 border-white animate-pulse z-10" />
        )}
        <MessageCircle className="text-white w-5 h-5 flex-shrink-0" />
        <span className="text-white text-sm font-semibold whitespace-nowrap hidden sm:block">
          {unread ? 'See what your commits are worth →' : 'Chat with TaxLift'}
        </span>
      </button>

      {/* ── Chat window ─────────────────────────────────────────────────── */}
      <div
        aria-label="TaxLift chat assistant"
        className={`
          fixed bottom-5 right-5 z-[100]
          w-[380px] max-w-[calc(100vw-1.5rem)]
          rounded-2xl shadow-2xl overflow-hidden
          flex flex-col bg-white
          transition-all duration-300 origin-bottom-right
          ${open
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-90 pointer-events-none'}
        `}
        style={{ maxHeight: 'min(600px, calc(100vh - 5rem))', height: 'min(600px, calc(100vh - 5rem))' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3
                        flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shadow-inner">
            <Zap size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight">TaxLift AI</p>
            <p className="text-indigo-200 text-[11px] leading-tight">
              SR&amp;ED assistant · {DAYS_LEFT > 0 ? `${DAYS_LEFT} days to June 30 deadline` : 'File now'}
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close chat"
          >
            <X size={17} />
          </button>
        </div>

        {/* Progress bar */}
        {step > 0 && <ProgressBar step={step} total={4} />}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth">
          {messages.map((m, i) =>
            m.role === 'bot'
              ? <BotBubble key={i} text={m.text.replace(/\*\*(.*?)\*\*/g, '$1')} highlight={m.highlight} />
              : <UserBubble key={i} text={m.text} />
          )}
          {typing && (
            <div className="flex items-start gap-2">
              <Avatar />
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm">
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Email input */}
        {emailMode && !emailSent && (
          <form
            onSubmit={submitEmail}
            className="px-3 pb-3 pt-2 border-t border-gray-100 flex-shrink-0 bg-white"
          >
            <div className="flex gap-2">
              <input
                ref={emailRef}
                type="email"
                value={emailVal}
                onChange={e => { setEmailVal(e.target.value); setEmailError('') }}
                placeholder="you@company.com"
                className={`
                  flex-1 px-3 py-2.5 text-sm rounded-xl border outline-none
                  focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                  ${emailError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}
                `}
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white
                           rounded-xl text-sm font-semibold flex items-center gap-1.5
                           transition-colors active:scale-95"
              >
                <Send size={14} />
              </button>
            </div>
            {emailError && <p className="text-red-500 text-xs mt-1 pl-1">{emailError}</p>}
            <button
              type="button"
              onClick={() => { setEmailMode(false); navigate('/scan'); setOpen(false) }}
              className="mt-1.5 text-xs text-gray-400 hover:text-gray-600 pl-1 underline underline-offset-2"
            >
              Skip — take me to GitHub connect
            </button>
          </form>
        )}

        {/* Quick-reply chips */}
        {chips.length > 0 && !emailMode && (
          <div className="bg-white px-3 pb-3 pt-2 flex flex-col gap-1.5 border-t border-gray-100 flex-shrink-0">
            {chips.map((chip, i) => (
              <button
                key={i}
                onClick={chip.onClick}
                className={`
                  w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium
                  flex items-center justify-between gap-2
                  transition-all duration-150 active:scale-[0.98]
                  ${chip.primary
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200'
                    : 'border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300'}
                `}
              >
                <span>{chip.label}</span>
                <ArrowRight size={14} className="flex-shrink-0 opacity-60" />
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-1.5 flex-shrink-0">
          <p className="text-center text-[10px] text-gray-400">
            🔒 Read-only GitHub access · No code stored · CRA-compliant
          </p>
        </div>
      </div>
    </>
  )
}
