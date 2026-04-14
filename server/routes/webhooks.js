/**
 * Webhook routes — CI/CD build run ingestion
 *
 * Pattern A  POST /api/v1/webhooks/github
 *   Receives GitHub App `workflow_run` events (HMAC-SHA256 verified).
 *   Inserts a build_run row and attributes it to an SR&ED cluster when
 *   the commit SHA matches evidence in the tenant's cluster set.
 *
 * Pattern C  POST /api/v1/webhooks/ci
 *   Generic endpoint for the taxlift-ci CLI agent (any CI system).
 *   Authenticated by a per-tenant API token (X-TaxLift-Token header).
 *
 * GET /api/v1/webhooks/build-runs
 *   Returns build runs for the logged-in tenant (paginated).
 *
 * Environment variables:
 *   GITHUB_WEBHOOK_SECRET   — secret set in the GitHub App webhook config
 *                             (generate with: openssl rand -hex 32)
 */

const router  = require('express').Router()
const crypto  = require('crypto')
const { v4: uuid } = require('../utils/uuid')
const db      = require('../db')
const { requireAuth } = require('../middleware/auth')

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Verify GitHub's X-Hub-Signature-256 header.
 * GitHub sends  sha256=<hex>  using HMAC-SHA256 over the raw request body.
 * We compare with a timing-safe equality check to prevent timing attacks.
 */
function verifyGitHubSignature(rawBody, signatureHeader) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    // If no secret is configured, skip verification in dev mode only
    if (process.env.NODE_ENV !== 'production') return true
    return false
  }
  if (!signatureHeader) return false

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signatureHeader, 'utf8')
    )
  } catch {
    return false
  }
}

/**
 * Verify a per-tenant CI token from X-TaxLift-Token header.
 * Tokens are stored in the integrations table under config_json.ci_token.
 * Returns { tenantId } on success, null on failure.
 */
function verifyCIToken(tokenHeader) {
  if (!tokenHeader) return null
  try {
    const row = db.prepare(`
      SELECT tenant_id
      FROM   integrations
      WHERE  provider = 'ci_agent'
        AND  JSON_EXTRACT(config_json, '$.ci_token') = ?
        AND  active = 1
      LIMIT 1
    `).get(tokenHeader)
    return row ? { tenantId: row.tenant_id } : null
  } catch {
    return null
  }
}

/**
 * Attempt to link a build run to an SR&ED cluster.
 * Strategy:
 *   1. Look for a cluster whose evidence_snapshot commits include this SHA.
 *   2. Fall back to branch-name pattern match (experimental/, spike/, feature/).
 * Returns cluster_id string or null.
 */
function attributeToCluster(tenantId, commitSha, branch) {
  if (!tenantId) return null

  // Try exact commit SHA match in clusters that belong to this tenant's clients
  if (commitSha) {
    try {
      const row = db.prepare(`
        SELECT cl.id
        FROM   clusters cl
        JOIN   clients  c  ON cl.client_id = c.id
        WHERE  c.tenant_id = ?
          AND  cl.status NOT IN ('Archived', 'Rejected')
        LIMIT 50
      `).all(tenantId)

      // For now clusters don't store commit SHAs directly — return first active
      // cluster when branch pattern matches (Phase 2 will add evidence_commits table)
      if (row.length > 0 && branch && /^(experimental|spike|feature|research|poc)\//.test(branch)) {
        return row[0].id
      }
    } catch {
      /* ignore — cluster attribution is best-effort */
    }
  }
  return null
}

/**
 * Score SR&ED eligibility for a build run.
 * High confidence signals: experimental branch, failed/flaky builds,
 * long duration (>10 min), explicit test_failed > 0.
 * Returns 1 (eligible) or 0 (not eligible).
 */
function scoreSREDEligibility({ branch, status, durationSeconds, testFailed }) {
  // Explicit experimental branch naming convention
  if (branch && /^(experimental|spike|research|poc)\//.test(branch)) return 1
  // Failed builds indicate technological uncertainty (core SR&ED criterion)
  if (status === 'failure' || status === 'failed') return 1
  // Long builds (>12 min) in feature branches often contain R&D work
  if (durationSeconds > 720 && branch && /^feature\//.test(branch)) return 1
  // Tests that fail signal iteration on hard problems
  if (testFailed && testFailed > 0) return 1
  return 0
}

// ── Pattern A — GitHub workflow_run webhook ───────────────────────────────────

router.post('/github', (req, res) => {
  // index.js mounts express.raw() for this path so req.rawBody is the original
  // bytes exactly as GitHub signed them. Never re-serialize req.body — JSON
  // serialisation changes whitespace/key order and breaks the HMAC.
  const rawBody   = req.rawBody   // Buffer set by stripeBodyStash in index.js
  const sigHeader = req.headers['x-hub-signature-256']

  if (!rawBody) {
    console.error('[webhooks/github] rawBody missing — check index.js middleware order')
    return res.status(500).json({ error: 'Raw body not captured' })
  }
  const event     = req.headers['x-github-event']

  if (!verifyGitHubSignature(rawBody, sigHeader)) {
    return res.status(401).json({ error: 'Invalid webhook signature' })
  }

  // We only care about workflow_run events
  if (event !== 'workflow_run') {
    return res.status(200).json({ ok: true, skipped: true, reason: `event=${event} ignored` })
  }

  // express.raw() gives us a Buffer in req.body — parse it now that HMAC is verified
  let payload
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' })
  }
  const run = payload.workflow_run

  if (!run) {
    return res.status(400).json({ error: 'Missing workflow_run in payload' })
  }

  // Only process completed runs
  if (run.status !== 'completed') {
    return res.status(200).json({ ok: true, skipped: true, reason: 'run not completed yet' })
  }

  // Determine tenant from GitHub installation ID or repository full_name
  // We look up the integration row matching this GitHub App installation
  let tenantId = null
  try {
    const installationId = String(payload.installation?.id || '')
    const repoFullName   = run.repository?.full_name || ''

    const intRow = db.prepare(`
      SELECT tenant_id
      FROM   integrations
      WHERE  provider = 'github'
        AND  (
          JSON_EXTRACT(config_json, '$.installation_id') = ?
          OR JSON_EXTRACT(config_json, '$.repo') = ?
        )
        AND  active = 1
      LIMIT 1
    `).get(installationId, repoFullName)

    tenantId = intRow?.tenant_id || null
  } catch {
    /* ignore lookup errors */
  }

  if (!tenantId) {
    // No matching integration — accept but don't store (unknown tenant)
    return res.status(200).json({ ok: true, skipped: true, reason: 'no matching tenant integration' })
  }

  // Extract run metadata
  const commitSha      = run.head_sha || null
  const branch         = run.head_branch || null
  const startedAt      = run.run_started_at || new Date().toISOString()
  const finishedAt     = run.updated_at || new Date().toISOString()
  const durationMs     = startedAt && finishedAt
    ? new Date(finishedAt) - new Date(startedAt)
    : 0
  const durationSec    = Math.max(0, Math.round(durationMs / 1000))
  const status         = run.conclusion || run.status || 'unknown'
  const workflowName   = run.name || run.workflow_id?.toString() || 'unknown'
  const triggeredBy    = run.triggering_actor?.login || run.actor?.login || null
  const repo           = run.repository?.full_name || null

  // Parse jobs (GitHub sends a jobs_url but not the job list in workflow_run)
  // We capture what's available in the payload; detailed job data comes via
  // the GitHub App jobs webhook (separate event, future enhancement).
  const jobsJson = JSON.stringify([])

  // Aggregate test counts from any check suites in the payload
  const testPassed  = null
  const testFailed  = null
  const testSkipped = null

  const isExperimental = branch && /^(experimental|spike|research|poc)\//.test(branch) ? 1 : 0
  const clusterId      = attributeToCluster(tenantId, commitSha, branch)
  const sredEligible   = scoreSREDEligibility({
    branch, status, durationSeconds: durationSec, testFailed
  })

  const runId = `brun-gh-${uuid().slice(0, 8)}`

  try {
    db.prepare(`
      INSERT OR IGNORE INTO build_runs
        (id, tenant_id, cluster_id, provider, repo, branch, commit_sha,
         triggered_by, workflow_name, started_at, finished_at,
         duration_seconds, status, is_experimental,
         jobs_json, test_passed, test_failed, test_skipped, sred_eligible)
      VALUES
        (?, ?, ?, 'github', ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?, ?, ?)
    `).run(
      runId, tenantId, clusterId, repo, branch, commitSha,
      triggeredBy, workflowName, startedAt, finishedAt,
      durationSec, status, isExperimental,
      jobsJson, testPassed, testFailed, testSkipped, sredEligible
    )
  } catch (err) {
    console.error('[webhooks/github] DB insert failed:', err.message)
    return res.status(500).json({ error: 'Failed to record build run' })
  }

  console.log(`[webhooks/github] Recorded run ${runId} — tenant=${tenantId} cluster=${clusterId} sred=${sredEligible}`)
  return res.status(200).json({
    ok:           true,
    build_run_id: runId,
    tenant_id:    tenantId,
    cluster_id:   clusterId,
    sred_eligible: !!sredEligible,
  })
})

// ── Pattern C — Generic CI agent endpoint ────────────────────────────────────

router.post('/ci', (req, res) => {
  const token = req.headers['x-taxlift-token']
  const auth  = verifyCIToken(token)

  if (!auth) {
    return res.status(401).json({ error: 'Invalid or missing X-TaxLift-Token' })
  }

  const { tenantId } = auth

  // Expected body fields (all optional except provider + started_at):
  // {
  //   provider:         'github' | 'jenkins' | 'circleci' | 'gitlab' | 'bitbucket' | ...
  //   repo:             'org/repo'
  //   branch:           'feature/my-feature'
  //   commit_sha:       'abc1234...'
  //   workflow_name:    'CI Pipeline'
  //   triggered_by:     'username'
  //   started_at:       ISO8601
  //   finished_at:      ISO8601
  //   duration_seconds: 420
  //   status:           'success' | 'failure' | 'cancelled' | 'skipped'
  //   test_passed:      42
  //   test_failed:      3
  //   test_skipped:     1
  //   jobs:             [{ name, status, duration_seconds }]   ← optional
  // }

  const {
    provider        = 'unknown',
    repo            = null,
    branch          = null,
    commit_sha      = null,
    workflow_name   = null,
    triggered_by    = null,
    started_at,
    finished_at     = null,
    duration_seconds,
    status          = 'unknown',
    test_passed     = null,
    test_failed     = null,
    test_skipped    = null,
    jobs            = [],
  } = req.body

  if (!started_at) {
    return res.status(400).json({ error: 'started_at is required' })
  }

  // Derive duration if not explicitly provided
  let durationSec = duration_seconds != null ? Number(duration_seconds) : 0
  if (!durationSec && started_at && finished_at) {
    durationSec = Math.max(0, Math.round((new Date(finished_at) - new Date(started_at)) / 1000))
  }

  const isExperimental = branch && /^(experimental|spike|research|poc)\//.test(branch) ? 1 : 0
  const clusterId      = attributeToCluster(tenantId, commit_sha, branch)
  const sredEligible   = scoreSREDEligibility({
    branch, status, durationSeconds: durationSec, testFailed: test_failed
  })

  const runId    = `brun-ci-${uuid().slice(0, 8)}`
  const jobsJson = JSON.stringify(Array.isArray(jobs) ? jobs : [])

  try {
    db.prepare(`
      INSERT OR IGNORE INTO build_runs
        (id, tenant_id, cluster_id, provider, repo, branch, commit_sha,
         triggered_by, workflow_name, started_at, finished_at,
         duration_seconds, status, is_experimental,
         jobs_json, test_passed, test_failed, test_skipped, sred_eligible)
      VALUES
        (?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?, ?, ?)
    `).run(
      runId, tenantId, clusterId, provider, repo, branch, commit_sha,
      triggered_by, workflow_name, started_at, finished_at,
      durationSec, status, isExperimental,
      jobsJson, test_passed, test_failed, test_skipped, sredEligible
    )
  } catch (err) {
    console.error('[webhooks/ci] DB insert failed:', err.message)
    return res.status(500).json({ error: 'Failed to record build run' })
  }

  console.log(`[webhooks/ci] Recorded run ${runId} — tenant=${tenantId} provider=${provider} sred=${sredEligible}`)
  return res.status(200).json({
    ok:           true,
    build_run_id: runId,
    tenant_id:    tenantId,
    cluster_id:   clusterId,
    sred_eligible: !!sredEligible,
  })
})

// ── GET /api/v1/webhooks/build-runs (authenticated) ──────────────────────────
// Returns build runs for the logged-in tenant, most recent first.
// Query params: limit (default 50), offset (default 0), cluster_id (optional filter)

router.get('/build-runs', requireAuth, (req, res) => {
  const tenantId  = req.user?.tenant_id
  if (!tenantId) return res.status(401).json({ error: 'Unauthorized' })

  const limit     = Math.min(Number(req.query.limit)  || 50, 200)
  const offset    = Number(req.query.offset) || 0
  const clusterId = req.query.cluster_id || null

  try {
    let sql = `
      SELECT
        br.*,
        cl.name AS cluster_name
      FROM build_runs br
      LEFT JOIN clusters cl ON br.cluster_id = cl.id
      WHERE br.tenant_id = ?
    `
    const params = [tenantId]

    if (clusterId) {
      sql += ' AND br.cluster_id = ?'
      params.push(clusterId)
    }

    sql += ' ORDER BY br.started_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const rows = db.prepare(sql).all(...params)

    // Parse jobs_json for each row
    const runs = rows.map(r => ({
      ...r,
      jobs:           tryParseJSON(r.jobs_json, []),
      is_experimental: !!r.is_experimental,
      sred_eligible:   !!r.sred_eligible,
    }))

    // Total count for pagination
    let countSql = 'SELECT COUNT(*) AS total FROM build_runs WHERE tenant_id = ?'
    const countParams = [tenantId]
    if (clusterId) {
      countSql += ' AND cluster_id = ?'
      countParams.push(clusterId)
    }
    const { total } = db.prepare(countSql).get(...countParams)

    return res.json({ runs, total, limit, offset })
  } catch (err) {
    console.error('[webhooks/build-runs] Query failed:', err.message)
    return res.status(500).json({ error: 'Failed to fetch build runs' })
  }
})

// ── Generate / rotate CI token for a tenant ──────────────────────────────────
// POST /api/v1/webhooks/ci-token  (requires admin role)
// Creates or updates the ci_agent integration row with a fresh random token.

router.post('/ci-token', requireAuth, (req, res) => {
  const tenantId = req.user?.tenant_id
  const role     = req.user?.role

  if (!tenantId) return res.status(401).json({ error: 'Unauthorized' })
  if (!['Admin', 'Reviewer'].includes(role)) {
    return res.status(403).json({ error: 'Admin or Reviewer role required' })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const now   = new Date().toISOString()

  try {
    // Upsert the ci_agent integration row
    const existing = db.prepare(`
      SELECT id FROM integrations
      WHERE tenant_id = ? AND provider = 'ci_agent'
      LIMIT 1
    `).get(tenantId)

    if (existing) {
      db.prepare(`
        UPDATE integrations
        SET config_json = JSON_SET(config_json, '$.ci_token', ?),
            active      = 1,
            updated_at  = ?
        WHERE id = ?
      `).run(token, now, existing.id)
    } else {
      db.prepare(`
        INSERT INTO integrations (id, tenant_id, provider, config_json, active, created_at, updated_at)
        VALUES (?, ?, 'ci_agent', ?, 1, ?, ?)
      `).run(`int-ci-${uuid().slice(0, 8)}`, tenantId, JSON.stringify({ ci_token: token }), now, now)
    }

    return res.json({ ok: true, ci_token: token })
  } catch (err) {
    console.error('[webhooks/ci-token] Failed:', err.message)
    return res.status(500).json({ error: 'Failed to create CI token' })
  }
})

// ── Utility ───────────────────────────────────────────────────────────────────

function tryParseJSON(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}

module.exports = router
