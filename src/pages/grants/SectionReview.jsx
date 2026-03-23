/**
 * S5 — Section Review
 * Main editing surface. Founder reads each section, approves or requests regeneration.
 * Source badge shows SR&ED vs gap fill origin.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft, CheckCircle2, RefreshCw, ChevronDown, ChevronUp,
  FileText, Users, DollarSign, Globe, TrendingUp, Lightbulb, FlaskConical,
  Loader2, AlertCircle, Download, MessageSquare, ThumbsUp, Edit3
} from 'lucide-react'
import { grants as grantsApi } from '../../lib/api'
import Button from '../../components/ui/Button'

const SECTION_ICONS = {
  project_desc: FileText,
  innovation:   Lightbulb,
  methodology:  FlaskConical,
  market:       TrendingUp,
  commercial:   DollarSign,
  cdn_benefit:  Globe,
  budget:       DollarSign,
  team:         Users,
}

const SOURCE_BADGE = {
  sred_only: { label: 'From SR&ED',   bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-100' },
  gap_fill:  { label: 'From gap fill', bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' },
  mixed:     { label: 'Mixed sources', bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
}

const STATUS_STYLES = {
  pending:    { bg: 'bg-gray-50',   border: 'border-gray-200',  icon: null },
  generating: { bg: 'bg-blue-50',   border: 'border-blue-200',  icon: null },
  ready:      { bg: 'bg-white',     border: 'border-gray-200',  icon: null },
  approved:   { bg: 'bg-green-50',  border: 'border-green-200', icon: CheckCircle2 },
  error:      { bg: 'bg-red-50',    border: 'border-red-200',   icon: AlertCircle },
}

export default function SectionReview() {
  const navigate  = useNavigate()
  const { id: applicationId } = useParams()

  const [application, setApplication]   = useState(null)
  const [sections, setSections]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [expandedSection, setExpandedSection] = useState(null)
  const [editingSection, setEditingSection]   = useState(null)
  const [editContent, setEditContent]         = useState('')
  const [feedbackNote, setFeedbackNote]       = useState('')
  const [showFeedback, setShowFeedback]       = useState({})
  const [actionInProgress, setActionInProgress] = useState({})

  async function load() {
    try {
      const data = await grantsApi.getApplication(applicationId)
      setApplication(data)
      setSections(data.sections || [])
      // Auto-expand first non-approved section
      const first = (data.sections || []).find(s => s.status !== 'approved')
      if (first) setExpandedSection(first.id)
    } catch (err) {
      alert('Failed to load application: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [applicationId])

  async function approveSection(sectionId) {
    setActionInProgress(p => ({ ...p, [sectionId]: 'approving' }))
    try {
      const updated = await grantsApi.approveSection(sectionId)
      setSections(ss => ss.map(s => s.id === sectionId ? { ...s, ...updated } : s))
      // Auto-expand next section
      const idx = sections.findIndex(s => s.id === sectionId)
      const next = sections.slice(idx + 1).find(s => s.status !== 'approved')
      if (next) setExpandedSection(next.id)
    } catch (err) {
      alert('Failed to approve: ' + err.message)
    } finally {
      setActionInProgress(p => ({ ...p, [sectionId]: null }))
    }
  }

  async function regenerateSection(sectionId) {
    const note = feedbackNote
    setActionInProgress(p => ({ ...p, [sectionId]: 'regenerating' }))
    setShowFeedback(p => ({ ...p, [sectionId]: false }))
    try {
      await grantsApi.regenerateSection(sectionId, note)
      setSections(ss => ss.map(s => s.id === sectionId ? { ...s, status: 'generating' } : s))
      setFeedbackNote('')
      // Poll until this section is done
      const poll = setInterval(async () => {
        const data = await grantsApi.getApplication(applicationId)
        const sec = (data.sections || []).find(s => s.id === sectionId)
        if (sec && sec.status !== 'generating') {
          setSections(data.sections || [])
          clearInterval(poll)
          setActionInProgress(p => ({ ...p, [sectionId]: null }))
        }
      }, 2000)
    } catch (err) {
      alert('Failed to regenerate: ' + err.message)
      setActionInProgress(p => ({ ...p, [sectionId]: null }))
    }
  }

  const approvedCount = sections.filter(s => s.status === 'approved').length
  const totalCount    = sections.length
  const allApproved   = approvedCount === totalCount && totalCount > 0

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-indigo-500" size={28} />
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/grants')} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {application?.grant_name} — Section Review
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {approvedCount} of {totalCount} sections approved
          </p>
        </div>
        <div className="flex items-center gap-3">
          {allApproved && (
            <button
              onClick={() => navigate(`/grants/applications/${applicationId}/export`)}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              <Download size={14} /> Export PDF
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${totalCount > 0 ? (approvedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-right">
          {approvedCount}/{totalCount} approved
          {allApproved && <span className="ml-2 text-green-600 font-medium">· All approved! Ready to export.</span>}
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((section, idx) => {
          const isExpanded  = expandedSection === section.id
          const isEditing   = editingSection === section.id
          const srcBadge    = SOURCE_BADGE[section.data_source] || SOURCE_BADGE.sred_only
          const statusStyle = STATUS_STYLES[section.status] || STATUS_STYLES.ready
          const Icon        = SECTION_ICONS[section.section_key] || FileText
          const action      = actionInProgress[section.id]

          return (
            <div
              key={section.id}
              className={`rounded-xl border ${statusStyle.border} ${statusStyle.bg} overflow-hidden`}
            >
              {/* Section header */}
              <button
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-black/5 transition-colors"
                onClick={() => setExpandedSection(isExpanded ? null : section.id)}
              >
                <Icon size={16} className={
                  section.status === 'approved' ? 'text-green-500' :
                  section.status === 'error' ? 'text-red-400' : 'text-gray-400'
                } />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{section.section_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${srcBadge.bg} ${srcBadge.text} ${srcBadge.border}`}>
                      {srcBadge.label}
                    </span>
                    {section.word_count && (
                      <span className="text-[10px] text-gray-400">{section.word_count}w</span>
                    )}
                  </div>
                  {section.status === 'generating' && (
                    <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" /> Generating…
                    </p>
                  )}
                  {section.status === 'error' && (
                    <p className="text-xs text-red-500 mt-0.5">Generation failed — click to regenerate</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {section.status === 'approved' && (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle2 size={13} /> Approved
                    </span>
                  )}
                  {isExpanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                </div>
              </button>

              {/* Section content */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">

                  {section.status === 'generating' ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="animate-spin text-indigo-500" size={24} />
                      <span className="ml-3 text-sm text-gray-500">Generating section…</span>
                    </div>
                  ) : isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={12}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            // Inline edit saves directly to section content via regenerate endpoint (with the edited content as "feedback")
                            setEditingSection(null)
                            setSections(ss => ss.map(s => s.id === section.id
                              ? { ...s, content: editContent, word_count: editContent.split(/\s+/).filter(Boolean).length }
                              : s
                            ))
                          }}
                        >
                          Save Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingSection(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {section.content || <span className="italic text-gray-400">No content generated yet.</span>}
                      </div>
                    </div>
                  )}

                  {/* Feedback input */}
                  {showFeedback[section.id] && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">
                        Feedback note (optional — helps Claude improve the rewrite)
                      </label>
                      <textarea
                        value={feedbackNote}
                        onChange={e => setFeedbackNote(e.target.value)}
                        rows={2}
                        placeholder="e.g. Make the Canadian benefit section more specific about job creation numbers…"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {/* Actions */}
                  {!isEditing && section.status !== 'generating' && (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <button
                        onClick={() => approveSection(section.id)}
                        disabled={!!action || !section.content}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        {action === 'approving'
                          ? <><Loader2 size={11} className="animate-spin" /> Approving…</>
                          : <><ThumbsUp size={11} /> Approve</>
                        }
                      </button>

                      <button
                        onClick={() => {
                          if (showFeedback[section.id]) {
                            regenerateSection(section.id)
                          } else {
                            setShowFeedback(p => ({ ...p, [section.id]: true }))
                          }
                        }}
                        disabled={action === 'regenerating'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                      >
                        {action === 'regenerating'
                          ? <><Loader2 size={11} className="animate-spin" /> Regenerating…</>
                          : showFeedback[section.id]
                            ? <><RefreshCw size={11} /> Regenerate with feedback</>
                            : <><RefreshCw size={11} /> Regenerate</>
                        }
                      </button>

                      <button
                        onClick={() => {
                          setEditingSection(section.id)
                          setEditContent(section.content || '')
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
                      >
                        <Edit3 size={11} /> Edit inline
                      </button>

                      {showFeedback[section.id] && (
                        <button
                          onClick={() => setShowFeedback(p => ({ ...p, [section.id]: false }))}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      )}

                      {section.status === 'approved' && (
                        <button
                          onClick={() => approveSection(section.id)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Unapprove
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* All approved CTA */}
      {allApproved && (
        <div className="mt-6 p-5 bg-green-50 border border-green-200 rounded-xl text-center">
          <CheckCircle2 size={28} className="text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-gray-900">All {totalCount} sections approved!</p>
          <p className="text-sm text-gray-500 mt-1">Your application is ready to export as a PDF.</p>
          <button
            onClick={() => navigate(`/grants/applications/${applicationId}/export`)}
            className="mt-4 px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700"
          >
            Export to PDF →
          </button>
        </div>
      )}
    </div>
  )
}
