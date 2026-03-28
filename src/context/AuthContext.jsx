/**
 * AuthContext — supports two login modes:
 *
 *  1. Real mode   — email + password → POST /auth/login → JWT stored in localStorage
 *                   On mount, reads existing token and calls /auth/me to restore session.
 *
 *  2. Demo mode   — select a mock persona; no network required.
 *                   Falls back automatically when the API is unreachable.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { USERS } from '../data/mockData'
import { auth as authApi, token as tokenStore, ApiError } from '../lib/api'

const AuthContext = createContext(null)

// ─── Demo personas ────────────────────────────────────────────────────────────
export const DEMO_PERSONAS = [
  { label: 'Sarah Chen — Admin',     userId: 'u-001', role: 'Admin'    },
  { label: 'Marcus Reid — Reviewer', userId: 'u-002', role: 'Reviewer' },
  { label: 'Jordan Kim — Developer', userId: 'u-003', role: 'Developer'},
  { label: 'David Okafor — Auditor', userId: 'u-005', role: 'Auditor'  },
]

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
    name:                 me.full_name ?? me.email,
    email:                me.email,
    role:                 normaliseRole(me.role),
    tenant_id:            me.tenant_id,
    avatar:               me.avatar ?? null,
    // SQLite returns 0/1 integers; coerce to boolean
    onboarding_completed: me.onboarding_completed === 1 || me.onboarding_completed === true,
    _fromApi:             true,
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser]   = useState(null)
  const [isDemoMode,  setIsDemoMode]    = useState(false)
  const [authLoading, setAuthLoading]   = useState(true)   // true during initial session restore
  const [authError,   setAuthError]     = useState(null)

  // ── Restore session from stored JWT on mount ──────────────────────────────
  useEffect(() => {
    const stored = tokenStore.get()
    if (!stored) {
      setAuthLoading(false)
      return
    }
    authApi.me()
      .then(me => {
        setCurrentUser(shapeBackendUser(me))
        setIsDemoMode(false)
      })
      .catch(() => {
        // Token expired or backend unreachable — clear token silently
        tokenStore.clear()
      })
      .finally(() => setAuthLoading(false))
  }, [])

  // ── Real login ────────────────────────────────────────────────────────────
  const loginWithCredentials = useCallback(async (email, password) => {
    setAuthError(null)
    try {
      const data = await authApi.login(email, password)
      tokenStore.set(data.access_token)
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

  // ── Register new account ──────────────────────────────────────────────────
  const register = useCallback(async ({ email, password, full_name = '', firm_name = '' }) => {
    setAuthError(null)
    try {
      const data = await authApi.register({ email, password, full_name, firm_name })
      tokenStore.set(data.access_token)
      const me = await authApi.me()
      setCurrentUser(shapeBackendUser(me))
      setIsDemoMode(false)
      return { ok: true, user: shapeBackendUser(me) }
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : 'Unable to connect to the server.'
      setAuthError(msg)
      return { ok: false, error: msg }
    }
  }, [])

  // ── Demo / mock login ─────────────────────────────────────────────────────
  const loginDemo = useCallback((userId) => {
    const user = USERS.find(u => u.id === userId)
    if (user) {
      tokenStore.clear()
      setCurrentUser(user)
      setIsDemoMode(true)
      setAuthError(null)
    }
  }, [])

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    tokenStore.clear()
    setCurrentUser(null)
    setIsDemoMode(false)
    setAuthError(null)
  }, [])

  // ── Refresh current user from /me ────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.me()
      setCurrentUser(shapeBackendUser(me))
    } catch { /* ignore — token may have expired */ }
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
