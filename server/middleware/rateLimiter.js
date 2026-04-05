/**
 * Rate Limiting Middleware
 *
 * Layered strategy:
 *   globalLimiter  — 200 req/15 min per IP (all routes)
 *   authLimiter    — 10 req/15 min per IP  (login, register — brute force)
 *   scanLimiter    — 30 req/hour per IP    (scan, clusters, reports — scraping)
 *   leadsLimiter   — 5  req/hour per IP    (marketing lead capture — form spam)
 *
 * Threat coverage:
 *   Threat 1 — API scraping / bulk export    → scanLimiter on /api/scan, /api/clusters
 *   Threat 4 — Credential stuffing on auth   → authLimiter on /api/auth
 */
const rateLimit = require('express-rate-limit')

function onLimitHit(req, _res, _next, options) {
  console.warn(
    `[rate-limit] LIMIT HIT ip=${req.ip} path=${req.path} limit=${options.max} window=${options.windowMs / 1000}s`
  )
}

// ── Global: reasonable baseline for all API traffic ──────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,   // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: { message: 'Too many requests — please slow down and try again.' },
  handler(req, res, next, options) {
    onLimitHit(req, res, next, options)
    res.status(options.statusCode).json(options.message)
  },
})

// ── Auth: brute-force & credential stuffing protection ───────────────────────
// 10 attempts per 15 min is generous for real users but painful for bots
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts — please wait 15 minutes and try again.' },
  handler(req, res, next, options) {
    onLimitHit(req, res, next, options)
    res.status(options.statusCode).json(options.message)
  },
})

// ── Scan / cluster / report endpoints: prevent bulk analysis scraping ─────────
// A real user generating reports shouldn't hit 30/hour; a scraper will
const scanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Report generation rate limit reached — please wait before requesting more.' },
  handler(req, res, next, options) {
    onLimitHit(req, res, next, options)
    res.status(options.statusCode).json(options.message)
  },
})

// ── Leads / marketing form: anti-spam ────────────────────────────────────────
const leadsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many submissions — please try again later.' },
  handler(req, res, next, options) {
    onLimitHit(req, res, next, options)
    res.status(options.statusCode).json(options.message)
  },
})

module.exports = { globalLimiter, authLimiter, scanLimiter, leadsLimiter }
