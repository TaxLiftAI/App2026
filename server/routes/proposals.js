/**
 * proposals.js — Proposal PDF Generation
 *
 * GET /api/proposals/pdf/:scanId
 *   Fetches scan from free_scans table, streams a polished 2-page PDF.
 *   No auth required (scan ID acts as access token).
 *
 * POST /api/proposals/pdf
 *   Accepts raw scan data in the request body and generates a PDF.
 *   Used when scan wasn't persisted (demo mode fallback).
 */
const express     = require('express')
const router      = express.Router()
const db          = require('../db')
const PDFDocument = require('pdfkit')
const { requireAuth }  = require('../middleware/auth')
const { scanLimiter }  = require('../middleware/rateLimiter')

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  indigo:      '#6366f1',
  indigoDark:  '#4f46e5',
  indigoMid:   '#818cf8',
  indigoLight: '#e0e7ff',
  indigoXLight:'#eef2ff',
  indigoLabel: '#c7d2fe',
  indigoMuted: '#a5b4fc',
  indigoBg:    '#7c7fef',   // stat box fill inside indigo card
  white:       '#ffffff',
  slate900:    '#0f172a',
  slate700:    '#334155',
  slate500:    '#64748b',
  slate300:    '#cbd5e1',
  slate100:    '#f1f5f9',
  slate50:     '#f8fafc',
  emerald:     '#10b981',
}

// Page layout (LETTER = 612 × 792 pt)
const W  = 612
const H  = 792
const ML = 60                // margin left
const MR = 60                // margin right
const CW = W - ML - MR      // content width = 492

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtK(n) {
  const v = Number(n) || 0
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${Math.round(v / 1_000)}K`
  return `$${Math.round(v).toLocaleString('en-CA')}`
}

function parseScanDate(created_at) {
  if (!created_at) return new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
  const d = new Date(created_at)
  return isNaN(d) ? new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
    : d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
}

// ── PDF builder ───────────────────────────────────────────────────────────────
function generatePDF(res, scanData, inline = false) {
  const {
    repos            = [],
    clusters         = [],
    estimated_credit = 0,
    commit_count     = 0,
    hours_total      = 0,
    created_at,
  } = scanData

  const creditLow  = Math.round(Number(estimated_credit) * 0.65)
  const creditHigh = Math.round(Number(estimated_credit) * 1.35)

  const topClusters = [...clusters]
    .sort((a, b) => (Number(b.estimated_credit_cad) || 0) - (Number(a.estimated_credit_cad) || 0))
    .slice(0, 3)

  const companyName = repos[0]?.split('/')[0] || 'Your Company'
  const repoNames   = repos.map(r => (r.split('/')[1] || r)).join(', ')
  const scanDate    = parseScanDate(created_at)
  const qualifyingCommits = Number(commit_count) || clusters.reduce((s, c) => s + (Number(c._commitCount) || 0), 0)
  const totalHours  = Number(hours_total) || clusters.reduce((s, c) => s + (Number(c.aggregate_time_hours) || 0), 0)

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    autoFirstPage: true,
    info: {
      Title:   `${companyName} — SR&ED Credit Analysis`,
      Author:  'TaxLift',
      Subject: 'SR&ED Tax Credit Proposal',
      Creator: 'TaxLift (taxlift.ai)',
    },
  })

  const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="taxlift-sred-proposal-${slug}.pdf"`
  )
  doc.pipe(res)

  // ── Page 1 ──────────────────────────────────────────────────────────────────
  drawPage1(doc, {
    companyName, repoNames, scanDate, repos, clusters, topClusters,
    creditLow, creditHigh, qualifyingCommits, totalHours,
  })

  // ── Page 2 ──────────────────────────────────────────────────────────────────
  doc.addPage()
  drawPage2(doc, { companyName, creditLow, creditHigh })

  doc.end()
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 — Executive Summary
// ─────────────────────────────────────────────────────────────────────────────
function drawPage1(doc, { companyName, repoNames, scanDate, repos, clusters, topClusters, creditLow, creditHigh, qualifyingCommits, totalHours }) {

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.rect(0, 0, W, 76).fill(C.indigo)

  // Logo mark — rounded square
  doc.roundedRect(ML, 20, 32, 32, 6).fill(C.indigoMid)
  doc.fillColor(C.white).fontSize(13).font('Helvetica-Bold')
    .text('TL', ML, 29, { width: 32, align: 'center' })

  // Wordmark
  doc.fillColor(C.white).fontSize(17).font('Helvetica-Bold')
    .text('TaxLift', ML + 40, 21)

  // Sub-title
  doc.fillColor(C.indigoLabel).fontSize(8.5).font('Helvetica')
    .text('SR&ED Credit Analysis', ML + 40, 44)

  // Scan date — right aligned
  doc.fillColor(C.indigoMuted).fontSize(8).font('Helvetica')
    .text(scanDate, 0, 50, { align: 'right', width: W - MR })

  // ── Company / repo line ─────────────────────────────────────────────────────
  let y = 94
  const displayCompany = companyName.charAt(0).toUpperCase() + companyName.slice(1)
  doc.fillColor(C.slate900).fontSize(15).font('Helvetica-Bold')
    .text(displayCompany, ML, y)
  y += 20

  const repoLabel = repoNames.length > 65 ? repoNames.slice(0, 65) + '…' : repoNames
  doc.fillColor(C.slate500).fontSize(8.5).font('Helvetica')
    .text(`Repos analyzed: ${repoLabel}`, ML, y)
  y += 22

  // ── Credit estimate box ─────────────────────────────────────────────────────
  const boxH = 155
  doc.roundedRect(ML, y, CW, boxH, 10).fill(C.indigo)

  // "ESTIMATED SR&ED REFUND" label
  doc.fillColor(C.indigoLabel).fontSize(8).font('Helvetica-Bold')
    .text('ESTIMATED SR&ED REFUND', ML, y + 16, { width: CW, align: 'center', characterSpacing: 1.5 })

  // Big credit range
  const creditStr = `${fmtK(creditLow)}  –  ${fmtK(creditHigh)}`
  doc.fillColor(C.white).fontSize(36).font('Helvetica-Bold')
    .text(creditStr, ML, y + 32, { width: CW, align: 'center' })

  // Sub-note
  doc.fillColor(C.indigoLabel).fontSize(8.5).font('Helvetica')
    .text(
      `Based on ${qualifyingCommits} qualifying commits across ${repos.length || clusters.length} repo${(repos.length || clusters.length) !== 1 ? 's' : ''}`,
      ML, y + 78, { width: CW, align: 'center' }
    )

  // Stat boxes (3 columns)
  const statBoxY = y + 98
  const statW    = Math.floor((CW - 12) / 3)   // ~160 px each
  const stats = [
    { label: 'Qualifying Clusters', value: String(clusters.length) },
    { label: 'Eligible Commits',    value: String(qualifyingCommits) },
    { label: 'Est. R&D Hours',      value: `${Math.round(totalHours)}h` },
  ]
  stats.forEach((stat, i) => {
    const sx = ML + i * (statW + 6)
    doc.roundedRect(sx, statBoxY, statW, 42, 6).fill(C.indigoBg)
    doc.fillColor(C.white).fontSize(17).font('Helvetica-Bold')
      .text(stat.value, sx, statBoxY + 6, { width: statW, align: 'center' })
    doc.fillColor(C.indigoLabel).fontSize(7).font('Helvetica')
      .text(stat.label, sx, statBoxY + 27, { width: statW, align: 'center' })
  })

  y += boxH + 18

  // ── Top qualifying activities ───────────────────────────────────────────────
  doc.fillColor(C.slate900).fontSize(10.5).font('Helvetica-Bold')
    .text('Top Qualifying Activity Themes', ML, y)
  y += 14
  doc.fillColor(C.slate500).fontSize(8).font('Helvetica')
    .text('Detected from commit history using CRA SR&ED signal keywords and file-path patterns.', ML, y, { width: CW })
  y += 16

  topClusters.forEach((cluster, i) => {
    const rowH   = 46
    const bgColor = i % 2 === 0 ? C.indigoXLight : C.slate50
    doc.roundedRect(ML, y, CW, rowH, 6).fill(bgColor)

    // Rank bubble
    doc.circle(ML + 17, y + 23, 11).fill(C.indigo)
    doc.fillColor(C.white).fontSize(9).font('Helvetica-Bold')
      .text(String(i + 1), ML + 6, y + 18, { width: 22, align: 'center' })

    // Theme / component name
    const theme = cluster._theme || cluster.business_component || 'General R&D'
    doc.fillColor(C.slate900).fontSize(9.5).font('Helvetica-Bold')
      .text(theme, ML + 36, y + 9, { width: CW - 140 })
    doc.fillColor(C.slate500).fontSize(7.5).font('Helvetica')
      .text(
        `${cluster._commitCount || 0} commits · ${Math.round(cluster.aggregate_time_hours || 0)} hrs`,
        ML + 36, y + 24
      )

    // Credit estimate
    doc.fillColor(C.indigo).fontSize(12).font('Helvetica-Bold')
      .text(fmtK(cluster.estimated_credit_cad || 0), ML + CW - 72, y + 10, { width: 72, align: 'right' })
    doc.fillColor(C.slate500).fontSize(7).font('Helvetica')
      .text('est. ITC', ML + CW - 72, y + 27, { width: 72, align: 'right' })

    y += rowH + 4
  })

  if (clusters.length > 3) {
    doc.fillColor(C.slate500).fontSize(7.5).font('Helvetica')
      .text(`+ ${clusters.length - 3} more qualifying cluster${clusters.length - 3 !== 1 ? 's' : ''} in your full report`, ML, y + 2)
    y += 14
  }

  y += 14

  // ── SR&ED explanation box ───────────────────────────────────────────────────
  const expBoxH = 78
  doc.roundedRect(ML, y, CW, expBoxH, 8).fill(C.slate50)
  doc.rect(ML, y, 4, expBoxH).fill(C.indigo)   // left accent stripe

  doc.fillColor(C.slate900).fontSize(9).font('Helvetica-Bold')
    .text('About SR&ED', ML + 14, y + 10)
  doc.fillColor(C.slate700).fontSize(8.2).font('Helvetica')
    .text(
      'SR&ED (Scientific Research & Experimental Development) is a federal tax incentive program that refunds ' +
      '35% of eligible R&D expenditures for Canadian-controlled private corporations. This analysis identifies ' +
      'your qualifying activities based on CRA guidelines.',
      ML + 14, y + 25, { width: CW - 22, lineGap: 2.5 }
    )

  // ── Page footer ─────────────────────────────────────────────────────────────
  const footerY = H - 34
  doc.moveTo(ML, footerY).lineTo(W - MR, footerY).strokeColor(C.slate300).lineWidth(0.5).stroke()
  doc.fillColor(C.slate500).fontSize(7.5).font('Helvetica')
    .text('TaxLift  ·  taxlift.ai  ·  hello@taxlift.ai', ML, footerY + 9)
  doc.fillColor(C.slate500).fontSize(7.5).font('Helvetica')
    .text('Page 1 of 2', 0, footerY + 9, { align: 'right', width: W - MR })
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2 — Next Steps & Methodology
// ─────────────────────────────────────────────────────────────────────────────
function drawPage2(doc, { creditLow, creditHigh }) {

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.rect(0, 0, W, 76).fill(C.indigo)
  doc.roundedRect(ML, 20, 32, 32, 6).fill(C.indigoMid)
  doc.fillColor(C.white).fontSize(13).font('Helvetica-Bold')
    .text('TL', ML, 29, { width: 32, align: 'center' })
  doc.fillColor(C.white).fontSize(17).font('Helvetica-Bold')
    .text('TaxLift', ML + 40, 21)
  doc.fillColor(C.indigoLabel).fontSize(8.5).font('Helvetica')
    .text('Next Steps & Methodology', ML + 40, 44)

  let y = 96

  // ── Section: How We Identified Your Qualifying Work ─────────────────────────
  doc.fillColor(C.indigo).fontSize(9.5).font('Helvetica-Bold')
    .text('HOW WE IDENTIFIED YOUR QUALIFYING WORK', ML, y, { characterSpacing: 0.8 })
  doc.moveTo(ML, y + 14).lineTo(W - MR, y + 14).strokeColor(C.indigoLight).lineWidth(0.8).stroke()
  y += 20

  const methodItems = [
    {
      title: 'Commit Message Analysis',
      desc:  'We analyzed commit messages for technical language patterns consistent with CRA\'s definition of SR&ED — systematic investigation, technical uncertainty, and experimental advancement.',
    },
    {
      title: 'SR&ED Keyword Detection',
      desc:  'Using a curated lexicon of 200+ SR&ED signal phrases drawn from CRA T661 guidance, each commit was scored for claim eligibility across key R&D activity categories.',
    },
    {
      title: 'CRA Theme Clustering',
      desc:  'Qualifying commits were grouped into activity clusters by research theme (ML/AI, algorithms, distributed systems, etc.) to match the T661\'s business component structure.',
    },
  ]

  methodItems.forEach(item => {
    const itemH = 52
    doc.roundedRect(ML, y, CW, itemH, 6).fill(C.slate50)
    doc.circle(ML + 14, y + 16, 5).fill(C.indigo)
    doc.fillColor(C.slate900).fontSize(9).font('Helvetica-Bold')
      .text(item.title, ML + 26, y + 8)
    doc.fillColor(C.slate700).fontSize(8).font('Helvetica')
      .text(item.desc, ML + 26, y + 22, { width: CW - 34, lineGap: 2 })
    y += itemH + 6
  })

  y += 8

  // ── Section: What's Included in Your CPA Package ────────────────────────────
  doc.fillColor(C.indigo).fontSize(9.5).font('Helvetica-Bold')
    .text("WHAT'S INCLUDED IN YOUR CPA PACKAGE", ML, y, { characterSpacing: 0.8 })
  doc.moveTo(ML, y + 14).lineTo(W - MR, y + 14).strokeColor(C.indigoLight).lineWidth(0.8).stroke()
  y += 22

  const pkgItems = [
    'Full T661 narratives for every qualifying cluster',
    'Evidence chain of custody (timestamped commit history)',
    'Audit readiness report with risk scoring',
    'CPA handoff package with supporting documentation',
  ]
  const colW = Math.floor((CW - 8) / 2)

  pkgItems.forEach((item, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const ix  = ML + col * (colW + 8)
    const iy  = y + row * 30

    doc.roundedRect(ix, iy, colW, 24, 4).fill(C.indigoXLight)
    doc.fillColor(C.indigo).fontSize(9).font('Helvetica-Bold')
      .text('✓', ix + 8, iy + 7)
    doc.fillColor(C.slate700).fontSize(8).font('Helvetica')
      .text(item, ix + 22, iy + 7, { width: colW - 28 })
  })

  y += Math.ceil(pkgItems.length / 2) * 30 + 14

  // ── Section: Typical Timeline ───────────────────────────────────────────────
  doc.fillColor(C.indigo).fontSize(9.5).font('Helvetica-Bold')
    .text('TYPICAL TIMELINE', ML, y, { characterSpacing: 0.8 })
  doc.moveTo(ML, y + 14).lineTo(W - MR, y + 14).strokeColor(C.indigoLight).lineWidth(0.8).stroke()
  y += 22

  const steps = [
    {
      num:   '1',
      title: 'TaxLift generates your package',
      sub:   '~2 hours of your time to review & confirm',
    },
    {
      num:   '2',
      title: 'CPA reviews & files your T661',
      sub:   'Your accountant submits the claim with CRA',
    },
    {
      num:   '3',
      title: 'CRA processes your refund',
      sub:   '60–90 days · CCPC refundable ITC',
    },
  ]
  const stepW = Math.floor((CW - 16) / 3)

  steps.forEach((step, i) => {
    const sx = ML + i * (stepW + 8)
    const sy = y

    // Box
    doc.roundedRect(sx, sy, stepW, 76).fillAndStroke(C.indigoXLight, C.indigoLight)

    // Step number circle
    doc.circle(sx + stepW / 2, sy + 20, 13).fill(C.indigo)
    doc.fillColor(C.white).fontSize(11).font('Helvetica-Bold')
      .text(step.num, sx, sy + 14, { width: stepW, align: 'center' })

    // Title
    doc.fillColor(C.slate900).fontSize(8.5).font('Helvetica-Bold')
      .text(step.title, sx + 6, sy + 40, { width: stepW - 12, align: 'center' })

    // Sub
    doc.fillColor(C.slate500).fontSize(7.5).font('Helvetica')
      .text(step.sub, sx + 6, sy + 56, { width: stepW - 12, align: 'center' })

    // Arrow connector
    if (i < 2) {
      const ax = sx + stepW + 4
      doc.fillColor(C.indigo).fontSize(13).font('Helvetica')
        .text('›', ax - 1, sy + 31, { width: 10 })
    }
  })

  y += 76 + 18

  // ── CTA box ─────────────────────────────────────────────────────────────────
  const ctaH = 82
  doc.roundedRect(ML, y, CW, ctaH, 10).fill(C.indigo)

  doc.fillColor(C.white).fontSize(14).font('Helvetica-Bold')
    .text('Ready to proceed?', ML, y + 14, { width: CW, align: 'center' })
  doc.fillColor(C.indigoLabel).fontSize(8.5).font('Helvetica')
    .text('Visit taxlift.ai/pricing  or  email hello@taxlift.ai', ML, y + 34, { width: CW, align: 'center' })
  doc.fillColor(C.indigoMuted).fontSize(8).font('Helvetica')
    .text(`Estimated refund: ${fmtK(creditLow)} – ${fmtK(creditHigh)} CAD`, ML, y + 52, { width: CW, align: 'center' })
  doc.fillColor(C.indigoLabel).fontSize(7.5).font('Helvetica')
    .text('Flat fee · No 20% contingency cut · CPA-ready package in 2 hours', ML, y + 65, { width: CW, align: 'center' })

  y += ctaH + 18

  // ── Disclaimer ──────────────────────────────────────────────────────────────
  doc.roundedRect(ML, y, CW, 50, 6).fill(C.slate50)
  doc.fillColor(C.slate500).fontSize(7.5).font('Helvetica')
    .text(
      'This estimate is preliminary and based on automated commit analysis. Final claim amounts are determined ' +
      'by your CPA and CRA review. TaxLift is not a tax advisor. SR&ED claims are subject to CRA eligibility ' +
      'determination and audit.',
      ML + 10, y + 10, { width: CW - 20, lineGap: 2.5, align: 'center' }
    )

  // ── Page footer ─────────────────────────────────────────────────────────────
  const footerY = H - 34
  doc.moveTo(ML, footerY).lineTo(W - MR, footerY).strokeColor(C.slate300).lineWidth(0.5).stroke()
  doc.fillColor(C.slate500).fontSize(7.5).font('Helvetica')
    .text('TaxLift  ·  taxlift.ai  ·  hello@taxlift.ai', ML, footerY + 9)
  doc.fillColor(C.slate500).fontSize(7.5).font('Helvetica')
    .text('Page 2 of 2', 0, footerY + 9, { align: 'right', width: W - MR })
}

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * GET /api/proposals/pdf/:scanId
 * Fetch scan from DB and stream a PDF. Opens inline in the browser PDF viewer.
 */
router.get('/pdf/:scanId', requireAuth, scanLimiter, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM free_scans WHERE id = ?').get(req.params.scanId)
    if (!row) return res.status(404).json({ message: 'Scan not found' })

    const scanData = {
      ...row,
      repos:    JSON.parse(row.repos_json    ?? '[]'),
      clusters: JSON.parse(row.clusters_json ?? '[]'),
    }

    generatePDF(res, scanData, /* inline */ true)
  } catch (err) {
    console.error('[proposals/pdf GET] error:', err.message)
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to generate PDF', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) })
    }
  }
})

/**
 * POST /api/proposals/pdf
 * Accept raw scan data in body and return a downloadable PDF.
 * Used for demo mode and when the scan wasn't persisted to the backend.
 */
router.post('/pdf', (req, res) => {
  try {
    generatePDF(res, req.body ?? {}, /* inline */ false)
  } catch (err) {
    console.error('[proposals/pdf POST] error:', err.message)
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to generate PDF', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) })
    }
  }
})

module.exports = router
