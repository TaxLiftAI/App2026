/**
 * db.js — SQLite database bootstrap using Node 22's built-in node:sqlite
 *
 * Opens (or creates) taxlift.db, runs CREATE TABLE IF NOT EXISTS migrations,
 * then seeds with mock-matching data on the first run so the UI looks
 * identical to the frontend-only demo.
 *
 * Requires Node >= 22.5.0  (node:sqlite is stable in Node 22.10+)
 */
const { DatabaseSync } = require('node:sqlite')
const bcrypt = require('bcryptjs')
const path   = require('path')
const fs     = require('fs')


// DB_PATH controls where the SQLite file lives.
// Railway: set DB_PATH=/app/data/taxlift.db and mount a persistent volume at /app/data
// Local dev: defaults to /tmp/taxlift.db (fine for development)
// Auto-creates the directory if it doesn't exist (e.g. on first Railway deploy).
const _configuredPath = process.env.DB_PATH ?? '/tmp/taxlift.db'
const _dir = path.dirname(_configuredPath)
let DB_PATH = _configuredPath
if (_dir !== '/tmp' && _dir !== '/') {
  try {
    fs.mkdirSync(_dir, { recursive: true })
  } catch (e) {
    console.warn(`[db] Could not create directory ${_dir} — falling back to /tmp/taxlift.db`)
    DB_PATH = '/tmp/taxlift.db'
  }
}
const db = new DatabaseSync(DB_PATH)


// ── Pragmas ────────────────────────────────────────────────────────────────────
// Avoid WAL on filesystems that don't support it (FUSE, network mounts)
try { db.exec('PRAGMA journal_mode = WAL') } catch { /* fallback to default DELETE */ }
db.exec('PRAGMA foreign_keys = ON')

