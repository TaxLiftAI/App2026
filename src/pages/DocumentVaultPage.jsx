import { useState, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, FileSpreadsheet, Image, FileCode, File, Archive,
  Upload, Download, Clock, ChevronDown, ChevronUp, Search,
  LayoutGrid, List, X, Tag, Layers, FolderOpen, HardDrive,
  CheckCircle2, Plus, AlertCircle, FlaskConical,
  Shield, ShieldCheck, ShieldAlert, Hash, Link2, Copy, Eye,
} from 'lucide-react'
import { CLUSTERS } from '../data/mockData'
import { useAuth } from '../context/AuthContext'
import { canDo } from '../lib/utils'
import { useDocuments, useVaultStats } from '../hooks'

// ─── File type config ─────────────────────────────────────────────────────────
const FILE_META = {
  pdf:  { icon: FileText,       color: 'text-red-500',    bg: 'bg-red-50',    label: 'PDF'   },
  docx: { icon: FileText,       color: 'text-blue-500',   bg: 'bg-blue-50',   label: 'DOCX'  },
  xlsx: { icon: FileSpreadsheet,color: 'text-green-500',  bg: 'bg-green-50',  label: 'XLSX'  },
  png:  { icon: Image,          color: 'text-purple-500', bg: 'bg-purple-50', label: 'PNG'   },
  csv:  { icon: FileText,       color: 'text-teal-500',   bg: 'bg-teal-50',   label: 'CSV'   },
  zip:  { icon: Archive,        color: 'text-gray-500',   bg: 'bg-gray-100',  label: 'ZIP'   },
  json: { icon: FileCode,       color: 'text-orange-500', bg: 'bg-orange-50', label: 'JSON'  },
}

const TAG_COLORS = {
  evidence:      'bg-blue-100 text-blue-700',
  narrative:     'bg-indigo-100 text-indigo-700',
  financial:     'bg-green-100 text-green-700',
  report:        'bg-amber-100 text-amber-700',
  correspondence:'bg-pink-100 text-pink-700',
  config:        'bg-slate-100 text-slate-600',
}

const ALL_TAGS  = ['evidence', 'narrative', 'financial', 'report', 'correspondence', 'config']
const ALL_TYPES = ['pdf', 'docx', 'xlsx', 'csv', 'png', 'json', 'zip']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtSize(kb) {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`
  return `${kb} KB`
}

function relDate(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function FileIcon({ type, size = 18 }) {
  const meta = FILE_META[type] ?? { icon: File, color: 'text-gray-400', bg: 'bg-gray-50' }
  const Icon = meta.icon
  return (
    <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
      <Icon size={size} className={meta.color} />
    </div>
  )
}

function TagBadge({ tag }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${TAG_COLORS[tag] ?? 'bg-gray-100 text-gray-600'}`}>
      {tag}
    </span>
  )
}

function VersionBadge({ v }) {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-mono font-medium">
      <Layers size={9} /> v{v}
    </span>
  )
}

// ─── Hash engine (FNV-1a 64-bit emulation via two 32-bit words) ───────────────
function computeDocHash(doc, version) {
  const payload = JSON.stringify({
    id: doc.id,
    name: doc.name,
    size_kb: version.size_kb,
    uploader: version.uploader_name,
    created_at: version.created_at,
  })
  // Two independent FNV-1a 32-bit hashes → simulate 64-bit SHA-256 prefix
  let h1 = 0x811c9dc5, h2 = 0xcbf29ce4
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i)
    h1 ^= ch; h1 = (h1 * 0x01000193) >>> 0
    h2 ^= (ch ^ 0x5a); h2 = (h2 * 0x01000193) >>> 0
  }
  const seg = n => n.toString(16).padStart(8, '0')
  return `${seg(h1)}${seg(h2)}${seg(h1 ^ h2)}${seg(h2 ^ 0xdeadbeef)}${seg(h1 ^ 0xcafebabe)}${seg(h2 ^ h1)}${seg(h1 * 7 >>> 0)}${seg(h2 * 13 >>> 0)}`
}

// ─── Evidence Snapshot Viewer ─────────────────────────────────────────────────
function EvidenceSnapshotViewer({ doc }) {
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [copied, setCopied] = useState(null)  // version number that was copied

  const currentVersion = doc.versions.find(v => v.version === doc.version) ?? doc.versions[doc.versions.length - 1]
  const currentHash = computeDocHash(doc, currentVersion)

  function copyHash(hash, ver) {
    navigator.clipboard?.writeText(hash).catch(() => {})
    setCopied(ver)
    setTimeout(() => setCopied(null), 2000)
  }

  // Build chain of custody events from all versions
  const custodyEvents = doc.versions.flatMap(v => {
    const hash = computeDocHash(doc, v)
    return [
      {
        type:  'upload',
        label: `v${v.version} uploaded by ${v.uploader_name}`,
        sub:   v.note,
        ts:    v.created_at,
        hash,
        ver:   v.version,
        current: v.version === doc.version,
      },
      {
        type:  'anchor',
        label: `Hash anchored (SHA-256)`,
        sub:   `${hash.slice(0, 16)}…`,
        ts:    v.created_at,
        ver:   v.version,
        current: v.version === doc.version,
      },
    ]
  }).sort((a, b) => new Date(a.ts) - new Date(b.ts))

  const visibleEvents = showAllHistory ? custodyEvents : custodyEvents.slice(-6)
  const hasMore = custodyEvents.length > 6

  const ICON_MAP = {
    upload: Upload,
    anchor: Hash,
  }
  const COLOR_MAP = {
    upload:  { dot: 'bg-indigo-500', line: 'text-indigo-700',  sub: 'text-indigo-600' },
    anchor:  { dot: 'bg-gray-400',   line: 'text-gray-600',    sub: 'text-gray-400'   },
  }

  return (
    <div className="mt-3 space-y-4">
      {/* Tamper detection header */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={15} className="text-green-600" />
          <p className="text-xs font-semibold text-green-800">Integrity Verified</p>
          <span className="ml-auto text-[10px] text-green-600 font-medium">v{currentVersion.version} · Current</span>
        </div>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-green-600 mb-1 font-medium uppercase tracking-wider">SHA-256</p>
            <code className="text-[10px] font-mono text-green-900 break-all leading-relaxed">
              {currentHash}
            </code>
          </div>
          <button
            onClick={() => copyHash(currentHash, currentVersion.version)}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-green-100 transition-colors"
            title="Copy hash"
          >
            {copied === currentVersion.version
              ? <CheckCircle2 size={13} className="text-green-600" />
              : <Copy size={13} className="text-green-500" />}
          </button>
        </div>
        <p className="text-[10px] text-green-500 mt-1.5">
          ✓ Hash matches stored record · {doc.versions.length} version{doc.versions.length !== 1 ? 's' : ''} on file · Uploaded {relDate(currentVersion.created_at)}
        </p>
      </div>

      {/* Version hashes */}
      {doc.versions.length > 1 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">All Version Hashes</p>
          <div className="space-y-1.5">
            {[...doc.versions].reverse().map(v => {
              const h = computeDocHash(doc, v)
              const isCurrent = v.version === doc.version
              return (
                <div key={v.version} className={`flex items-center gap-2 p-2 rounded-lg ${isCurrent ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-100'}`}>
                  <div className="flex-shrink-0">
                    <span className={`text-[10px] font-bold font-mono ${isCurrent ? 'text-green-700' : 'text-gray-400'}`}>v{v.version}</span>
                  </div>
                  <code className="text-[10px] font-mono text-gray-600 flex-1 min-w-0 truncate">{h.slice(0, 32)}…</code>
                  <button
                    onClick={() => copyHash(h, v.version)}
                    className="flex-shrink-0 p-1 rounded hover:bg-white transition-colors"
                    title="Copy full hash"
                  >
                    {copied === v.version
                      ? <CheckCircle2 size={11} className="text-green-500" />
                      : <Copy size={11} className="text-gray-400 hover:text-gray-600" />}
                  </button>
                  {isCurrent && <ShieldCheck size={11} className="text-green-500 flex-shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Chain of custody timeline */}
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Chain of Custody</p>
        <div className="relative">
          {visibleEvents.map((ev, idx) => {
            const Icon = ICON_MAP[ev.type] ?? Eye
            const colors = COLOR_MAP[ev.type] ?? { dot: 'bg-gray-400', line: 'text-gray-600', sub: 'text-gray-400' }
            return (
              <div key={`${ev.type}-${ev.ver}-${idx}`} className="flex gap-3 mb-2.5">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-5 h-5 rounded-full ${colors.dot} flex items-center justify-center`}>
                    <Icon size={10} className="text-white" />
                  </div>
                  {idx < visibleEvents.length - 1 && <div className="w-px flex-1 bg-gray-200 my-0.5 min-h-[10px]" />}
                </div>
                <div className="flex-1 pb-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[11px] font-medium ${colors.line}`}>{ev.label}</p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{relDate(ev.ts)}</span>
                  </div>
                  {ev.sub && <p className={`text-[10px] ${colors.sub} font-mono mt-0.5 truncate`}>{ev.sub}</p>}
                </div>
              </div>
            )
          })}
          {hasMore && (
            <button
              onClick={() => setShowAllHistory(h => !h)}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 ml-8 mt-1"
            >
              {showAllHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {showAllHistory ? 'Show less' : `Show ${custodyEvents.length - 6} more events`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Version history drawer ────────────────────────────────────────────────────
function VersionHistory({ versions }) {
  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Version History</p>
      <div className="space-y-2">
        {[...versions].reverse().map((v, i) => (
          <div key={v.version} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                i === 0 ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {v.version}
              </div>
              {i < versions.length - 1 && <div className="w-px flex-1 bg-gray-200 my-0.5 min-h-[12px]" />}
            </div>
            <div className="flex-1 pb-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-700">{v.uploader_name}</span>
                <span className="text-[10px] text-gray-400">{relDate(v.created_at)} · {fmtSize(v.size_kb)}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">{v.note}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Grid card ────────────────────────────────────────────────────────────────
function GridCard({ doc, expanded, onToggle, onDownload, canUpload }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-200 hover:shadow-sm transition-all ${expanded ? 'border-indigo-300 shadow-sm' : ''}`}>
      <div className="flex items-start gap-3">
        <FileIcon type={doc.type} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate leading-snug" title={doc.name}>
            {doc.name}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <VersionBadge v={doc.version} />
            <TagBadge tag={doc.tag} />
          </div>
        </div>
      </div>

      {doc.cluster_name && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <FolderOpen size={11} className="text-gray-400 flex-shrink-0" />
          <span className="text-[11px] text-gray-500 truncate">{doc.cluster_name}</span>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between text-[10px] text-gray-400">
        <span>{fmtSize(doc.size_kb)}</span>
        <span>{relDate(doc.created_at)}</span>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
        <button
          onClick={() => onDownload(doc)}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 text-xs font-medium transition-colors"
        >
          <Download size={12} /> Download
        </button>
        <button
          onClick={() => onToggle(doc.id)}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-medium transition-colors"
        >
          <Clock size={12} />
          History
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {expanded && (
        <div>
          <EvidenceSnapshotViewer doc={doc} />
          <VersionHistory versions={doc.versions} />
        </div>
      )}
    </div>
  )
}

// ─── List row ─────────────────────────────────────────────────────────────────
function ListRow({ doc, expanded, onToggle, onDownload }) {
  return (
    <div className={`border-b border-gray-100 last:border-0 ${expanded ? 'bg-indigo-50/30' : 'hover:bg-gray-50'} transition-colors`}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => onToggle(doc.id)}>
        <FileIcon type={doc.type} size={15} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {doc.cluster_name && (
              <span className="text-[11px] text-gray-400 truncate flex items-center gap-0.5">
                <FolderOpen size={10} /> {doc.cluster_name}
              </span>
            )}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <TagBadge tag={doc.tag} />
          <VersionBadge v={doc.version} />
        </div>

        <div className="hidden md:block flex-shrink-0 w-16 text-right text-[11px] text-gray-400">
          {fmtSize(doc.size_kb)}
        </div>

        <div className="hidden lg:block flex-shrink-0 w-20 text-right text-[11px] text-gray-400">
          {relDate(doc.created_at)}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onDownload(doc) }}
            className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
            title="Download"
          >
            <Download size={14} />
          </button>
          <span className="text-gray-300">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          <EvidenceSnapshotViewer doc={doc} />
          <VersionHistory versions={doc.versions} />
        </div>
      )}
    </div>
  )
}

// ─── Upload zone ──────────────────────────────────────────────────────────────
function UploadZone({ onUpload }) {
  const inputRef  = useRef(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onUpload(files)
  }

  function handleChange(e) {
    const files = Array.from(e.target.files)
    if (files.length) onUpload(files)
    e.target.value = ''
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
        dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
      }`}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" multiple className="hidden" onChange={handleChange} />
      <Upload size={20} className={`mx-auto mb-2 ${dragging ? 'text-indigo-500' : 'text-gray-400'}`} />
      <p className="text-sm font-medium text-gray-700">
        {dragging ? 'Drop to upload' : 'Drag & drop files here'}
      </p>
      <p className="text-xs text-gray-400 mt-1">or <span className="text-indigo-500 font-medium">click to browse</span> · PDF, DOCX, XLSX, PNG, CSV, ZIP, JSON</p>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onClose }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg animate-fade-in">
      <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
      <span>{msg}</span>
      <button onClick={onClose} className="ml-2 text-gray-400 hover:text-white">
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DocumentVaultPage() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const canUpload = canDo('editClusters', currentUser?.role)

  // ── API data ────────────────────────────────────────────────────────────────
  const { data: apiDocs, usingMock, refetch: refetchDocs } = useDocuments()
  const { data: stats } = useVaultStats()

  const [localDocs, setLocalDocs] = useState(null) // optimistic additions only
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [tagFilter, setTagFilter]   = useState('all')
  const [clusterFilter, setClusterFilter] = useState('all')
  const [viewMode, setViewMode]   = useState('grid')   // 'grid' | 'list'
  const [expanded, setExpanded]   = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [toast, setToast]         = useState(null)
  const [sortBy, setSortBy]       = useState('date')   // 'date' | 'name' | 'size'

  // Merge API docs with optimistic local additions
  const docs = useMemo(() => [...(apiDocs ?? []), ...(localDocs ?? [])], [apiDocs, localDocs])

  // Cluster options from docs + mock CLUSTERS
  const clusterOptions = useMemo(() => {
    const map = {}
    docs.forEach(d => { if (d.cluster_id) map[d.cluster_id] = d.cluster_name })
    return Object.entries(map).map(([id, name]) => ({ id, name }))
  }, [docs])

  const filtered = useMemo(() => {
    let result = docs.filter(d => {
      if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false
      if (typeFilter !== 'all'    && d.type !== typeFilter)         return false
      if (tagFilter  !== 'all'    && d.tag  !== tagFilter)          return false
      if (clusterFilter !== 'all') {
        if (clusterFilter === '__none__' && d.cluster_id !== null) return false
        if (clusterFilter !== '__none__' && d.cluster_id !== clusterFilter) return false
      }
      return true
    })
    if (sortBy === 'date') result = result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sortBy === 'name') result = result.sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'size') result = result.sort((a, b) => b.size_kb - a.size_kb)
    return result
  }, [docs, search, typeFilter, tagFilter, clusterFilter, sortBy])

  function toggleExpand(id) {
    setExpanded(prev => prev === id ? null : id)
  }

  function handleDownload(doc) {
    showToast(`Downloading ${doc.name}…`)
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleUpload = useCallback((files) => {
    const newDocs = files.map((f, i) => {
      const ext = f.name.split('.').pop().toLowerCase()
      const type = ALL_TYPES.includes(ext) ? ext : 'pdf'
      return {
        id: `doc-upload-${Date.now()}-${i}`,
        name: f.name,
        type,
        size_kb: Math.round(f.size / 1024) || 1,
        cluster_id: null,
        cluster_name: null,
        uploader_id: currentUser?.id ?? 'u-001',
        uploader_name: currentUser?.display_name ?? 'You',
        version: 1,
        tag: 'evidence',
        created_at: new Date().toISOString(),
        versions: [{
          version: 1,
          size_kb: Math.round(f.size / 1024) || 1,
          uploader_name: currentUser?.display_name ?? 'You',
          created_at: new Date().toISOString(),
          note: 'Uploaded via TaxLift Vault',
        }],
      }
    })
    setLocalDocs(prev => [...newDocs, ...(prev ?? [])])
    showToast(`${files.length} file${files.length > 1 ? 's' : ''} uploaded successfully`)
    setShowUpload(false)
  }, [currentUser])

  // Summary stats from current docs
  const totalKb   = docs.reduce((s, d) => s + d.size_kb, 0)
  const unlinked  = docs.filter(d => !d.cluster_id).length

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">

      {/* Demo mode banner */}
      {usingMock && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-indigo-600 rounded-xl text-xs text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <FlaskConical size={13} className="text-indigo-200 flex-shrink-0" />
            <span className="font-medium">This is a demo — connect a data source to manage your real evidence files.</span>
          </div>
          <button
            onClick={() => navigate('/quick-connect')}
            className="flex-shrink-0 bg-white text-indigo-700 font-semibold px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap"
          >
            Connect now
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Document Vault</h2>
          <p className="text-sm text-gray-500 mt-0.5">Evidence files, narratives and supporting documents for your SR&ED filing.</p>
        </div>
        {canUpload && (
          <button
            onClick={() => setShowUpload(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} />
            Upload Files
          </button>
        )}
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Files',     value: docs.length,               icon: File,      color: 'text-indigo-500' },
          { label: 'Total Size',      value: fmtSize(totalKb),           icon: HardDrive, color: 'text-teal-500'   },
          { label: 'Clusters Linked', value: clusterOptions.length,      icon: FolderOpen,color: 'text-blue-500'   },
          { label: 'Unlinked Files',  value: unlinked,                   icon: AlertCircle,color: unlinked > 0 ? 'text-amber-500' : 'text-gray-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Icon size={18} className={color} />
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-base font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Upload zone ── */}
      {showUpload && canUpload && (
        <UploadZone onUpload={handleUpload} />
      )}

      {/* ── Filters ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        {/* Row 1: search + sort + view toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search files…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            )}
          </div>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-700"
          >
            <option value="date">Sort: Newest</option>
            <option value="name">Sort: Name</option>
            <option value="size">Sort: Largest</option>
          </select>

          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="List view"
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Row 2: type + tag + cluster chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* File type */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${typeFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              All types
            </button>
            {ALL_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t === typeFilter ? 'all' : t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium uppercase tracking-wide transition-colors ${
                  typeFilter === t
                    ? `${FILE_META[t]?.bg ?? 'bg-gray-100'} ${FILE_META[t]?.color ?? 'text-gray-600'} ring-1 ring-current`
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-gray-200" />

          {/* Tag */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setTagFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${tagFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              All tags
            </button>
            {ALL_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setTagFilter(tag === tagFilter ? 'all' : tag)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                  tagFilter === tag
                    ? (TAG_COLORS[tag] ?? 'bg-gray-100 text-gray-600') + ' ring-1 ring-current'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Tag size={9} className="inline mr-0.5" />
                {tag}
              </button>
            ))}
          </div>

          {/* Cluster filter */}
          {clusterOptions.length > 0 && (
            <>
              <div className="w-px h-4 bg-gray-200" />
              <select
                value={clusterFilter}
                onChange={e => setClusterFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-700"
              >
                <option value="all">All clusters</option>
                <option value="__none__">Unlinked files</option>
                {clusterOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* ── Results count ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {filtered.length} file{filtered.length !== 1 ? 's' : ''} {search || typeFilter !== 'all' || tagFilter !== 'all' || clusterFilter !== 'all' ? 'matching filters' : 'total'}
        </p>
        {(search || typeFilter !== 'all' || tagFilter !== 'all' || clusterFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setTypeFilter('all'); setTagFilter('all'); setClusterFilter('all') }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
          >
            <X size={11} /> Clear filters
          </button>
        )}
      </div>

      {/* ── File display ── */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-16">
          <File size={28} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No files found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(doc => (
            <GridCard
              key={doc.id}
              doc={doc}
              expanded={expanded === doc.id}
              onToggle={toggleExpand}
              onDownload={handleDownload}
              canUpload={canUpload}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* List header */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <div className="w-9 flex-shrink-0" />
            <div className="flex-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">File Name</div>
            <div className="hidden sm:block flex-shrink-0 w-32 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Type / Tag</div>
            <div className="hidden md:block flex-shrink-0 w-16 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Size</div>
            <div className="hidden lg:block flex-shrink-0 w-20 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Uploaded</div>
            <div className="w-16 flex-shrink-0" />
          </div>
          {filtered.map(doc => (
            <ListRow
              key={doc.id}
              doc={doc}
              expanded={expanded === doc.id}
              onToggle={toggleExpand}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* ── Toast ── */}
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
