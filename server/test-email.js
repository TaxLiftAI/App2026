/**
 * test-email.js — run locally to confirm Resend is wired correctly
 *
 * Usage:
 *   RESEND_API_KEY=re_xxx EMAIL_FROM=hello@taxlift.ai node server/test-email.js
 *
 * Or if you have a .env file:
 *   node -r dotenv/config server/test-email.js
 */

const https = require('https')

const KEY   = process.env.RESEND_API_KEY
const FROM  = process.env.EMAIL_FROM  || 'hello@taxlift.ai'
const TO    = process.env.ALERT_TO    || 'hello@taxlift.ai'

console.log('\n── TaxLift Email Diagnostic ──────────────────────────────')
console.log(`RESEND_API_KEY : ${KEY ? KEY.slice(0, 10) + '…  ✅' : '❌  NOT SET'}`)
console.log(`EMAIL_FROM     : ${FROM}`)
console.log(`ALERT_TO       : ${TO}`)
console.log('──────────────────────────────────────────────────────────\n')

if (!KEY) {
  console.error('❌  RESEND_API_KEY is not set. Export it before running:\n')
  console.error('   export RESEND_API_KEY=re_xxxxxxxxxxxx\n')
  process.exit(1)
}

const body = JSON.stringify({
  from:    FROM,
  to:      [TO],
  subject: '✅ TaxLift email diagnostic — Resend is working',
  html: `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="background:#4F46E5;border-radius:12px;padding:20px;margin-bottom:20px">
        <h2 style="color:#fff;margin:0">✅ Resend is working!</h2>
      </div>
      <p style="font-size:14px;color:#334155">This is a diagnostic email from TaxLift.</p>
      <table style="font-size:13px;width:100%;border-collapse:collapse">
        <tr style="background:#F8FAFC"><td style="padding:8px 12px;font-weight:600;color:#334155">Sent at</td><td style="padding:8px 12px">${new Date().toISOString()}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;color:#334155">From</td><td style="padding:8px 12px">${FROM}</td></tr>
        <tr style="background:#F8FAFC"><td style="padding:8px 12px;font-weight:600;color:#334155">To</td><td style="padding:8px 12px">${TO}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;color:#334155">Key prefix</td><td style="padding:8px 12px">${KEY.slice(0, 10)}…</td></tr>
      </table>
      <p style="margin-top:20px;font-size:12px;color:#94A3B8">
        If you received this, every scan on taxlift.ai will now send you an alert email.
      </p>
    </div>
  `,
  text: `TaxLift diagnostic: Resend is working. Sent at ${new Date().toISOString()} from ${FROM} to ${TO}`,
})

console.log(`Sending test email to ${TO} via Resend…`)

const req = https.request({
  hostname: 'api.resend.com',
  path:     '/emails',
  method:   'POST',
  headers: {
    'Authorization':  `Bearer ${KEY}`,
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
}, res => {
  let data = ''
  res.on('data', d => data += d)
  res.on('end', () => {
    const parsed = (() => { try { return JSON.parse(data) } catch { return data } })()

    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log(`\n✅  Email sent!  Resend ID: ${parsed.id}`)
      console.log(`   Check ${TO} — it should arrive within 30 seconds.\n`)
    } else {
      console.error(`\n❌  Resend returned ${res.statusCode}:`)
      console.error('   ', typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : parsed)
      console.log('\nCommon causes:')
      console.log('  • EMAIL_FROM domain not verified in Resend dashboard')
      console.log('  • API key is invalid or from wrong Resend account')
      console.log('  • Free tier daily limit hit (100/day on free plan)\n')
      process.exit(1)
    }
  })
})

req.on('error', err => {
  console.error('\n❌  Network error connecting to Resend:', err.message)
  process.exit(1)
})

req.write(body)
req.end()
