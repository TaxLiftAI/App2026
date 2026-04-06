/**
 * CalendlyEmbed — inline Calendly widget + modal wrapper.
 *
 * The Calendly widget script is loaded lazily (only when the modal opens).
 *
 * Props:
 *   isOpen  {boolean}
 *   onClose {function}
 *   url     {string}    — Calendly URL, defaults to VITE_CALENDLY_URL env var
 */
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const DEFAULT_URL = import.meta.env.VITE_CALENDLY_URL ?? 'https://calendly.com/taxlift/free-review'
const WIDGET_SCRIPT = 'https://assets.calendly.com/assets/external/widget.js'
const WIDGET_CSS    = 'https://assets.calendly.com/assets/external/widget.css'

function loadCalendlyAssets() {
  // CSS
  if (!document.getElementById('calendly-css')) {
    const link    = document.createElement('link')
    link.id       = 'calendly-css'
    link.rel      = 'stylesheet'
    link.href     = WIDGET_CSS
    document.head.appendChild(link)
  }

  // Script
  return new Promise((resolve) => {
    if (window.Calendly) { resolve(); return }
    if (document.getElementById('calendly-js')) {
      // Script tag already added — wait for it to load
      document.getElementById('calendly-js').addEventListener('load', resolve)
      return
    }
    const script    = document.createElement('script')
    script.id       = 'calendly-js'
    script.src      = WIDGET_SCRIPT
    script.async    = true
    script.onload   = resolve
    document.head.appendChild(script)
  })
}

export default function CalendlyEmbed({ isOpen, onClose, url = DEFAULT_URL }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    loadCalendlyAssets().then(() => {
      if (containerRef.current && window.Calendly) {
        // Clear any previous widget
        containerRef.current.innerHTML = ''
        window.Calendly.initInlineWidget({
          url,
          parentElement: containerRef.current,
          prefill:   {},
          utm:       {},
        })
      }
    })
  }, [isOpen, url])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Book a demo"
      >
        <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Book a demo</h2>
              <p className="text-sm text-slate-500">Pick a time that works for you — 30 minutes.</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Calendly widget container */}
          <div
            ref={containerRef}
            style={{ minHeight: 630 }}
            className="calendly-inline-widget w-full"
          />
        </div>
      </div>
    </>
  )
}
