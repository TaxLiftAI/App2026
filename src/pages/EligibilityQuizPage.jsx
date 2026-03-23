import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, XCircle, AlertCircle, ChevronRight, ChevronLeft,
  HelpCircle, RotateCcw, Zap, BookOpen, Microscope, Calendar,
  Users, MapPin, FileSearch, Lightbulb, GitMerge, ArrowRight,
} from 'lucide-react'

// ─── Quiz questions ───────────────────────────────────────────────────────────
// CRA SR&ED 3 criteria: (1) Tech uncertainty, (2) Tech advancement, (3) Systematic investigation
// Each question: id, criterion, text, hint, options [{label, value, weight}]
// weight: positive = supports eligibility, negative = hurts

const QUESTIONS = [
  {
    id: 'q1',
    criterion: 'Scope',
    criterionLabel: 'Work Category',
    icon: BookOpen,
    text: 'What best describes the type of work you are looking to claim?',
    hint: 'SR&ED covers technological work in any industry — software, hardware, processes, materials, or biological systems.',
    options: [
      { label: 'Software or algorithms',                  value: 'software',   weight: 10 },
      { label: 'Hardware, electronics or devices',        value: 'hardware',   weight: 10 },
      { label: 'Processes, methods or manufacturing',     value: 'process',    weight: 10 },
      { label: 'Materials, chemistry or biology',         value: 'science',    weight: 10 },
      { label: 'Not sure / multiple areas',               value: 'mixed',      weight:  5 },
    ],
  },
  {
    id: 'q2',
    criterion: 'Uncertainty',
    criterionLabel: 'Technological Uncertainty',
    icon: Microscope,
    text: 'Did your team face a technological uncertainty that standard engineering practice could not resolve without experimentation?',
    hint: 'This is the most critical CRA criterion. "Uncertainty" means you didn\'t know if or how the technology would work — not just that the project was difficult.',
    options: [
      { label: 'Yes — we genuinely didn\'t know if/how to achieve the technical goal', value: 'yes',    weight: 30 },
      { label: 'Partially — some aspects were uncertain, others were routine',         value: 'partial', weight: 15 },
      { label: 'No — a competent professional could have solved it without testing',   value: 'no',      weight: -20 },
    ],
  },
  {
    id: 'q3',
    criterion: 'Advancement',
    criterionLabel: 'Technological Advancement',
    icon: Lightbulb,
    text: 'Was the goal of the work to advance technology or scientific knowledge beyond the current state of practice?',
    hint: '"Advancement" doesn\'t mean a world-first discovery. It means your work pushed the boundaries of what was possible within your own technological context.',
    options: [
      { label: 'Yes — we were trying to go beyond what was publicly known or commercially available', value: 'yes',    weight: 25 },
      { label: 'Partially — we adapted existing technology but encountered novel challenges',          value: 'partial', weight: 12 },
      { label: 'No — we were implementing a known solution to a known problem',                        value: 'no',      weight: -15 },
    ],
  },
  {
    id: 'q4',
    criterion: 'Systematic',
    criterionLabel: 'Systematic Investigation',
    icon: FileSearch,
    text: 'Was the work conducted as a systematic investigation — with hypotheses, experiments, and documented results?',
    hint: 'CRA requires that work follows a scientific method: you formed a hypothesis, ran experiments or trials, and observed/recorded results. Informal tinkering does not qualify.',
    options: [
      { label: 'Yes — we documented hypotheses, experiments and outcomes throughout',     value: 'yes',    weight: 20 },
      { label: 'Partially — some documentation exists but the process wasn\'t formal',    value: 'partial', weight: 10 },
      { label: 'No — the work was exploratory / ad-hoc without systematic documentation', value: 'no',      weight: -10 },
    ],
  },
  {
    id: 'q5',
    criterion: 'Canada',
    criterionLabel: 'Performed in Canada',
    icon: MapPin,
    text: 'Was the SR&ED work performed in Canada by Canadian employees or contractors?',
    hint: 'Work must be performed in Canada. Overhead support outside Canada can be included at reduced rates. Payments to foreign subcontractors are generally not eligible.',
    options: [
      { label: 'Yes — all work was performed in Canada',                          value: 'yes',    weight: 15 },
      { label: 'Mostly — some small portion was done outside Canada',             value: 'partial', weight:  8 },
      { label: 'No — work was primarily performed outside Canada',                value: 'no',      weight: -30 },
    ],
  },
  {
    id: 'q6',
    criterion: 'People',
    criterionLabel: 'Qualified Personnel',
    icon: Users,
    text: 'Were qualified scientific or technological personnel (e.g. engineers, scientists, developers) the ones performing the SR&ED work?',
    hint: 'SR&ED claimants must be "SR&ED performers" — typically defined by their education, training, or experience with the relevant technology. Admin and management time generally does not qualify.',
    options: [
      { label: 'Yes — the work was done by engineers, scientists, or experienced developers', value: 'yes',    weight: 10 },
      { label: 'Mostly — a mix of qualified and non-qualified staff were involved',           value: 'partial', weight:  5 },
      { label: 'Not sure — we haven\'t assessed qualification of individuals',               value: 'unsure',  weight:  3 },
    ],
  },
  {
    id: 'q7',
    criterion: 'Ownership',
    criterionLabel: 'IP Ownership',
    icon: Zap,
    text: 'Is the work contracted out to you by a third party, and if so, do you retain the rights to the SR&ED?',
    hint: 'A Canadian company can claim SR&ED for contract work only if it retains the IP or if the contract explicitly allows the claim. If you\'re doing this work for your own business, this doesn\'t apply.',
    options: [
      { label: 'No — this is our own internal R&D, not contracted work',                      value: 'own',       weight: 10 },
      { label: 'Yes — contracted work, and we retain the SR&ED rights',                       value: 'contracted_own', weight:  8 },
      { label: 'Yes — contracted work, and the client retains the rights',                    value: 'contracted_client', weight: -15 },
    ],
  },
  {
    id: 'q8',
    criterion: 'Timing',
    criterionLabel: 'Filing Window',
    icon: Calendar,
    text: 'Is the work within the 18-month CRA SR&ED filing deadline from the fiscal year end in which it occurred?',
    hint: 'SR&ED claims must be filed within 12 months of the tax return due date, which is itself 6 months after fiscal year end — giving you approximately 18 months from year-end. Late filing forfeits the claim.',
    options: [
      { label: 'Yes — the work is within the 18-month window',     value: 'yes',    weight: 10 },
      { label: 'Unsure — I need to check the exact dates',         value: 'unsure',  weight:  5 },
      { label: 'No — the work is likely outside the window',       value: 'no',      weight: -25 },
    ],
  },
  {
    id: 'q9',
    criterion: 'Outcome',
    criterionLabel: 'Result of Work',
    icon: GitMerge,
    text: 'What was the outcome of the technological work?',
    hint: 'SR&ED does not require success. A negative result — proving something doesn\'t work — is just as valid as a positive one, as long as you were trying to advance technology.',
    options: [
      { label: 'Successful — we achieved the technological goal',                                    value: 'success',  weight: 10 },
      { label: 'Partial — we made progress but the goal wasn\'t fully achieved',                     value: 'partial',  weight: 10 },
      { label: 'Unsuccessful — we determined the approach doesn\'t work (negative result)',          value: 'negative', weight: 10 },
      { label: 'Abandoned — we stopped for non-technical reasons (budget, pivot, etc.)',             value: 'abandoned', weight:  5 },
    ],
  },
]

const MAX_SCORE = QUESTIONS.reduce((sum, q) => sum + Math.max(...q.options.map(o => o.weight)), 0)

// ─── Verdict config ───────────────────────────────────────────────────────────
function getVerdict(score, pct) {
  if (pct >= 70) return {
    level: 'likely',
    label: 'Likely Eligible',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    ring: 'ring-green-400',
    icon: CheckCircle2,
    iconColor: 'text-green-500',
    summary: 'Based on your answers, this work appears to meet the key CRA SR&ED criteria. We recommend proceeding with a formal claim — consider scheduling a developer interview to collect supporting evidence.',
  }
  if (pct >= 40) return {
    level: 'possible',
    label: 'Possibly Eligible',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    ring: 'ring-amber-400',
    icon: AlertCircle,
    iconColor: 'text-amber-500',
    summary: 'Some aspects of this work may qualify for SR&ED, but there are gaps to address. Review the flagged criteria below and strengthen your documentation before filing.',
  }
  return {
    level: 'unlikely',
    label: 'Unlikely Eligible',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    ring: 'ring-red-400',
    icon: XCircle,
    iconColor: 'text-red-500',
    summary: 'Based on your answers, this work does not appear to meet the core CRA SR&ED requirements. Review the criteria below — if circumstances have changed, retake the quiz or speak with a SR&ED specialist.',
  }
}

// ─── Criterion breakdown ──────────────────────────────────────────────────────
function criterionStatus(question, answer) {
  if (!answer) return 'unanswered'
  const opt = question.options.find(o => o.value === answer)
  if (!opt) return 'unanswered'
  if (opt.weight >= 15) return 'pass'
  if (opt.weight >= 5)  return 'partial'
  return 'fail'
}

const STATUS_META = {
  pass:       { icon: CheckCircle2, color: 'text-green-500', label: 'Passes' },
  partial:    { icon: AlertCircle,  color: 'text-amber-500', label: 'Partially meets' },
  fail:       { icon: XCircle,      color: 'text-red-500',   label: 'Does not meet' },
  unanswered: { icon: HelpCircle,   color: 'text-gray-300',  label: 'Not answered' },
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step, total }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div
        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
        style={{ width: `${((step + 1) / total) * 100}%` }}
      />
    </div>
  )
}

// ─── Results page ─────────────────────────────────────────────────────────────
function ResultsPage({ answers, onRetake, onStartCluster }) {
  const score = QUESTIONS.reduce((sum, q) => {
    const opt = q.options.find(o => o.value === answers[q.id])
    return sum + (opt?.weight ?? 0)
  }, 0)

  const minPossible = QUESTIONS.reduce((sum, q) => sum + Math.min(...q.options.map(o => o.weight)), 0)
  const range = MAX_SCORE - minPossible
  const pct = Math.round(((score - minPossible) / range) * 100)
  const verdict = getVerdict(score, pct)
  const VerdictIcon = verdict.icon

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Verdict card */}
      <div className={`rounded-2xl border-2 p-6 ${verdict.bg} ${verdict.border}`}>
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-full bg-white flex items-center justify-center ring-2 ${verdict.ring} ring-offset-2`}>
            <VerdictIcon size={24} className={verdict.iconColor} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className={`text-xl font-bold ${verdict.color}`}>{verdict.label}</h3>
              <span className={`text-sm font-semibold px-2.5 py-1 rounded-full bg-white ${verdict.color} border ${verdict.border}`}>
                {pct}% eligibility confidence
              </span>
            </div>
            <p className="text-sm text-gray-700 mt-2 leading-relaxed">{verdict.summary}</p>
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-5">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Eligibility score</span>
            <span className="font-semibold">{pct} / 100</span>
          </div>
          <div className="w-full bg-white/60 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-700 ${
                pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Per-criterion breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-800">Criteria Breakdown</h4>
        </div>
        <div className="divide-y divide-gray-50">
          {QUESTIONS.map(q => {
            const status = criterionStatus(q, answers[q.id])
            const meta = STATUS_META[status]
            const StatusIcon = meta.icon
            const selectedOpt = q.options.find(o => o.value === answers[q.id])
            const CriterionIcon = q.icon

            return (
              <div key={q.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center mt-0.5">
                  <CriterionIcon size={13} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800">{q.criterionLabel}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <StatusIcon size={13} className={meta.color} />
                      <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                    </div>
                  </div>
                  {selectedOpt && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">"{selectedOpt.label}"</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Next steps */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-indigo-900 mb-3">Recommended Next Steps</h4>
        <div className="space-y-2">
          {verdict.level !== 'unlikely' && (
            <div className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-800">Schedule a developer interview to capture technical context while it's fresh</p>
            </div>
          )}
          <div className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-800">Create an Activity Cluster in TaxLift and link your evidence documents in the Vault</p>
          </div>
          {verdict.level === 'possible' && (
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-800">Review your documentation practices — systematic records (GitHub commits, Jira tickets, test logs) significantly strengthen a claim</p>
            </div>
          )}
          {verdict.level === 'unlikely' && (
            <div className="flex items-start gap-2">
              <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-800">Consider consulting a SR&ED specialist — some answers may be stronger than you think, especially around technological uncertainty</p>
            </div>
          )}
          <div className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-800">Check the Audit Readiness page to ensure your cluster scores above 70 before your filing deadline</p>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex items-center gap-3 flex-wrap">
        {verdict.level !== 'unlikely' && (
          <button
            onClick={onStartCluster}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <GitMerge size={15} />
            Create a Cluster
            <ArrowRight size={13} />
          </button>
        )}
        <button
          onClick={onRetake}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition-colors"
        >
          <RotateCcw size={14} />
          Retake Quiz
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EligibilityQuizPage() {
  const navigate = useNavigate()
  const [step, setStep]       = useState(0)
  const [answers, setAnswers] = useState({})
  const [done, setDone]       = useState(false)

  const q = QUESTIONS[step]
  const Icon = q?.icon ?? HelpCircle
  const selectedValue = answers[q?.id]
  const isLast = step === QUESTIONS.length - 1

  function select(value) {
    setAnswers(prev => ({ ...prev, [q.id]: value }))
  }

  function handleNext() {
    if (!selectedValue) return
    if (isLast) { setDone(true); return }
    setStep(s => s + 1)
  }

  function handleBack() {
    if (step === 0) return
    setStep(s => s - 1)
  }

  function handleRetake() {
    setAnswers({})
    setStep(0)
    setDone(false)
  }

  if (done) {
    return (
      <div className="p-6 max-w-screen-md mx-auto">
        <ResultsPage
          answers={answers}
          onRetake={handleRetake}
          onStartCluster={() => navigate('/clusters')}
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-screen-md mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900">SR&amp;ED Eligibility Quiz</h2>
        <p className="text-sm text-gray-500 mt-1">
          Answer 9 questions to assess whether your R&amp;D work qualifies under Canada's SR&amp;ED program. Takes about 3 minutes.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Question {step + 1} of {QUESTIONS.length}</span>
          <span className="font-medium text-gray-700">{q.criterionLabel}</span>
        </div>
        <ProgressBar step={step} total={QUESTIONS.length} />
      </div>

      {/* Question card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-4">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Icon size={18} className="text-indigo-500" />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">{q.criterion}</span>
            <h3 className="text-base font-semibold text-gray-900 mt-0.5 leading-snug">{q.text}</h3>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {q.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all text-sm leading-snug ${
                selectedValue === opt.value
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-800 font-medium shadow-sm'
                  : 'border-gray-200 text-gray-700 hover:border-indigo-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-4 h-4 rounded-full border-2 transition-colors ${
                  selectedValue === opt.value ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                }`}>
                  {selectedValue === opt.value && (
                    <div className="w-full h-full rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                  )}
                </div>
                {opt.label}
              </div>
            </button>
          ))}
        </div>

        {/* CRA hint */}
        <div className="mt-5 flex items-start gap-2 p-3 bg-gray-50 rounded-xl">
          <HelpCircle size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 leading-relaxed">{q.hint}</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={15} /> Back
        </button>

        <button
          onClick={handleNext}
          disabled={!selectedValue}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
        >
          {isLast ? 'See Results' : 'Next'}
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
