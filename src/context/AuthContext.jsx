/**
 * AuthContext — supports two login modes:
 *
 *  1. Real mode   — email + password → POST /auth/login → JWT lives in httpOnly cookie.
 *                   On mount, calls /auth/me; the browser sends the cookie automatically.
 *                   Tokens never touch localStorage — eliminates XSS exfiltration risk.
 *
 *  2. Demo mode   — select a mock persona; no network required.
 *                   Falls back automatically when the API is unreachable.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { USERS } from '../data/mockData'
import { auth as authApi, ApiError } from '../lib/api'

const AuthContext = createContext(null)

// ─── Demo personas ─────────────────────────────────────────────────────────────────────────────────
export const DEMO_PERSONAS = [
  { label: 'Sarah Chen — Admin',     userId: 'u-001', role: 'Admin'    },
  { label: 'Marcus Reid — Reviewer', userId: 'u-002', role: 'Reviewer' },
  { label: 'Jordan Kim — Developer', userId: 'u-003', role: 'Developer'},
  { label: 'David Okafor — Auditor', userId: 'u-005', role: 'Auditor'  },
]

// ─── CPA demo persona (Blocker 1 fix — independent CPA login) ─────────────────
export const CPA_DEMO_PERSONA = {
  id:                   'cpa-demo-001',
  name:                 'Jennifer Hartwell, CPA',
  email:                'jhartwell@hartwell-cpa.ca',
  role:                 'CPA',
  firm_name:            'Hartwell & Associates CPA',
  tenant_id:            'cpa-tenant-demo',
  subscription_tier:    'growth',
  onboarding_completed: true,
  _fromApi:             false,
}

// Map backend role strings → frontend role strings used in canDo()
function normaliseRole(role) {
  if (!role) return 'Developer'
  const r = role.toLowerCase()
  if (r === 'admin')    return 'Admin'
  if (r === 'reviewer') return 'Reviewer'
  if (r === 'cpa')      return 'CPA'
  if (r === 'auditor')  return 'Auditor'
  return 'Developer'
}

// Shape a backend /me response into the same object shape as mock USERS
function shapeBackendUser(me) {
  return {
    id:                   me.id,
    name:                 me.display_name ?? me.full_name ?? me.email,
    email:                me.email,
    role:                 normaliseRole(me.role),
    tenant_id:            me.tenant_id,
    avatar:               me.avatar ?? null,
    firm_name:            me.firm_name ?? null,
    subscription_tier:    me.subscription_tier ?? 'free',
    // SQLite returns 0/1 integers; coerce to booleans
    onboarding_completed: me.onboarding_completed === 1 || me.onboarding_completed === true,
    // IMPORTANT: must forward email_verified so the verification banner in Layout.jsx fires.
    // API returns 0/1 from SQLite; coerce to boolean so === false comparisons work correctly.
    email_verified:       me.email_verified === 1 || me.email_verified === true,
    created_at:           me.created_at ?? null,
    _fromApi:             true,
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser]   = useState(null)
  const [isDemoMode,  setIsDemoMode]    = useState(false)
  const [authLoading, setAuthLoading]   = useState(true)   // true during initial session restore
  const [authError,   setAuthError]     = useState(null)

  // ── Restore session on mount ────────────────────────────────────────────────────────────────
  // The browser sends the httpOnly taxlift_access cookie automatically.
  // If it's valid, /me succeeds and we restore state. If expired, api.js auto-refreshes via
  // the taxlift_refresh cookie. If both are expired, the call fails silently → no session.
  useEffect(() => {
    // Safety timeout: if the server takes > 12 s (Railway cold start), stop
    // blocking the UI so the user at least sees the login page instead of
    // a blank white screen.
    const timeout = setTimeout(() => setAuthLoading(false), 12_000)
    authApi.me()
      .then(me => {
        setCurrentUser(shapeBackendUser(me))
        setIsDemoMode(false)
      })
      .catch(() => {
        // Cookie expired / not present — start unauthenticated
      })
      .finally(() => {
        clearTimeout(timeout)
        setAuthLoading(false)
      })
    return () => clearTimeout(timeout)
  }, [])

  // ── Global unauthorized event — fired by api.js when both tokens expire ───────
  // Clears local state so the UI drops to the login page.
  useEffect(() => {
    function handleUnauthorized() {
      setCurrentUser(null)
      setIsDemoMode(false)
    }
    window.addEventListener('taxlift:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('taxlift:unauthorized', handleUnauthorized)
  }, [])

  // ── Real login ──────────────────────────────────────────────────────────────────────────────
  // Server sets httpOnly cookies on successful login; no token handling needed here.
  const loginWithCredentials = useCallback(async (email, password) => {
    setAuthError(null)
    try {
      await authApi.login(email, password)
      // Cookies are now set by the server — fetch fresh user state
      const me = await authApi.me()
      const shaped = shapeBackendUser(me)
      setCurrentUser(shaped)
      setIsDemoMode(false)
      return { ok: true, onboarding_completed: shaped.onboarding_completed }
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : 'Unable to connect to the server.'
      setAuthError(msg)
      return { ok: false, error: msg }
    }
  }, [])

  // ── Register new account ──────────────────────────────────────────────────────────────────────
  // Server sets httpOnly cookies on successful register; no token handling needed here.
  const register = useCallback(async ({ email, password, full_name = '', firm_name = '' }) => {
    setAuthError(null)
    try {
      await authApi.register({ email, password, full_name, firm_name })
      // Cookies are now set by the server — fetch fresh user state
      const me = await authApi.me()
      const shaped = shapeBackendUser(me)
      setCurrentUser(shaped)
      setIsDemoMode(false)
      return { ok: true, user: shaped }
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : 'Unable to connect to the server.'
      setAuthError(msg)
      return { ok: false, error: msg }
    }
  }, [])

  // ── Demo / mock login ─────────────────────────────────────────────────────────────────
  const loginDemo = useCallback((userId) => {
    const raw = USERS.find(u => u.id === userId)
    if (raw) {
      // Shape the mock user so all UI components get the same fields they expect
      // from a real backend user (name, subscription_tier, onboarding_completed, etc.)
      setCurrentUser({
        ...raw,
        name:                 raw.display_name ?? raw.email,
        subscription_tier:    'starter',   // give demo users full feature access
        onboarding_completed: true,
        _fromApi:             false,
      })
      setIsDemoMode(true)
      setAuthError(null)
    }
  }, [])

  // ── Logout ────────────────────────────────────────────────────────────────────────────────────
  // Calls the server to clear httpOnly cookies and invalidate the refresh token in the DB.
  // Then clears local state regardless of server response (best-effort cookie invalidation).
  const logout = useCallback(async () => {
    if (!isDemoMode) {
      try { await authApi.logout() } catch { /* ignore — cookies expire naturally */ }
    }
    setCurrentUser(null)
    setIsDemoMode(false)
    setAuthError(null)
  }, [isDemoMode])

  // ── Refresh current user from /me ────────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.me()
      setCurrentUser(shapeBackendUser(me))
    } catch { /* ignore — token may have expired */ }
  }, [])

  // ── CPA demo login (Blocker 1 fix) ───────────────────────────────────────────
  const loginCpaDemo = useCallback(() => {
    setCurrentUser(CPA_DEMO_PERSONA)
    setIsDemoMode(true)
    setAuthError(null)
  }, [])

  // Legacy shim — kept so any older call-site using login(userId) still works
  const login = loginDemo

  return (
    <AuthContext.Provider value={{
      currentUser,
      isDemoMode,
      authLoading,
      authError,
      login,            // legacy demo shim
      loginDemo,
      loginCpaDemo,     // CPA-specific demo login
      loginWithCredentials,
      register,
      refreshUser,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
