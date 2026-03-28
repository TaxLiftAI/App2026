/**
 * db.js — SQLite database bootstrap (better-sqlite3)
 *
 * Opens (or creates) taxlift.db, runs CREATE TABLE IF NOT EXISTS migrations,
 * then seeds a demo user on the first run.
 *
 * DB_PATH env var controls where the file lives:
 *   Railway: set DB_PATH=/app/data/taxlift.db + mount persistent volume at /app/data
 *   Local dev: defaults to /tmp/taxlift.db
 */
const Database = require('better-sqlite3')
const bcrypt   = require('bcryptjs')
const path     = require('path')
const fs       = require('fs')

// ── Path resolution ───────────────────────────────────────────────────────────
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

const db = new Database(DB_PATH)

// ── Pragmas ───────────────────────────────────────────────────────────────────
try { db.exec('PRAGMA journal_mode = WAL') } catch { /* fallback to default DELETE */ }
db.exec('PRAGMA foreign_keys = ON')

// ── Migrations (idempotent) ───────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                 TEXT PRIMARY KEY,
    email              TEXT UNIQUE NOT NULL,
    password_hash      TEXT NOT NULL,
    full_name          TEXT NOT NULL DEFAULT '',
    firm_name          TEXT NOT NULL DEFAULT '',
    role               TEXT NOT NULL DEFAULT 'admin',
    subscription_tier  TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT,
    subscribed_at      TEXT,
    github_token       TEXT,
    atlassian_token    TEXT,
    onboarding_complete INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clients (
    id              TEXT PRIMARY KEY,
    cpa_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name    TEXT NOT NULL,
    contact_name    TEXT NOT NULL DEFAULT '',
    email           TEXT NOT NULL DEFAULT '',
    phone           TEXT NOT NULL DEFAULT '',
    industry        TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'active',
    fiscal_year_end TEXT,
    sr_eligible     INTEGER NOT NULL DEFAULT 0,
    notes           TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clusters (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id        TEXT REFERENCES clients(id) ON DELETE SET NULL,
    name             TEXT NOT NULL,
    theme            TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'draft',
    confidence_score INTEGER NOT NULL DEFAULT 0,
    estimated_credit REAL    NOT NULL DEFAULT 0,
    hours            INTEGER NOT NULL DEFAULT 0,
    narrative        TEXT NOT NULL DEFAULT '',
    start_date       TEXT,
    end_date         TEXT,
    repos_json       TEXT NOT NULL DEFAULT '[]',
    commits_json     TEXT NOT NULL DEFAULT '[]',
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cluster_evidences (
    id         TEXT PRIMARY KEY,
    cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    type       TEXT NOT NULL DEFAULT 'commit',
    source     TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL DEFAULT '',
    hash       TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS free_scans (
    id               TEXT PRIMARY KEY,
    email            TEXT NOT NULL,
    repos_json       TEXT NOT NULL DEFAULT '[]',
    clusters_json    TEXT NOT NULL DEFAULT '[]',
    estimated_credit REAL    NOT NULL DEFAULT 0,
    commit_count     INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS drip_emails (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL,
    scan_id       TEXT NOT NULL DEFAULT '',
    sequence_step INTEGER NOT NULL,
    send_after    TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    sent_at       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS leads (
    id         TEXT PRIMARY KEY,
    email      TEXT NOT NULL,
    full_name  TEXT NOT NULL DEFAULT '',
    company    TEXT NOT NULL DEFAULT '',
    message    TEXT NOT NULL DEFAULT '',
    source     TEXT NOT NULL DEFAULT 'marketing',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id                TEXT PRIMARY KEY,
    cpa_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_name       TEXT NOT NULL DEFAULT '',
    client_email      TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'pending',
    credit_amount     REAL NOT NULL DEFAULT 0,
    commission_rate   REAL NOT NULL DEFAULT 0.008,
    commission_amount REAL NOT NULL DEFAULT 0,
    notes             TEXT NOT NULL DEFAULT '',
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS grant_eligibility (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    programs_json TEXT NOT NULL DEFAULT '[]',
    computed_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id)
  );

  CREATE TABLE IF NOT EXISTS grant_gap_answers (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answers    TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id)
  );

  CREATE TABLE IF NOT EXISTS grant_applications (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program    TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'draft',
    deadline   TEXT,
    notes      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS grant_sections (
    id             TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES grant_applications(id) ON DELETE CASCADE,
    section_key    TEXT NOT NULL,
    title          TEXT NOT NULL DEFAULT '',
    content        TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'pending',
    feedback_note  TEXT NOT NULL DEFAULT '',
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proposals (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id  TEXT REFERENCES clients(id) ON DELETE SET NULL,
    title      TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'draft',
    content    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// ── Seed demo user on first run ───────────────────────────────────────────────
try {
  const { makeId } = require('./utils/uuid')
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@taxlift.ai')
  if (!existing) {
    const hash = bcrypt.hashSync('demo1234', 10)
    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, firm_name, role, subscription_tier, onboarding_complete)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(makeId(), 'demo@taxlift.ai', hash, 'Demo User', 'TaxLift Demo', 'admin', 'plus', 1)
    console.log('[db] Seeded demo user: demo@taxlift.ai / demo1234')
  }
} catch (err) {
  console.warn('[db] Seed skipped:', err.message)
}

console.log(`[db] Ready — ${DB_PATH}`)

module.exports = db
