/**
 * SREDQualificationPanel
 *
 * Shows WHY a cluster qualifies for SR&ED — not just that it does.
 * Scores each of the 3 CRA criteria against real commit evidence,
 * surfacing the specific commits that prove each point, plus audit
 * talking points and potential challenges.
 *
 * Props:
 *   cluster  — cluster object (trigger_rules, business_component, risk_score, etc.)
 *   commits  — git_commits array from the evidence snapshot
 *   compact  — boolean: show condensed badge row only (for list views)
 */
import { useState } from 'react'
import {
  CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp,
  GitCommit, Shield, Microscope, TrendingUp, MessageSquare,
  Lightbulb, AlertCircle, Info,
} from 'lucide-react'

// ── Heuristic → criterion mapping ─────────────────────────────────────────────
// Each heuristic contributes evidence toward one or more CRA criteria
const HEURISTIC_CRITERION = {
  ExperimentalBranches:   ['systematic', 'uncertainty'],
  BuildExperimentation:   ['systematic'],
  HighCodeChurn:          ['systematic'],
  BlockedStatus:          ['uncertainty'],
  RefactoringPattern:     ['systematic'],
  PerformanceOptimization:['advancement'],
  TestDrivenDevelopment:  ['systematic'],
  ResearchKeywords:       ['uncertainty', 'advancement'],
}

// Commit message patterns → criterion evidence
const COMMIT_PATTERNS = {
  systematic: [
    /^(experiment|poc|prototype|bench|benchmark|research|spike|test-)/i,
    /\b(iteration|attempt|hypothesis|trial|compare|vs\.?|versus)\b/i,
    /\b(approach [ab12]|strategy [ab12]|option [ab12])\b/i,
  ],
  uncertainty: [
    /^(poc|prototype|spike|research|exploration|investigate)/i,
    /\b(unknown|uncertain|unclear|unknowable|undetermined)\b/i,
    /\b(failed|failure|revert|rollback|abandoned|dead-?end)\b/i,
    /\b(not sure|unclear|open question|tbd|todo|investigate)\b/i,
    /\b(try|trying|attempt|testing if|checking if)\b/i,
  ],
  advancement: [
    /\d+\.?\d*\s*%.*→.*\d+\.?\d*\s*%/,                  // "67% → 94%"
    /\d+\s*[xX×]\s*(faster|slower|improvement|speedup)/i,
    /from\s+\d+\s*(ms|s|sec)\s+to\s+\d+/i,               // "from 340ms to 12ms"
    /improved?\s+(?:from\s+)?\d/i,
    /\b(novel|new algorithm|new approach|new method|breakthrough|innovation)\b/i,
    /\b(outperforms?|beats?|exceeds?|surpasses?)\b/i,
  ],
}

// ── Qualification engine ───────────────────────────────────────────────────────
function scoreCommit(msg, criterion) {
  return COMMIT_PATTERNS[criterion].some(re => re.test(msg)) ? 1 : 0
}

function heuristicScore(triggerRules, criterion) {
  const relevant = triggerRules.filter(r =>
    (HEURISTIC_CRITERION[r.heuristic] ?? []).includes(criterion)
  )
  if (!relevant.length) return 0
  // Weighted average of fired_values for relevant heuristics
  const totalWeight = relevant.reduce((s, r) => s + r.weight, 0)
  const weightedSum = relevant.reduce((s, r) => s + r.fired_value * r.weight, 0)
  return weightedSum / totalWeight
}

export function qualifyCluster(cluster, commits = []) {
  const rules   = cluster?.trigger_rules ?? []
  const allMsgs = commits.map(c => c.message ?? '')

  // ── Systematic Investigation ─────────────────────────────────────────────
  const sysHeuristic    = heuristicScore(rules, 'systematic')
  const sysCommits      = commits.filter(c => scoreCommit(c.message ?? '', 'systematic'))
  const sysCommitScore  = Math.min(sysCommits.length / Math.max(commits.length * 0.25, 1), 1)
  const sysScore        = Math.round(((sysHeuristic * 0.6) + (sysCommitScore * 0.4)) * 100)

  // ── Technological Uncertainty ─────────────────────────────────────────────
  const uncHeuristic    = heuristicScore(rules, 'uncertainty')
  const uncCommits      = commits.filter(c => scoreCommit(c.message ?? '', 'uncertainty'))
  // Multiple experimental branches = strong uncertainty signal
  const experimentCount = commits.filter(c => /^(experiment|poc|spike|research)/i.test(c.message ?? '')).length
  const experimentBonus = Math.min(experimentCount / 3, 1) * 0.2
  const uncCommitScore  = Math.min(uncCommits.length / Math.max(commits.length * 0.2, 1), 1)
  const uncScore        = Math.round(Math.min(((uncHeuristic * 0.5) + (uncCommitScore * 0.3) + experimentBonus) * 100, 100))

  // ── Advancement of Knowledge ─────────────────────────────────────────────
  const advHeuristic    = heuristicScore(rules, 'advancement')
  const advCommits      = commits.filter(c => scoreCommit(c.message ?? '', 'advancement'))
  const measuredResults = commits.filter(c => /\d+.*→.*\d+|\d+\s*[xX×]\s*faster|\d+\s*ms/i.test(c.message ?? ''))
  const advScore        = Math.round(
    ((advHeuristic * 0.4) + (Math.min(advCommits.length / Math.max(commits.length * 0.15, 1), 1) * 0.4)
    + (Math.min(measuredResults.length / 2, 1) * 0.2)) * 100
  )

  const overall = Math.round((sysScore * 0.35 + uncScore * 0.40 + advScore * 0.25))

  return {
    overall,
    criteria: {
      systematic:  { score: sysScore,  commits: sysCommits.slice(0, 3),  measured: [] },
      uncertainty: { score: uncScore,  commits: uncCommits.slice(0, 3),  measured: [] },
      advancement: { score: advScore,  commits: advCommits.slice(0, 3),  measured: measuredResults.slice(0, 2) },
    },
    topEvidenceCommits: [
      ...sysCommits.slice(0, 2),
      ...uncCommits.slice(0, 1),
      ...advCommits.slice(0, 1),
    ].filter((v, i, a) => a.findIndex(x => x.sha === v.sha) === i).slice(0, 4),
    weaknesses: [
      sysScore < 50  && 'Few commits show systematic experimental process — consider adding experiment notes',
      uncScore < 50  && 'Limited evidence of technological uncertainty — document what was unknown at project start',
      advScore < 40  && 'No measurable advancement found — add before/after metrics to commit messages',
      commits.length < 5 && 'Small commit sample — more commits strengthen the evidence chain',
    ].filter(Boolean),
  }
}

// ── Score display helpers ──────────────────────────────────────────────────────
function scoreColor(n) {
  if (n >= 75) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Strong' }
  if (n >= 50) return { bar: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   label: 'Moderate' }
  return           { bar: 'bg-red-400',         text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     label: 'Weak' }
}

function ScoreBar({ score }) {
  const c = scoreColor(score)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[10px] font-semibold w-6 text-right ${c.text}`}>{score}%</span>
    </div>
  )
}

// ── Per-criterion content ──────────────────────────────────────────────────────
const CRITERIA_META = {
  systematic: {
    icon:  Microscope,
    title: 'Systematic Investigation',
    ref:   'ITA s.248(1)(a)',
    what:  'CRA requires evidence that work was carried out using a scientific method — not ad-hoc fixes or trial-and-error without documentation.',
    strong:'Commits show structured experiment cycles: hypothesis → implementation → measurement → iteration. Branch naming, POCs, and benchmarks all demonstrate systematic process.',
    moderate:'Some experimental commits present but the process could be more clearly documented. Adding experiment outcome notes to commit messages would strengthen this.',
    weak:  'Commits appear routine. SR&ED requires documented evidence of systematic investigation. If this work was experimental, add retrospective notes or a project journal.',
    talkingPoint: 'We ran a structured investigation: each major change was preceded by a hypothesis about the expected outcome, implemented in isolation, measured against baseline, and the results informed the next iteration. Our commit history shows this cycle repeating.',
    auditorChallenge: 'CRA may ask: "How is this different from normal software development?" Answer: normal dev follows known patterns; this work involved testing approaches with uncertain outcomes.',
  },
  uncertainty: {
    icon:  AlertCircle,
    title: 'Technological Uncertainty',
    ref:   'ITA s.248(1)(b)',
    what:  'The most scrutinised criterion. CRA requires that uncertainty could NOT have been resolved by a competent practitioner using standard techniques — it required genuine investigation.',
    strong:'Multiple exploratory commits (POCs, spikes, experiments) indicate the team was navigating genuinely unknown territory. Failed attempts and pivots are strong evidence.',
    moderate:'Some uncertainty signals present. Strengthened by documenting what standard approaches were considered and why they were insufficient.',
    weak:  'Limited evidence of genuine uncertainty. CRA may view this as routine development. Document: what did you not know at the start? What approaches did you rule out, and why?',
    talkingPoint: 'At the start of this project, we genuinely did not know if [the approach] would work within our performance and reliability constraints. We surveyed existing solutions and found none that addressed [specific gap]. Our experiments were designed specifically to resolve that uncertainty.',
    auditorChallenge: 'CRA may ask: "Couldn\'t a competent engineer have figured this out?" Answer: a competent engineer would know the standard approaches — those didn\'t work for our requirements. We had to develop new knowledge.',
  },
  advancement: {
    icon:  TrendingUp,
    title: 'Advancement of Knowledge',
    ref:   'ITA s.248(1)(c)',
    what:  'Work must advance scientific or technological knowledge — not just the company\'s knowledge, but knowledge useful beyond one business application.',
    strong:'Quantified improvements (throughput, latency, accuracy) and novel algorithmic approaches documented in commits. These results constitute advancement that generalises.',
    moderate:'Some measurable outcomes but advancement could be more explicitly stated. Connecting results to broader technical knowledge strengthens the claim.',
    weak:  'No clear measurable advancement found in commits. For this criterion, add commits that document what new knowledge was gained — even negative results count.',
    talkingPoint: 'The work produced new knowledge about [specific technique] that goes beyond our specific use case. We documented the results — including what didn\'t work — which constitutes advancement of knowledge under CRA guidelines.',
    auditorChallenge: 'CRA may ask: "Is this just knowledge useful to your company?" Answer: the advancement is in the technique itself — understanding why [approach] fails at scale, or how to achieve [result] under [constraints], is knowledge applicable to the field.',
  },
}

// ── Criterion card ─────────────────────────────────────────────────────────────
function CriterionCard({ id, data, score }) {
  const [showTalking, setShowTalking] = useState(false)
  const meta = CRITERIA_META[id]
  const Icon = meta.icon
  const c    = scoreColor(score)

  const explanation = score >= 75 ? meta.strong : score >= 50 ? meta.moderate : meta.weak

  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 ${c.bg}`}>
        <div className="w-7 h-7 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0">
          <Icon size={14} className={c.text} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-xs font-bold ${c.text}`}>{meta.title}</p>
            <span className="text-[9px] text-gray-400 font-mono">{meta.ref}</span>
          </div>
          <ScoreBar score={score} />
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/70 ${c.text} flex-shrink-0`}>
          {c.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 bg-white space-y-3">
        {/* What CRA looks for */}
        <p className="text-[11px] text-gray-500 leading-relaxed italic border-l-2 border-gray-200 pl-2">
          {meta.what}
        </p>

        {/* Assessment */}
        <div className="flex items-start gap-2">
          {score >= 75
            ? <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            : score >= 50
            ? <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
            : <XCircle      size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
          }
          <p className="text-xs text-gray-700 leading-relaxed">{explanation}</p>
        </div>

        {/* Commit evidence */}
        {data.commits.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <GitCommit size={9} /> Supporting commits
            </p>
            {data.commits.map(cm => (
              <div key={cm.sha} className="flex items-start gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5">
                <span className="font-mono text-[9px] text-gray-400 flex-shrink-0 mt-0.5">{cm.sha?.slice(0,7)}</span>
                <p className="text-[11px] text-gray-700 leading-tight font-mono">{cm.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Measured results (advancement criterion) */}
        {data.measured?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Quantified results</p>
            {data.measured.map(cm => {
              const match = cm.message?.match(/(\d+[\w%]+\s*→\s*\d+[\w%]+|\d+\s*[xX×]\s*\w+|\d+\s*ms\s*\w+\s*\d+\s*ms)/i)
              return (
                <div key={cm.sha} className="flex items-center gap-2 bg-emerald-50 rounded-lg px-2.5 py-1.5">
                  <TrendingUp size={11} className="text-emerald-500 flex-shrink-0" />
                  <p className="text-[11px] text-emerald-800 font-medium">{match?.[0] ?? cm.message?.slice(0,80)}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Talking point toggle */}
        <button
          onClick={() => setShowTalking(v => !v)}
          className="flex items-center gap-1.5 text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
        >
          <MessageSquare size={10} />
          {showTalking ? 'Hide' : 'Show'} audit talking point
          {showTalking ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
        </button>

        {showTalking && (
          <div className="space-y-2">
            <div className="bg-indigo-50 rounded-xl px-3 py-2.5 border border-indigo-100">
              <p className="text-[10px] font-semibold text-indigo-600 mb-1 uppercase tracking-wide">
                If CRA asks about this criterion, say:
              </p>
              <p className="text-xs text-indigo-900 leading-relaxed italic">
                "{meta.talkingPoint}"
              </p>
            </div>
            <div className="bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
              <p className="text-[10px] font-semibold text-amber-600 mb-1 uppercase tracking-wide">
                Likely auditor challenge:
              </p>
              <p className="text-xs text-amber-900 leading-relaxed">{meta.auditorChallenge}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Compact badge row (for list/scan views) ────────────────────────────────────
export function QualificationBadges({ cluster, commits, onClick }) {
  const result = qualifyCluster(cluster, commits)
  const overall = scoreColor(result.overall)

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 flex-wrap group"
      title="View qualification breakdown"
    >
      {Object.entries(result.criteria).map(([key, data]) => {
        const c    = scoreColor(data.score)
        const meta = CRITERIA_META[key]
        const Icon = meta.icon
        return (
          <span key={key} className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5
            rounded-full border ${c.bg} ${c.border} ${c.text}`}>
            <Icon size={8} />
            {data.score}%
          </span>
        )
      })}
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${overall.bg} ${overall.text} border ${overall.border}`}>
        {result.overall}% overall
      </span>
      <Info size={9} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
    </button>
  )
}

// ── Full panel ─────────────────────────────────────────────────────────────────
export default function SREDQualificationPanel({ cluster, commits = [], defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const result = qualifyCluster(cluster, commits)
  const overall = scoreColor(result.overall)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${overall.bg}`}>
            <Shield size={15} className={overall.text} />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-gray-900">Why this qualifies for SR&amp;ED</p>
            <p className="text-xs text-gray-400 mt-0.5">
              3-criterion CRA test · commit evidence · audit talking points
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mini criterion badges */}
          <div className="hidden sm:flex items-center gap-1.5">
            {Object.entries(result.criteria).map(([key, data]) => {
              const c    = scoreColor(data.score)
              const meta = CRITERIA_META[key]
              const Icon = meta.icon
              return (
                <span key={key} className={`inline-flex items-center gap-1 text-[9px] font-semibold
                  px-1.5 py-0.5 rounded-full border ${c.bg} ${c.border} ${c.text}`}>
                  <Icon size={8} /> {data.score}%
                </span>
              )
            })}
          </div>
          {/* Overall confidence pill */}
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${overall.bg} ${overall.text} ${overall.border}`}>
            {result.overall}% confidence
          </span>
          {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-5 space-y-4">

          {/* Intro */}
          <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
            <Lightbulb size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-800 leading-relaxed">
              SR&amp;ED qualification under ITA s.248(1) requires meeting <strong>all three criteria</strong> below.
              Each score reflects evidence found in this cluster's commit history and detection signals.
              Use the talking points to prepare for a CRA review conversation.
            </p>
          </div>

          {/* Three criteria */}
          <div className="space-y-3">
            {Object.entries(result.criteria).map(([key, data]) => (
              <CriterionCard
                key={key}
                id={key}
                data={data}
                score={data.score}
              />
            ))}
          </div>

          {/* Weaknesses / suggestions */}
          {result.weaknesses.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle size={12} /> Strengthen this claim before filing
              </p>
              {result.weaknesses.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center text-[9px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* All good */}
          {result.weaknesses.length === 0 && result.overall >= 75 && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-800 font-medium">
              <CheckCircle2 size={13} className="text-emerald-500" />
              Strong qualification evidence across all three criteria. This cluster is well-positioned for a CRA review.
            </div>
          )}

          <p className="text-[10px] text-gray-400 text-center">
            Confidence scores are derived from commit message patterns and detection signals.
            Review with your SR&amp;ED practitioner before filing.
          </p>
        </div>
      )}
    </div>
  )
}
