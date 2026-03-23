/**
 * narrativeScorer.js
 *
 * Scores a T661 SR&ED narrative out of 100 across the five dimensions the CRA
 * examines when assessing SR&ED eligibility:
 *
 *   1. Technological Uncertainty  (20 pts) — was the outcome genuinely unknown?
 *   2. Systematic Investigation   (20 pts) — was there a structured, iterative process?
 *   3. Qualified Personnel        (20 pts) — were named, qualified people involved?
 *   4. Technological Advancement  (20 pts) — was new knowledge or capability achieved?
 *   5. Work Description           (20 pts) — is it substantive, specific, and concrete?
 *
 * Each dimension returns a score of 0 (missing), 10 (partial), or 20 (strong),
 * a pass/partial/fail status, and a one-sentence improvement suggestion when failing.
 *
 * The scorer is a pure function — no side effects, no async, safe to call on every
 * keystroke (debounced in the UI for comfort).
 *
 * Usage:
 *   import { scoreNarrative } from '../lib/narrativeScorer'
 *   const result = scoreNarrative(narrativeText, cluster)
 *   // → { totalScore, label, color, dimensions, weakestDimension, patch }
 */

// ─── Dimension keyword banks ───────────────────────────────────────────────────

// TU: Technological Uncertainty
const TU_STRONG = [
  'technological uncertainty', 'faced uncertainty', 'could not determine',
  'not known whether', 'uncertainty in', 'uncertainty regarding',
  'insufficient guidance', 'not solvable by standard', 'standard practice did not',
  'standard engineering practice did not', 'no established solution',
  'undocumented', 'could not predict whether', 'no prior published',
  'unclear whether', 'could not be resolved by', 'no existing solution',
]
const TU_WEAK = [
  'unknown', 'uncertain', 'complex challenge', 'no prior', 'novel challenge',
  'not straightforward', 'no documentation', 'not documented', 'no existing',
  'cannot determine', 'no standard', 'unpredictable', 'non-trivial',
]

// SI: Systematic Investigation
const SI_STRONG = [
  'experimental development', 'experimental cycle', 'experimental iteration',
  'iterative experiment', 'hypothesis testing', 'hypothesis-driven',
  'iterative development', 'iterative investigation', 'iterative approach',
  'systematic investigation', 'systematic testing', 'systematic experimental',
  'experimental sharding', 'experimental training', 'experimental build',
  'systematic refactoring', 'systematic development', 'each iteration',
  'progressive refinement', 'tested and refined',
]
const SI_WEAK = [
  'systematic', 'iterative', 'iteration', 'investigation', 'tested', 'explored',
  'experiments', 'experimental', 'cycles', 'trial', 'multiple attempts',
  'failure', 'failed build', 'failed test', 'debugging', 'investigated',
]

// QP: Qualified Personnel — must name ≥2 people OR explicitly state qualified roles
const QP_STRONG_PATTERNS = [
  // Two or more named people (detect "X and Y" where both look like proper names)
  /(?:engineers?|developers?|scientists?|researchers?)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s+and\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
  // "[Name] and [Name]" pattern (any two Proper Nouns with "and")
  /[A-Z][a-z]+\s+[A-Z][a-z]+\s+and\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
]
const QP_WEAK = [
  'software engineer', 'senior engineer', 'engineer', 'developer',
  'scientist', 'researcher', 'data scientist', 'ml engineer',
  'machine learning engineer', 'software developer', 'technical lead',
  'tech lead', 'principal engineer', 'staff engineer',
]

// TA: Technological Advancement — explicitly states new knowledge or capability
const TA_STRONG = [
  'technological advancement', 'advances the state', 'new knowledge',
  'novel capability', 'capability not commercially available',
  'not achievable through standard', 'novel fraud detection',
  'not previously achievable', 'advances the organisation',
  'advance the taxpayer', 'novel method', 'novel technique',
  'novel architecture', 'novel approach', 'newly developed',
  'first-of-its-kind', 'beyond the state of technology',
]
const TA_WEAK = [
  'improvement', 'improved', 'achieved', 'resulting in', 'accomplished',
  'optimized', 'optimised', 'reduction', 'reduced', 'increased',
  'enhanced', 'advanced', 'novel', 'new approach', 'innovative',
]

// WD: Work Description — word count + tech specificity + concrete metrics
const TECH_TERMS = [
  'redis', 'postgresql', 'mysql', 'mongodb', 'kubernetes', 'docker',
  'react', 'node', 'python', 'java', 'rust', 'golang', 'typescript',
  'tensorflow', 'pytorch', 'xgboost', 'sklearn', 'spark', 'kafka',
  'aws', 'gcp', 'azure', 'lambda', 'graphql', 'grpc', 'rest api',
  'microservice', 'webpack', 'nginx', 'redis cluster', 'shap', 'smote',
  'stripe', 'psd2', 'sca', 'idempotency', 'webhook', 'oauth',
  'consistent hashing', 'slot-based', 'f1 score', 'precision', 'recall',
  'latency', 'throughput', 'p99', 'p95', 'vectorization', 'quantization',
  'transformer', 'attention', 'bert', 'gpt', 'llm', 'rag',
  'wasm', 'llvm', 'jit', 'bytecode', 'raft', 'paxos', 'crdt',
  'sha-256', 'sha256', 'hmac', 'aes', 'zkp',
  'commit', 'build', 'jira', 'github', 'ci/cd', 'pipeline',
]
// Regex for concrete metrics (numbers with units or % or ms or x improvement)
const METRIC_PATTERN = /\d+(\.\d+)?\s*(%|ms|s\b|h\b|hours?|x\b|×|→|->|from \d)/i

// ─── Dimension scoring ─────────────────────────────────────────────────────────

function countKeywords(lower, keywords) {
  return keywords.reduce((n, kw) => n + (lower.includes(kw.toLowerCase()) ? 1 : 0), 0)
}

function scoreTU(text) {
  const lower = text.toLowerCase()
  const strongHits = countKeywords(lower, TU_STRONG)
  const weakHits   = countKeywords(lower, TU_WEAK)

  if (strongHits >= 1) return 20
  if (weakHits >= 3)   return 10
  if (weakHits >= 1)   return 0  // present but too vague
  return 0
}

function scoreSI(text) {
  const lower = text.toLowerCase()
  const strongHits = countKeywords(lower, SI_STRONG)
  const weakHits   = countKeywords(lower, SI_WEAK)

  if (strongHits >= 2) return 20
  if (strongHits >= 1) return 20  // any explicit iterative/experimental framing is strong
  if (weakHits >= 4)   return 10
  if (weakHits >= 2)   return 10
  return 0
}

function scoreQP(text) {
  const lower = text.toLowerCase()

  // Check for two named qualified personnel (strong pattern)
  const hasStrongPattern = QP_STRONG_PATTERNS.some(p => p.test(text))
  if (hasStrongPattern) return 20

  // Check for at least one weak keyword (named or described role)
  const weakHits = countKeywords(lower, QP_WEAK)
  if (weakHits >= 1) return 10

  return 0
}

function scoreTA(text) {
  const lower = text.toLowerCase()
  const strongHits = countKeywords(lower, TA_STRONG)
  const weakHits   = countKeywords(lower, TA_WEAK)

  if (strongHits >= 1) return 20
  if (weakHits >= 2)   return 10
  if (weakHits >= 1)   return 10
  return 0
}

function scoreWD(text) {
  const lower = text.toLowerCase()
  const words = text.trim().split(/\s+/).length

  // Word count threshold: 200 words for full credit on length portion
  const lengthScore = words >= 200 ? 10 : words >= 150 ? 5 : 0

  // Tech specificity: ≥3 recognised tech terms
  const techHits = countKeywords(lower, TECH_TERMS)
  const hasMetric = METRIC_PATTERN.test(text)

  const specificityScore = (techHits >= 3 && hasMetric) ? 10
    : (techHits >= 2 || hasMetric) ? 5
    : 0

  const total = lengthScore + specificityScore
  if (total >= 15) return 20
  if (total >= 8)  return 10
  return 0
}

// ─── Improvement suggestions (per dimension × severity) ───────────────────────

const SUGGESTIONS = {
  tu: {
    0:  'State what was technologically unknown: "The team faced uncertainty in determining whether [approach] could achieve [goal], as no existing documentation or standard practice provided a reliable answer."',
    10: 'Strengthen the uncertainty by explaining why standard practice failed: "Existing industry solutions did not address [specific gap], requiring novel investigation beyond routine engineering."',
  },
  si: {
    0:  'Describe your systematic process: "The team conducted N iterative experimental cycles, each testing a specific hypothesis. Failures in cycles 1–2 (build IDs) informed subsequent design decisions."',
    10: 'Add explicit hypothesis-testing language: "Each experimental iteration tested a specific hypothesis and the results of failed builds directly informed the next experimental cycle."',
  },
  qp: {
    0:  'Name the qualified personnel: "Software engineers [First Last] and [First Last] conducted all SR&ED activities, bringing expertise in [domain]."',
    10: 'Add a second named engineer and their specific role: "Senior engineer [Name] (ML lead) and [Name] (systems engineer) jointly designed and executed the experimental programme."',
  },
  ta: {
    0:  'State the new knowledge achieved: "This work advanced the organisation\'s technical knowledge base by establishing that [specific finding], producing a capability not previously achievable through standard practice."',
    10: 'Frame outcomes as technological advancement, not just improvement: "The resulting [method/architecture] represents new knowledge that could not have been obtained without this systematic investigation."',
  },
  wd: {
    0:  'Expand to ≥150 words with specific technology names, before/after metrics (e.g. "latency reduced from 340 ms to 12 ms"), and referenced commit hashes or ticket IDs.',
    10: 'Add concrete metrics and at least 3 specific technology names: include tool versions, F1/accuracy numbers, latency deltas, or throughput figures supported by referenced evidence.',
  },
}

// ─── AI improvement patch generator ───────────────────────────────────────────
// Generates a targeted 2-3 sentence text patch for the weakest dimension.
// No LLM call — pure template logic filled with cluster metadata.

export function generateImprovementPatch(scoreResult, cluster) {
  const weakest = [...scoreResult.dimensions].sort((a, b) => a.score - b.score)[0]
  if (!weakest || weakest.score >= 20) return null

  const component = cluster?.business_component ?? 'this business component'
  const hours     = cluster?.aggregate_time_hours?.toFixed(0) ?? 'N'

  const patches = {
    tu: `The team faced technological uncertainty in determining whether the chosen approach for ${component} could achieve the required performance and reliability characteristics. No existing published benchmark, library, or standard engineering practice addressed this specific configuration or workload profile. The outcome could not be predicted with confidence at the outset of the work.`,

    si: `The engineering team conducted systematic experimental investigation, executing ${hours} hours of iterative development cycles. Each cycle tested a specific hypothesis derived from observed failure modes, and the results of unsuccessful builds directly informed the design of subsequent experiments. This structured approach ensured that all negative results contributed measurable new knowledge to the investigation.`,

    qp: `Qualified software engineers with domain expertise in ${component.split('—')[0]?.trim() ?? 'the relevant technical area'} conducted all SR&ED-eligible activities. The personnel involved held the technical qualifications necessary to identify and resolve technological uncertainty, and directly performed the experimental design, implementation, and analysis of results.`,

    ta: `This systematic investigation advanced the organisation's technical knowledge by establishing that ${component.split('—')[0]?.trim() ?? 'the work'} could be achieved within the required constraints — a capability not previously available to the taxpayer. The resulting techniques and knowledge are directly applicable to future R&D initiatives and represent measurable advancement beyond the state of technology at project inception.`,

    wd: `[Reviewer: expand this section with (a) the specific technologies and version numbers used, (b) quantitative before/after metrics (e.g. latency reduced from X ms to Y ms, accuracy improved from X% to Y%), and (c) references to specific commit hashes, build IDs, or Jira ticket numbers that serve as contemporaneous evidence of the systematic work performed.]`,
  }

  return {
    dimensionCode: weakest.code,
    dimensionName: weakest.name,
    patch:         patches[weakest.code] ?? '',
  }
}

// ─── Main scorer ───────────────────────────────────────────────────────────────

/**
 * scoreNarrative(text, cluster?)
 *
 * @param  {string} text     Raw narrative text to score
 * @param  {object} cluster  Optional cluster object for patch generation context
 * @returns {object} Scoring result
 */
export function scoreNarrative(text, cluster = null) {
  if (!text || text.trim().length === 0) {
    const empty = (code, name) => ({
      code, name, score: 0, maxScore: 20,
      status: 'fail', suggestion: SUGGESTIONS[code][0],
    })
    return {
      totalScore: 0, label: 'No Narrative', color: 'gray',
      dimensions: [
        empty('tu', 'Technological Uncertainty'),
        empty('si', 'Systematic Investigation'),
        empty('qp', 'Qualified Personnel'),
        empty('ta', 'Technological Advancement'),
        empty('wd', 'Work Description'),
      ],
      weakestDimension: null,
      patch: null,
    }
  }

  const scores = {
    tu: scoreTU(text),
    si: scoreSI(text),
    qp: scoreQP(text),
    ta: scoreTA(text),
    wd: scoreWD(text),
  }

  const DIMENSION_NAMES = {
    tu: 'Technological Uncertainty',
    si: 'Systematic Investigation',
    qp: 'Qualified Personnel',
    ta: 'Technological Advancement',
    wd: 'Work Description',
  }

  const dimensions = Object.entries(scores).map(([code, score]) => {
    const status     = score >= 20 ? 'pass' : score >= 10 ? 'partial' : 'fail'
    const suggestion = score < 20 ? SUGGESTIONS[code][score >= 10 ? 10 : 0] : null
    return {
      code,
      name:       DIMENSION_NAMES[code],
      score,
      maxScore:   20,
      status,     // 'pass' | 'partial' | 'fail'
      suggestion,
    }
  })

  const totalScore = dimensions.reduce((s, d) => s + d.score, 0)

  const label = totalScore >= 90 ? 'Excellent'
    : totalScore >= 80 ? 'Good'
    : totalScore >= 60 ? 'Needs Work'
    : 'Insufficient'

  // green | amber | red | gray
  const color = totalScore >= 80 ? 'green'
    : totalScore >= 60 ? 'amber'
    : 'red'

  const weakest = [...dimensions].sort((a, b) => a.score - b.score)[0]
  const result  = { totalScore, label, color, dimensions, weakestDimension: weakest }

  result.patch = generateImprovementPatch(result, cluster)
  return result
}

// ─── Aggregate scorer (for CPA package) ───────────────────────────────────────

/**
 * scoreNarrativeSet(clusters, narrativeLookup?)
 *
 * Scores multiple clusters at once for the CPA package quality gate.
 * Returns a summary with a pass/warn/fail determination.
 *
 * @param {Array}  clusters        Array of cluster objects
 * @param {object} narrativeLookup Optional { [narrative_id]: { content_text } } map
 * @returns {object} Aggregate quality result
 */
export function scoreNarrativeSet(clusters, narrativeLookup = {}) {
  const results = clusters.map(c => {
    const text = c.narrative_content_text
      ?? narrativeLookup[c.narrative_id]?.content_text
      ?? ''
    return {
      cluster: c,
      score:   scoreNarrative(text, c),
      text,
    }
  })

  const passing    = results.filter(r => r.score.totalScore >= 80)
  const needsWork  = results.filter(r => r.score.totalScore >= 60 && r.score.totalScore < 80)
  const failing    = results.filter(r => r.score.totalScore < 60)
  const allPassing = failing.length === 0 && needsWork.length === 0
  const anyFailing = failing.length > 0

  return {
    results,
    passing, needsWork, failing,
    allPassing, anyFailing,
    averageScore: results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.score.totalScore, 0) / results.length)
      : 0,
  }
}
