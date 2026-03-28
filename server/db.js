/**
 * db.js — SQLite database bootstrap (better-sqlite3)
 * Complete schema derived from ALL route files.
 */
const Database = require('better-sqlite3')
const bcrypt   = require('bcryptjs')
const path     = require('path')
const fs       = require('fs')
const crypto   = require('crypto')

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data'
try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
const DB_PATH = path.join(DATA_DIR, 'taxlift.db')

const db = new Database(DB_PATH)
try { db.exec('PRAGMA journal_mode = WAL') } catch {}
db.exec('PRAGMA foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                   TEXT PRIMARY KEY,
    email                TEXT UNIQUE NOT NULL,
    password_hash        TEXT NOT NULL,
    full_name            TEXT NOT NULL DEFAULT '',
    firm_name            TEXT NOT NULL DEFAULT '',
    role                 TEXT NOT NULL DEFAULT 'admin',
    tenant_id            TEXT,
    subscription_tier    TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id   TEXT,
    subscribed_at        TEXT,
    github_token         TEXT,
    atlassian_token      TEXT,
    onboarding_complete  INTEGER NOT NULL DEFAULT 0,
    created_at           TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS company_profiles (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_number  TEXT NOT NULL DEFAULT '',
    company_name     TEXT NOT NULL DEFAULT '',
    province         TEXT NOT NULL DEFAULT 'ON',
    employee_count   INTEGER NOT NULL DEFAULT 10,
    fiscal_year_end  TEXT NOT NULL DEFAULT 'December',
    industry_domain  TEXT NOT NULL DEFAULT '',
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id)
  );

  CREATE TABLE IF NOT EXISTS clients (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name            TEXT NOT NULL,
    industry                TEXT NOT NULL DEFAULT '',
    fiscal_year_end         TEXT,
    filing_deadline         TEXT,
    primary_contact         TEXT NOT NULL DEFAULT '',
    primary_contact_email   TEXT NOT NULL DEFAULT '',
    status                  TEXT NOT NULL DEFAULT 'active',
    notes                   TEXT NOT NULL DEFAULT '',
    clusters_total          INTEGER NOT NULL DEFAULT 0,
    clusters_approved       INTEGER NOT NULL DEFAULT 0,
    clusters_pending_review INTEGER NOT NULL DEFAULT 0,
    estimated_credit_cad    REAL NOT NULL DEFAULT 0,
    avg_readiness_score     REAL NOT NULL DEFAULT 0,
    documents_count         INTEGER NOT NULL DEFAULT 0,
    last_activity_at        TEXT NOT NULL DEFAULT (datetime('now')),
    created_at              TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clusters (
    id          TEXT PRIMARY KEY,
    client_id   TEXT REFERENCES clients(id) ON DELETE SET NULL,
    name        TEXT NOT NULL,
    theme       TEXT NOT NULL DEFAULT '',
    hours       INTEGER NOT NULL DEFAULT 0,
    credit_cad  REAL NOT NULL DEFAULT 0,
    narrative   TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'draft',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sred_projects (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                 TEXT NOT NULL DEFAULT '',
    technical_uncertainty TEXT NOT NULL DEFAULT '',
    work_performed        TEXT NOT NULL DEFAULT '',
    status                TEXT NOT NULL DEFAULT 'draft',
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sred_expenditures (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES sred_projects(id) ON DELETE CASCADE,
    category    TEXT NOT NULL DEFAULT '',
    amount      REAL NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    period      TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sred_team_members (
    id               TEXT PRIMARY KEY,
    project_id       TEXT NOT NULL REFERENCES sred_projects(id) ON DELETE CASCADE,
    name             TEXT NOT NULL DEFAULT '',
    role             TEXT NOT NULL DEFAULT '',
    time_percentage  REAL NOT NULL DEFAULT 0,
    qualifications   TEXT NOT NULL DEFAULT '',
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS free_scans (
    id               TEXT PRIMARY KEY,
    email            TEXT NOT NULL,
    repos_json       TEXT NOT NULL DEFAULT '[]',
    clusters_json    TEXT NOT NULL DEFAULT '[]',
    estimated_credit REAL NOT NULL DEFAULT 0,
    commit_count     INTEGER NOT NULL DEFAULT 0,
    cluster_count    INTEGER NOT NULL DEFAULT 0,
    hours_total      INTEGER NOT NULL DEFAULT 0,
    user_id          TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS drip_emails (
    id             TEXT PRIMARY KEY,
    email          TEXT NOT NULL,
    scan_id        TEXT NOT NULL DEFAULT '',
    sequence_step  INTEGER NOT NULL,
    send_after     TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',
    sent_at        TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS leads (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    company       TEXT NOT NULL DEFAULT '',
    plan_interest TEXT NOT NULL DEFAULT '',
    source        TEXT NOT NULL DEFAULT 'marketing',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id                  TEXT PRIMARY KEY,
    referrer_user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ref_code            TEXT NOT NULL DEFAULT '',
    company_name        TEXT NOT NULL DEFAULT '',
    industry            TEXT NOT NULL DEFAULT '',
    fiscal_year         TEXT NOT NULL DEFAULT '',
    primary_contact     TEXT NOT NULL DEFAULT '',
    status              TEXT NOT NULL DEFAULT 'pending',
    credit_amount       REAL NOT NULL DEFAULT 0,
    commission_amount   REAL NOT NULL DEFAULT 0,
    commission_cad      REAL NOT NULL DEFAULT 0,
    commission_status   TEXT NOT NULL DEFAULT 'pending',
    commission_confirmed INTEGER NOT NULL DEFAULT 0,
    commission_paid     INTEGER NOT NULL DEFAULT 0,
    date_referred       TEXT NOT NULL DEFAULT (datetime('now')),
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS eligibility_cache (
    id        TEXT PRIMARY KEY,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    result    TEXT NOT NULL DEFAULT '[]',
    cached_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id)
  );

  CREATE TABLE IF NOT EXISTS gap_answers (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_desc       TEXT NOT NULL DEFAULT '',
    revenue_model     TEXT NOT NULL DEFAULT '',
    canadian_benefit  TEXT NOT NULL DEFAULT '',
    differentiation   TEXT NOT NULL DEFAULT '',
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id)
  );

  CREATE TABLE IF NOT EXISTS grant_applications (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grant_id         TEXT NOT NULL DEFAULT '',
    grant_name       TEXT NOT NULL DEFAULT '',
    sred_project_ids TEXT NOT NULL DEFAULT '[]',
    status           TEXT NOT NULL DEFAULT 'draft',
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS grant_sections (
    id             TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES grant_applications(id) ON DELETE CASCADE,
    section_key    TEXT NOT NULL,
    section_name   TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'pending',
    data_source    TEXT NOT NULL DEFAULT '',
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS section_versions (
    id            TEXT PRIMARY KEY,
    section_id    TEXT NOT NULL REFERENCES grant_sections(id) ON DELETE CASCADE,
    content       TEXT NOT NULL DEFAULT '',
    feedback_note TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

console.log('[db] Ready —', DB_PATH)

try {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@taxlift.ai')
  if (!existing) {
    const id   = crypto.randomUUID()
    const hash = bcrypt.hashSync('Demo1234!', 10)
    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, firm_name, role, subscription_tier)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, 'demo@taxlift.ai', hash, 'Demo User', 'TaxLift Demo', 'admin', 'growth')
    console.log('[db] Demo user seeded')
  }
} catch (e) {
  console.warn('[db] Seed skipped:', e.message)
}

module.exports = db
