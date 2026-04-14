/**
 * planLimits.js — Server-side plan enforcement middleware
 *
 * Prevents free-tier users from accessing paid features regardless of
 * what the frontend shows. The frontend gates are UX; this is the real guard.
 *
 * Plans:
 *   free     — 3 clusters max, read-only reports (no export/download),
 *              no grants module, no CPA portal, no audit-readiness export
 *   starter  — 25 clusters, report export, no grants module
 *   plus     — unlimited clusters, all features
 *   (any other value treated as free)
 *
 * Usage in routes:
 *   const { requirePlan, requireClusterQuota } = require('../middleware/planLimits')
 *
 *   router.post('/', requireAuth, requireClusterQuota, createCluster)
 *   router.get('/export', requireAuth, requirePlan('starter'), exportReport)
 *   router.get('/grants', requireAuth, requirePlan('plus'), getGrants)
 */

const db = require('../db')

// ── Plan hierarchy ────────────────────────────────────────────────────────────
const PLAN_RANK = { free: 0, starter: 1, plus: 2, enterprise: 3 }

function planRank(tier) {
  return PLAN_RANK[tier] ?? 0
}

// ── Cluster limits per plan ───────────────────────────────────────────────────
const CLUSTER_LIMITS = { free: 3, starter: 25, plus: Infinity, enterprise: Infinity }

function clusterLimit(tier) {
  return CLUSTER_LIMITS[tier] ?? 3
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTier(req) {
  // requireAuth must have run first — tier is on req.user
  return req.user?.subscription_tier ?? 'free'
}

function upgradePayload(requiredPlan, currentTier) {
  return {
    error:         'plan_required',
    message:       `This feature requires the ${requiredPlan} plan or higher.`,
    current_plan:  currentTier,
    required_plan: requiredPlan,
    upgrade_url:   '/pricing',
  }
}

// ── requirePlan(minimumPlan) ──────────────────────────────────────────────────
// Returns middleware that blocks unless user's plan >= minimumPlan.
//
// Example: requirePlan('starter') blocks free users.
//          requirePlan('plus') blocks free + starter users.

function requirePlan(minimumPlan) {
  return function planGuard(req, res, next) {
    const tier = getTier(req)
    if (planRank(tier) >= planRank(minimumPlan)) return next()
    return res.status(402).json(upgradePayload(minimumPlan, tier))
  }
}

// ── requireClusterQuota ───────────────────────────────────────────────────────
// Blocks cluster creation (POST) when the tenant has hit their plan limit.
// Only applies to POST — GET/PUT/DELETE pass through unconditionally.

function requireClusterQuota(req, res, next) {
  if (req.method !== 'POST') return next()

  const tenantId = req.user?.tenant_id
  const tier     = getTier(req)
  const limit    = clusterLimit(tier)

  if (limit === Infinity) return next()

  try {
    // Count active clusters for this tenant across all their clients
    const { count } = db.prepare(`
      SELECT COUNT(*) AS count
      FROM   clusters cl
      JOIN   clients  c ON cl.client_id = c.id
      WHERE  c.tenant_id = ?
        AND  cl.status NOT IN ('Archived', 'Rejected')
    `).get(tenantId) ?? { count: 0 }

    if (count >= limit) {
      return res.status(402).json({
        error:         'cluster_quota_exceeded',
        message:       `Your ${tier} plan allows up to ${limit} active clusters. Upgrade to add more.`,
        current_count: count,
        limit,
        current_plan:  tier,
        upgrade_url:   '/pricing',
      })
    }
  } catch (err) {
    console.error('[planLimits] quota check failed:', err.message)
    // On DB error, fail open (don't block the user — log and continue)
  }

  next()
}

// ── requireExportAccess ───────────────────────────────────────────────────────
// Blocks report/document export on free plan.
// Use on any GET endpoint that triggers a file download.

const requireExportAccess = requirePlan('starter')

// ── requireGrantsAccess ───────────────────────────────────────────────────────
// Blocks the grants module on free + starter plans.

const requireGrantsAccess = requirePlan('plus')

// ── injectPlanInfo ────────────────────────────────────────────────────────────
// Non-blocking middleware that attaches plan metadata to req for use in handlers.
// Useful for returning plan-aware responses without hard-blocking.

function injectPlanInfo(req, _res, next) {
  const tier = getTier(req)
  req.plan = {
    tier,
    rank:            planRank(tier),
    clusterLimit:    clusterLimit(tier),
    canExport:       planRank(tier) >= planRank('starter'),
    canAccessGrants: planRank(tier) >= planRank('plus'),
  }
  next()
}

module.exports = {
  requirePlan,
  requireClusterQuota,
  requireExportAccess,
  requireGrantsAccess,
  injectPlanInfo,
}
