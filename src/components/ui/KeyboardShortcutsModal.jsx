import { useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'

// ─── Shortcut data ─────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['⌘', 'K'],   label: 'Open command palette / search' },
      { keys: ['?'],         label: 'Show keyboard shortcuts' },
      { keys: ['Esc'],       label: 'Close any modal, panel, or palette' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['⌘', 'K'], then: ['type cluster name'], label: 'Jump to a specific cluster' },
      { keys: ['↑', '↓'],  label: 'Move between command palette results' },
      { keys: ['↵'],        label: 'Open selected result' },
    ],
  },
  {
    title: 'Cluster Bulk Review',
    shortcuts: [
      { keys: ['A'], label: 'Approve all selected clusters' },
      { keys: ['R'], label: 'Reject all selected clusters' },
      { keys: ['Esc'], label: 'Cancel bulk review mode' },
    ],
  },
  {
    title: 'Notifications',
    shortcuts: [
      { keys: ['Esc'], label: 'Close notification panel' },
    ],
  },
  {
    title: 'Comments',
    shortcuts: [
      { keys: ['↵'],          label: 'Submit a reply (inside reply composer)' },
      { keys: ['Shift', '↵'], label: 'New line inside a comment' },
    ],
  },
  {
    title: 'Document Vault',
    shortcuts: [
      { keys: ['Click'],       label: 'Expand / collapse version history' },
    ],
  },
  {
    title: 'Eligibility Quiz',
    shortcuts: [
      { keys: ['1',' – ','5'], label: 'Select answer by position number' },
      { keys: ['↵'],           label: 'Proceed to next question' },
      { keys: ['Backspace'],   label: 'Go back one question' },
    ],
  },
]

// ─── Key cap ───────────────────────────────────────────────────────────────────
function Key({ k }) {
  const isText = k.length > 1 && !['Shift', 'Esc', 'Backspace', 'Tab', 'Enter'].includes(k) && k !== '↵' && k !== '↑' && k !== '↓'
  if (isText) return <span className="text-[11px] text-gray-400 italic">{k}</span>
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 bg-white border border-gray-300 rounded shadow-sm text-[11px] font-mono text-gray-700 leading-none">
      {k}
    </kbd>
  )
}

// ─── Shortcut row ──────────────────────────────────────────────────────────────
function ShortcutRow({ keys, then, label }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-1 flex-shrink-0 ml-4">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && !['–', '+'].includes(k) && <span className="text-gray-300 text-xs">+</span>}
            <Key k={k} />
          </span>
        ))}
        {then && (
          <>
            <span className="text-gray-300 text-xs mx-1">then</span>
            {then.map((k, i) => <Key key={i} k={k} />)}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function KeyboardShortcutsModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    function handle(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Keyboard size={14} className="text-indigo-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Shortcuts grid */}
        <div className="overflow-y-auto p-5" style={{ maxHeight: 'calc(80vh - 80px)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {SECTIONS.map(section => (
              <div key={section.title}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {section.title}
                </p>
                <div className="bg-gray-50 rounded-xl px-3 divide-y divide-gray-100">
                  {section.shortcuts.map((s, i) => (
                    <ShortcutRow key={i} {...s} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <p className="text-[11px] text-gray-400">
            Press <Key k="?" /> anywhere to toggle this panel
          </p>
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1"
          >
            Close <Key k="Esc" />
          </button>
        </div>
      </div>
    </div>
  )
}
