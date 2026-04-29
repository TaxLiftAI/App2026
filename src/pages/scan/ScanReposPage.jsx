/**
 * ScanReposPage — /scan/repos
 *
 * Shown after GitHub OAuth succeeds. Lists the user's GitHub repos,
 * lets them select up to 3, then kicks off the scan.
 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Github, Search, Star, Lock, Globe, ShieldCheck,
  ChevronRight, AlertTriangle, Loader2, Check, Code2,
} from 'lucide-react'
import { getStoredToken, LS_KEYS } from '../../lib/oauthConfig'

const MAX_REPOS = 3


function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30)  return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

const LANG_COLORS = {
  Python: 'bg-blue-400', TypeScript: 'bg-blue-600', JavaScript: 'bg-yellow-400',
  Go: 'bg-cyan-400', Rust: 'bg-orange-500', Java: 'bg-red-500', Swift: 'bg-orange-400',
  'C++': 'bg-pink-500', Ruby: 'bg-red-400', MDX: 'bg-slate-400',
}

export default function ScanReposPage() {
  const navigate   = useNavigate()
  const [repos,      setRepos]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [query,      setQuery]      = useState('')
  const [selected,   setSelected]   = useState([])    // array of full_name strings
  const [teamSize,   setTeamSize]   = useState(5)     // engineers who do R&D work
  const [avgSalary,  setAvgSalary]  = useState(120000) // avg T4 salary
  const [province,   setProvince]   = useState('ON')   // province of incorporation

  useEffect(() => {
    loadRepos()
  }, [])

  async function loadRepos() {
    setLoading(true)
    const token = getStoredToken('github')

    if (!token) {
      // No token in memory — session expired or user landed here directly.
      // Send them back to the scan landing page to re-authorise with GitHub.
      navigate('/scan', { replace: true })
      return
    }

    try {
      const res = await fetch('https://api.github.com/user/repos?sort=pushed&per_page=50&type=all', {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' },
      })
      if (!res.ok) throw new Error(`GitHub API error ${res.status}`)
      const data = await res.json()
      setRepos(data)
    } catch (err) {
      console.warn('[ScanReposPage] GitHub API failed:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return repos
    const q = query.toLowerCase()
    return repos.filter(r =>
      r.full_name.toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q) ||
      (r.language ?? '').toLowerCase().includes(q)
    )
  }, [repos, query])

  function toggleRepo(fullName) {
    setSelected(prev => {
      if (prev.includes(fullName)) return prev.filter(n => n !== fullName)
      if (prev.length >= MAX_REPOS) return prev          // cap at 3
      return [...prev, fullName]
    })
  }

  function handleStartScan() {
    if (selected.length === 0) return
    sessionStorage.setItem('taxlift_scan_repos',      JSON.stringify(selected))
    sessionStorage.setItem('taxlift_scan_team_size',  String(teamSize))
    sessionStorage.setItem('taxlift_scan_avg_salary', String(avgSalary))
    sessionStorage.setItem('taxlift_scan_province',   province)
    navigate('/scan/running')
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded-xl flex items-center justify-center">
              <ShieldCheck size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 tracking-tight">TaxLift</span>
            <span className="text-gray-300 mx-1">·</span>
            <span className="text-sm text-gray-500">Select repos to scan</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400">
              {selected.length}/{MAX_REPOS} selected
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Privacy banner */}
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-6">
          <Lock size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-indigo-700 leading-relaxed">
            <strong>TaxLift reads commit messages and filenames only</strong> — your source code
            never leaves GitHub. We use OAuth read-only access to fetch commit history.
          </p>
        </div>

        {/* Page title */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Select up to {MAX_REPOS} repos to scan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Choose your most active R&D repos. Focus on ML, algorithms, platform, or core product — not docs or config repos.
          </p>
          {/* Coming-soon platform chips */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[11px] text-gray-400">Currently: GitHub</span>
            <span className="text-[11px] text-gray-300">·</span>
            {[
              { name: 'GitLab', icon: '🦊' },
              { name: 'Bitbucket', icon: '🪣' },
              { name: 'Azure DevOps', icon: '🔷' },
            ].map(p => (
              <span
                key={p.name}
                className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-semibold"
              >
                {p.icon} {p.name} — coming soon
              </span>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search repos by name, language, or description…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Repo list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={28} className="text-indigo-500 animate-spin" />
            <p className="text-sm text-gray-500">Fetching your repositories from GitHub…</p>
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Failed to load repositories</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
              <button onClick={loadRepos} className="text-xs text-red-700 underline mt-1">Try again</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No repos match your search.</div>
            ) : filtered.map(repo => {
              const isSelected = selected.includes(repo.full_name)
              const atCap      = selected.length >= MAX_REPOS && !isSelected
              const dotColor   = LANG_COLORS[repo.language] ?? 'bg-gray-400'
              return (
                <button
                  key={repo.id}
                  onClick={() => !atCap && toggleRepo(repo.full_name)}
                  disabled={atCap}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                      : atCap
                      ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'
                    }`}>
                      {isSelected && <Check size={11} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900 truncate">
                          {repo.full_name}
                        </span>
                        {repo.private
                          ? <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5"><Lock size={8} /> Private</span>
                          : <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5"><Globe size={8} /> Public</span>
                        }
                      </div>
                      {repo.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{repo.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {repo.language && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-500">
                            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                            {repo.language}
                          </span>
                        )}
                        {repo.stargazers_count > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-400">
                            <Star size={10} /> {repo.stargazers_count}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400">
                          Updated {timeAgo(repo.pushed_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Sticky CTA footer */}
        <div className="sticky bottom-6 mt-8">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-4 flex items-center justify-between gap-4">
            <div>
              {selected.length === 0 ? (
                <p className="text-sm text-gray-500">Select at least one repo to continue</p>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {selected.length} repo{selected.length !== 1 ? 's' : ''} selected
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {selected.map(s => s.split('/')[1]).join(', ')}
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500 whitespace-nowrap">Employees</label>
                <input
                  type="number" min={1} max={500} value={teamSize}
                  onChange={e => setTeamSize(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500 whitespace-nowrap">Avg salary</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                  <input
                    type="number" min={40000} max={500000} step={5000} value={avgSalary}
                    onChange={e => setAvgSalary(Math.max(40000, parseInt(e.target.value) || 120000))}
                    className="w-24 border border-gray-200 rounded-lg pl-5 pr-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500 whitespace-nowrap">Province</label>
                <select
                  value={province}
                  onChange={e => setProvince(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  {[['ON','Ontario'],['QC','Québec'],['BC','BC'],['AB','Alberta'],
                    ['MB','Manitoba'],['SK','Saskatchewan'],['NS','Nova Scotia']].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleStartScan}
              disabled={selected.length === 0}
              className={`flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                selected.length > 0
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Github size={15} />
              Scan {selected.length > 0 ? `${selected.length} repo${selected.length !== 1 ? 's' : ''}` : 'repos'} →
            </button>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-[11px] text-gray-400 text-center mt-4">
          <Code2 size={10} className="inline mr-1" />
          We fetch up to 200 recent commits per repo. Scanning takes 10–45 seconds depending on repo size.
        </p>
      </div>
    </div>
  )
}
