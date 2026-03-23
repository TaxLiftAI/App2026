/**
 * S3 — Gap Fill Interview
 * 4-question commercial context interview.
 * One question at a time. Progress bar.
 * Answers stored at company level — fill once, reused forever.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2, Info } from 'lucide-react'
import { grants as grantsApi } from '../../lib/api'

const QUESTIONS = [
  {
    key: 'market_desc',
    number: 1,
    title: 'Target Market & Problem',
    prompt: 'Describe your target market and the problem you\'re solving.',
    subtext: 'Who is your ideal customer? What pain point are you addressing?',
    hint: 'Example: "We serve mid-market SaaS companies (50–500 employees) that lose 3–8% of revenue to payment fraud. Existing rule-based fraud tools have a 15% false-positive rate, blocking legitimate transactions and frustrating customers."',
    placeholder: 'Describe your target customer, the size of the opportunity, and the core problem your technology solves…',
    srEdNote: 'Company name, project title, and R&D domain are pre-filled from your SR&ED filing.',
    usedIn: 'Market opportunity section, Canadian benefit section',
  },
  {
    key: 'revenue_model',
    number: 2,
    title: 'Revenue Model & Traction',
    prompt: 'How does your company generate revenue?',
    subtext: 'Describe your business model and current commercial traction.',
    hint: 'Example: "We charge a monthly SaaS fee of $2,000–$15,000/month depending on transaction volume. Currently at $480K ARR with 12 paying customers, growing 20% month-over-month."',
    placeholder: 'Describe your pricing model, revenue streams, and any current traction (ARR, customers, growth rate)…',
    srEdNote: 'Your R&D expenditure data is already captured in SR&ED.',
    usedIn: 'Commercialisation plan section, market opportunity section',
  },
  {
    key: 'canadian_benefit',
    number: 3,
    title: 'Canadian Economic Benefit',
    prompt: 'What Canadian economic benefit does this project create?',
    subtext: 'Jobs, IP ownership, Canadian customers, export intent, partnerships.',
    hint: 'Example: "We employ 8 full-time engineers in Toronto (2 added this year), own all developed IP in Canada, and serve 4 Canadian enterprise customers. We intend to export to the US market from our Canadian base."',
    placeholder: 'Describe jobs created or retained in Canada, Canadian IP ownership, Canadian customers, export plans, or partnerships with Canadian universities or institutions…',
    srEdNote: 'Your province and employee count are already in your SR&ED company profile.',
    usedIn: 'Canadian benefit section (required by all federal grants)',
  },
  {
    key: 'differentiation',
    number: 4,
    title: 'Competitive Differentiation',
    prompt: 'What makes your solution unique vs. existing alternatives?',
    subtext: 'Why are existing solutions inadequate? What\'s your key advantage?',
    hint: 'Example: "Existing fraud tools rely on static rule sets that can\'t adapt to evolving fraud patterns. Our ML model retrains in near-real-time on transaction feedback, achieving 340% better precision than rule-based baselines in our benchmark."',
    placeholder: 'Describe what makes your technical approach different, why competitors\' solutions fall short, and your key defensible advantage…',
    srEdNote: 'Your technical advancement narrative from SR&ED provides the technical foundation here.',
    usedIn: 'Innovation and novelty section, market opportunity section',
  },
]

export default function GapFillInterview() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const applicationId = searchParams.get('application')

  const [step, setStep]         = useState(0)
  const [answers, setAnswers]   = useState({ market_desc: '', revenue_model: '', canadian_benefit: '', differentiation: '' })
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [loading, setLoading]   = useState(true)
  const [showHint, setShowHint] = useState(false)

  // Load any existing answers
  useEffect(() => {
    grantsApi.getGapAnswers()
      .then(existing => {
        if (existing) {
          setAnswers(prev => ({
            market_desc:      existing.market_desc      || prev.market_desc,
            revenue_model:    existing.revenue_model    || prev.revenue_model,
            canadian_benefit: existing.canadian_benefit || prev.canadian_benefit,
            differentiation:  existing.differentiation  || prev.differentiation,
          }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const currentQ = QUESTIONS[step]
  const isLastStep = step === QUESTIONS.length - 1
  const currentAnswer = answers[currentQ.key] || ''
  const canAdvance = currentAnswer.trim().length >= 20

  function handleChange(val) {
    setAnswers(prev => ({ ...prev, [currentQ.key]: val }))
    setSaved(false)
  }

  async function handleNext() {
    if (!canAdvance) return
    setSaving(true)
    try {
      // Auto-save on each step
      await grantsApi.saveGapAnswers(answers)
      setSaved(true)
      if (isLastStep) {
        // Navigate to generation
        if (applicationId) {
          navigate(`/grants/applications/${applicationId}/generating`)
        } else {
          navigate('/grants')
        }
      } else {
        setStep(s => s + 1)
        setShowHint(false)
      }
    } catch (err) {
      alert('Failed to save answers: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-indigo-500" size={28} />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-12 pb-20 px-4">
      <div className="w-full max-w-xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/grants')}
            className="text-gray-400 hover:text-gray-600">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Gap Fill Interview</h1>
            <p className="text-xs text-gray-500">4 questions · answers saved permanently · reused for all future applications</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Question {step + 1} of {QUESTIONS.length}</span>
            <span>{Math.round(((step) / QUESTIONS.length) * 100)}% complete</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {QUESTIONS.map((q, i) => (
              <button
                key={q.key}
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  i < step ? 'text-green-600 cursor-pointer' :
                  i === step ? 'text-indigo-600 font-medium' : 'text-gray-300'
                }`}
              >
                {i < step ? <CheckCircle2 size={12} /> : <span className="w-3 h-3 rounded-full border border-current inline-block" />}
              </button>
            ))}
          </div>
        </div>

        {/* Question card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-7 space-y-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium mb-3">
              Q{currentQ.number} of {QUESTIONS.length}
            </div>
            <h2 className="text-lg font-bold text-gray-900">{currentQ.title}</h2>
            <p className="text-base text-gray-700 mt-1">{currentQ.prompt}</p>
            <p className="text-sm text-gray-500 mt-1">{currentQ.subtext}</p>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-700 flex items-start gap-2">
            <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0 text-indigo-500" />
            <span><strong>SR&ED reused:</strong> {currentQ.srEdNote}</span>
          </div>

          <textarea
            value={currentAnswer}
            onChange={e => handleChange(e.target.value)}
            rows={5}
            placeholder={currentQ.placeholder}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />

          <div className="flex items-center justify-between text-xs">
            <span className={currentAnswer.length < 20 ? 'text-gray-400' : 'text-green-600'}>
              {currentAnswer.trim().split(/\s+/).filter(Boolean).length} words
              {currentAnswer.length < 20 && ' (minimum 20 characters)'}
            </span>
            <button
              onClick={() => setShowHint(!showHint)}
              className="flex items-center gap-1 text-gray-400 hover:text-indigo-500"
            >
              <Info size={12} /> {showHint ? 'Hide' : 'Show'} example
            </button>
          </div>

          {showHint && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 italic">
              {currentQ.hint}
            </div>
          )}

          <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
            <span className="font-medium">Used in:</span> {currentQ.usedIn}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/grants')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft size={16} /> {step > 0 ? 'Previous' : 'Back'}
          </button>

          <button
            onClick={handleNext}
            disabled={!canAdvance || saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isLastStep ? (saving ? 'Saving…' : 'Save & Generate Sections') : (saving ? 'Saving…' : 'Next Question')}
            {!isLastStep && !saving && <ChevronRight size={14} />}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Answers are saved automatically and reused across all future grant applications.
        </p>
      </div>
    </div>
  )
}
