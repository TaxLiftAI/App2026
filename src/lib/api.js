/**
 * TaxLift API Client
 *
 * Thin fetch wrapper that:
 *  - Reads base URL from VITE_API_URL (defaults to http://localhost:3001)
 *  - Injects Authorization: Bearer <token> from localStorage on every request
 *  - Handles 401 → dispatches global 'taxlift:unauthorized' event
 *  - Returns parsed JSON or throws a structured ApiError
 *  - Falls back gracefully when the backend is unreachable
 *
 * Mock-data fallback:
 *  If VITE_API_URL is not set AND a request fails with a network error,
 *  the calling code should catch ApiError with status === 0 and use
 *  the local mockData instead.  See hooks.js and CPAPortalPage for examples.
 */

export const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '')

const TOKEN_KEY = 'taxlift_access_token'

// ── Token helpers ─────────────────────────────────────────────────────────────
export const token = {
  get:   ()    => localStorage.getItem(TOKEN_KEY),
  set:   (t)   => localStorage.setItem(TOKEN_KEY, t),
  clear: ()    => localStorage.removeItem(TOKEN_KEY),
}

// ── Structured error ──────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(status, message, detail) {
    super(message)
    this.name   = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function request(method, path, { body, params, isForm = false } = {}) {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
  }

  const headers = {}
  const t = token.get()
  if (t) headers['Authorization'] = `Bearer ${t}`
  if (body && !isForm) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    // Network error — backend unreachable; caller should fall back to mock data
    throw new ApiError(0, 'Network error — backend unreachable', err.message)
  }

  if (res.status === 401) {
    token.clear()
    window.dispatchEvent(new CustomEvent('taxlift:unauthorized'))
    throw new ApiError(401, 'Unauthorized — please log in again')
  }

  const ct = res.headers.get('content-type') ?? ''
  const data = ct.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) {
    const msg = (typeof data === 'object' ? data?.message ?? data?.detail : data) ?? `HTTP ${res.status}`
    throw new ApiError(res.status, msg, data)
  }

  return data
}

const get  = (path, opts) => request('GET',    path, opts)
const post = (path, opts) => request('POST',   path, opts)
const put  = (path, opts) => request('PUT',    path, opts)
const del  = (path, opts) => request('DELETE', path, opts)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  /**
   * login — supports both JSON body and OAuth2 form-encoded.
   * Express backend accepts either.
   */
  login: (email, password) =>
    post('/api/auth/login', { body: { email, password } }),

  register: (payload) =>
    post('/api/auth/register', { body: payload }),

  me: () => get('/api/auth/me'),

  changePassword: (payload) =>
    post('/api/auth/change-password', { body: payload }),
}

// ── Clients (CPA portal) ──────────────────────────────────────────────────────
export const clients = {
  list:   (params)        => get('/api/clients',     { params }),
  get:    (id)            => get(`/api/clients/${id}`),
  create: (payload)       => post('/api/clients',    { body: payload }),
  update: (id, payload)   => put(`/api/clients/${id}`, { body: payload }),
  delete: (id)            => del(`/api/clients/${id}`),
}

// ── Clusters ──────────────────────────────────────────────────────────────────
export const clusters = {
  list:   (params)        => get('/api/clusters',     { params }),
  get:    (id)            => get(`/api/clusters/${id}`),
  create: (payload)       => post('/api/clusters',   { body: payload }),
  update: (id, payload)   => put(`/api/clusters/${id}`, { body: payload }),
  delete: (id)            => del(`/api/clusters/${id}`),
}

// ── Referrals ─────────────────────────────────────────────────────────────────
export const referrals = {
  list:   (params)        => get('/api/referrals',      { params }),
  stats:  ()              => get('/api/referrals/stats'),
  get:    (id)            => get(`/api/referrals/${id}`),
  create: (payload)       => post('/api/referrals',     { body: payload }),
  update: (id, payload)   => put(`/api/referrals/${id}`, { body: payload }),
}

// ── Billing / Stripe ──────────────────────────────────────────────────────────
export const billing = {
  createCheckoutSession: (plan, successUrl, cancelUrl) =>
    post('/api/billing/create-checkout-session', { body: { plan, successUrl, cancelUrl } }),
  subscription: () => get('/api/billing/subscription'),
}

// ── Leads ─────────────────────────────────────────────────────────────────────
export const leads = {
  capture: (payload) => post('/api/leads', { body: payload }),
  list:    (params)  => get('/api/leads',   { params }),
  export:  ()        => `${BASE_URL}/api/leads/export`, // returns URL for direct link
}

// ── Integrations ──────────────────────────────────────────────────────────────
export const integrations = {
  list: () => get('/api/integrations'),
}

// ── OAuth proxy ───────────────────────────────────────────────────────────────
export const oauthProxy = {
  githubCallback:     (code, state) => get('/api/oauth/github/callback',    { params: { code, state } }),
  atlassianCallback:  (code, state) => get('/api/oauth/atlassian/callback', { params: { code, state } }),
  githubUser:         (ghToken)     => get('/api/oauth/github/user',        { params: {} }),
  githubRepos:        (ghToken)     => get('/api/oauth/github/repos'),
  githubCommits:      (repo, page)  => get('/api/oauth/github/commits',     { params: { repo, page } }),
  atlassianResources: ()            => get('/api/oauth/atlassian/resources'),
  atlassianIssues:    (cloudId, projectKey) =>
    get('/api/oauth/atlassian/issues', { params: { cloudId, projectKey } }),
}

// ── Grants ────────────────────────────────────────────────────────────────────
export const grants = {
  /** Run eligibility matching for authenticated company (cached 30 days) */
  eligibility: (forceRefresh = false) =>
    get('/api/grants/eligibility', forceRefresh ? { params: { refresh: 'true' } } : undefined),

  /** Get gap fill interview answers */
  getGapAnswers: () => get('/api/grants/gap-answers'),

  /** Save gap fill interview answers */
  saveGapAnswers: (payload) => post('/api/grants/gap-answers', { body: payload }),

  /** List all grant applications for authenticated user */
  listApplications: () => get('/api/grants/applications'),

  /** Create a new grant application */
  createApplication: (payload) => post('/api/grants/applications', { body: payload }),

  /** Get a specific application with its sections */
  getApplication: (id) => get(`/api/grants/applications/${id}`),

  /** Trigger section generation pipeline */
  triggerGeneration: (id) => post(`/api/grants/applications/${id}/generate`),

  /** Poll generation progress */
  getGenerationStatus: (id) => get(`/api/grants/applications/${id}/status`),

  /** Approve a single section */
  approveSection: (sectionId) =>
    request('PATCH', `/api/grants/sections/${sectionId}/approve`),

  /** Regenerate a section with optional feedback */
  regenerateSection: (sectionId, feedbackNote = '') =>
    post(`/api/grants/sections/${sectionId}/regenerate`, { body: { feedback_note: feedbackNote } }),

  /** Get export data for an application */
  exportApplication: (id) => post(`/api/grants/applications/${id}/export`),

  /** Update application status / tracking fields */
  updateApplication: (id, payload) =>
    request('PATCH', `/api/grants/applications/${id}`, { body: payload }),

  /** Get SR&ED context for authenticated user */
  getSredContext: () => get('/api/grants/sred-context'),

  /** Get grants directory */
  directory: () => get('/api/grants/directory'),
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const admin = {
  funnel:       ()        => get('/api/admin/funnel'),
  triggerDrip:  (payload) => post('/api/admin/drip/trigger', { body: payload }),
}

// ── Health ────────────────────────────────────────────────────────────────────
export const health = {
  check: () => get('/health'),
}

// ── isReachable — used by pages to decide mock vs real data ──────────────────
let _reachableCache = null
let _reachableAt    = 0

export async function isServerReachable() {
  // Cache for 10 seconds to avoid hammering the health endpoint
  if (_reachableCache !== null && Date.now() - _reachableAt < 10_000) {
    return _reachableCache
  }
  try {
    await health.check()
    _reachableCache = true
  } catch {
    _reachableCache = false
  }
  _reachableAt = Date.now()
  return _reachableCache
}

export default { auth, clients, clusters, referrals, billing, leads, integrations, oauthProxy, health, grants, token, isServerReachable }
