/**
 * OAuthCallbackPage — /oauth/callback
 *
 * Handles the OAuth redirect from GitHub and Atlassian (Jira) after the user
 * authorises the TaxLift app.
 *
 * Flow:
 *   1. Read ?code=, ?state=, and ?error= from the URL
 *   2. Validate the state against the value stored in localStorage (CSRF check)
 *   3. Attempt to exchange the code for an access token via the backend proxy
 *      (/api/oauth/github/exchange or /api/oauth/jira/exchange)
 *   4a. If exchange succeeds → store token in localStorage, redirect to Quick Connect
 *   4b. If exchange fails (no backend) → store the raw code, redirect to Quick Connect
 *       with ?connected=1 so it can fall back to demo-mode scanning
 *
 * The provider is encoded in the stored state as "provider:randomHex".
 */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, AlertTriangle, Github, Ticket } from 'lucide-react'
import {
  exchangeGitHubCode,
  exchangeJiraCode,
  storeToken,
  LS_KEYS,
} from '../lib/oauthConfig'

// Provider-specific display metadata
const PROVIDER_META = {
  github: { label: 'GitHub',    Icon: Github, color: 'text-gray-900' },
  jira:   { label: 'Atlassian', Icon: Ticket, color: 'text-blue-600' },
}

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [phase,    setPhase]    = useState('processing') // processing | success | error
  const [message,  setMessage]  = useState('Completing authorization…')
  const [provider, setProvider] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function handleCallback() {
      const code      = searchParams.get('code')
      const state     = searchParams.get('state')
      const error     = searchParams.get('error')
      const errorDesc = searchParams.get('error_description')

      // ── OAuth provider returned an error ──────────────────────────────────
      if (error) {
        if (!cancelled) {
          setPhase('error')
          setMessage(errorDesc ?? error ?? 'Authorization was denied or cancelled.')
        }
        return
      }

      if (!code) {
        if (!cancelled) {
          setPhase('error')
          setMessage('No authorization code received. Please try again.')
        }
        return
      }

      // ── Detect provider and validate state (CSRF guard) ───────────────────
      const storedRaw    = localStorage.getItem(LS_KEYS.OAUTH_STATE) ?? ''
      const [prov, expectedState] = storedRaw.split(':')
      const detectedProvider = prov || 'github'

      if (!cancelled) setProvider(detectedProvider)

      if (state && expectedState && state !== expectedState) {
        if (!cancelled) {
          setPhase('error')
          setMessage('Security check failed (state mismatch). Please try again.')
        }
        return
      }

      // ── GitHub ─────────────────────────────────────────────────────────────
      if (detectedProvider === 'github') {
        if (!cancelled) setMessage('Exchanging GitHub authorization code…')

        // ⚠️ Token exchange requires backend proxy — see oauthConfig.js for details.
        // Returns null when /api/oauth/github/exchange is unavailable.
        const token = await exchangeGitHubCode(code, state)

        if (!cancelled) {
          if (token) {
            storeToken('github', token)
            setMessage('Connected to GitHub! Redirecting…')
          } else {
            // Backend not available: store raw code so QuickConnectPage can show
            // a PAT fallback prompt, or proceed with demo-mode scanning.
            localStorage.setItem('taxlift_github_oauth_code', code)
            setMessage('GitHub authorized — proceeding in demo scan mode.')
          }
          localStorage.removeItem(LS_KEYS.OAUTH_STATE)
          setPhase('success')

          // If this auth was triggered from the free scan flow, go to repo selector.
          // Otherwise fall through to Quick Connect as usual.
          const isScanFlow = sessionStorage.getItem('taxlift_scan_flow') === 'true'
          if (isScanFlow) {
            sessionStorage.removeItem('taxlift_scan_flow')
            setTimeout(() => navigate('/scan/repos'), 1200)
          } else {
            setTimeout(() => navigate('/quick-connect?provider=github&connected=1'), 1200)
          }
        }
        return
      }

      // ── Jira / Atlassian ───────────────────────────────────────────────────
      if (detectedProvider === 'jira') {
        if (!cancelled) setMessage('Exchanging Atlassian authorization code…')

        const verifier = localStorage.getItem(LS_KEYS.PKCE_VERIFIER) ?? ''

        // ⚠️ Token exchange requires backend proxy — see oauthConfig.js for details.
        const result = await exchangeJiraCode(code, verifier)

        if (!cancelled) {
          if (result?.accessToken) {
            storeToken('jira', result.accessToken)
            if (result.refreshToken) {
              localStorage.setItem(LS_KEYS.JIRA_REFRESH, result.refreshToken)
            }
            setMessage('Connected to Atlassian! Redirecting…')
          } else {
            localStorage.setItem('taxlift_jira_oauth_code', code)
            setMessage('Jira authorized — proceeding in demo scan mode.')
          }
          localStorage.removeItem(LS_KEYS.OAUTH_STATE)
          localStorage.removeItem(LS_KEYS.PKCE_VERIFIER)
          setPhase('success')
          setTimeout(() => navigate('/quick-connect?provider=jira&connected=1'), 1200)
        }
        return
      }

      // ── Unknown provider ───────────────────────────────────────────────────
      if (!cancelled) {
        setPhase('error')
        setMessage('Unknown OAuth provider. Please try again.')
      }
    }

    handleCallback()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const meta = PROVIDER_META[provider] ?? { label: 'Integration', Icon: Loader2, color: 'text-indigo-600' }
  const Icon = meta.Icon

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-sm w-full text-center">

        {phase === 'processing' && (
          <>
            <Loader2 size={44} className="text-indigo-600 animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-1">Completing authorization</h2>
            <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
          </>
        )}

        {phase === 'success' && (
          <>
            <div className="relative w-14 h-14 mx-auto mb-4">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                <Icon size={22} className={meta.color} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle2 size={14} className="text-white" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">{meta.label} connected</h2>
            <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
            <p className="text-xs text-gray-400 mt-3">Redirecting you back to Quick Connect…</p>
          </>
        )}

        {phase === 'error' && (
          <>
            <AlertTriangle size={44} className="text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-1">Authorization failed</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">{message}</p>
            <button
              onClick={() => {
                const isScanFlow = sessionStorage.getItem('taxlift_scan_flow') === 'true'
                navigate(isScanFlow ? '/scan' : '/quick-connect')
              }}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Try again
            </button>
          </>
        )}

      </div>
    </div>
  )
}
