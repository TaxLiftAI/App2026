/**
 * TaxLiftLogo — canonical brand mark used across all pages.
 *
 * Props:
 *   variant  'light' | 'dark'   — 'light' for white/light backgrounds, 'dark' for dark/indigo backgrounds
 *   size     'sm' | 'md' | 'lg' — controls icon + text scale
 *   iconOnly {boolean}          — renders the icon mark only (no wordmark)
 *   className {string}          — extra classes on the wrapper
 */
export default function TaxLiftLogo({ variant = 'light', size = 'md', iconOnly = false, className = '' }) {
  const sizes = {
    sm: { icon: 28, text: '18px', ai: '10px', gap: 9 },
    md: { icon: 36, text: '22px', ai: '12px', gap: 11 },
    lg: { icon: 48, text: '30px', ai: '15px', gap: 14 },
  }
  const s = sizes[size] ?? sizes.md

  const wordmarkColor = variant === 'dark' ? '#f8fafc' : '#0f172a'
  const aiColor      = variant === 'dark' ? '#818cf8' : '#4f46e5'

  return (
    <div className={`flex items-center ${className}`} style={{ gap: s.gap }}>
      {/* Icon mark */}
      <svg
        viewBox="0 0 48 48"
        width={s.icon}
        height={s.icon}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <rect width="48" height="48" rx="11" fill="#4f46e5" />
        {/* Bar 1 — short */}
        <rect x="8"  y="30" width="8" height="11" rx="2" fill="white" opacity="0.5" />
        {/* Bar 2 — medium */}
        <rect x="20" y="24" width="8" height="17" rx="2" fill="white" opacity="0.72" />
        {/* Bar 3 — tall */}
        <rect x="32" y="18" width="8" height="23" rx="2" fill="white" />
        {/* Upward arrow above bar 3 */}
        <path
          d="M30 19 L36 11 L42 19"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Wordmark */}
      {!iconOnly && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontSize: s.text,
            fontWeight: 500,
            color: wordmarkColor,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}>
            TaxLift
          </span>
          <span style={{
            fontSize: s.ai,
            fontWeight: 500,
            color: aiColor,
            letterSpacing: '0.05em',
            lineHeight: 1,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}>
            AI
          </span>
        </div>
      )}
    </div>
  )
}
