/**
 * QuickConnectPage — /quick-connect
 *
 * Guided onboarding that connects GitHub or Jira via OAuth and surfaces
 * SR&ED candidate clusters from your real engineering history.
 *
 * Flow:
 *   Step 1 → Pick integration
 *   Step 2a → Authorize (OAuth button or PAT)
 *   Step 2b → Repo selector: searchable list with language/star/private badges,
 *             select up to 3 repos, privacy reassurance banner
 *   Step 3  → Real scan with progress bar: fetch commits (paginated),
 *             fetch diffs for candidates, run scorer, display enriched clusters
 *
 * Scoring (see sredScanner.js):
 *   Message keywords  → up to 3 pts
 *   File-path signals → up to 4 pts
 *   Diff/patch terms  → up to 5 pts
 *   QUALIFY_THRESHOLD = 3 pts minimum
 *
 * Privacy model:
 *   - GitHub OAuth token stored in localStorage only (never sent to TaxLift server)
 *   - Only commit metadata + diffs are read; source code files are never stored
 *   - Diffs are scored in-browser and discarded; only the commit SHA + message are kept
 *   - Max 50 diff fetches per repo to stay within API rate limits
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Github, GitMerge, CheckCircle2, ChevronRight, ChevronLeft,
  Zap, Link2, Eye, ArrowRight, Loader2, Shield, Clock,
  DollarSign, AlertTriangle, Ticket, Hammer, ExternalLink,
  User, RefreshCw, FlaskConical, ChevronDown, ChevronUp, Info,
  Star, Lock, Search, GitCommit, Plus, X, TrendingUp, Package,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatHours } from '../lib/utils'
import { StatusBadge } from '../components/ui/Badge'
import RiskScore from '../components/ui/RiskScore'
import {
  GITHUB_CLIENT_ID, JIRA_CLIENT_ID,
  getGitHubAuthUrl, getJiraAuthUrl,
  generateState, generatePKCE,
  getStoredToken, getStoredUser,
  storeToken, clearToken,
  LS_KEYS,
} from '../lib/oauthConfig'
import {
  scanCommits, scanIssues,
  DEMO_COMMITS, DEMO_JIRA_ISSUES, DEMO_REPO_NAME,
  scoreMessageOnly, QUALIFY_THRESHOLD,
} from '../lib/sredScanner'

// ── Constants ─────────────────────────────────────────────────────────────────
const delay   = (ms) => new Promise(res => setTimeout(res, ms))
const GH_API  = 'https://api.github.com'
const AT_API  = 'https://api.atlassian.com'
const MAX_REPOS_SELECTABLE = 3
const MAX_COMMITS_PER_REPO = 200   // 2 pages × 100
const MAX_DIFF_FETCHES     = 50    // cap diff API calls per repo

const ghHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
})
const atHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
})

// Language badge colours (Tailwind bg/text pairs)
const LANG_COLORS = {
  JavaScript:  'bg-yellow-100 text-yellow-800',
  TypeScript:  'bg-blue-100   text-blue-800',
  Python:      'bg-green-100  text-green-800',
  Go:          'bg-cyan-100   text-cyan-800',
  Rust:        'bg-orange-100 text-orange-800',
  Java:        'bg-red-100    text-red-800',
  'C++':       'bg-purple-100 text-purple-800',
  Ruby:        'bg-pink-100   text-pink-800',
  Swift:       'bg-amber-100  text-amber-800',
  Kotlin:      'bg-violet-100 text-violet-800',
}

// ── Integration definitions ───────────────────────────────────────────────────
const INTEGRATIONS = [
  {
    id:           'github',
    name:         'GitHub',
    icon:         Github,
    color:        'bg-gray-900',
    textColor:    'text-white',
    oauthSupported: true,
    oauthLabel:   'Authorize with GitHub',
    description:  'OAuth 2.0 or Personal Access Token',
    patFields: [
      { id: 'token',  label: 'Personal Access Token', type: 'password', placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx', hint: 'Needs repo, read:org, read:user scopes' },
      { id: 'org',    label: 'GitHub Organisation (optional)', type: 'text', placeholder: 'acme-corp', hint: 'Leave blank to scan your personal repos' },
      { id: 'since',  label: 'Scan commits from date', type: 'date', placeholder: '' },
    ],
  },
  {
    id:           'jira',
    name:         'Jira',
    icon:         Ticket,
    color:        'bg-blue-600',
    textColor:    'text-white',
    oauthSupported: true,
    oauthLabel:   'Authorize with Atlassian',
    description:  'OAuth 2.0 or Atlassian API token',
    patFields: [
      { id: 'domain',   label: 'Atlassian domain',       type: 'text',     placeholder: 'acme.atlassian.net' },
      { id: 'email',    label: 'Account email',           type: 'email',    placeholder: 'you@acme.com' },
      { id: 'token',    label: 'API Token',               type: 'password', placeholder: 'ATATT3xxxxxxxxxxx', hint: 'Create at id.atlassian.com → Security → API tokens' },
      { id: 'projects', label: 'Project keys (optional)', type: 'text',     placeholder: 'ENG, BACK, PAY', hint: 'Leave blank to scan all projects' },
    ],
  },
  {
    id:           'gitlab',
    name:         'GitLab',
    icon:         GitMerge,
    color:        'bg-orange-600',
    textColor:    'text-white',
    oauthSupported: false,
    description:  'Personal or Group Access Token',
    patFields: [
      { id: 'host',   label: 'GitLab URL',        type: 'text',     placeholder: 'https://gitlab.com', hint: 'Self-hosted: https://git.acme.com' },
      { id: 'token',  label: 'Access Token',      type: 'password', placeholder: 'glpat-xxxxxxxxxxxx', hint: 'Needs read_api, read_repository' },
      { id: 'group',  label: 'Group / Namespace', type: 'text',     placeholder: 'acme-corp' },
    ],
  },
  {
    id:           'azuredevops',
    name:         'Azure DevOps',
    icon:         Hammer,
    color:        'bg-sky-700',
    textColor:    'text-white',
    oauthSupported: false,
    description:  'Personal Access Token',
    patFields: [
      { id: 'org',     label: 'Organisation',          type: 'text',     placeholder: 'acme-corp' },
      { id: 'token',   label: 'Personal Access Token', type: 'password', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { id: 'project', label: 'Project name',          type: 'text',     placeholder: 'Backend Platform' },
    ],
  },
]

// Scan step labels
const SCAN_STEPS = [
  { label: 'Authenticating with GitHub' },
  { label: 'Loading commit history' },
  { label: 'Fetching diffs for candidates' },
  { label: 'Running SR&ED keyword heuristics' },
  { label: 'Clustering related activities' },
  { label: 'Scoring eligibility & risk' },
  { label: 'Building evidence snapshots' },
  { label: 'Finalising cluster index' },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepDot({ n, current, label }) {
  const done   = n < current
  const active = n === current
  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
        done   ? 'bg-indigo-600 border-indigo-600 text-white' :
        active ? 'bg-white border-indigo-600 text-indigo-600' :
                 'bg-white border-gray-200 text-gray-400'
      }`}>
        {done ? <CheckCircle2 size={14} /> : n}
      </div>
      <span className={`text-sm font-medium hidden sm:block ${active ? 'text-gray-900' : done ? 'text-indigo-600' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  )
}

function StepRow({ current }) {
  const labels = ['Connect', 'Select repos', 'First clusters']
  return (
    <div className="flex items-center gap-3 mb-8">
      {labels.map((label, i) => (
        <div key={label} className="contents">
          <StepDot n={i + 1} current={current} label={label} />
          {i < labels.length - 1 && (
            <div className={`flex-1 h-px ${current > i + 1 ? 'bg-indigo-300' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function Field({ field, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gray-700">{field.label}</label>
      <input
        type={field.type}
        value={value ?? ''}
        onChange={e => onChange(field.id, e.target.value)}
        placeholder={field.placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-gray-50 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
      />
      {field.hint && <p className="text-[11px] text-gray-400">{field.hint}</p>}
    </div>
  )
}

// Privacy reassurance banner — shown on repo selector and scan steps
function PrivacyBanner() {
  return (
    <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-600">
      <Shield size={13} className="text-indigo-500 flex-shrink-0" />
      <span>
        <strong className="text-slate-700">TaxLift reads commit metadata only</strong> — we never
        store your source code or diffs. Patches are scored in-browser and immediately discarded.
      </span>
    </div>
  )
}

// Single repo row in the selector
function RepoCard({ repo, selected, onToggle, disabled }) {
  const langColor = LANG_COLORS[repo.language] ?? 'bg-slate-100 text-slate-600'
  const updatedAt = repo.pushed_at
    ? new Date(repo.pushed_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <button
      onClick={() => onToggle(repo.full_name)}
      disabled={disabled && !selected}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
        selected
          ? 'border-indigo-500 bg-indigo-50 shadow-sm'
          : disabled
          ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
          : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
      }`}
    >
      {/* Checkbox */}
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
        selected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
      }`}>
        {selected && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
      </div>

      {/* Repo info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900 truncate">{repo.name}</span>
          {repo.private && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
              <Lock size={8} /> Private
            </span>
          )}
          {repo.language && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${langColor}`}>
              {repo.language}
            </span>
          )}
        </div>
        {repo.description && (
          <p className="text-[11px] text-gray-400 truncate mt-0.5">{repo.description}</p>
        )}
        {updatedAt && (
          <p className="text-[10px] text-gray-400 mt-0.5">Last pushed {updatedAt}</p>
        )}
      </div>

      {/* Stars */}
      {repo.stargazers_count > 0 && (
        <div className="flex items-center gap-1 text-[11px] text-gray-400 flex-shrink-0">
          <Star size={11} className="text-amber-400" />
          {repo.stargazers_count.toLocaleString()}
        </div>
      )}
    </button>
  )
}

// Enhanced cluster card — shows real commit SHAs + messages, add-to-claim button
function ClusterPreviewCard({ cluster, idx, onAddToClaim }) {
  const [visible, setVisible]   = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100 * idx)
    return () => clearTimeout(t)
  }, [idx])

  const commits = cluster._commits ?? []
  const signals = cluster._signals ?? []

  // Format short SHA
  const shortSha = (sha) => sha ? sha.slice(0, 7) : '???????'

  return (
    <div
      className={`border border-gray-200 rounded-xl bg-white hover:border-indigo-200 hover:shadow-sm transition-all ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}
      style={{ transition: 'opacity 0.35s ease, transform 0.35s ease, border-color 0.15s, box-shadow 0.15s' }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 leading-snug">{cluster.business_component}</p>
            <p className="text-[10px] text-gray-400 font-mono mt-0.5">{cluster.id}</p>
          </div>
          <StatusBadge status={cluster.status} />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap mb-3">
          <span className="flex items-center gap-1">
            <GitCommit size={11} />
            {cluster._commitCount ?? signals.length} qualifying commit{(cluster._commitCount ?? signals.length) !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1"><Clock size={11} /> {formatHours(cluster.aggregate_time_hours)}</span>
          <span className="flex items-center gap-1 font-semibold text-green-700">
            <DollarSign size={11} /> {formatCurrency(cluster.estimated_credit_cad)}
          </span>
          <RiskScore score={cluster.risk_score} />
        </div>

        {/* Signal source badges */}
        {cluster._source === 'github' && (
          <div className="flex items-center gap-1 mb-3">
            <Github size={11} className="text-gray-400" />
            <span className="text-[10px] text-gray-400">{cluster._repo ?? 'GitHub'} · {cluster._theme}</span>
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Hide' : 'View'} commits
          </button>
          {onAddToClaim && (
            <button
              onClick={() => onAddToClaim(cluster)}
              className="ml-auto flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
            >
              <Plus size={11} /> Add to SR&amp;ED claim
            </button>
          )}
        </div>
      </div>

      {/* Expanded commit list */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 rounded-b-xl p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Qualifying commits
          </p>
          {commits.length > 0 ? commits.map((c, i) => (
            <div key={c.sha ?? i} className="flex items-start gap-2">
              <code className="text-[10px] font-mono text-indigo-400 flex-shrink-0 mt-0.5 bg-indigo-50 px-1.5 py-0.5 rounded">
                {shortSha(c.sha)}
              </code>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-gray-700 leading-snug">
                  {c.message.slice(0, 80)}{c.message.length > 80 ? '…' : ''}
                </p>
                {c.files?.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                    {c.files.slice(0, 3).join(', ')}{c.files.length > 3 ? ` +${c.files.length - 3}` : ''}
                  </p>
                )}
              </div>
              {c.score != null && (
                <span className="flex-shrink-0 text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                  {c.score}pt
                </span>
              )}
            </div>
          )) : signals.map((s, i) => (
            <div key={i} className="text-[11px] text-gray-600 bg-white rounded px-2 py-1 leading-snug border border-gray-100">
              "{s.slice(0, 80)}{s.length > 80 ? '…' : ''}"
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function QuickConnectPage() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const { currentUser } = useAuth()

  // ── Core wizard state ────────────────────────────────────────────────────────
  const [step, setStep]                   = useState(1)
  const [integration, setInt]             = useState(null)
  const [showPat, setShowPat]             = useState(false)
  const [fields, setFields]               = useState({})
  const [error, setError]                 = useState(null)
  const [connectedUser, setConnectedUser] = useState(null)
  const [isDemoMode, setIsDemoMode]       = useState(false)
  const cancelledRef = useRef(false)

  // ── Repo selector state (step 2) ─────────────────────────────────────────────
  const [repoList, setRepoList]           = useState([])
  const [repoListLoading, setRepoListLoading] = useState(false)
  const [reposLoaded, setReposLoaded]     = useState(false)
  const [selectedRepos, setSelectedRepos] = useState([])  // array of full_name strings
  const [repoSearch, setRepoSearch]       = useState('')
  const [activeToken, setActiveToken]     = useState(null) // token for the current session

  // ── Scan state (step 3) ──────────────────────────────────────────────────────
  const [scanStep, setScanStep]     = useState(0)
  const [scanDone, setScanDone]     = useState(false)
  const [clusters, setClusters]     = useState([])
  const [scanLog, setScanLog]       = useState([])
  const [fetchProgress, setFetchProgress] = useState(null)  // { current, total, label }

  // ── Filtered repo list ───────────────────────────────────────────────────────
  const filteredRepos = useMemo(() => {
    if (!repoSearch.trim()) return repoList
    const q = repoSearch.toLowerCase()
    return repoList.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q) ||
      (r.language ?? '').toLowerCase().includes(q)
    )
  }, [repoList, repoSearch])

  // ── OAuth callback: ?provider=github&connected=1 ─────────────────────────────
  useEffect(() => {
    const prov      = searchParams.get('provider')
    const connected = searchParams.get('connected')
    if (prov && connected === '1') {
      const intg = INTEGRATIONS.find(i => i.id === prov)
      if (intg) {
        setInt(intg)
        const tok  = getStoredToken(prov)
        const user = getStoredUser(prov)
        if (user) setConnectedUser(user)
        setActiveToken(tok)

        if (prov === 'github' && tok) {
          // We have a real token — load repo list and show selector
          loadRepos(tok, intg, {})
        } else if (prov === 'jira' && tok) {
          // Jira: skip repo selector, go straight to scan
          runScan(intg, tok, {}, [])
        } else {
          // No token — run demo
          setIsDemoMode(true)
          runScan(intg, null, {}, [])
        }
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── OAuth initiation ──────────────────────────────────────────────────────────
  function initiateGitHubOAuth() {
    const state = generateState()
    localStorage.setItem(LS_KEYS.OAUTH_STATE, `github:${state}`)
    window.location.href = getGitHubAuthUrl(state)
  }

  async function initiateJiraOAuth() {
    const state                   = generateState()
    const { verifier, challenge } = await generatePKCE()
    localStorage.setItem(LS_KEYS.OAUTH_STATE,   `jira:${state}`)
    localStorage.setItem(LS_KEYS.PKCE_VERIFIER, verifier)
    window.location.href = getJiraAuthUrl(state, challenge)
  }

  // ── PAT connect ───────────────────────────────────────────────────────────────
  function handlePatConnect() {
    setError(null)
    const tok = fields.token?.trim() || null
    if (integration?.id === 'github' && !tok) {
      setError('Please enter a Personal Access Token, or use GitHub OAuth above.')
      return
    }
    if (integration?.id === 'jira' && (!fields.domain?.trim() || !tok)) {
      setError('Domain and API Token are required.')
      return
    }
    setActiveToken(tok)
    if (integration?.id === 'github') {
      loadRepos(tok, integration, fields)
    } else {
      runScan(integration, tok, fields, [])
    }
  }

  // ── Load repo list (GitHub only) ─────────────────────────────────────────────
  async function loadRepos(token, intg, config) {
    setRepoListLoading(true)
    setReposLoaded(false)
    setRepoList([])
    setError(null)

    try {
      // Verify token first
      const meRes = await fetch(`${GH_API}/user`, { headers: ghHeaders(token) })
      if (!meRes.ok) {
        if (meRes.status === 401) {
          throw new Error('GitHub token expired — please re-authorize.')
        }
        throw new Error(`GitHub API error: ${meRes.status}`)
      }
      const me = await meRes.json()
      setConnectedUser(me.login)
      setIsDemoMode(false)

      // Fetch repos (personal + org if specified)
      const org = config?.org?.trim()
      const url = org
        ? `${GH_API}/orgs/${encodeURIComponent(org)}/repos?per_page=50&sort=pushed&type=all`
        : `${GH_API}/user/repos?per_page=50&sort=pushed&affiliation=owner,collaborator,organization_member`
      const reposRes = await fetch(url, { headers: ghHeaders(token) })
      if (!reposRes.ok) throw new Error(`Failed to fetch repos: ${reposRes.status}`)
      const repos = await reposRes.json()

      setRepoList(Array.isArray(repos) ? repos : [])
      setReposLoaded(true)
      setStep(2)
    } catch (err) {
      // Token invalid / expired — fall back to demo
      if (err.message?.includes('expired') || err.message?.includes('401')) {
        setError(`${err.message} Running demo scan instead.`)
        clearToken(intg?.id ?? 'github')
        setIsDemoMode(true)
        runScan(intg, null, config, [])
      } else {
        setError(`Could not load repos: ${err.message}`)
      }
    } finally {
      setRepoListLoading(false)
    }
  }

  // ── Toggle repo selection ─────────────────────────────────────────────────────
  function toggleRepo(fullName) {
    setSelectedRepos(prev => {
      if (prev.includes(fullName)) return prev.filter(r => r !== fullName)
      if (prev.length >= MAX_REPOS_SELECTABLE) return prev
      return [...prev, fullName]
    })
  }

  // ── Disconnect stored OAuth token ─────────────────────────────────────────────
  function handleDisconnect(prov) {
    clearToken(prov)
    localStorage.removeItem('taxlift_github_oauth_code')
    localStorage.removeItem('taxlift_jira_oauth_code')
    setConnectedUser(null)
    setIsDemoMode(false)
    setActiveToken(null)
    setReposLoaded(false)
    setRepoList([])
    setSelectedRepos([])
    setStep(2)
  }

  // ── Core scan function ────────────────────────────────────────────────────────
  async function runScan(intg, token, config, reposToScan) {
    cancelledRef.current = false
    setStep(3)
    setScanStep(0)
    setScanDone(false)
    setClusters([])
    setScanLog([])
    setFetchProgress(null)

    const log     = (msg) => setScanLog(prev => [...prev, msg])
    const advance = async (i, ms = 700) => {
      if (cancelledRef.current) return false
      setScanStep(i)
      await delay(ms)
      return !cancelledRef.current
    }

    const allClusters = []

    try {
      // ── Step 0: Authenticate ──────────────────────────────────────────────────
      if (!await advance(0, 600)) return

      if (token && intg.id === 'github' && !connectedUser) {
        try {
          const res  = await fetch(`${GH_API}/user`, { headers: ghHeaders(token) })
          if (res.ok) {
            const user = await res.json()
            setConnectedUser(user.login)
            setIsDemoMode(false)
            log(`Authenticated as @${user.login}`)
          } else if (res.status === 401) {
            clearToken('github')
            throw new Error('Token expired — re-authorization required')
          } else {
            throw new Error(`GitHub API: ${res.status}`)
          }
        } catch (err) {
          log(`Auth failed (${err.message}) — switching to demo mode`)
          setIsDemoMode(true)
        }
      } else if (token && intg.id === 'jira') {
        try {
          const res  = await fetch(`${AT_API}/oauth/token/accessible-resources`, { headers: atHeaders(token) })
          if (res.ok) {
            const resources = await res.json()
            if (resources[0]) {
              localStorage.setItem(LS_KEYS.JIRA_CLOUD_ID, resources[0].id)
              setConnectedUser(resources[0].name)
              setIsDemoMode(false)
              log(`Connected to Atlassian cloud: ${resources[0].name}`)
            }
          } else {
            throw new Error(`Atlassian API: ${res.status}`)
          }
        } catch (err) {
          log(`Auth failed (${err.message}) — switching to demo mode`)
          setIsDemoMode(true)
        }
      } else if (!token) {
        log('No token — running demo scan')
        setIsDemoMode(true)
      } else {
        log(`Using cached token for @${connectedUser ?? 'user'}`)
      }

      // ── Step 1: Fetch commits ─────────────────────────────────────────────────
      if (!await advance(1, 400)) return

      let rawCommits = []
      let rawIssues  = []
      const jiraCloudId = localStorage.getItem(LS_KEYS.JIRA_CLOUD_ID)
      const effectiveToken = token
      const isReal = !isDemoMode && !!effectiveToken

      if (isReal && intg.id === 'github') {
        const since = config.since
          ? new Date(config.since).toISOString()
          : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

        const targetRepos = reposToScan.length > 0
          ? reposToScan
          : (config.repos ?? '').split(',').map(r => r.trim()).filter(Boolean)

        if (targetRepos.length === 0) {
          log('No repos selected — using demo data')
          setIsDemoMode(true)
        } else {
          for (const repoFullName of targetRepos.slice(0, MAX_REPOS_SELECTABLE)) {
            if (cancelledRef.current) return
            const repoShort = repoFullName.split('/').pop()
            try {
              let allCommits = []

              // Paginate up to 2 pages (200 commits max)
              for (let page = 1; page <= 2; page++) {
                if (cancelledRef.current) return
                setFetchProgress({ current: (page - 1) * 100, total: 200, label: `${repoShort} — page ${page}` })
                const url = `${GH_API}/repos/${repoFullName}/commits?per_page=100&page=${page}&since=${encodeURIComponent(since)}`
                const res = await fetch(url, { headers: ghHeaders(effectiveToken) })

                if (res.status === 401) {
                  clearToken('github')
                  throw new Error('Token expired')
                }
                if (!res.ok) { log(`${repoShort}: API error ${res.status} on page ${page}`); break }

                const batch = await res.json()
                if (!Array.isArray(batch) || batch.length === 0) break
                allCommits.push(...batch)
                log(`${repoShort}: fetched ${allCommits.length} commits so far…`)
                if (batch.length < 100) break  // last page
              }

              setFetchProgress(null)
              log(`${repoShort}: ${allCommits.length} commits loaded`)
              rawCommits.push({ repo: repoShort, commits: allCommits })
            } catch (err) {
              if (err.message === 'Token expired') {
                setError('GitHub token expired — please re-authorize to scan real repos.')
                setIsDemoMode(true)
                rawCommits = []
                break
              }
              log(`${repoShort}: skipped (${err.message})`)
            }
          }
        }
      }

      if (isReal && intg.id === 'jira' && jiraCloudId) {
        try {
          const projectFilter = (config.projects ?? '').split(',').map(p => p.trim().toUpperCase()).filter(Boolean)
          const jql = projectFilter.length
            ? `project in (${projectFilter.join(',')}) AND updated >= -365d ORDER BY updated DESC`
            : 'updated >= -365d ORDER BY updated DESC'
          const url = `${AT_API}/ex/jira/${jiraCloudId}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=200&fields=summary,description,project`
          const res = await fetch(url, { headers: atHeaders(effectiveToken) })
          if (res.ok) {
            const data = await res.json()
            rawIssues = data.issues ?? []
            log(`Fetched ${rawIssues.length} Jira issues`)
          }
        } catch {
          log('Failed to fetch Jira issues — using demo data')
          setIsDemoMode(true)
        }
      }

      // Fall back to demo data
      if (rawCommits.length === 0 && intg.id === 'github') {
        rawCommits = [{ repo: DEMO_REPO_NAME, commits: DEMO_COMMITS }]
        if (!isDemoMode) log('No commits found — using demo dataset')
        setIsDemoMode(true)
      }
      if (rawIssues.length === 0 && intg.id === 'jira') {
        rawIssues = DEMO_JIRA_ISSUES
        if (!isDemoMode) log('No issues found — using demo dataset')
        setIsDemoMode(true)
      }

      // ── Step 2: Fetch diffs for candidate commits ─────────────────────────────
      if (!await advance(2, 400)) return

      if (!isDemoMode && intg.id === 'github' && effectiveToken) {
        for (const entry of rawCommits) {
          if (cancelledRef.current) return
          const { repo, commits } = entry

          // Pre-screen on message score — only fetch diffs for likely candidates
          const candidates = commits.filter(c => scoreMessageOnly(c) >= 2)
          const diffTarget  = candidates.slice(0, MAX_DIFF_FETCHES)
          log(`${repo}: fetching diffs for ${diffTarget.length} candidate commit${diffTarget.length !== 1 ? 's' : ''}`)

          const enriched = [...commits]  // copy so we can mutate

          let diffCount = 0
          for (const candidate of diffTarget) {
            if (cancelledRef.current) return
            setFetchProgress({
              current: diffCount,
              total:   diffTarget.length,
              label:   `${repo} — diffs ${diffCount + 1}/${diffTarget.length}`,
            })
            try {
              const res = await fetch(
                `${GH_API}/repos/${reposToScan.find(r => r.endsWith('/' + repo)) ?? reposToScan[0] ?? repo}/commits/${candidate.sha}`,
                { headers: ghHeaders(effectiveToken) }
              )
              if (res.ok) {
                const detail = await res.json()
                // Merge files back into the commit object in our enriched array
                const idx = enriched.findIndex(c => c.sha === candidate.sha)
                if (idx !== -1) enriched[idx] = { ...enriched[idx], files: detail.files ?? [] }
              }
            } catch {
              // diff fetch failed — continue without it
            }
            diffCount++
          }
          setFetchProgress(null)
          entry.commits = enriched
          log(`${repo}: diff enrichment complete`)
        }
      } else {
        await delay(300)  // visual pause for demo mode
      }

      // ── Step 3: SR&ED keyword heuristics ─────────────────────────────────────
      if (!await advance(3, 600)) return

      for (const { repo, commits } of rawCommits) {
        const found = scanCommits(commits, repo)
        if (found?.length) {
          allClusters.push(...found)
          log(`${repo}: detected ${found.length} SR&ED cluster${found.length !== 1 ? 's' : ''}`)
        } else {
          log(`${repo}: no qualifying clusters found`)
        }
      }

      if (rawIssues.length > 0) {
        const projectKey = config.projects?.split(',')[0]?.trim() ?? 'ENG'
        const found = scanIssues(rawIssues, projectKey)
        if (found?.length) {
          allClusters.push(...found)
          log(`Jira: detected ${found.length} SR&ED cluster${found.length !== 1 ? 's' : ''}`)
        }
      }

      // ── Steps 4-7: Clustering, risk, evidence, index ──────────────────────────
      if (!await advance(4, 700)) return
      if (!await advance(5, 600)) return
      if (!await advance(6, 500)) return
      if (!await advance(7, 400)) return

      if (!cancelledRef.current) {
        setClusters(allClusters)
        setScanDone(true)
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(`Scan failed: ${err.message}. Please try again.`)
        setScanDone(true)
      }
    }
  }

  useEffect(() => () => { cancelledRef.current = true }, [])

  function handleFieldChange(id, val) {
    setFields(prev => ({ ...prev, [id]: val }))
  }

  // ── Step 1 — pick integration ─────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <Zap size={12} /> Quick Connect · 5-minute setup
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect your first integration</h1>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              We'll scan your real commit history and surface SR&ED candidate clusters automatically.
            </p>
          </div>

          <StepRow current={1} />

          <div className="grid grid-cols-2 gap-3 mb-5">
            {INTEGRATIONS.map(intg => {
              const Icon     = intg.icon
              const hasToken = !!getStoredToken(intg.id)
              return (
                <button
                  key={intg.id}
                  onClick={() => { setInt(intg); setStep(2); setShowPat(false); setError(null) }}
                  className="flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md hover:border-indigo-400 border-gray-200 bg-white"
                >
                  <div className={`w-10 h-10 rounded-xl ${intg.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={18} className={intg.textColor} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{intg.name}</p>
                      {intg.oauthSupported && (
                        <span className="text-[9px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded uppercase tracking-wide">OAuth</span>
                      )}
                      {hasToken && (
                        <span className="text-[9px] font-bold bg-green-100 text-green-600 px-1.5 py-0.5 rounded uppercase tracking-wide">✓</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{intg.description}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 ml-auto flex-shrink-0" />
                </button>
              )
            })}
          </div>

          <PrivacyBanner />

          <p className="text-center mt-5 text-xs text-gray-400">
            Already connected?{' '}
            <button onClick={() => navigate('/dashboard')} className="text-indigo-600 hover:underline font-medium">
              Go to dashboard →
            </button>
          </p>
        </div>
      </div>
    )
  }

  // ── Step 2a — authenticate ────────────────────────────────────────────────────
  if (step === 2 && integration && !reposLoaded) {
    const Icon          = integration.icon
    const existingToken = getStoredToken(integration.id)
    const existingUser  = getStoredUser(integration.id)
    const oauthReady    = integration.id === 'github' ? !!GITHUB_CLIENT_ID : !!JIRA_CLIENT_ID

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <StepRow current={2} />

          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${integration.color} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} className={integration.textColor} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Connect {integration.name}</p>
                <p className="text-xs text-gray-400">{integration.description}</p>
              </div>
            </div>

            {/* Already connected */}
            {existingToken && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <User size={14} className="text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-green-800">
                    {existingUser ? `Connected as @${existingUser}` : `${integration.name} connected`}
                  </p>
                  <p className="text-[11px] text-green-600">Token found — click below to load your repos</p>
                </div>
                <button
                  onClick={() => handleDisconnect(integration.id)}
                  className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 font-medium"
                >
                  <RefreshCw size={11} /> Disconnect
                </button>
              </div>
            )}

            {/* OAuth button */}
            {integration.oauthSupported && !existingToken && (
              <>
                {oauthReady ? (
                  <button
                    onClick={integration.id === 'github' ? initiateGitHubOAuth : initiateJiraOAuth}
                    className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold transition-colors ${
                      integration.id === 'github'
                        ? 'bg-gray-900 hover:bg-gray-800 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <Icon size={16} />
                    {integration.oauthLabel}
                    <ExternalLink size={12} className="opacity-60" />
                  </button>
                ) : (
                  <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-xs text-amber-800">
                    <Info size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <span>
                      To enable OAuth, add{' '}
                      <code className="bg-amber-100 px-1 rounded font-mono">
                        {integration.id === 'github' ? 'VITE_GITHUB_CLIENT_ID' : 'VITE_JIRA_CLIENT_ID'}
                      </code>{' '}
                      to your <code className="bg-amber-100 px-1 rounded font-mono">.env.local</code>.
                    </span>
                  </div>
                )}

                {/* PAT toggle */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-100" />
                  <button
                    onClick={() => setShowPat(v => !v)}
                    className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
                  >
                    {showPat ? '↑ Hide' : 'Or use'} Personal Access Token
                  </button>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              </>
            )}

            {/* PAT fields */}
            {(!integration.oauthSupported || showPat || existingToken) && (
              <div className="space-y-4">
                {integration.patFields.map(field => (
                  <Field key={field.id} field={field} value={fields[field.id]} onChange={handleFieldChange} />
                ))}
              </div>
            )}

            <PrivacyBanner />

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700">
                <AlertTriangle size={13} className="flex-shrink-0" /> {error}
              </div>
            )}

            {/* Loading state while fetching repos */}
            {repoListLoading && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-indigo-600">
                <Loader2 size={16} className="animate-spin" /> Loading your repositories…
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => { setStep(1); setError(null); setReposLoaded(false) }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                <ChevronLeft size={15} /> Back
              </button>
              <button
                disabled={repoListLoading}
                onClick={() => {
                  if (existingToken) {
                    loadRepos(existingToken, integration, fields)
                  } else if (fields.token?.trim()) {
                    handlePatConnect()
                  } else {
                    setIsDemoMode(true)
                    runScan(integration, null, fields, [])
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {repoListLoading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                {existingToken
                  ? 'Load my repos'
                  : fields.token?.trim()
                  ? 'Connect & load repos'
                  : 'Run demo scan'}
              </button>
            </div>
          </div>

          <p className="text-center mt-4 text-xs text-gray-400">
            Takes under 10 seconds to load your repository list.
          </p>
        </div>
      </div>
    )
  }

  // ── Step 2b — repo selector ───────────────────────────────────────────────────
  if (step === 2 && integration && reposLoaded) {
    const limitReached = selectedRepos.length >= MAX_REPOS_SELECTABLE

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex flex-col items-center justify-start p-6 pt-10">
        <div className="w-full max-w-2xl">
          <StepRow current={2} />

          {/* Header card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-4">
            <div className="flex items-center gap-3 mb-1">
              <Github size={18} className="text-gray-900" />
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {connectedUser ? `@${connectedUser}'s repositories` : 'Select repositories'}
                </p>
                <p className="text-xs text-gray-400">
                  {repoList.length} repos found · Select up to {MAX_REPOS_SELECTABLE} to scan
                </p>
              </div>
              <button
                onClick={() => handleDisconnect(integration.id)}
                className="ml-auto flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
              >
                <X size={11} /> Disconnect
              </button>
            </div>

            {/* Privacy banner */}
            <PrivacyBanner />
          </div>

          {/* Limit notice */}
          {limitReached && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800 mb-3">
              <Info size={13} className="flex-shrink-0 text-amber-500" />
              Maximum {MAX_REPOS_SELECTABLE} repos selected. Deselect one to change your selection.
            </div>
          )}

          {/* Search + list */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden mb-4">
            {/* Search */}
            <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-2">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={repoSearch}
                onChange={e => setRepoSearch(e.target.value)}
                placeholder="Search repositories by name, language…"
                className="flex-1 text-sm outline-none bg-transparent text-gray-900 placeholder:text-gray-400"
              />
              {repoSearch && (
                <button onClick={() => setRepoSearch('')} className="text-gray-300 hover:text-gray-500">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Repo list */}
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 p-2 space-y-1">
              {filteredRepos.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  {repoSearch ? 'No repos match your search.' : 'No repositories found.'}
                </p>
              ) : (
                filteredRepos.map(repo => (
                  <RepoCard
                    key={repo.full_name}
                    repo={repo}
                    selected={selectedRepos.includes(repo.full_name)}
                    onToggle={toggleRepo}
                    disabled={limitReached}
                  />
                ))
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setReposLoaded(false); setSelectedRepos([]) }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              <ChevronLeft size={15} /> Back
            </button>

            <button
              disabled={selectedRepos.length === 0}
              onClick={() => runScan(integration, activeToken, fields, selectedRepos)}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-xl transition-colors shadow-sm"
            >
              <Zap size={15} />
              Scan {selectedRepos.length > 0 ? `${selectedRepos.length} repo${selectedRepos.length !== 1 ? 's' : ''}` : 'selected repos'}
              <ArrowRight size={14} />
            </button>

            {repoList.length > 0 && (
              <button
                onClick={() => runScan(integration, null, fields, [])}
                className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap px-2"
              >
                Run demo instead
              </button>
            )}
          </div>

          <p className="text-center mt-3 text-xs text-gray-400">
            Scanning typically takes 15–60 seconds depending on commit history.
          </p>
        </div>
      </div>
    )
  }

  // ── Step 3 — scan + results ───────────────────────────────────────────────────
  const Icon        = integration?.icon ?? GitMerge
  const totalCredit = clusters.reduce((s, c) => s + (c.estimated_credit_cad ?? 0), 0)
  const totalHours  = clusters.reduce((s, c) => s + (c.aggregate_time_hours  ?? 0), 0)
  const totalCommits = clusters.reduce((s, c) => s + (c._commitCount ?? 0), 0)
  const lowSignal   = !isDemoMode && scanDone && clusters.length < 2 && selectedRepos.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
      <div className="max-w-3xl mx-auto">
        <StepRow current={3} />

        {!scanDone ? (
          /* ── Scanning animation ──────────────────────────────────────────── */
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
                <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                <div className="absolute inset-2 flex items-center justify-center">
                  <Icon size={18} className="text-indigo-600" />
                </div>
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {isDemoMode ? 'Running demo scan…' : `Scanning ${selectedRepos.length} repo${selectedRepos.length !== 1 ? 's' : ''}…`}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {isDemoMode
                  ? 'Running SR&ED heuristics on example dataset.'
                  : connectedUser
                  ? `Connected as @${connectedUser} · Fetching commits & diffs`
                  : 'Running SR&ED keyword heuristics.'}
              </p>
              {isDemoMode && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <FlaskConical size={12} /> Demo mode — results use example data
                </div>
              )}
            </div>

            {/* Scan step checklist */}
            <div className="space-y-2 max-w-md mx-auto mb-5">
              {SCAN_STEPS.map((s, i) => {
                const done   = i < scanStep
                const active = i === scanStep
                return (
                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
                    active  ? 'bg-indigo-50 text-indigo-700 font-medium' :
                    done    ? 'text-gray-400' : 'text-gray-300'
                  }`}>
                    <div className="w-5 flex-shrink-0">
                      {done   ? <CheckCircle2 size={16} className="text-green-500" />             :
                       active ? <Loader2     size={16} className="animate-spin text-indigo-600" /> :
                                <div className="w-4 h-4 rounded-full border-2 border-gray-200" />}
                    </div>
                    <span className="flex-1">{s.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Real-time diff progress bar */}
            {fetchProgress && (
              <div className="max-w-md mx-auto bg-indigo-50 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs text-indigo-700 mb-1.5">
                  <span className="font-medium">{fetchProgress.label}</span>
                  <span>{fetchProgress.current}/{fetchProgress.total}</span>
                </div>
                <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${fetchProgress.total > 0 ? Math.round((fetchProgress.current / fetchProgress.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Live log */}
            {scanLog.length > 0 && (
              <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-3 max-w-md mx-auto max-h-28 overflow-y-auto">
                {scanLog.map((line, i) => (
                  <p key={i} className="text-[11px] text-gray-500 font-mono leading-relaxed">
                    {'>'} {line}
                  </p>
                ))}
              </div>
            )}
          </div>

        ) : (
          /* ── Results ─────────────────────────────────────────────────────── */
          <div className="space-y-5">

            {/* Privacy banner */}
            <PrivacyBanner />

            {/* Demo mode notice */}
            {isDemoMode && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <FlaskConical size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Demo scan results</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Showing clusters from an example commit dataset — the same SR&ED heuristics
                    run on your real repos once connected.{' '}
                    <button onClick={() => { setStep(2); setReposLoaded(false); setError(null) }} className="underline font-medium hover:text-amber-900">
                      Connect GitHub to scan real data →
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* Low-signal empty state */}
            {lowSignal && (
              <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-4">
                <AlertTriangle size={18} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {clusters.length === 0
                      ? 'No SR&ED signals detected in the selected repos'
                      : 'Limited SR&ED signal found'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    We found limited SR&ED signal in these repos. For best results, try connecting
                    your <strong>main engineering repo</strong> — especially one with ML/algorithm
                    experiments, performance research, or novel architectural work.
                  </p>
                  <button
                    onClick={() => { setStep(2); setReposLoaded(false); setSelectedRepos([]) }}
                    className="mt-2 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Try a different repo →
                  </button>
                </div>
              </div>
            )}

            {/* Success banner */}
            {clusters.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-green-900">
                    Found {clusters.length} SR&ED candidate cluster{clusters.length !== 1 ? 's' : ''}
                    {!isDemoMode && connectedUser ? ` from @${connectedUser}'s repos` : ''}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <span className="text-xs text-green-700 flex items-center gap-1">
                      <GitCommit size={11} /> {totalCommits} qualifying commits
                    </span>
                    <span className="text-xs text-green-700 flex items-center gap-1">
                      <Clock size={11} /> {formatHours(totalHours)} eligible
                    </span>
                    <span className="text-xs text-green-700 font-bold flex items-center gap-1">
                      <TrendingUp size={11} /> {formatCurrency(totalCredit)} estimated ITC credit
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Error (non-fatal) */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
                <AlertTriangle size={13} className="flex-shrink-0" /> {error}
              </div>
            )}

            {/* Cluster cards */}
            {clusters.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900">Detected clusters</p>
                  <span className="text-xs text-gray-400">{clusters.length} candidate{clusters.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-3">
                  {clusters.map((c, i) => (
                    <ClusterPreviewCard
                      key={c.id}
                      cluster={c}
                      idx={i}
                      onAddToClaim={() => navigate('/clusters')}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => navigate('/welcome')}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
              >
                See your credit estimate <ArrowRight size={15} />
              </button>
              {clusters.length > 0 && (
                <button
                  onClick={() => navigate('/clusters')}
                  className="flex items-center gap-2 border border-gray-200 text-gray-600 text-sm px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Eye size={15} /> Review clusters
                </button>
              )}
              <button
                onClick={() => {
                  setScanDone(false)
                  setClusters([])
                  setError(null)
                  if (reposLoaded) {
                    setStep(2)
                  } else {
                    setStep(2)
                    setReposLoaded(false)
                  }
                }}
                className="flex items-center gap-2 border border-gray-200 text-gray-600 text-sm px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <RefreshCw size={15} /> Re-scan
              </button>
            </div>

            <p className="text-center text-xs text-gray-400">
              These are SR&ED <em>candidates</em> — review each cluster, approve narratives, and
              share with your CPA to finalise the T661 claim.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
