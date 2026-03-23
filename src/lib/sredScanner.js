/**
 * sredScanner.js
 *
 * SR&ED (Scientific Research & Experimental Development) signal detection.
 *
 * Takes raw GitHub commits or Jira issues and:
 *   1. Scores each item against a keyword list based on CRA eligibility criteria
 *   2. Classifies matching items into SR&ED activity themes
 *   3. Groups items by theme and repo/project into candidate clusters
 *   4. Estimates eligible hours and ITC credit (CAD) using simple proxies
 *
 * CRA SR&ED eligibility requires:
 *   • Technological advancement beyond current knowledge base
 *   • Technological uncertainty that couldn't be resolved by routine engineering
 *   • Systematic investigation (hypothesis → experiment → observation)
 *
 * Scoring model (per commit):
 *   Message keywords   → up to 3 pts  (strong signal)
 *   Filename signals   → up to 4 pts  (medium signal — research file paths)
 *   Diff/patch content → up to 5 pts  (broad signal — any matching terms)
 *   ─────────────────────────────────────────────────────
 *   QUALIFY_THRESHOLD  = 3 pts minimum to flag as SR&ED candidate
 */

// ── Minimum score to count a commit as SR&ED-qualifying ───────────────────────
export const QUALIFY_THRESHOLD = 3

// ── SR&ED signal keywords ──────────────────────────────────────────────────────
// Sourced from CRA SR&ED terminology and common engineering language that signals
// qualifying activities under the three-part eligibility test.
export const SRED_KEYWORDS = [
  // Uncertainty & exploration (strongest signals)
  'experiment', 'experimental', 'hypothesis', 'hypothesize',
  'investigate', 'investigation', 'exploratory', 'explore',
  'prototype', 'proof of concept', 'poc', 'spike',
  'uncertain', 'uncertainty', 'unknown', 'undefined behavior', 'unpredictable',
  'feasibility', 'feasible', 'evaluate', 'evaluating',

  // Research language
  'research', 'r&d', 'novel', 'innovative', 'new approach',
  'breakthrough', 'first-of-its-kind', 'state of the art',
  'literature review', 'peer-reviewed', 'academic',

  // ML / AI (high-value, frequently qualifying)
  'machine learning', 'ml model', 'neural network', 'deep learning',
  'transformer', 'attention mechanism', 'fine-tuning', 'pre-training',
  'reinforcement learning', 'training pipeline', 'model training',
  'nlp', 'natural language', 'computer vision', 'object detection',
  'embedding', 'vector', 'inference', 'quantization',
  'hyperparameter', 'gradient', 'backprop',

  // Algorithm & optimization
  'algorithm', 'heuristic', 'optimization', 'optimise', 'optimize',
  'approximation', 'complexity', 'convergence', 'search space',
  'genetic algorithm', 'simulated annealing', 'monte carlo',

  // Performance research
  'latency', 'throughput', 'bottleneck', 'profiling',
  'benchmark', 'benchmarking', 'measure performance',
  'reduce latency', 'improve throughput', 'cold start',

  // Distributed systems & infrastructure research
  'distributed system', 'consensus', 'fault tolerance', 'availability',
  'replication', 'sharding', 'partitioning', 'coordination',
  'concurrent', 'parallelism', 'race condition', 'deadlock',
  'eventual consistency', 'cap theorem', 'raft', 'paxos',

  // Security & cryptography research
  'encryption', 'cryptography', 'zero-knowledge', 'zkp',
  'homomorphic', 'differential privacy', 'secure computation',
  'vulnerability', 'exploit', 'threat model',

  // Compiler & runtime research
  'compiler', 'parser', 'codegen', 'bytecode', 'jit',
  'ahead-of-time', 'runtime', 'interpreter', 'ast', 'llvm',
  'garbage collection', 'memory model',

  // Process indicators (systematic investigation)
  'root cause', 'root cause analysis', 'intermittent', 'reproduce bug',
  'debug unknown', 'undefined', 'unexpected behavior',
  'workaround', 'edge case', 'failure mode',
]

// ── File-path patterns that strongly suggest R&D work ─────────────────────────
// A commit touching these paths gets a filename signal bonus.
const SRED_PATH_PATTERNS = [
  /\bml\b/i, /\bai\b/i, /model/i, /train/i, /inference/i,
  /experiment/i, /research/i, /prototype/i, /poc\b/i, /spike\b/i,
  /algorithm/i, /optim/i, /benchmark/i, /perf/i,
  /crypto/i, /cipher/i, /zkp/i, /zk[-_]/i,
  /compiler/i, /codegen/i, /parser/i, /jit\b/i, /llvm/i,
  /distributed/i, /consensus/i, /raft\b/i, /paxos/i,
  /neural/i, /nlp\b/i, /embed/i, /vector/i, /transform/i,
]

// ── SR&ED activity themes ──────────────────────────────────────────────────────
// Used to group qualifying signals into coherent business components.
const THEMES = [
  {
    name:     'ML / AI Development',
    keywords: ['machine learning', 'ml model', 'neural network', 'deep learning', 'transformer',
               'nlp', 'natural language', 'computer vision', 'training', 'inference',
               'embedding', 'reinforcement learning', 'gradient', 'quantization'],
  },
  {
    name:     'Algorithm Research & Optimization',
    keywords: ['algorithm', 'heuristic', 'optimization', 'approximation', 'complexity',
               'convergence', 'search space', 'genetic algorithm', 'monte carlo', 'benchmark'],
  },
  {
    name:     'Distributed Systems Research',
    keywords: ['distributed', 'consensus', 'fault tolerance', 'replication', 'sharding',
               'partitioning', 'concurrent', 'parallelism', 'race condition', 'cap theorem',
               'raft', 'paxos', 'eventual consistency'],
  },
  {
    name:     'Security & Cryptography R&D',
    keywords: ['encryption', 'cryptography', 'zero-knowledge', 'zkp', 'homomorphic',
               'differential privacy', 'vulnerability', 'threat model', 'secure computation'],
  },
  {
    name:     'Performance Engineering Research',
    keywords: ['latency', 'throughput', 'bottleneck', 'profiling', 'benchmark',
               'cold start', 'reduce latency', 'improve throughput'],
  },
  {
    name:     'Compiler / Runtime Research',
    keywords: ['compiler', 'parser', 'codegen', 'bytecode', 'jit', 'runtime',
               'interpreter', 'ast', 'llvm', 'garbage collection'],
  },
  {
    name:     'Exploratory Prototyping',
    keywords: ['prototype', 'poc', 'proof of concept', 'spike', 'experiment',
               'exploratory', 'feasibility', 'evaluate', 'hypothesis'],
  },
  {
    name:     'Technical Uncertainty Resolution',
    keywords: ['uncertain', 'unknown', 'undefined', 'intermittent', 'root cause',
               'reproduce', 'workaround', 'edge case', 'failure mode'],
  },
]

// ── Scoring helpers ────────────────────────────────────────────────────────────

/**
 * Score commit message text. Cap at 3 pts.
 * Each unique keyword hit = 1 pt; very explicit terms count double.
 */
function scoreMessage(msg) {
  if (!msg) return 0
  const lower = msg.toLowerCase()
  let pts = 0
  for (const kw of SRED_KEYWORDS) {
    if (lower.includes(kw)) {
      // High-signal terms worth 2 pts
      const highSignal = ['experiment', 'hypothesis', 'r&d', 'proof of concept',
        'poc', 'research', 'prototype', 'spike', 'uncertain', 'investigate'].includes(kw)
      pts += highSignal ? 2 : 1
      if (pts >= 3) return 3  // cap
    }
  }
  return Math.min(pts, 3)
}

/**
 * Score file paths touched by the commit. Cap at 4 pts.
 * Matches against SRED_PATH_PATTERNS — each unique matching file = 1 pt.
 */
function scoreFilenames(files) {
  if (!files?.length) return 0
  let pts = 0
  const seen = new Set()
  for (const f of files) {
    const fname = f.filename ?? f.name ?? ''
    for (const re of SRED_PATH_PATTERNS) {
      if (re.test(fname) && !seen.has(fname)) {
        seen.add(fname)
        pts += 1
        break
      }
    }
    if (pts >= 4) return 4  // cap
  }
  return pts
}

/**
 * Score diff/patch content. Cap at 5 pts.
 * Scans the actual code changes — even 1 matching term in a diff is meaningful.
 */
function scorePatch(files) {
  if (!files?.length) return 0
  // Combine all patches into one string for scanning
  const allPatch = files.map(f => f.patch ?? '').join('\n').toLowerCase()
  if (!allPatch.trim()) return 0
  let pts = 0
  for (const kw of SRED_KEYWORDS) {
    if (allPatch.includes(kw)) {
      pts += 1
      if (pts >= 5) return 5  // cap
    }
  }
  return pts
}

/**
 * Full commit scoring using all three dimensions.
 *
 * @param {object} commit  GitHub commit object, optionally enriched with .files
 * @returns {{ total: number, msgScore: number, fnScore: number, patchScore: number }}
 */
export function scoreCommitFull(commit) {
  const msg        = commit.commit?.message ?? commit.message ?? ''
  const files      = commit.files ?? null
  const msgScore   = scoreMessage(msg.split('\n')[0])       // subject line only
  const fnScore    = scoreFilenames(files)
  const patchScore = scorePatch(files)
  return {
    total:      msgScore + fnScore + patchScore,
    msgScore,
    fnScore,
    patchScore,
  }
}

/**
 * Quick message-only score — used to pre-screen commits before fetching diffs.
 * A commit scoring ≥ 2 on message alone is worth fetching the full diff for.
 */
export function scoreMessageOnly(commit) {
  const msg = commit.commit?.message ?? commit.message ?? ''
  return scoreMessage(msg.split('\n')[0])
}

function detectTheme(text) {
  if (!text) return 'General R&D Activity'
  const lower = text.toLowerCase()
  let best = { name: 'General R&D Activity', hits: 0 }
  for (const theme of THEMES) {
    const hits = theme.keywords.reduce((n, kw) => n + (lower.includes(kw) ? 1 : 0), 0)
    if (hits > best.hits) best = { name: theme.name, hits }
  }
  return best.name
}

// ── Credit estimation helpers ──────────────────────────────────────────────────
// Proxies only — actual T661 calculations use the proxy method with real salaries.

/** Rough estimate: 2h eligible R&D per qualifying commit (conservative for CRA) */
function estimateHoursFromCommits(count) {
  return count * 2
}

/** Rough estimate: 12 eligible hours of R&D per qualifying Jira ticket */
function estimateHoursFromIssues(count) {
  return count * 12
}

/**
 * ITC estimate using simplified proxy method:
 *   Fully-loaded contractor rate: $150 CAD/hr
 *   CCPC enhanced ITC rate (first $3M): 35%
 *   → $52.50 credit per eligible hour
 */
function estimateCredit(hours) {
  return Math.round(hours * 150 * 0.35)
}

/** Risk score 1–10 (lower = better). Based on explicitness of SR&ED language. */
function estimateRisk(texts) {
  const combined = texts.join(' ').toLowerCase()
  const hasUncertainty = ['uncertain', 'unknown', 'investigate', 'undefined', 'intermittent']
    .some(k => combined.includes(k))
  const hasExplicit = ['r&d', 'experiment', 'research', 'proof of concept', 'poc', 'hypothesis']
    .some(k => combined.includes(k))
  if (hasUncertainty && hasExplicit) return 2
  if (hasExplicit)    return 4
  if (hasUncertainty) return 6
  return 7
}

// ── Legacy text scorer (kept for backward compat with any callers) ─────────────
export function scoreText(text) {
  if (!text) return 0
  const lower = text.toLowerCase()
  return SRED_KEYWORDS.reduce((n, kw) => n + (lower.includes(kw) ? 1 : 0), 0)
}

// ── GitHub commit scanning ─────────────────────────────────────────────────────
/**
 * scanCommits — analyse GitHub commit objects and return SR&ED candidate clusters.
 *
 * Accepts two kinds of commit objects:
 *   Basic   { sha, commit: { message, author: { date } } }                    (list endpoint)
 *   Enriched { sha, commit: {...}, files: [{ filename, patch }] }              (detail endpoint)
 *
 * When enriched commits are supplied the scorer uses all three dimensions
 * (message + filenames + diff) to determine eligibility.
 * When only basic commits are supplied it falls back to message-only scoring.
 *
 * @param {Array}  commits   GitHub REST API commit objects
 * @param {string} repoName  Repository name (used as cluster label prefix)
 * @returns {Array|null}     Array of cluster-shaped objects, or null if no signals found
 */
export function scanCommits(commits, repoName) {
  const qualifying = []

  for (const c of commits) {
    const { total, msgScore, fnScore, patchScore } = scoreCommitFull(c)
    if (total >= QUALIFY_THRESHOLD) {
      const msg = c.commit?.message ?? c.message ?? ''
      qualifying.push({
        message:    msg.split('\n')[0].slice(0, 120),  // subject line, capped
        sha:        c.sha ?? null,
        date:       c.commit?.author?.date ?? c.date ?? new Date().toISOString(),
        score:      total,
        msgScore,
        fnScore,
        patchScore,
        files:      (c.files ?? []).map(f => f.filename).filter(Boolean).slice(0, 5),
      })
    }
  }

  if (qualifying.length === 0) return null

  // Group by theme using commit messages
  const groups = {}
  for (const item of qualifying) {
    const theme = detectTheme(item.message)
    if (!groups[theme]) groups[theme] = []
    groups[theme].push(item)
  }

  return Object.entries(groups).map(([theme, items], i) => {
    const hours  = estimateHoursFromCommits(items.length)
    const credit = estimateCredit(hours)
    const risk   = estimateRisk(items.map(it => it.message))

    // Top 8 items by score for display, sorted highest-score first
    const topItems = [...items].sort((a, b) => b.score - a.score).slice(0, 8)

    return {
      id:                   `gh-${repoName.replace(/\W+/g, '-')}-${i + 1}`,
      business_component:   `${repoName} · ${theme}`,
      status:               'New',
      aggregate_time_hours: hours,
      estimated_credit_cad: credit,
      risk_score:           risk,
      stale_context:        false,
      created_at:           items[0]?.date ?? new Date().toISOString(),
      _source:              'github',
      _theme:               theme,
      _repo:                repoName,
      _signals:             topItems.map(it => it.message),
      _commits:             topItems.map(it => ({ sha: it.sha, message: it.message, score: it.score, files: it.files })),
      _commitCount:         items.length,
      _totalScore:          items.reduce((s, it) => s + it.score, 0),
    }
  })
}

// ── Jira issue scanning ────────────────────────────────────────────────────────
/**
 * scanIssues — analyse Jira issue objects and return SR&ED candidate clusters.
 *
 * @param {Array}  issues      Jira REST API issue objects (fields.summary + fields.description)
 * @param {string} projectKey  Jira project key (used as cluster label prefix)
 * @returns {Array|null}       Array of cluster-shaped objects, or null if no signals found
 */
export function scanIssues(issues, projectKey) {
  const matching = issues.filter(issue => {
    const summary     = issue.fields?.summary ?? ''
    const descContent = issue.fields?.description?.content?.[0]?.content?.[0]?.text ?? ''
    return scoreText(`${summary} ${descContent}`) > 0
  })

  if (matching.length === 0) return null

  const groups = {}
  for (const issue of matching) {
    const text  = issue.fields?.summary ?? ''
    const theme = detectTheme(text)
    if (!groups[theme]) groups[theme] = []
    groups[theme].push({
      summary: text.slice(0, 120),
      key:     issue.key ?? null,
    })
  }

  return Object.entries(groups).map(([theme, items], i) => {
    const hours  = estimateHoursFromIssues(items.length)
    const credit = estimateCredit(hours)
    const risk   = estimateRisk(items.map(it => it.summary))
    return {
      id:                   `jira-${projectKey.replace(/\W+/g, '-')}-${i + 1}`,
      business_component:   `${projectKey} · ${theme}`,
      status:               'New',
      aggregate_time_hours: hours,
      estimated_credit_cad: credit,
      risk_score:           risk,
      stale_context:        false,
      created_at:           new Date().toISOString(),
      _source:              'jira',
      _theme:               theme,
      _signals:             items.slice(0, 5).map(it => it.summary),
      _commits:             null,
      _issueCount:          items.length,
    }
  })
}

// ── Demo data ──────────────────────────────────────────────────────────────────
// Realistic SR&ED-qualifying commits for a SaaS company, used when OAuth token
// exchange fails (no backend) so the scan still demonstrates real value.

export const DEMO_REPO_NAME = 'platform-core'

export const DEMO_COMMITS = [
  { sha: 'a1b2c3d4', commit: { message: 'Experiment: transformer-based commit classifier for SR&ED signal detection — initial accuracy 61%, investigating false negatives', author: { date: '2025-10-05T10:00:00Z' } } },
  { sha: 'b2c3d4e5', commit: { message: 'Prototype ML pipeline for anomaly detection in billing events — evaluating isolation forest vs autoencoder', author: { date: '2025-10-12T14:30:00Z' } } },
  { sha: 'c3d4e5f6', commit: { message: 'Spike: graph neural network for real-time fraud scoring — proof of concept, edge case behaviour still unknown', author: { date: '2025-10-20T09:15:00Z' } } },
  { sha: 'd4e5f6g7', commit: { message: 'Research: novel approach to distributed rate limiting without central coordinator — exploring CRDTs under network partition', author: { date: '2025-11-03T11:00:00Z' } } },
  { sha: 'e5f6g7h8', commit: { message: 'POC: zero-knowledge proof for tenant data isolation — investigating zkSNARK vs zkSTARK tradeoffs', author: { date: '2025-11-10T16:45:00Z' } } },
  { sha: 'f6g7h8i9', commit: { message: 'Optimization experiment: custom JIT bytecode compilation reduces query latency from 380ms to 47ms — root cause of remaining 47ms variance uncertain', author: { date: '2025-11-18T13:00:00Z' } } },
  { sha: 'g7h8i9j0', commit: { message: 'Investigate intermittent consensus failure under concurrent leader elections — root cause unknown, adding observability', author: { date: '2025-12-02T10:30:00Z' } } },
  { sha: 'h8i9j0k1', commit: { message: 'Exploratory: custom compiler pass for ahead-of-time query plan optimization — hypothesis: 30% fewer CPU cycles', author: { date: '2025-12-09T15:00:00Z' } } },
  { sha: 'i9j0k1l2', commit: { message: 'R&D: feasibility study — on-device neural network quantization for mobile inference without accuracy degradation', author: { date: '2025-12-16T12:00:00Z' } } },
  { sha: 'j0k1l2m3', commit: { message: 'Hypothesis: adaptive bloom filter sizing reduces false positive rate under skewed key distribution — benchmarking in progress', author: { date: '2026-01-07T09:00:00Z' } } },
  { sha: 'k1l2m3n4', commit: { message: 'Algorithm research: novel heuristic for multi-tenant bin-packing under SLA constraints — convergence properties not yet proven', author: { date: '2026-01-14T14:00:00Z' } } },
  { sha: 'l2m3n4o5', commit: { message: 'Prototype: neural architecture search for latency-constrained edge deployment — evaluating NAS-BERT variants', author: { date: '2026-01-21T11:00:00Z' } } },
  { sha: 'm3n4o5p6', commit: { message: 'Investigation: differential privacy mechanisms for federated learning aggregation — epsilon calibration undefined for our threat model', author: { date: '2026-02-04T10:00:00Z' } } },
  { sha: 'n4o5p6q7', commit: { message: 'Experiment: learned index structures to replace B-trees in write-heavy workloads — throughput improvement hypothesis requires validation', author: { date: '2026-02-18T13:30:00Z' } } },
  { sha: 'o5p6q7r8', commit: { message: 'Research: memory-safe runtime for untrusted tenant WASM execution — exploring formal verification via Lean4', author: { date: '2026-03-03T09:45:00Z' } } },
]

export const DEMO_JIRA_ISSUES = [
  { key: 'ENG-1201', fields: { summary: 'Research and implement ML-based anomaly detection for payment fraud (experimental — baseline unknown)' } },
  { key: 'ENG-1207', fields: { summary: 'Spike: evaluate graph-based feature engineering for churn prediction model — feasibility unclear' } },
  { key: 'ENG-1215', fields: { summary: 'Investigate intermittent race condition in distributed lock service — root cause undefined after 3 weeks' } },
  { key: 'ENG-1223', fields: { summary: 'Proof of concept: zero-knowledge audit trail — no existing implementation to reference' } },
  { key: 'ENG-1240', fields: { summary: 'Optimize transformer inference latency: hypothesis that custom CUDA kernel reduces p99 by 60%' } },
  { key: 'ENG-1258', fields: { summary: 'R&D: novel consensus algorithm tolerant to Byzantine faults in multi-region deployment' } },
  { key: 'ENG-1271', fields: { summary: 'Exploratory: ahead-of-time query compilation using LLVM IR — unknown whether JIT overhead is the actual bottleneck' } },
  { key: 'ENG-1285', fields: { summary: 'Research: federated learning aggregation with differential privacy guarantees for multi-tenant model training' } },
  { key: 'ENG-1299', fields: { summary: 'Prototype: on-device quantized neural network for mobile with <5% accuracy drop — quantization approach uncertain' } },
]
