/**
 * ScanRunningPage — /scan/running
 *
 * Runs the SR&ED scan client-side:
 *   1. Reads selected repos + email from storage
 *   2. Fetches commits from GitHub API for each repo (using stored OAuth token)
 *   3. Runs scanCommits() from sredScanner.js
 *   4. POSTs aggregated results to /api/scan/free for persistence
 *   5. Stores results in sessionStorage → navigates to /scan/results
 *
 * Falls back to demo scan results when the GitHub token is unavailable.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react'
import { getStoredToken } from '../../lib/oauthConfig'
import { scanCommits }    from '../../lib/sredScanner'

// ── Demo fallback data ────────────────────────────────────────────────────────────────────────────
// Shown when GitHub is unreachable / token not available.
const DEMO_RESULTS = {
  clusters: [
    {
      id: 'gh-ml-platform-1',
      business_component: 'ml-platform · ML / AI Development',
      _theme: 'ML / AI Development',
      _repo: 'ml-platform',
      aggregate_time_hours: 42,
      estimated_credit_cad: 22050,
      _commitCount: 21,
      _signals: [
        'experiment: test gradient checkpointing to cut memory by 40%',
        'implement adaptive learning rate scheduler with warmup',
        'add hypothesis test for batch norm vs layer norm on small datasets',
        'poc: evaluate flash-attention vs standard self-attention',
      ],
      risk_score: 3,
    },
    {
      id: 'gh-backend-api-1',
      business_component: 'backend-api · Algorithm Research & Optimization',
      _theme: 'Algorithm Research & Optimization',
      _repo: 'backend-api',
      aggregate_time_hours: 28,
      estimated_credit_cad: 14700,
      _commitCount: 14,
      _signals: [
        'optimize query planner: reduce p99 latency by 62% with new index heuristic',
        'research: evaluate LSM vs B-tree for write-heavy workloads',
        'benchmark custom hash join vs postgres merge join',
      ],
      risk_score: 2,
    },
    {
      id: 'gh-perf-benchmarks-1',
      business_component: 'perf-benchmarks · Performance Engineering Research',
      _theme: 'Performance Engineering Research',
      _repo: 'perf-benchmarks',
      aggregate_time_hours: 18,
      estimated_credit_cad: 9450,
      _commitCount: 9,
      _signals: [
        'profile cold start bottleneck in inference worker init',
        'investigate throughput regression in batch pipeline after v2.1',
        'measure tail latency impact of GC pressure under load',
      ],
      risk_score: 2,
    },
  ],
  email: '',
  repos: ['acme/ml-platform', 'acme/backend-api', 'acme/perf-benchmarks'],
  commit_count: 44,
  hours_total: 88,
  estimated_credit: 46200,
  is_demo: true,
}

// ── Progress steps ──────────────────────────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Connecting to GitHub',           sub: 'Verifying OAuth token…' },
  { label: 'Scanning commits',               sub: 'Fetching recent commit history…' },
  { label: 'Detecting SR&ED patterns',       sub: 'Running keyword & context analysis…' },
  { label: 'Calculating credit estimate',    sub: 'Applying CRA ITC proxy method…' },
  { label: 'Preparing your results',         sub: 'Almost there…' },
]

export default function ScanRunningPage() {
  const navigate    = useNavigate()
  const [step,      setStep]      = useState(0)   // 0-based index into STEPS
  const [done,      setDone]      = useState(false)
  const hasFired    = useRef(false)

  useEffect(() => {
    if (hasFired.current) return
    hasFired.current = true
    runScan()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function runScan() {
    const repos = JSON.parse(sessionStorage.getItem('taxlift_scan_repos') ?? '[]')
    const email = localStorage.getItem('taxlift_scan_email') ?? ''
    const token = getStoredToken('github')

    // ── Step 0: connecting ─────────────────────────────────────────────────────────────────────────────
    setStep(0)
    await delay(600)

    let allClusters   = []
    let totalCommits  = 0
    let isDemo        = false

    if (!token || repos.length === 0) {
      // ── Demo mode ───────────────────────────────────────────────────────────────────────────────
      isDemo = true
      setStep(1)
      await delay(800)
      setStep(2)
      await delay(1000)
      setStep(3)
      await delay(700)
      allClusters  = DEMO_RESULTS.clusters
      totalCommits = DEMO_RESULTS.commit_count
    } else {
      // ── Real scan ───────────────────────────────────────────────────────────────────────────────
      setStep(1)

      for (const repoFullName of repos) {
        try {
          // Paginate up to 3 pages × 100 commits = 300 commits per repo
          // The GitHub API caps per_page at 100; multiple pages capture older R&D work
          let allCommits = []
          for (let page = 1; page <= 3; page++) {
            const res = await fetch(
              `https://api.github.com/repos/${repoFullName}/commits?per_page=100&page=${page}`,
              { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' } }
            )
            if (!res.ok) break
            const pageCommits = await res.json()
            if (!Array.isArray(pageCommits) || pageCommits.length === 0) break
            allCommits.push(...pageCommits)
            if (pageCommits.length < 100) break   // last page — no more commits
          }
          if (allCommits.length === 0) continue

          totalCommits += allCommits.length
          setStep(2)

          const repoName = repoFullName.split('/')[1]
          const clusters = scanCommits(allCommits, repoName)
          if (clusters) allClusters.push(...clusters)
        } catch (err) {
          console.warn(`[ScanRunningPage] Failed to scan ${repoFullName}:`, err.message)
        }
      }

      // De-duplicate themes across repos: merge clusters with the same theme
      const merged = {}
      for (const c of allClusters) {
        const key = c._theme
        if (!merged[key]) {
          merged[key] = { ...c }
        } else {
          merged[key].aggregate_time_hours += c.aggregate_time_hours
          merged[key].estimated_credit_cad += c.estimated_credit_cad
          merged[key]._commitCount         += c._commitCount
          merged[key]._signals             = [...(merged[key]._signals ?? []), ...(c._signals ?? [])].slice(0, 8)
        }
      }
      allClusters = Object.values(merged)

      setStep(3)
      await delay(500)
    }

    // ── Step 4: calculate + save ───────────────────────────────────────────────────────────────────────
    setStep(4)

    const teamSize   = parseInt(sessionStorage.getItem('taxlift_scan_team_size') ?? '5', 10) || 5
    const totalHours = allClusters.reduce((s, c) => s + (c.aggregate_time_hours ?? 0), 0)

    // ── Salary-anchored credit (CRA proxy method) ────────────────────────────
    // Commit-based hours tell us the SR&ED eligibility fraction (qualifying hours /
    // max plausible hours). Apply that fraction to actual payroll to get a realistic
    // credit rather than inflating contractor-rate guesses.
    //
    //   max plausible hours  = teamSize × 1,800 hrs/yr × 70% cap (SR&ED cannot be >70% of work)
    //   eligibility fraction = min(totalHours / maxHours, 0.85)
    //   qualified spend      = teamSize × $120,000 avg salary × eligibility fraction
    //   federal ITC          = qualified spend × 35% (CCPC)
    //
    // ScanResultsPage adds provincial ITC when the user selects their province.
    const maxHours           = teamSize * 1_800 * 0.70
    const eligibilityFrac    = Math.min(totalHours / Math.max(maxHours, 1), 0.85)
    const avgSalary          = 120_000
    const qualifiedSpend     = teamSize * avgSalary * eligibilityFrac
    const salaryCredit       = Math.round(qualifiedSpend * 0.35)   // federal ITC only

    // Use the higher of commit-based or salary-anchored (salary is usually more accurate
    // for multi-person teams; commit-based is more accurate for solo contributors)
    const commitCredit       = allClusters.reduce((s, c) => s + (c.estimated_credit_cad ?? 0), 0)
    const totalCredit        = teamSize <= 2 ? commitCredit : Math.max(commitCredit, salaryCredit)

    const payload = {
      email,
      repos,
      clusters:         allClusters,
      estimated_credit: totalCredit,
      commit_count:     totalCommits,
      hours_total:      totalHours,
      team_size:        teamSize,
      eligibility_pct:  Math.round(eligibilityFrac * 100),
    }

    // Persist to backend (best-effort — don't block UX if backend unreachable)
    let scanId = null
    try {
      const res = await fetch('/api/v1/scan/free', {
        method:  'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (res.ok) {
        const data = await res.json()
        scanId = data.id
      }
    } catch { /* backend unreachable — continue */ }

    // Store results for /scan/results
    sessionStorage.setItem('taxlift_scan_results', JSON.stringify({
      ...payload,
      scanId,
      is_demo: isDemo,
    }))

    await delay(400)
    setDone(true)
    await delay(500)
    navigate('/scan/results')
  }

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">TaxLift</span>
        </div>

        {/* Animated step list */}
        <div className="space-y-4 mb-10">
          {STEPS.map((s, i) => {
            const isPast    = i < step
            const isCurrent = i === step && !done
            const isFuture  = i > step

            return (
              <div key={i} className={`flex items-start gap-3 text-left transition-all duration-300 ${
                isFuture ? 'opacity-30' : 'opacity-100'
              }`}>
                <div className="mt-0.5 flex-shrink-0">
                  {isPast ? (
                    <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <CheckCircle2 size={12} className="text-white" />
                    </div>
                  ) : isCurrent ? (
                    <Loader2 size={20} className="text-indigo-400 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isPast ? 'text-emerald-400' : isCurrent ? 'text-white' : 'text-slate-500'}`}>
                    {s.label}
                  </p>
                  {isCurrent && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{s.sub}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${done ? 100 : (step / (STEPS.length - 1)) * 95}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          {done ? 'Done! Taking you to your results…' : 'Scanning your commit history…'}
        </p>
      </div>
    </div>
  )
}
