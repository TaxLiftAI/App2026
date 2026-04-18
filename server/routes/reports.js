/**
 * reports.js — Real report data served from scan results
 *
 * GET /api/v1/reports/summary?scan_id=xxx   → summary stats
 * GET /api/v1/reports/clusters?scan_id=xxx  → cluster array with cached narratives
 *
 * Falls back gracefully: if scan_id absent, returns 400 (hooks use mock fallback).
 */
const router = require('express').Router()
const db     = require('../db')

function getClusters(scanId) {
  const scan = db.prepare('SELECT * FROM free_scans WHERE id = ?').get(scanId)
  if (!scan) return null

  const clusters = JSON.parse(scan.clusters_json || '[]')

  // Attach cached narratives if available
  let narrativeMap = {}
  try {
    const cached = db.prepare('SELECT narratives_json FROM scan_narratives WHERE scan_id = ?').get(scanId)
    if (cached) narrativeMap = JSON.parse(cached.narratives_json)
  } catch {}

  return {
    scan,
    clusters: clusters.map(c => ({
      ...c,
      status:                c.status || 'New',
      narrative_content_text: narrativeMap[c.id]?.content_text || null,
    })),
  }
}

// GET /api/v1/reports/summary
router.get('/summary', (req, res) => {
  const { scan_id, start, end } = req.query
  if (!scan_id) return res.status(400).json({ error: 'scan_id required' })

  try {
    const result = getClusters(scan_id)
    if (!result) return res.status(404).json({ error: 'Scan not found' })

    const { scan, clusters } = result
    const approved = clusters.filter(c => c.status !== 'Rejected')

    res.json({
      total_clusters:       clusters.length,
      approved_clusters:    approved.length,
      rejected_clusters:    clusters.length - approved.length,
      pending_clusters:     clusters.filter(c => c.status === 'New').length,
      total_eligible_hours: Number(scan.hours_total)  || approved.reduce((s, c) => s + (c.aggregate_time_hours || 0), 0),
      total_credit_cad:     Number(scan.estimated_credit) || 0,
      total_credit_usd:     Math.round((Number(scan.estimated_credit) || 0) * 0.74),
      repos:                JSON.parse(scan.repos_json || '[]'),
      scan_date:            scan.created_at,
    })
  } catch (err) {
    console.error('[reports/summary]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/v1/reports/clusters
router.get('/clusters', (req, res) => {
  const { scan_id } = req.query
  if (!scan_id) return res.status(400).json({ error: 'scan_id required' })

  try {
    const result = getClusters(scan_id)
    if (!result) return res.status(404).json({ error: 'Scan not found' })
    res.json(result.clusters)
  } catch (err) {
    console.error('[reports/clusters]', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
