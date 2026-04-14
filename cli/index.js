#!/usr/bin/env node
/**
 * taxlift-ci  — TaxLift CI/CD build run agent
 *
 * Usage (add as a step in any CI pipeline):
 *
 *   npx taxlift-ci
 *
 * Required environment variables:
 *   TAXLIFT_TOKEN   — per-tenant API token (from TaxLift → Integrations → CI Token)
 *
 * Optional environment variables (auto-detected from popular CI platforms):
 *   TAXLIFT_API_URL — override API base (default: https://app2026-production.up.railway.app)
 *
 * The agent auto-detects the CI platform and reads:
 *   • commit SHA, branch, workflow/job name, start time, duration
 *   • test results (if TAXLIFT_TEST_PASSED / TAXLIFT_TEST_FAILED are set)
 *
 * Supported CI platforms (auto-detected):
 *   GitHub Actions, GitLab CI, CircleCI, Jenkins, Bitbucket Pipelines,
 *   Travis CI, Buildkite, Azure DevOps, Drone CI
 *
 * Exit codes:
 *   0 — success (build run recorded or --dry-run)
 *   1 — fatal error (missing token, network failure in non-optional mode)
 *
 * Flags:
 *   --dry-run     Print detected metadata without sending to TaxLift
 *   --optional    Exit 0 even on failure (useful to avoid blocking CI)
 *   --verbose     Print extra debugging output
 */

'use strict'

const https   = require('https')
const http    = require('http')
const { URL } = require('url')

// ── CLI flags ─────────────────────────────────────────────────────────────────

const args      = process.argv.slice(2)
const DRY_RUN   = args.includes('--dry-run')
const OPTIONAL  = args.includes('--optional')
const VERBOSE   = args.includes('--verbose')

function log(...msg)  { console.log('[taxlift-ci]', ...msg) }
function debug(...msg) { if (VERBOSE) console.log('[taxlift-ci][debug]', ...msg) }
function warn(...msg)  { console.warn('[taxlift-ci][warn]', ...msg) }

function exit(code, msg) {
  if (msg) (code === 0 ? log : warn)(msg)
  process.exit(OPTIONAL ? 0 : code)
}

// ── CI platform detection ─────────────────────────────────────────────────────

/**
 * Returns a normalised build metadata object regardless of CI platform.
 * All fields are strings or null — no type coercion needed.
 */
function detectCIEnvironment() {
  const env = process.env

  // ── GitHub Actions ────────────────────────────────────────────────────────
  if (env.GITHUB_ACTIONS === 'true') {
    debug('Detected: GitHub Actions')
    const startedAt   = env.GITHUB_RUN_STARTED_AT || new Date().toISOString()
    const finishedAt  = new Date().toISOString()
    const durationSec = Math.round((new Date(finishedAt) - new Date(startedAt)) / 1000)
    return {
      provider:       'github',
      repo:           env.GITHUB_REPOSITORY   || null,
      branch:         env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || null,
      commit_sha:     env.GITHUB_SHA           || null,
      workflow_name:  env.GITHUB_WORKFLOW      || null,
      triggered_by:   env.GITHUB_ACTOR         || null,
      run_id:         env.GITHUB_RUN_ID        || null,
      started_at:     startedAt,
      finished_at:    finishedAt,
      duration_seconds: durationSec,
      status:         env.TAXLIFT_STATUS       || 'success', // caller can set this
    }
  }

  // ── GitLab CI ────────────────────────────────────────────────────────────
  if (env.GITLAB_CI === 'true') {
    debug('Detected: GitLab CI')
    return {
      provider:       'gitlab',
      repo:           env.CI_PROJECT_PATH      || null,
      branch:         env.CI_COMMIT_REF_NAME   || null,
      commit_sha:     env.CI_COMMIT_SHA        || null,
      workflow_name:  env.CI_PIPELINE_NAME || env.CI_JOB_NAME || null,
      triggered_by:   env.GITLAB_USER_LOGIN    || null,
      run_id:         env.CI_PIPELINE_ID       || null,
      started_at:     env.CI_PIPELINE_CREATED_AT || new Date().toISOString(),
      finished_at:    new Date().toISOString(),
      duration_seconds: Number(env.CI_JOB_STARTED_AT
        ? Math.round((Date.now() - new Date(env.CI_JOB_STARTED_AT).getTime()) / 1000)
        : 0),
      status:         env.TAXLIFT_STATUS || 'success',
    }
  }

  // ── CircleCI ─────────────────────────────────────────────────────────────
  if (env.CIRCLECI === 'true') {
    debug('Detected: CircleCI')
    return {
      provider:       'circleci',
      repo:           `${env.CIRCLE_PROJECT_USERNAME}/${env.CIRCLE_PROJECT_REPONAME}`,
      branch:         env.CIRCLE_BRANCH        || null,
      commit_sha:     env.CIRCLE_SHA1          || null,
      workflow_name:  env.CIRCLE_WORKFLOW_NAME || null,
      triggered_by:   env.CIRCLE_USERNAME      || null,
      run_id:         env.CIRCLE_BUILD_NUM     || null,
      started_at:     new Date().toISOString(),
      finished_at:    new Date().toISOString(),
      duration_seconds: 0,
      status:         env.TAXLIFT_STATUS || 'success',
    }
  }

  // ── Jenkins ──────────────────────────────────────────────────────────────
  if (env.JENKINS_URL) {
    debug('Detected: Jenkins')
    const durationSec = env.BUILD_DURATION
      ? Math.round(Number(env.BUILD_DURATION) / 1000)
      : 0
    return {
      provider:       'jenkins',
      repo:           env.GIT_URL             || null,
      branch:         env.GIT_BRANCH          || env.BRANCH_NAME || null,
      commit_sha:     env.GIT_COMMIT          || null,
      workflow_name:  env.JOB_NAME            || null,
      triggered_by:   env.BUILD_USER          || null,
      run_id:         env.BUILD_NUMBER        || null,
      started_at:     new Date(Date.now() - durationSec * 1000).toISOString(),
      finished_at:    new Date().toISOString(),
      duration_seconds: durationSec,
      status:         env.TAXLIFT_STATUS || (env.BUILD_RESULT === 'FAILURE' ? 'failure' : 'success'),
    }
  }

  // ── Bitbucket Pipelines ───────────────────────────────────────────────────
  if (env.BITBUCKET_BUILD_NUMBER) {
    debug('Detected: Bitbucket Pipelines')
    return {
      provider:       'bitbucket',
      repo:           env.BITBUCKET_REPO_FULL_NAME || null,
      branch:         env.BITBUCKET_BRANCH         || null,
      commit_sha:     env.BITBUCKET_COMMIT         || null,
      workflow_name:  env.BITBUCKET_PIPELINE_UUID  || null,
      triggered_by:   null,
      run_id:         env.BITBUCKET_BUILD_NUMBER   || null,
      started_at:     new Date().toISOString(),
      finished_at:    new Date().toISOString(),
      duration_seconds: 0,
      status:         env.TAXLIFT_STATUS || 'success',
    }
  }

  // ── Travis CI ────────────────────────────────────────────────────────────
  if (env.TRAVIS === 'true') {
    debug('Detected: Travis CI')
    return {
      provider:       'travis',
      repo:           env.TRAVIS_REPO_SLUG     || null,
      branch:         env.TRAVIS_PULL_REQUEST_BRANCH || env.TRAVIS_BRANCH || null,
      commit_sha:     env.TRAVIS_COMMIT        || null,
      workflow_name:  `Travis build #${env.TRAVIS_BUILD_NUMBER}`,
      triggered_by:   null,
      run_id:         env.TRAVIS_BUILD_ID      || null,
      started_at:     new Date().toISOString(),
      finished_at:    new Date().toISOString(),
      duration_seconds: 0,
      status:         env.TAXLIFT_STATUS || (env.TRAVIS_TEST_RESULT === '1' ? 'failure' : 'success'),
    }
  }

  // ── Buildkite ────────────────────────────────────────────────────────────
  if (env.BUILDKITE === 'true') {
    debug('Detected: Buildkite')
    return {
      provider:       'buildkite',
      repo:           env.BUILDKITE_REPO         || null,
      branch:         env.BUILDKITE_BRANCH        || null,
      commit_sha:     env.BUILDKITE_COMMIT        || null,
      workflow_name:  env.BUILDKITE_PIPELINE_SLUG || null,
      triggered_by:   env.BUILDKITE_BUILD_CREATOR || null,
      run_id:         env.BUILDKITE_BUILD_NUMBER  || null,
      started_at:     env.BUILDKITE_TIMEOUT_IN_MINUTES
        ? new Date().toISOString()
        : new Date().toISOString(),
      finished_at:    new Date().toISOString(),
      duration_seconds: 0,
      status:         env.TAXLIFT_STATUS || 'success',
    }
  }

  // ── Azure DevOps ─────────────────────────────────────────────────────────
  if (env.TF_BUILD === 'True') {
    debug('Detected: Azure DevOps')
    return {
      provider:       'azure',
      repo:           env.BUILD_REPOSITORY_NAME   || null,
      branch:         env.BUILD_SOURCEBRANCH?.replace('refs/heads/', '') || null,
      commit_sha:     env.BUILD_SOURCEVERSION      || null,
      workflow_name:  env.BUILD_DEFINITIONNAME     || null,
      triggered_by:   env.BUILD_REQUESTEDFOR       || null,
      run_id:         env.BUILD_BUILDID            || null,
      started_at:     new Date().toISOString(),
      finished_at:    new Date().toISOString(),
      duration_seconds: 0,
      status:         env.TAXLIFT_STATUS || 'success',
    }
  }

  // ── Drone CI ─────────────────────────────────────────────────────────────
  if (env.DRONE === 'true') {
    debug('Detected: Drone CI')
    return {
      provider:       'drone',
      repo:           env.DRONE_REPO              || null,
      branch:         env.DRONE_SOURCE_BRANCH || env.DRONE_BRANCH || null,
      commit_sha:     env.DRONE_COMMIT_SHA        || null,
      workflow_name:  env.DRONE_STAGE_NAME        || null,
      triggered_by:   env.DRONE_COMMIT_AUTHOR     || null,
      run_id:         env.DRONE_BUILD_NUMBER      || null,
      started_at:     env.DRONE_BUILD_STARTED
        ? new Date(Number(env.DRONE_BUILD_STARTED) * 1000).toISOString()
        : new Date().toISOString(),
      finished_at:    new Date().toISOString(),
      duration_seconds: env.DRONE_BUILD_STARTED
        ? Math.round((Date.now() - Number(env.DRONE_BUILD_STARTED) * 1000) / 1000)
        : 0,
      status:         env.TAXLIFT_STATUS || (env.DRONE_BUILD_STATUS === 'failure' ? 'failure' : 'success'),
    }
  }

  // ── Unknown / local ───────────────────────────────────────────────────────
  debug('No CI platform detected — using manual env vars')
  return {
    provider:       env.TAXLIFT_PROVIDER     || 'unknown',
    repo:           env.TAXLIFT_REPO         || null,
    branch:         env.TAXLIFT_BRANCH       || null,
    commit_sha:     env.TAXLIFT_COMMIT       || null,
    workflow_name:  env.TAXLIFT_WORKFLOW     || null,
    triggered_by:   env.TAXLIFT_TRIGGERED_BY || null,
    run_id:         null,
    started_at:     env.TAXLIFT_STARTED_AT   || new Date().toISOString(),
    finished_at:    new Date().toISOString(),
    duration_seconds: Number(env.TAXLIFT_DURATION_SECONDS || 0),
    status:         env.TAXLIFT_STATUS       || 'success',
  }
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function post(apiUrl, token, body) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(apiUrl)
    const isHttps = parsed.protocol === 'https:'
    const lib     = isHttps ? https : http
    const payload = JSON.stringify(body)

    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname,
      method:   'POST',
      headers: {
        'Content-Type':    'application/json',
        'Content-Length':  Buffer.byteLength(payload),
        'X-TaxLift-Token': token,
        'User-Agent':      `taxlift-ci/1.0.0 node/${process.version}`,
      },
    }

    const req = lib.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, body: data })
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(10000, () => {
      req.destroy(new Error('Request timed out after 10s'))
    })
    req.write(payload)
    req.end()
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const token  = process.env.TAXLIFT_TOKEN
  const apiUrl = (process.env.TAXLIFT_API_URL || 'https://app2026-production.up.railway.app')
    .replace(/\/$/, '') + '/api/v1/webhooks/ci'

  if (!token && !DRY_RUN) {
    exit(1, 'TAXLIFT_TOKEN is not set. Generate one in TaxLift → Integrations → CI Token.')
    return
  }

  const ciMeta = detectCIEnvironment()

  // Merge manual test result overrides
  const testPassed  = process.env.TAXLIFT_TEST_PASSED  != null ? Number(process.env.TAXLIFT_TEST_PASSED)  : null
  const testFailed  = process.env.TAXLIFT_TEST_FAILED  != null ? Number(process.env.TAXLIFT_TEST_FAILED)  : null
  const testSkipped = process.env.TAXLIFT_TEST_SKIPPED != null ? Number(process.env.TAXLIFT_TEST_SKIPPED) : null

  const payload = {
    ...ciMeta,
    test_passed:  testPassed,
    test_failed:  testFailed,
    test_skipped: testSkipped,
  }

  if (DRY_RUN) {
    log('Dry run — would POST the following to', apiUrl)
    console.log(JSON.stringify(payload, null, 2))
    log('Set TAXLIFT_TOKEN and remove --dry-run to record this build run.')
    process.exit(0)
    return
  }

  debug('Sending build run to', apiUrl)
  debug('Payload:', JSON.stringify(payload))

  try {
    const res = await post(apiUrl, token, payload)

    if (res.status === 200 || res.status === 201) {
      const d = res.body
      log(`Build run recorded — id=${d.build_run_id} cluster=${d.cluster_id || 'unattributed'} sred_eligible=${d.sred_eligible}`)
      if (d.sred_eligible) {
        log('✅  This build is flagged as SR&ED eligible and will contribute to your credit claim.')
      }
      process.exit(0)
    } else if (res.status === 401) {
      exit(1, `Authentication failed — check your TAXLIFT_TOKEN value.`)
    } else {
      warn(`Server returned ${res.status}:`, JSON.stringify(res.body))
      exit(1, 'Failed to record build run.')
    }
  } catch (err) {
    warn('Network error:', err.message)
    if (OPTIONAL) {
      log('Continuing despite error (--optional mode).')
      process.exit(0)
    } else {
      exit(1, 'Could not reach TaxLift API. Add --optional to avoid blocking CI.')
    }
  }
}

main()
