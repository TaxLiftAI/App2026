/**
 * ActivityLogUpload — Download template + upload XLSX activity log
 *
 * Uses SheetJS (loaded from CDN script tag) to parse the file client-side,
 * then POSTs parsed rows to /api/v1/changelog/upload.
 *
 * Shows an inline credit estimate result after successful upload.
 */
import { useState, useRef, useEffect } from 'react'
import {
  Download, Upload, CheckCircle2, AlertCircle, Loader2,
  FileSpreadsheet, DollarSign, Clock, BarChart2, X,
} from 'lucide-react'
import { changelog as changelogApi, ApiError } from '../lib/api'

// ── Load SheetJS from CDN (only once) ────────────────────────────────────────
let xlsxLoaded = false
function loadXLSX() {
  return new Promise((resolve, reject) => {
    if (xlsxLoaded || window.XLSX) { xlsxLoaded = true; resolve(window.XLSX); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload  = () => { xlsxLoaded = true; resolve(window.XLSX) }
    s.onerror = () => reject(new Error('Failed to load SheetJS'))
    document.head.appendChild(s)
  })
}

// ── Column name normaliser ────────────────────────────────────────────────────
function fuzzyGet(obj, ...keys) {
  for (const k of keys) {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '')
    const found = Object.entries(obj).find(
      ([rk]) => rk.toLowerCase().replace(/[^a-z0-9]/g, '').includes(norm)
    )
    if (found && found[1] !== '' && found[1] !== undefined) return String(found[1]).trim()
  }
  return ''
}

function normaliseElig(v) {
  const s = String(v || '').toLowerCase()
  if (s === 'yes' || s === 'y')     return 'Yes'
  if (s === 'partial' || s === 'p') return 'Partial'
  return 'No'
}

function parseWorkbook(XLSX, buffer, filename) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

  const sheetName = wb.SheetNames.find(n =>
    /activity log|summary|changes/i.test(n)
  ) ?? wb.SheetNames[0]

  const ws = wb.Sheets[sheetName]
  const all = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, header: 1 })

  // Find the header row (contains "Date" and "Hours")
  const hdrIdx = all.findIndex(row =>
    row.some(c => /^date$/i.test(String(c).trim())) &&
    row.some(c => /hours/i.test(String(c).trim()))
  )
  if (hdrIdx < 0) throw new Error('Could not find a header row with "Date" and "Hours" columns.')

  const headers = all[hdrIdx].map(c => String(c).trim())
  const dataRows = all.slice(hdrIdx + 1)

  const rows = dataRows
    .map(row => {
      const obj = {}
      headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
      return obj
    })
    .map(r => ({
      date:        fuzzyGet(r, 'Date'),
      type:        fuzzyGet(r, 'Type'),
      area:        fuzzyGet(r, 'Module', 'Area', 'Module / Area'),
      title:       fuzzyGet(r, 'Title'),
      description: fuzzyGet(r, 'Description', 'Detail'),
      role:        fuzzyGet(r, 'Developer Role', 'Role', 'DeveloperRole'),
      hours:       parseFloat(fuzzyGet(r, 'Hours Spent', 'Hours', 'Hrs')) || 0,
      eligibility: normaliseElig(fuzzyGet(r, "SR&ED Eligible", 'Eligible', 'SRED')),
      uncertainty: fuzzyGet(r, 'Technological Uncertainty', 'Uncertainty', 'TU'),
      impact:      fuzzyGet(r, 'Impact'),
    }))
    .filter(r => r.hours > 0 || r.title)

  if (!rows.length) throw new Error('No data rows found. Make sure the file has hours and titles filled in.')
  return rows
}

function fmt(n) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ActivityLogUpload({ className = '', onEstimate, demoMode = false, id }) {
  const fileRef = useRef()
  const [state,    setState]    = useState('idle')   // idle | parsing | uploading | done | error
  const [error,    setError]    = useState(null)
  const [result,   setResult]   = useState(null)
  const [filename, setFilename] = useState(null)

  async function handleFile(file) {
    if (!file) return
    setFilename(file.name)
    setState('parsing')
    setError(null)
    setResult(null)

    try {
      const XLSX  = await loadXLSX()
      const buf   = await file.arrayBuffer()
      const rows  = parseWorkbook(XLSX, new Uint8Array(buf), file.name)

      setState('uploading')
      const res = await changelogApi.upload(file.name, rows)
      setResult(res)
      setState('done')
      onEstimate?.(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err.message ?? 'Something went wrong'))
      setState('error')
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function reset() {
    setState('idle')
    setError(null)
    setResult(null)
    setFilename(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const busy = state === 'parsing' || state === 'uploading'

  return (
    <div id={id} className={`bg-white border border-gray-200 rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <FileSpreadsheet size={15} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Activity Log Upload</p>
            <p className="text-[11px] text-gray-400">
              {demoMode
                ? 'Download the template, fill in your R&D hours, and upload after signing in'
                : 'Supplement GitHub/Jira data with manual R&D hours'}
            </p>
          </div>
        </div>
        <a
          href="/templates/SRED_Activity_Log_Template.xlsx"
          download
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
        >
          <Download size={12} /> Download template
        </a>
      </div>

      <div className="p-5">
        {/* Result panel */}
        {state === 'done' && result && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 size={15} />
                <span className="text-sm font-semibold">Uploaded: {filename}</span>
              </div>
              <button onClick={reset} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>

            {/* Stat row */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[
                { icon: Clock,      label: 'Eligible hours',  value: `${result.eligible_hours}h`, sub: `${result.eligible_pct}% of total` },
                { icon: DollarSign, label: 'Eligible spend',  value: fmt(result.eligible_expenditure), sub: 'salaries + overhead' },
                { icon: BarChart2,  label: 'Credit estimate', value: fmt(result.total_credit_cad), sub: `fed ${fmt(result.federal_credit_cad)} + prov ${fmt(result.provincial_credit_cad)}` },
              ].map(({ icon: Icon, label, value, sub }) => (
                <div key={label} className="bg-indigo-50 rounded-xl p-3 text-center">
                  <Icon size={14} className="text-indigo-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Eligibility breakdown */}
            <div className="flex items-center gap-2 text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              {Object.entries(result.by_eligibility).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${k === 'Yes' ? 'bg-green-500' : k === 'Partial' ? 'bg-amber-400' : 'bg-gray-300'}`} />
                  {v} {k}
                </span>
              ))}
              <span className="ml-auto text-gray-400">
                {result.total_rows} activities · {result.total_hours}h total
              </span>
            </div>

            <p className="text-[10px] text-gray-400 mt-2 text-center">
              Rate assumptions: Developer $72/hr · Senior Dev $92/hr · Architect/ML $116/hr · 35% federal + 8% ON provincial
            </p>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4 text-xs text-red-700">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <div className="flex-1">{error}</div>
            <button onClick={reset} className="text-red-400 hover:text-red-600 shrink-0">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Drop zone — disabled in demo mode */}
        {(state === 'idle' || state === 'error') && (
          demoMode ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center bg-gray-50">
              <Upload size={20} className="text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-500">
                Upload available after signing in
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                Download the template above, fill it in, then create a free account to upload
              </p>
              <a
                href="/register"
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline"
              >
                Create free account →
              </a>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 hover:border-indigo-300 rounded-xl p-6 text-center cursor-pointer transition-colors group"
            >
              <Upload size={20} className="text-gray-300 group-hover:text-indigo-400 mx-auto mb-2 transition-colors" />
              <p className="text-xs font-medium text-gray-600 group-hover:text-indigo-600 transition-colors">
                Drop your activity log here, or click to browse
              </p>
              <p className="text-[10px] text-gray-400 mt-1">.xlsx files · max 8 MB</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>
          )
        )}

        {/* Loading */}
        {busy && (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 size={22} className="animate-spin text-indigo-500" />
            <p className="text-xs text-gray-500">
              {state === 'parsing' ? 'Parsing spreadsheet…' : 'Calculating credit estimate…'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
