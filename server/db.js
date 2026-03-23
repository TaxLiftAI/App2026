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

// ── Schema ─────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,
    email               TEXT UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    full_name           TEXT NOT NULL DEFAULT '',
    firm_name           TEXT NOT NULL DEFAULT '',
    role                TEXT NOT NULL DEFAULT 'developer',
    tenant_id           TEXT NOT NULL DEFAULT 'tenant-default',
    subscription_tier   TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id  TEXT,
    subscribed_at       TEXT,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS clients (
    id                       TEXT PRIMARY KEY,
    user_id                  TEXT NOT NULL REFERENCES users(id),
    company_name             TEXT NOT NULL,
    industry                 TEXT NOT NULL DEFAULT '',
    fiscal_year_end          TEXT NOT NULL DEFAULT 'December',
    filing_deadline          TEXT NOT NULL DEFAULT '',
    primary_contact          TEXT NOT NULL DEFAULT '',
    primary_contact_email    TEXT NOT NULL DEFAULT '',
    clusters_total           INTEGER NOT NULL DEFAULT 0,
    clusters_approved        INTEGER NOT NULL DEFAULT 0,
    clusters_pending_review  INTEGER NOT NULL DEFAULT 0,
    avg_readiness_score      INTEGER NOT NULL DEFAULT 0,
    estimated_credit_cad     REAL    NOT NULL DEFAULT 0,
    documents_count          INTEGER NOT NULL DEFAULT 0,
    last_activity_at         TEXT,
    status                   TEXT NOT NULL DEFAULT 'onboarded',
    notes                    TEXT NOT NULL DEFAULT '',
    created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS clusters (
    id           TEXT PRIMARY KEY,
    client_id    TEXT NOT NULL REFERENCES clients(id),
    name         TEXT NOT NULL,
    theme        TEXT NOT NULL DEFAULT '',
    hours        REAL NOT NULL DEFAULT 0,
    credit_cad   REAL NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'pending',
    narrative    TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS leads (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    company       TEXT NOT NULL DEFAULT '',
    plan_interest TEXT NOT NULL DEFAULT '',
    source        TEXT NOT NULL DEFAULT 'marketing',
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS free_scans (
    id               TEXT PRIMARY KEY,
    email            TEXT NOT NULL DEFAULT '',
    repos_json       TEXT NOT NULL DEFAULT '[]',
    clusters_json    TEXT NOT NULL DEFAULT '[]',
    estimated_credit REAL NOT NULL DEFAULT 0,
    commit_count     INTEGER NOT NULL DEFAULT 0,
    cluster_count    INTEGER NOT NULL DEFAULT 0,
    hours_total      REAL NOT NULL DEFAULT 0,
    user_id          TEXT,
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS drip_emails (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL,
    scan_id       TEXT NOT NULL,
    sequence_step INTEGER NOT NULL,
    send_after    TEXT NOT NULL,
    sent_at       TEXT,
    status        TEXT NOT NULL DEFAULT 'pending',
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id                   TEXT PRIMARY KEY,
    referrer_user_id     TEXT NOT NULL REFERENCES users(id),
    ref_code             TEXT NOT NULL,
    company_name         TEXT NOT NULL,
    industry             TEXT NOT NULL DEFAULT '',
    fiscal_year          TEXT NOT NULL DEFAULT '',
    primary_contact      TEXT NOT NULL DEFAULT '',
    referral_status      TEXT NOT NULL DEFAULT 'scanning',
    commission_status    TEXT NOT NULL DEFAULT 'pending',
    estimated_credit_cad REAL    NOT NULL DEFAULT 0,
    commission_cad       REAL    NOT NULL DEFAULT 0,
    commission_confirmed INTEGER NOT NULL DEFAULT 0,
    commission_paid      INTEGER NOT NULL DEFAULT 0,
    paid_at              TEXT,
    notes                TEXT NOT NULL DEFAULT '',
    date_referred        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );
`)

// ── Grants module schema ────────────────────────────────────────────────────────
db.exec(`
  -- SR&ED tables (read-only source data for Grants module)
  CREATE TABLE IF NOT EXISTS sred_projects (
    id                     TEXT PRIMARY KEY,
    user_id                TEXT NOT NULL REFERENCES users(id),
    title                  TEXT NOT NULL,
    technical_uncertainty  TEXT NOT NULL DEFAULT '',
    technical_advancement  TEXT NOT NULL DEFAULT '',
    work_performed         TEXT NOT NULL DEFAULT '',
    start_date             TEXT NOT NULL DEFAULT '',
    end_date               TEXT NOT NULL DEFAULT '',
    status                 TEXT NOT NULL DEFAULT 'filed',
    created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS sred_expenditures (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES sred_projects(id),
    category    TEXT NOT NULL,
    amount      REAL NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    period      TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS sred_team_members (
    id               TEXT PRIMARY KEY,
    project_id       TEXT NOT NULL REFERENCES sred_projects(id),
    name             TEXT NOT NULL,
    role             TEXT NOT NULL DEFAULT '',
    time_percentage  REAL NOT NULL DEFAULT 100,
    qualifications   TEXT NOT NULL DEFAULT '',
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  -- Company profile (extended from users for grant eligibility)
  CREATE TABLE IF NOT EXISTS company_profiles (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL UNIQUE REFERENCES users(id),
    business_number TEXT NOT NULL DEFAULT '',
    company_name    TEXT NOT NULL DEFAULT '',
    province        TEXT NOT NULL DEFAULT 'ON',
    employee_count  INTEGER NOT NULL DEFAULT 10,
    fiscal_year_end TEXT NOT NULL DEFAULT 'December',
    industry_domain TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  -- Gap fill answers (company-scoped, reused across all grant applications)
  CREATE TABLE IF NOT EXISTS gap_answers (
    id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id          TEXT NOT NULL UNIQUE REFERENCES users(id),
    market_desc      TEXT,
    revenue_model    TEXT,
    canadian_benefit TEXT,
    differentiation  TEXT,
    updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  -- Grant applications
  CREATE TABLE IF NOT EXISTS grant_applications (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id),
    grant_id          TEXT NOT NULL,
    grant_name        TEXT NOT NULL,
    sred_project_ids  TEXT NOT NULL DEFAULT '[]',
    status            TEXT NOT NULL DEFAULT 'draft',
    submitted_at      TEXT,
    amount_requested  REAL,
    amount_awarded    REAL,
    notes             TEXT NOT NULL DEFAULT '',
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  -- Application sections (6-8 rows per application)
  CREATE TABLE IF NOT EXISTS grant_sections (
    id             TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES grant_applications(id),
    section_key    TEXT NOT NULL,
    section_name   TEXT NOT NULL,
    content        TEXT,
    status         TEXT NOT NULL DEFAULT 'pending',
    data_source    TEXT NOT NULL DEFAULT 'sred_only',
    word_count     INTEGER,
    feedback_note  TEXT,
    approved_at    TEXT,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  -- Section version history
  CREATE TABLE IF NOT EXISTS section_versions (
    id            TEXT PRIMARY KEY,
    section_id    TEXT NOT NULL REFERENCES grant_sections(id),
    content       TEXT NOT NULL,
    feedback_note TEXT,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  -- Eligibility cache (30-day cache per user)
  CREATE TABLE IF NOT EXISTS eligibility_cache (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL UNIQUE REFERENCES users(id),
    result     TEXT NOT NULL,
    cached_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );
`)

// ── node:sqlite returns null-prototype objects; normalise to plain objects ─────
// The node:sqlite rows have null prototypes. Wrap .get() / .all() so downstream
// code can spread them and use Object.keys etc normally.
const _prepare = db.prepare.bind(db)
db.prepare = function(sql) {
  const stmt = _prepare(sql)
  const origGet = stmt.get.bind(stmt)
  const origAll = stmt.all.bind(stmt)
  stmt.get = (...args) => {
    const row = origGet(...args)
    return row ? Object.assign({}, row) : row
  }
  stmt.all = (...args) => {
    const rows = origAll(...args)
    return rows.map(r => Object.assign({}, r))
  }
  return stmt
}

// ── Seed helper ────────────────────────────────────────────────────────────────
function isEmpty(table) {
  return db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get().n === 0
}

function seed() {
  if (!isEmpty('users')) return   // already seeded

  const hash = (pw) => bcrypt.hashSync(pw, 10)
  const now  = new Date().toISOString()

  // ── Users ──────────────────────────────────────────────────────────────────
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, firm_name, role, tenant_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const users = [
    ['u-001', 'sarah.chen@acmecorp.com',  bcrypt.hashSync('Admin1234!',   10), 'Sarah Chen',    'Acme Corp',          'admin',    'tenant-acme', '2025-09-01T00:00:00Z'],
    ['u-002', 'marcus.reid@acmecorp.com', bcrypt.hashSync('Reviewer123!', 10), 'Marcus Reid',   'Acme Corp',          'reviewer', 'tenant-acme', '2025-09-01T00:00:00Z'],
    ['u-003', 'jordan.kim@acmecorp.com',  bcrypt.hashSync('Dev12345!',    10), 'Jordan Kim',    'Acme Corp',          'developer','tenant-acme', '2025-10-15T00:00:00Z'],
    ['u-cpa', 'margaret.chen@crowe.ca',   bcrypt.hashSync('Cpa12345!',    10), 'Margaret Chen', 'Crowe MacKay LLP',   'cpa',      'tenant-cpa',  '2024-09-01T00:00:00Z'],
    ['u-005', 'david.okafor@auditor.ca',  bcrypt.hashSync('Audit123!',    10), 'David Okafor',  '',                   'auditor',  'tenant-acme', '2025-11-01T00:00:00Z'],
    ['u-dev', 'admin@taxlift.dev',        bcrypt.hashSync('Admin1234!',   10), 'Dev Admin',     'TaxLift',            'admin',    'tenant-acme', now],
  ]
  users.forEach(u => insertUser.run(...u))

  // ── Clients ────────────────────────────────────────────────────────────────
  const insertClient = db.prepare(`
    INSERT INTO clients
      (id, user_id, company_name, industry, fiscal_year_end, filing_deadline,
       primary_contact, primary_contact_email, clusters_total, clusters_approved,
       clusters_pending_review, avg_readiness_score, estimated_credit_cad,
       documents_count, last_activity_at, status, notes, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `)

  const clients = [
    ['cli-001','u-cpa','Acme Corp',         'AI / Software',        'December','2026-06-30','Sarah Chen',    'sarah.chen@acmecorp.com',  10,2,3,74,116000,15,'2026-03-17T08:14:00Z','needs_attention','3 narratives awaiting CPA review. Context refresh overdue on 2 clusters.',          '2025-09-01T00:00:00Z'],
    ['cli-002','u-cpa','NovaSystems Inc.',   'Cloud Infrastructure', 'June',    '2026-06-30','Daniel Park',   'd.park@novasystems.ca',      7,6,1,92,204000,28,'2026-03-16T14:30:00Z','ready_to_file',  'All narratives approved. Final CPA sign-off pending before T661 submission.',        '2025-10-01T00:00:00Z'],
    ['cli-003','u-cpa','BrightPath AI',      'Machine Learning',     'March',   '2026-07-31','Amara Diallo',  'a.diallo@brightpathai.io',   5,1,2,51, 47000, 9,'2026-03-12T11:00:00Z','needs_attention','Developer interviews incomplete for 3 clusters. Narrative quality below threshold.', '2025-11-15T00:00:00Z'],
    ['cli-004','u-cpa','Vertex Labs',        'Quantum Computing',    'December','2026-04-15','Thomas Wu',     't.wu@vertexlabs.ca',         4,0,1,24, 18000, 3,'2026-02-28T09:45:00Z','at_risk',        'URGENT: Filing deadline in 29 days. No clusters approved.',                          '2025-12-01T00:00:00Z'],
    ['cli-005','u-cpa','ClearPath Medical',  'Healthcare Software',  'May',     '2026-05-15','Fatima Al-Hassan','fatima@clearpathmed.com', 3,0,1,38, 33000, 6,'2026-03-05T15:00:00Z','at_risk',        'Deadline in 59 days. HR records incomplete. No developer interviews conducted yet.',  '2026-01-10T00:00:00Z'],
    ['cli-006','u-cpa','Ironclad Software',  'DevSecOps',            'July',    '2026-07-31','Leo Marchetti', 'l.marchetti@ironclad.dev',   0,0,0, 0,     0, 0, null,                  'onboarded',      'New client — onboarding in progress. Data integrations not yet connected.',           '2026-02-01T00:00:00Z'],
  ]
  clients.forEach(c => insertClient.run(...c))

  // ── Clusters ───────────────────────────────────────────────────────────────
  const insertCluster = db.prepare(`
    INSERT INTO clusters (id, client_id, name, theme, hours, credit_cad, status, narrative, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `)

  const clusters = [
    ['clus-001','cli-001','ML Fraud Detection Pipeline',     'MachineLearning',        340,127500,'approved', 'The team undertook systematic investigation into novel ML architectures for real-time fraud detection.', '2026-01-12T00:00:00Z'],
    ['clus-002','cli-001','Distributed Query Optimizer',     'PerformanceOptimization',280,105000,'approved', 'Systematic experimentation with query plan generation under distributed constraints.', '2026-01-25T00:00:00Z'],
    ['clus-003','cli-001','Real-time Inference Engine',      'SystemsEngineering',     210, 78750,'in_review','',                                                                                '2026-02-05T00:00:00Z'],
    ['clus-004','cli-002','Kubernetes Auto-scaler Research', 'CloudInfrastructure',    180, 67500,'approved', 'Investigation into predictive horizontal pod autoscaling using custom metrics.', '2026-01-10T00:00:00Z'],
    ['clus-005','cli-002','Zero-downtime Migration Protocol','SystemsEngineering',     120, 45000,'approved', 'Developed novel online schema migration tooling for PostgreSQL under sustained write load.', '2026-01-20T00:00:00Z'],
  ]
  clusters.forEach(c => insertCluster.run(...c))

  // ── Referrals ──────────────────────────────────────────────────────────────
  const insertReferral = db.prepare(`
    INSERT INTO referrals
      (id, referrer_user_id, ref_code, company_name, industry, fiscal_year, primary_contact,
       referral_status, commission_status, estimated_credit_cad, commission_cad,
       commission_confirmed, commission_paid, paid_at, notes, date_referred, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `)

  const referrals = [
    ['ref-001','u-cpa','REF-CROWE-001','Zenith Biotech Inc.',   'Life Sciences / Software','2024','Sophie Lamarche','filed',        'paid',     312000,2496,1,1,'2026-02-14T00:00:00Z','T661 filed 2026-02-01. CRA confirmation received. Commission invoice settled.',              '2025-10-08T00:00:00Z','2025-10-08T00:00:00Z'],
    ['ref-002','u-cpa','REF-CROWE-002','Pulse Commerce Ltd.',  'E-commerce SaaS',          '2025','Remy Bouchard',  'package_ready','confirmed',142000,1136,1,0,null,                  'Package delivered. Awaiting CPA review and T661 sign-off.',                                  '2025-11-22T00:00:00Z','2025-11-22T00:00:00Z'],
    ['ref-003','u-cpa','REF-CROWE-003','Atlas Network Systems','Network Infrastructure',   '2025','Jordan Kim',    'package_ready','confirmed', 67000, 536,1,0,null,                  'Package ready. 6 of 8 clusters approved. Final 2 under review.',                            '2025-12-10T00:00:00Z','2025-12-10T00:00:00Z'],
    ['ref-004','u-cpa','REF-CROWE-004','Axiom Robotics Corp.', 'Industrial Automation',   '2025','Marcus Webb',   'in_review',    'pending',   89000, 712,0,0,null,                  'In active review. 4 clusters identified, 2 approved so far.',                               '2026-01-15T00:00:00Z','2026-01-15T00:00:00Z'],
    ['ref-005','u-cpa','REF-CROWE-005','Meridian Analytics',   'Business Intelligence',   '2025','Chen Li',       'scanning',     'pending',       0,   0,0,0,null,                  'Just onboarded. GitHub and Jira connected. Initial scan in progress.',                      '2026-02-28T00:00:00Z','2026-02-28T00:00:00Z'],
  ]
  referrals.forEach(r => insertReferral.run(...r))

  // ── Company profiles ───────────────────────────────────────────────────────
  const insertCompanyProfile = db.prepare(`
    INSERT INTO company_profiles
      (id, user_id, business_number, company_name, province, employee_count, fiscal_year_end, industry_domain)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const companyProfiles = [
    ['cp-001', 'u-001', '123456789RC0001', 'Acme Corp',         'ON', 42,  'December', 'AI / Software'],
    ['cp-002', 'u-cpa', '987654321RC0001', 'Crowe MacKay LLP',  'ON', 210, 'March',    'Professional Services'],
    ['cp-003', 'u-dev', '555000123RC0001', 'TaxLift Dev',        'BC', 8,   'December', 'SaaS / FinTech'],
  ]
  companyProfiles.forEach(p => insertCompanyProfile.run(...p))

  // ── SR&ED Projects ─────────────────────────────────────────────────────────
  const insertProject = db.prepare(`
    INSERT INTO sred_projects
      (id, user_id, title, technical_uncertainty, technical_advancement, work_performed, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const projects = [
    [
      'sp-001', 'u-001',
      'ML Fraud Detection Engine',
      'It was technologically uncertain whether transformer-based architectures could achieve sub-50ms inference latency on commodity hardware for real-time payment fraud detection, given the non-stationary distribution of fraud patterns and the computational constraints of on-premise deployment.',
      'We advanced the state of knowledge in applied machine learning for financial fraud detection by developing a novel hybrid architecture combining sparse attention mechanisms with adaptive feature quantisation, achieving 99.2% precision at a 0.8% false-positive rate — a 340% improvement over the prior baseline.',
      'The team designed and executed systematic experiments iterating on model architectures, training data pipelines, and inference optimisation strategies. Work included: (1) literature review of 47 published transformer variants; (2) controlled experiments across 12 architectural configurations; (3) development of custom CUDA kernels for low-latency inference; (4) integration testing under production-scale synthetic load.',
      '2024-01-15', '2024-12-31', 'filed'
    ],
    [
      'sp-002', 'u-001',
      'Distributed Query Optimizer Research',
      'The technical challenge was whether cost-based query optimisation could be extended to federated, heterogeneous data sources with partial statistics — a problem not solved by existing open-source optimisers which assume full cardinality metadata.',
      'Advanced the practice of distributed query planning by developing an adaptive optimiser that infers partial statistics via Bayesian estimation, reducing cross-shard data movement by 68% on benchmark workloads.',
      'Systematic investigation across 3 experimental phases: baseline measurement, hypothesis formulation, and iterative prototype refinement. Experiments on 8-node cluster with 500GB+ synthetic TPC-DS datasets.',
      '2024-03-01', '2024-11-30', 'filed'
    ],
    [
      'sp-003', 'u-dev',
      'Automated SR&ED Classification System',
      'Uncertainty existed as to whether large language models could reliably classify mixed-activity software logs into SR&ED-eligible vs non-eligible activities at CPA-acceptable accuracy levels without extensive domain-specific fine-tuning.',
      'Developed a prompt-chain approach with structured output validation achieving 94% agreement with experienced SR&ED practitioners on a 500-case benchmark, establishing a new automated baseline for the industry.',
      'Iterative prompt engineering, evaluation harness development, and systematic testing across 6 LLM configurations. Includes active learning loop for continuous improvement on edge cases.',
      '2024-06-01', '2025-03-31', 'filed'
    ],
  ]
  projects.forEach(p => insertProject.run(...p))

  // ── SR&ED Expenditures ────────────────────────────────────────────────────
  const insertExp = db.prepare(`
    INSERT INTO sred_expenditures (id, project_id, category, amount, description, period)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const expenditures = [
    ['se-001', 'sp-001', 'Salaries',     280000, 'ML engineers and data scientists (3 FTE)', '2024'],
    ['se-002', 'sp-001', 'Contractors',   45000, 'External ML infrastructure specialist',     '2024'],
    ['se-003', 'sp-001', 'Materials',     12000, 'GPU compute credits and benchmark datasets', '2024'],
    ['se-004', 'sp-002', 'Salaries',     210000, 'Database engineers (2.5 FTE)',               '2024'],
    ['se-005', 'sp-002', 'Materials',      8500, 'Cloud compute for benchmarking experiments', '2024'],
    ['se-006', 'sp-003', 'Salaries',      95000, 'Full-stack developer and ML engineer',       '2024-2025'],
    ['se-007', 'sp-003', 'Contractors',   18000, 'SR&ED practitioner evaluation and review',   '2024-2025'],
  ]
  expenditures.forEach(e => insertExp.run(...e))

  // ── SR&ED Team Members ────────────────────────────────────────────────────
  const insertTeam = db.prepare(`
    INSERT INTO sred_team_members (id, project_id, name, role, time_percentage, qualifications)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const teamMembers = [
    ['tm-001', 'sp-001', 'Dr. Aisha Patel',   'Principal ML Researcher',    80, 'PhD Computer Science (U of T), 8 years applied ML in financial services'],
    ['tm-002', 'sp-001', 'Carlos Mendez',     'Senior ML Engineer',         90, 'MSc Machine Learning (McGill), 5 years production ML systems'],
    ['tm-003', 'sp-001', 'Yuna Park',         'Data Engineer',              60, 'BEng Software Engineering, 4 years data pipeline and MLOps'],
    ['tm-004', 'sp-002', 'Raj Krishnamurthy', 'Database Systems Lead',      85, 'PhD Computer Science, distributed systems focus, 10 years query optimisation'],
    ['tm-005', 'sp-002', 'Sofia Andersen',    'Infrastructure Engineer',    70, 'MEng Computer Engineering, cloud and distributed compute specialist'],
    ['tm-006', 'sp-003', 'Prateek Sharma',    'Founding Engineer',         100, 'BEng Software, 6 years full-stack, 2 years building SR&ED automation tooling'],
  ]
  teamMembers.forEach(t => insertTeam.run(...t))

  console.log('🌱  Database seeded with demo data (including SR&ED + Grants data).')
}

seed()

module.exports = db
