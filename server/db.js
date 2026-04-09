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
    onboarding_completed INTEGER NOT NULL DEFAULT 0,
    email_verified       INTEGER NOT NULL DEFAULT 0,
    email_verify_token   TEXT,
    email_verify_sent_at TEXT,
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

// ── Onboarding migrations (safe ALTER TABLE — no-ops if columns already exist) ─
try { db.exec('ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0') } catch { /* already exists */ }
try { db.exec('ALTER TABLE company_profiles ADD COLUMN tech_stack TEXT NOT NULL DEFAULT \'[]\'') }    catch { /* already exists */ }
try { db.exec('ALTER TABLE company_profiles ADD COLUMN sred_claimed TEXT NOT NULL DEFAULT \'not_sure\'') } catch { /* already exists */ }
// ── Grants migrations ─────────────────────────────────────────────────────────
try { db.exec('ALTER TABLE gap_answers ADD COLUMN has_university_partner INTEGER DEFAULT NULL') } catch { /* already exists */ }
// ── User drip email migrations ────────────────────────────────────────────────
try { db.exec(`
  CREATE TABLE IF NOT EXISTS user_drip_emails (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL,
    email          TEXT NOT NULL,
    sequence_step  INTEGER NOT NULL,
    send_after     TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',
    sent_at        TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  )
`) } catch { /* already exists */ }

// Mark all seeded demo users as having completed onboarding so they go straight to the dashboard
db.exec("UPDATE users SET onboarding_completed = 1 WHERE id IN ('u-001','u-002','u-003','u-cpa','u-005','u-dev','u-demo')")

// ── Ensure demo@taxlift.ai always exists (idempotent — safe to run on every boot) ─
// Password: demo123
db.prepare(`
  INSERT OR IGNORE INTO users (id, email, password_hash, full_name, firm_name, role, tenant_id, onboarding_completed)
  VALUES ('u-demo', 'demo@taxlift.ai', '$2a$10$19zhFBskimCkq66R1PkAMOBBmMFQWbQH9nN3wvYDUks1Csu/Pfwju', 'Demo User', 'TaxLift Demo', 'admin', 'tenant-demo', 1)
`).run()


// ── Seed helper ────────────────────────────────────────────────────────────────
function isEmpty(table) {
  return db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get().n === 0
}

function seed() {
  // Guard on a specific seeded record so the boot-time INSERT OR IGNORE
  // for demo@taxlift.ai does not prevent the full seed from running.
  if (db.prepare("SELECT id FROM users WHERE id = 'u-001'").get()) return

  const now  = new Date().toISOString()

  // ── Users ──────────────────────────────────────────────────────────────────
  // Passwords are pre-hashed (bcrypt cost 10) to avoid blocking startup.
  // Plaintext passwords for dev login: Admin1234! / Reviewer123! / Dev12345! / Cpa12345! / Audit123!
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, firm_name, role, tenant_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const users = [
    ['u-001', 'sarah.chen@acmecorp.com',  '$2a$10$90Ze1TBNf26jz2llHAtZhOOJgGfoL50nSvPCXDWOEXPgw3u5AmF2K', 'Sarah Chen',    'Acme Corp',          'admin',    'tenant-acme', '2025-09-01T00:00:00Z'],
    ['u-002', 'marcus.reid@acmecorp.com', '$2a$10$FZqXEDDDA/tU0ORKOp3Y0e0hfW.BS8XUJbeWiu5WDGlqMkCrJIZ.m', 'Marcus Reid',   'Acme Corp',          'reviewer', 'tenant-acme', '2025-09-01T00:00:00Z'],
    ['u-003', 'jordan.kim@acmecorp.com',  '$2a$10$STZz0FVIaHbzLUDIeQIH3eYApLvueNsxb5n.vjLHFgyeRvcCRi.eG', 'Jordan Kim',    'Acme Corp',          'developer','tenant-acme', '2025-10-15T00:00:00Z'],
    ['u-cpa', 'margaret.chen@crowe.ca',   '$2a$10$ozOEYq0HQLOl66mFlL8CfujVEAGYWFEdsu34P1.14KDKGHoiru/Nm',  'Margaret Chen', 'Crowe MacKay LLP',   'cpa',      'tenant-cpa',  '2024-09-01T00:00:00Z'],
    ['u-005', 'david.okafor@auditor.ca',  '$2a$10$/mXJOkSak5/BPDiF8gMsauEC.UqF/BhCqJhoKRhuLLRoxFWOsUd3.', 'David Okafor',  '',                   'auditor',  'tenant-acme', '2025-11-01T00:00:00Z'],
    ['u-dev', 'admin@taxlift.dev',        '$2a$10$90Ze1TBNf26jz2llHAtZhOOJgGfoL50nSvPCXDWOEXPgw3u5AmF2K', 'Dev Admin',     'TaxLift',            'admin',    'tenant-acme', now],
    ['u-demo','demo@taxlift.ai',          '$2a$10$19zhFBskimCkq66R1PkAMOBBmMFQWbQH9nN3wvYDUks1Csu/Pfwju', 'Demo User',     'TaxLift Demo',       'admin',    'tenant-demo', now],
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
    ['clus-001','cli-001','ML Fraud Detection Pipeline',     'MachineLearning',        340,127500,'Approved', 'The team undertook systematic investigation into novel ML architectures for real-time fraud detection.', '2026-01-12T00:00:00Z'],
    ['clus-002','cli-001','Distributed Query Optimizer',     'PerformanceOptimization',280,105000,'Approved', 'Systematic experimentation with query plan generation under distributed constraints.', '2026-01-25T00:00:00Z'],
    ['clus-003','cli-001','Real-time Inference Engine',      'SystemsEngineering',     210, 78750,'In Review','',                                                                                '2026-02-05T00:00:00Z'],
    ['clus-004','cli-002','Kubernetes Auto-scaler Research', 'CloudInfrastructure',    180, 67500,'Approved', 'Investigation into predictive horizontal pod autoscaling using custom metrics.', '2026-01-10T00:00:00Z'],
    ['clus-005','cli-002','Zero-downtime Migration Protocol','SystemsEngineering',     120, 45000,'Approved', 'Developed novel online schema migration tooling for PostgreSQL under sustained write load.', '2026-01-20T00:00:00Z'],
  ]
  clusters.forEach(c => insertCluster.run(...c))

  // ── Referrals ──────────────────────────────────────────────────────────────
  const insertReferral = db.prepare(`
    INSERT INTO referrals
      (id, referrer_user_id, ref_code, company_name, industry, fiscal_year, primary_contact,
       status, commission_status, credit_amount, commission_cad,
       commission_confirmed, commission_paid, date_referred, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `)

  const referrals = [
    ['ref-001','u-cpa','REF-CROWE-001','Zenith Biotech Inc.',   'Life Sciences / Software','2024','Sophie Lamarche','filed',        'paid',     312000,2496,1,1,'2025-10-08T00:00:00Z','2025-10-08T00:00:00Z'],
    ['ref-002','u-cpa','REF-CROWE-002','Pulse Commerce Ltd.',   'E-commerce SaaS',         '2025','Remy Bouchard',  'package_ready','confirmed',142000,1136,1,0,'2025-11-22T00:00:00Z','2025-11-22T00:00:00Z'],
    ['ref-003','u-cpa','REF-CROWE-003','Atlas Network Systems', 'Network Infrastructure',  '2025','Jordan Kim',    'package_ready','confirmed', 67000, 536,1,0,'2025-12-10T00:00:00Z','2025-12-10T00:00:00Z'],
    ['ref-004','u-cpa','REF-CROWE-004','Axiom Robotics Corp.',  'Industrial Automation',   '2025','Marcus Webb',   'in_review',    'pending',   89000, 712,0,0,'2026-01-15T00:00:00Z','2026-01-15T00:00:00Z'],
    ['ref-005','u-cpa','REF-CROWE-005','Meridian Analytics',    'Business Intelligence',   '2025','Chen Li',       'scanning',     'pending',       0,   0,0,0,'2026-02-28T00:00:00Z','2026-02-28T00:00:00Z'],
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
      (id, user_id, title, technical_uncertainty, work_performed, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const projects = [
    [
      'sp-001', 'u-001',
      'ML Fraud Detection Engine',
      'It was technologically uncertain whether transformer-based architectures could achieve sub-50ms inference latency on commodity hardware for real-time payment fraud detection, given the non-stationary distribution of fraud patterns and the computational constraints of on-premise deployment.',
      'The team designed and executed systematic experiments iterating on model architectures, training data pipelines, and inference optimisation strategies. Work included: (1) literature review of 47 published transformer variants; (2) controlled experiments across 12 architectural configurations; (3) development of custom CUDA kernels for low-latency inference; (4) integration testing under production-scale synthetic load.',
      'filed'
    ],
    [
      'sp-002', 'u-001',
      'Distributed Query Optimizer Research',
      'The technical challenge was whether cost-based query optimisation could be extended to federated, heterogeneous data sources with partial statistics — a problem not solved by existing open-source optimisers which assume full cardinality metadata.',
      'Systematic investigation across 3 experimental phases: baseline measurement, hypothesis formulation, and iterative prototype refinement. Experiments on 8-node cluster with 500GB+ synthetic TPC-DS datasets.',
      'filed'
    ],
    [
      'sp-003', 'u-dev',
      'Automated SR&ED Classification System',
      'Uncertainty existed as to whether large language models could reliably classify mixed-activity software logs into SR&ED-eligible vs non-eligible activities at CPA-acceptable accuracy levels without extensive domain-specific fine-tuning.',
      'Iterative prompt engineering, evaluation harness development, and systematic testing across 6 LLM configurations. Includes active learning loop for continuous improvement on edge cases.',
      'filed'
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

// ── Additive migrations for existing databases ────────────────────────────────
// CREATE TABLE IF NOT EXISTS won't add new columns to an existing table.
// Use ALTER TABLE … ADD COLUMN (idempotent via try/catch) for every new column.
;[
  'ALTER TABLE users ADD COLUMN email_verified         INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN email_verify_token     TEXT',
  'ALTER TABLE users ADD COLUMN email_verify_sent_at   TEXT',
  'ALTER TABLE users ADD COLUMN password_reset_token   TEXT',
  'ALTER TABLE users ADD COLUMN password_reset_sent_at TEXT',
].forEach(sql => { try { db.exec(sql) } catch { /* column already exists — safe to ignore */ } })

module.exports = db
