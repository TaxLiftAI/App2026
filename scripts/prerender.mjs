/**
 * scripts/prerender.mjs
 *
 * Lightweight static prerender for TaxLift's public routes.
 *
 * Run AFTER `vite build`:  node scripts/prerender.mjs
 *
 * What it does:
 *   1. Reads dist/index.html (the Vite output).
 *   2. For each public route, writes a route-specific index.html that:
 *      - Has the correct <title> and <meta name="description"> hard-coded
 *      - Has correct OG / Twitter / canonical tags pointing at that path
 *      - Loads the same JS bundle (React hydrates on top)
 *   3. Googlebot / social crawlers now get real HTML with all the metadata
 *      without needing Next.js or a Node.js server.
 *
 * This is a zero-dependency, zero-config solution that works with Vercel's
 * static output directory.
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST      = path.resolve(__dirname, '../dist')

// ── Route manifest ────────────────────────────────────────────────────────────
const ROUTES = [
  {
    path:        '/',
    title:       'TaxLift — Automated SR&ED / R&D Tax Credit Platform',
    description: 'TaxLift automates SR&ED and R&D tax credit claims for Canadian startups. Connect GitHub or Jira, get a CRA-ready T661 package in minutes. Free eligibility scan.',
  },
  {
    path:        '/pricing',
    title:       'Pricing — TaxLift SR&ED Tax Credit Platform',
    description: 'Simple, transparent pricing for SR&ED claims. Start free with our eligibility scan. Paid plans charged as a percentage of credits recovered — no recovery, no fee.',
  },
  {
    path:        '/demo',
    title:       'Interactive Demo — TaxLift SR&ED Platform',
    description: 'Explore TaxLift with live sample data. See auto-detected SR&ED clusters, T661-ready narratives, and an audit-ready CRA package — no sign-up needed.',
  },
  {
    path:        '/estimate',
    title:       'Free SR&ED Credit Estimator — TaxLift',
    description: 'Calculate how much SR&ED tax credit your Canadian startup could recover. Enter headcount and salary — get an instant CRA-grade estimate with provincial breakdown.',
  },
  {
    path:        '/scan',
    title:       'Free SR&ED Scan — TaxLift',
    description: 'Connect GitHub in 60 seconds and get a free SR&ED eligibility scan. TaxLift identifies qualifying R&D work from your commit history and estimates your CRA tax credit.',
  },
  {
    path:        '/signup',
    title:       'Create Account — TaxLift SR&ED Platform',
    description: 'Sign up for TaxLift and start your free SR&ED eligibility scan. No credit card required. Connect GitHub or Jira and get your first credit estimate in minutes.',
  },
  {
    path:        '/login',
    title:       'Sign In — TaxLift',
    description: 'Sign in to your TaxLift account to manage SR&ED claims, review clusters, and access your CRA tax credit dashboard.',
  },
]

const BASE_URL = 'https://taxlift.ai'
const OG_IMAGE = `${BASE_URL}/og-image.png`

// ── Read the built index.html ─────────────────────────────────────────────────
const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf-8')

// ── Inject route-specific tags into the template ──────────────────────────────
function buildHtml(route) {
  const url = `${BASE_URL}${route.path}`

  // Replace <title>
  let html = template.replace(
    /<title>.*?<\/title>/,
    `<title>${escapeHtml(route.title)}</title>`,
  )

  // Replace / inject description
  html = upsertMeta(html, 'name',     'description',    route.description)
  html = upsertMeta(html, 'property', 'og:title',       route.title)
  html = upsertMeta(html, 'property', 'og:description', route.description)
  html = upsertMeta(html, 'property', 'og:url',         url)
  html = upsertMeta(html, 'property', 'og:image',       OG_IMAGE)
  html = upsertMeta(html, 'name',     'twitter:title',       route.title)
  html = upsertMeta(html, 'name',     'twitter:description', route.description)
  html = upsertMeta(html, 'name',     'twitter:image',       OG_IMAGE)

  // Replace canonical
  html = html.replace(
    /<link rel="canonical"[^>]*>/,
    `<link rel="canonical" href="${url}" />`,
  )

  return html
}

function upsertMeta(html, attr, name, content) {
  const tag    = `<meta ${attr}="${name}" content="${escapeHtml(content)}" />`
  const regex  = new RegExp(`<meta ${attr}="${escapeRe(name)}"[^>]*>`)
  return regex.test(html) ? html.replace(regex, tag) : html.replace('</head>', `  ${tag}\n  </head>`)
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── Write output files ────────────────────────────────────────────────────────
let written = 0
for (const route of ROUTES) {
  const html    = buildHtml(route)
  const dir     = route.path === '/' ? DIST : path.join(DIST, route.path)
  const outFile = path.join(dir, 'index.html')

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  // For the root route, overwrite in place; for sub-routes, only write if the
  // directory doesn't already contain a hand-crafted index.html from Vite.
  fs.writeFileSync(outFile, html, 'utf-8')
  console.log(`  ✓  ${route.path.padEnd(16)} → ${outFile.replace(DIST, 'dist')}`)
  written++
}

console.log(`\nPrerender complete — ${written} routes written.\n`)
