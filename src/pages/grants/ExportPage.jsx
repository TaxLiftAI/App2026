/**
 * S6 — Export & Submit
 * All sections approved. PDF download, per-section clipboard copy.
 * Manual submission date entry for tracker. Links to grant portal.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft, Download, Copy, Check, ExternalLink,
  Calendar, FileText, Loader2, CheckCircle2
} from 'lucide-react'
import { grants as grantsApi } from '../../lib/api'

const GRANT_PORTALS = {
  irap:        { url: 'https://nrc.canada.ca/en/support-technology-innovation/nrc-irap', name: 'NRC-IRAP Portal' },
  oitc:        { url: 'https://www.ontario.ca/page/ontario-innovation-tax-credit', name: 'Ontario Innovation Tax Credit' },
  sdtc:        { url: 'https://sdtc.ca/en/apply/', name: 'SDTC Application Portal' },
  ngen:        { url: 'https://www.ngen.ca/en/funding', name: 'NGen Funding Portal' },
  bc_ignite:   { url: 'https://www2.gov.bc.ca/gov/content/economic-development/business', name: 'BC Ignite' },
  ab_innovates:{ url: 'https://albertainnovates.ca/programs/', name: 'Alberta Innovates' },
  qc_crsng:   { url: 'https://www.nserc-crsng.gc.ca/Professors-Professeurs/Grants-Subs/', name: 'CRSNG Portal' },
}

export default function ExportPage() {
  const navigate = useNavigate()
  const { id: applicationId } = useParams()

  const [exportData, setExportData]       = useState(null)
  const [loading, setLoading]             = useState(true)
  const [exporting, setExporting]         = useState(false)
  const [copied, setCopied]               = useState({})
  const [submittedDate, setSubmittedDate] = useState('')
  const [amountRequested, setAmountRequested] = useState('')
  const [trackSaved, setTrackSaved]       = useState(false)

  useEffect(() => {
    grantsApi.exportApplication(applicationId)
      .then(data => { setExportData(data); setLoading(false) })
      .catch(err => { alert(err.message); setLoading(false) })
  }, [applicationId])

  function copySection(sectionKey, content) {
    navigator.clipboard.writeText(content)
    setCopied(p => ({ ...p, [sectionKey]: true }))
    setTimeout(() => setCopied(p => ({ ...p, [sectionKey]: false })), 2000)
  }

  function copyAllSections() {
    if (!exportData) return
    const text = exportData.sections.map(s =>
      `## ${s.section_name}\n\n${s.content}`
    ).join('\n\n---\n\n')
    navigator.clipboard.writeText(text)
    setCopied(p => ({ ...p, all: true }))
    setTimeout(() => setCopied(p => ({ ...p, all: false })), 2000)
  }

  function downloadPDF() {
    if (!exportData) return
    setExporting(true)

    // Build a simple printable HTML page and trigger browser print-to-PDF
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${exportData.grant_name} — ${exportData.company_name}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #111; }
    h1 { font-size: 22px; border-bottom: 2px solid #111; padding-bottom: 10px; }
    h2 { font-size: 16px; margin-top: 36px; color: #333; }
    p { line-height: 1.7; font-size: 13px; }
    .meta { font-size: 12px; color: #555; margin-bottom: 30px; }
    .section { page-break-inside: avoid; margin-bottom: 30px; }
    hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${exportData.grant_name} — Grant Application</h1>
  <div class="meta">
    <strong>${exportData.company_name}</strong> · Business Number: ${exportData.business_number || 'N/A'} · Province: ${exportData.province} · Fiscal Year End: ${exportData.fiscal_year_end}<br>
    Generated: ${new Date(exportData.exported_at).toLocaleDateString('en-CA')} · Maximum Funding: $${exportData.max_funding?.toLocaleString()} · Deadline: ${exportData.deadline}
  </div>
  ${exportData.sections.map(s => `
  <div class="section">
    <h2>${s.section_name}</h2>
    ${s.content.split('\n').map(line => line.trim() ? `<p>${line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>` : '').join('')}
  </div>
  `).join('<hr>')}
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank')
    if (win) win.focus()
    setTimeout(() => { URL.revokeObjectURL(url); setExporting(false) }, 1000)
  }

  async function saveTracking() {
    try {
      await grantsApi.updateApplication(applicationId, {
        status: 'submitted',
        submitted_at: submittedDate ? new Date(submittedDate).toISOString() : new Date().toISOString(),
        amount_requested: amountRequested ? parseFloat(amountRequested) : null,
      })
      setTrackSaved(true)
      setTimeout(() => navigate('/grants/tracker'), 1200)
    } catch (err) {
      alert('Failed to save: ' + err.message)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-indigo-500" size={28} />
    </div>
  )

  const portal = GRANT_PORTALS[exportData?.grant_id]

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/grants/applications/${applicationId}/review`)} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Export & Submit</h1>
          <p className="text-xs text-gray-500 mt-0.5">{exportData?.grant_name} · {exportData?.company_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyAllSections}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
          >
            {copied.all ? <><Check size={12} className="text-green-500" /> Copied</> : <><Copy size={12} /> Copy All</>}
          </button>
          <button
            onClick={downloadPDF}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {exporting ? 'Opening…' : 'PDF / Print'}
          </button>
        </div>
      </div>

      {/* Application header info */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div><p className="text-gray-400">Company</p><p className="font-semibold text-gray-800 mt-0.5">{exportData?.company_name}</p></div>
        <div><p className="text-gray-400">Business #</p><p className="font-semibold text-gray-800 mt-0.5">{exportData?.business_number || 'N/A'}</p></div>
        <div><p className="text-gray-400">Province</p><p className="font-semibold text-gray-800 mt-0.5">{exportData?.province}</p></div>
        <div><p className="text-gray-400">Fiscal Year End</p><p className="font-semibold text-gray-800 mt-0.5">{exportData?.fiscal_year_end}</p></div>
      </div>

      {/* Portal link */}
      {portal && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <ExternalLink size={16} className="text-blue-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">Submit on the grant portal</p>
            <p className="text-xs text-blue-600 mt-0.5">Copy sections below and paste into the online application form.</p>
          </div>
          <a href={portal.url} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
            Open Portal →
          </a>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Application Sections</h2>
        {exportData?.sections?.map(section => (
          <div key={section.section_key} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-800">{section.section_name}</span>
                <span className="text-xs text-gray-400">{section.word_count}w</span>
              </div>
              <button
                onClick={() => copySection(section.section_key, section.content)}
                className="flex items-center gap-1 px-2.5 py-1 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
              >
                {copied[section.section_key]
                  ? <><Check size={11} className="text-green-500" /> Copied</>
                  : <><Copy size={11} /> Copy</>
                }
              </button>
            </div>
            <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap max-h-32 overflow-hidden relative">
              {section.content}
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
            </div>
          </div>
        ))}
      </div>

      {/* Tracking */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Calendar size={15} /> Log Your Submission
        </h2>
        <p className="text-xs text-gray-500">Record when you submitted so TaxLift can track the application outcome.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Submission Date</label>
            <input
              type="date"
              value={submittedDate}
              onChange={e => setSubmittedDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Amount Requested ($)</label>
            <input
              type="number"
              value={amountRequested}
              onChange={e => setAmountRequested(e.target.value)}
              placeholder="e.g. 250000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <button
          onClick={saveTracking}
          disabled={trackSaved}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-70"
        >
          {trackSaved
            ? <><CheckCircle2 size={14} className="text-green-300" /> Saved! Redirecting to tracker…</>
            : 'Save to Application Tracker'
          }
        </button>
      </div>
    </div>
  )
}
