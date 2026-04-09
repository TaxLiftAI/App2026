/**
 * drip-cron.js — Standalone email drip scheduler
 *
 * Run this as a SEPARATE Railway cron service, NOT as part of the web process.
 * Running it inside the web process causes duplicate emails when Railway scales
 * to multiple replicas.
 *
 * Railway cron setup:
 *   1. In Railway dashboard → New Service → Cron Job
 *   2. Command:  node server/drip-cron.js
 *   3. Schedule: every 15 minutes  →  *\/15 * * * *
 *   4. Set the same environment variables as the web service
 *
 * What it does:
 *   Calls startDripScheduler() which fires a single pass: scans the email_drip
 *   queue for any pending messages whose send_after timestamp has passed, sends
 *   them via SMTP (or logs if SMTP not configured), and exits.
 *
 * SMTP env vars (all optional — falls back to log-only mode if absent):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *   EMAIL_FROM  (defaults to hello@taxlift.ai)
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const { startDripScheduler } = require('./lib/emailDrip')

console.log('[drip-cron] Starting drip pass at', new Date().toISOString())

startDripScheduler()

// Give the scheduler a moment to fire pending emails before the process exits.
// The scheduler uses setInterval internally; we wait 30s to ensure one full
// sweep completes, then exit cleanly so Railway's cron runner can track success.
setTimeout(() => {
  console.log('[drip-cron] Pass complete. Exiting.')
  process.exit(0)
}, 30_000)
