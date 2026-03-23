// ─── Users ───────────────────────────────────────────────────────────────────
export const USERS = [
  {
    id: 'u-001',
    tenant_id: 'tenant-acme',
    role: 'Admin',
    display_name: 'Sarah Chen',
    email: 'sarah.chen@acmecorp.com',
    github_user_id: 'schen',
    jira_account_id: 'acct-001',
    slack_user_id: 'U001',
    interview_opt_out_until: null,
    last_active_at: '2026-03-03T14:22:00Z',
    created_at: '2025-09-01T00:00:00Z',
  },
  {
    id: 'u-002',
    tenant_id: 'tenant-acme',
    role: 'Reviewer',
    display_name: 'Marcus Reid',
    email: 'marcus.reid@acmecorp.com',
    github_user_id: 'mreid',
    jira_account_id: 'acct-002',
    slack_user_id: 'U002',
    interview_opt_out_until: null,
    last_active_at: '2026-03-03T11:05:00Z',
    created_at: '2025-09-01T00:00:00Z',
  },
  {
    id: 'u-003',
    tenant_id: 'tenant-acme',
    role: 'Developer',
    display_name: 'Jordan Kim',
    email: 'jordan.kim@acmecorp.com',
    github_user_id: 'jkim',
    jira_account_id: 'acct-003',
    slack_user_id: 'U003',
    interview_opt_out_until: null,
    last_active_at: '2026-03-02T09:15:00Z',
    created_at: '2025-10-15T00:00:00Z',
  },
  {
    id: 'u-004',
    tenant_id: 'tenant-acme',
    role: 'Developer',
    display_name: 'Priya Sharma',
    email: 'priya.sharma@acmecorp.com',
    github_user_id: 'psharma',
    jira_account_id: 'acct-004',
    slack_user_id: 'U004',
    interview_opt_out_until: '2026-03-25T00:00:00Z',
    last_active_at: '2026-02-28T16:44:00Z',
    created_at: '2025-11-01T00:00:00Z',
  },
  {
    id: 'u-005',
    tenant_id: 'tenant-acme',
    role: 'Auditor',
    display_name: 'David Okafor',
    email: 'david.okafor@acmecorp.com',
    github_user_id: null,
    jira_account_id: null,
    slack_user_id: 'U005',
    interview_opt_out_until: null,
    last_active_at: '2026-02-25T10:00:00Z',
    created_at: '2026-01-15T00:00:00Z',
  },
]

// ─── Evidence Snapshots ───────────────────────────────────────────────────────
export const EVIDENCE_SNAPSHOTS = {
  'snap-001': {
    snapshot_id: 'snap-001',
    cluster_id: 'clus-001',
    tenant_id: 'tenant-acme',
    snapshot_date: '2026-01-12T08:30:00Z',
    checksum: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    storage_location: 's3://taxlift-evidence/tenant-acme/clusters/clus-001/snapshot-2026-01-12.tar.gz',
    glacier_archived_at: null,
    git_commits: [
      { sha: 'a1b2c3d4e5f6', message: 'feat: integrate Stripe v2 SDK with retry logic', author: 'jkim', committed_at: '2026-01-08T14:22:00Z', files_changed: 12, lines_added: 487, lines_deleted: 91, diff_truncated: null },
      { sha: 'b2c3d4e5f6a7', message: 'fix: resolve webhook signature verification edge case', author: 'jkim', committed_at: '2026-01-09T10:05:00Z', files_changed: 3, lines_added: 45, lines_deleted: 12, diff_truncated: null },
      { sha: 'c3d4e5f6a7b8', message: 'test: add 47 unit tests for payment state machine', author: 'psharma', committed_at: '2026-01-10T16:40:00Z', files_changed: 8, lines_added: 892, lines_deleted: 0, diff_truncated: null },
      { sha: 'd4e5f6a7b8c9', message: 'refactor: extract idempotency key logic to middleware', author: 'jkim', committed_at: '2026-01-11T09:15:00Z', files_changed: 6, lines_added: 134, lines_deleted: 78, diff_truncated: null },
      { sha: 'e5f6a7b8c9d0', message: 'chore: bump stripe-node to 14.8.0 (SCA support)', author: 'psharma', committed_at: '2026-01-11T11:30:00Z', files_changed: 2, lines_added: 8, lines_deleted: 6, diff_truncated: null },
    ],
    jira_tickets: [
      { ticket_id: 'PAY-412', summary: 'Research SCA compliance for EU payment flows', status: 'Done', worklog_hours: 24.5, story_points: 8, blocked_duration_hours: 6, status_history: [{ status: 'To Do', changed_at: '2026-01-05T09:00:00Z', changed_by: 'mreid' }, { status: 'In Progress', changed_at: '2026-01-06T10:00:00Z', changed_by: 'jkim' }, { status: 'Blocked', changed_at: '2026-01-07T14:00:00Z', changed_by: 'jkim' }, { status: 'Done', changed_at: '2026-01-10T17:00:00Z', changed_by: 'jkim' }] },
      { ticket_id: 'PAY-418', summary: 'Implement idempotent payment retry with exponential backoff', status: 'Done', worklog_hours: 18, story_points: 5, blocked_duration_hours: 0, status_history: [{ status: 'To Do', changed_at: '2026-01-07T09:00:00Z', changed_by: 'mreid' }, { status: 'Done', changed_at: '2026-01-11T16:00:00Z', changed_by: 'psharma' }] },
    ],
    build_logs: [
      { build_id: 'bk-1001', status: 'failure', branch: 'experiment/stripe-v2', started_at: '2026-01-09T08:00:00Z', duration_seconds: 312, failure_stage: 'integration-tests' },
      { build_id: 'bk-1002', status: 'failure', branch: 'experiment/stripe-v2', started_at: '2026-01-09T10:30:00Z', duration_seconds: 298, failure_stage: 'integration-tests' },
      { build_id: 'bk-1003', status: 'success', branch: 'experiment/stripe-v2', started_at: '2026-01-10T14:00:00Z', duration_seconds: 445, failure_stage: null },
      { build_id: 'bk-1004', status: 'success', branch: 'experiment/stripe-v2', started_at: '2026-01-11T12:00:00Z', duration_seconds: 431, failure_stage: null },
    ],
  },
  'snap-002': {
    snapshot_id: 'snap-002',
    cluster_id: 'clus-002',
    tenant_id: 'tenant-acme',
    snapshot_date: '2026-01-25T11:00:00Z',
    checksum: 'sha256:f4c92b7a3d81e054bc2a7f6c9d3e5b1a4f8c2e7d6b9a0c3f5e8d1b4a7c0e3f6',
    storage_location: 's3://taxlift-evidence/tenant-acme/clusters/clus-002/snapshot-2026-01-25.tar.gz',
    glacier_archived_at: null,
    git_commits: [
      { sha: 'f1e2d3c4b5a6', message: 'poc: prototype Redis Cluster sharding strategy', author: 'psharma', committed_at: '2026-01-19T10:00:00Z', files_changed: 5, lines_added: 210, lines_deleted: 30, diff_truncated: null },
      { sha: 'a6b5c4d3e2f1', message: 'experiment: compare consistent hashing vs slot-based routing', author: 'psharma', committed_at: '2026-01-21T15:30:00Z', files_changed: 4, lines_added: 187, lines_deleted: 45, diff_truncated: null },
      { sha: '1a2b3c4d5e6f', message: 'perf: benchmark cache hit ratio improvements (67% → 94%)', author: 'jkim', committed_at: '2026-01-23T09:45:00Z', files_changed: 2, lines_added: 38, lines_deleted: 12, diff_truncated: null },
    ],
    jira_tickets: [
      { ticket_id: 'INF-201', summary: 'Investigate Redis Cluster migration path for payment service', status: 'In Review', worklog_hours: 32, story_points: 13, blocked_duration_hours: 8, status_history: [] },
      { ticket_id: 'INF-207', summary: 'Design cache invalidation strategy for distributed reads', status: 'Done', worklog_hours: 21, story_points: 8, blocked_duration_hours: 0, status_history: [] },
    ],
    build_logs: [
      { build_id: 'bk-2001', status: 'failure', branch: 'poc/cache-redesign', started_at: '2026-01-22T09:00:00Z', duration_seconds: 520, failure_stage: 'load-tests' },
      { build_id: 'bk-2002', status: 'success', branch: 'poc/cache-redesign', started_at: '2026-01-23T14:00:00Z', duration_seconds: 510, failure_stage: null },
    ],
  },
  'snap-003': {
    snapshot_id: 'snap-003',
    cluster_id: 'clus-003',
    tenant_id: 'tenant-acme',
    snapshot_date: '2026-02-05T09:15:00Z',
    checksum: 'sha256:c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3',
    storage_location: 's3://taxlift-evidence/tenant-acme/clusters/clus-003/snapshot-2026-02-05.tar.gz',
    glacier_archived_at: null,
    git_commits: [
      { sha: '2b3c4d5e6f7a', message: 'feat: implement XGBoost feature pipeline for transaction scoring', author: 'jkim', committed_at: '2026-01-28T11:00:00Z', files_changed: 18, lines_added: 1240, lines_deleted: 230, diff_truncated: null },
      { sha: '3c4d5e6f7a8b', message: 'experiment: SMOTE oversampling for class imbalance (F1: 0.71→0.89)', author: 'jkim', committed_at: '2026-01-30T14:20:00Z', files_changed: 6, lines_added: 312, lines_deleted: 45, diff_truncated: null },
      { sha: '4d5e6f7a8b9c', message: 'feat: add SHAP explainability layer for model audit trail', author: 'psharma', committed_at: '2026-02-01T10:30:00Z', files_changed: 9, lines_added: 445, lines_deleted: 78, diff_truncated: null },
      { sha: '5e6f7a8b9c0d', message: 'perf: optimize feature extraction from 340ms to 12ms via vectorization', author: 'jkim', committed_at: '2026-02-03T16:00:00Z', files_changed: 4, lines_added: 89, lines_deleted: 134, diff_truncated: null },
    ],
    jira_tickets: [
      { ticket_id: 'ML-089', summary: 'Research ensemble methods for real-time fraud detection', status: 'Done', worklog_hours: 56, story_points: 21, blocked_duration_hours: 12, status_history: [] },
      { ticket_id: 'ML-095', summary: 'Implement model versioning and A/B testing framework', status: 'In Progress', worklog_hours: 34, story_points: 13, blocked_duration_hours: 0, status_history: [] },
    ],
    build_logs: [
      { build_id: 'bk-3001', status: 'failure', branch: 'ml/fraud-v3', started_at: '2026-01-29T08:00:00Z', duration_seconds: 1240, failure_stage: 'model-validation' },
      { build_id: 'bk-3002', status: 'failure', branch: 'ml/fraud-v3', started_at: '2026-01-31T10:00:00Z', duration_seconds: 1380, failure_stage: 'model-validation' },
      { build_id: 'bk-3003', status: 'success', branch: 'ml/fraud-v3', started_at: '2026-02-03T15:00:00Z', duration_seconds: 1520, failure_stage: null },
    ],
  },
}

// ─── Narratives ───────────────────────────────────────────────────────────────
export const NARRATIVES = {
  'narr-001': {
    id: 'narr-001',
    cluster_id: 'clus-001',
    tenant_id: 'tenant-acme',
    version: 2,
    format: 'T661',
    content_text: `Business Component: Payment Gateway — Stripe v2 Integration

Line of Business Activity Description:
During the period January 5–11, 2026, Acme Corp engineering conducted systematic investigation and experimental development to achieve Strong Customer Authentication (SCA) compliance under PSD2 regulatory requirements for EU payment flows.

Technological Uncertainty:
The taxpayer faced technological uncertainty in determining whether Stripe's v2 SDK could be integrated with the existing idempotency key framework while preserving SCA compliance across all EU payment corridors. Existing documentation provided insufficient guidance on webhook signature verification edge cases, requiring iterative experimental cycles.

Work Performed:
Software engineers Jordan Kim and Priya Sharma conducted 5 experimental development iterations. Build records bk-1001 and bk-1002 document two failed integration-test cycles during which the team isolated SCA signature validation failures. A third successful build (bk-1003) followed systematic refactoring of the idempotency key middleware. Jira ticket PAY-412 documents 24.5 hours of blocked investigation into EU SCA compliance requirements, including a 6-hour blocked period resolving an undocumented Stripe webhook edge case.

Qualified SR&ED Work:
Total qualified work: 156.5 hours across 2 developers. Eligible expenditures relate to wages for systematic investigation of novel integration challenges not solvable by standard software engineering practice.`,
    llm_model_version: 'gpt-4-0125-preview',
    prompt_hash: 'sha256:9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
    quality_score: 0.93,
    quality_passed: true,
    quality_failure_reasons: [],
    citations: [
      { claim_text: 'two failed integration-test cycles', evidence_field: 'build_logs[0].status', evidence_value: 'failure' },
      { claim_text: '24.5 hours of blocked investigation', evidence_field: 'jira_tickets[0].worklog_hours', evidence_value: '24.5' },
      { claim_text: '6-hour blocked period', evidence_field: 'jira_tickets[0].blocked_duration_hours', evidence_value: '6' },
      { claim_text: 'Jordan Kim and Priya Sharma', evidence_field: 'git_commits[0].author', evidence_value: 'jkim' },
    ],
    approved_by: 'u-002',
    approved_at: '2026-01-28T15:30:00Z',
    edit_history: [
      { editor_id: 'u-002', edited_at: '2026-01-28T14:55:00Z', diff: '@@ -12,3 +12,3 @@\n-Work Performed:\n+Work Performed (SR&ED Eligible):\n' },
    ],
  },
  'narr-002': {
    id: 'narr-002',
    cluster_id: 'clus-002',
    tenant_id: 'tenant-acme',
    version: 1,
    format: 'T661',
    content_text: `Business Component: Cache Redesign — Redis Cluster Migration

Line of Business Activity Description:
During January 19–23, 2026, Acme Corp systematically investigated whether Redis Cluster's slot-based routing could be adopted as a replacement for the current single-node Redis architecture while maintaining sub-5ms p99 cache latency at 10,000 requests/second.

Technological Uncertainty:
Engineering faced uncertainty regarding whether consistent hashing versus slot-based routing would yield superior cache hit ratios under the existing data access patterns of the payment service. No prior published benchmarks existed for this specific workload profile.

Work Performed:
Engineer Priya Sharma designed and executed two experimental sharding strategies (commits f1e2d3c4b5a6 and a6b5c4d3e2f1). A load test failure (build bk-2001) during initial slot-based routing trials necessitated architectural revision. The team achieved a cache hit ratio improvement from 67% to 94% (commit 1a2b3c4d5e6f). Jira INF-201 documents 32 hours of investigation with 8 blocked hours resolving replication lag under write-heavy load scenarios.

Qualified SR&ED Work:
Total qualified work: 89 hours. Eligible wages for systematic investigation of novel distributed caching architecture for the taxpayer's specific workload characteristics.`,
    llm_model_version: 'gpt-4-0125-preview',
    prompt_hash: 'sha256:1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c',
    quality_score: 0.88,
    quality_passed: true,
    quality_failure_reasons: [],
    citations: [
      { claim_text: 'cache hit ratio improvement from 67% to 94%', evidence_field: 'git_commits[2].message', evidence_value: 'perf: benchmark cache hit ratio improvements (67% → 94%)' },
      { claim_text: 'load test failure', evidence_field: 'build_logs[0].status', evidence_value: 'failure' },
      { claim_text: '32 hours of investigation', evidence_field: 'jira_tickets[0].worklog_hours', evidence_value: '32' },
    ],
    approved_by: null,
    approved_at: null,
    edit_history: [],
  },
  'narr-003': {
    id: 'narr-003',
    cluster_id: 'clus-003',
    tenant_id: 'tenant-acme',
    version: 1,
    format: 'T661',
    content_text: `Business Component: ML Pipeline — Fraud Detection v3

Line of Business Activity Description:
During January 28 – February 3, 2026, Acme Corp conducted experimental AI/ML development to achieve real-time transaction fraud scoring with sub-15ms inference latency, a capability not commercially available for the taxpayer's specific transaction profile.

Technological Uncertainty:
Engineering faced uncertainty in (a) whether XGBoost ensemble methods could achieve F1 > 0.85 on the taxpayer's severely imbalanced transaction dataset without manual feature engineering, and (b) whether SHAP explainability could be integrated within latency constraints required for real-time approval flows.

Work Performed:
Engineers Jordan Kim and Priya Sharma conducted 3 experimental ML training cycles. Model validation failures in builds bk-3001 and bk-3002 document systematic testing of class imbalance mitigation strategies. SMOTE oversampling experiments (commit 3c4d5e6f7a8b) achieved F1 improvement from 0.71 to 0.89. Feature extraction was subsequently optimized from 340ms to 12ms through vectorization (commit 5e6f7a8b9c0d). Jira ML-089 documents 56 hours of qualified research including a 12-hour blocked period resolving model drift under live transaction data.

Qualified SR&ED Work:
Total qualified work: 234 hours. Eligible wages for systematic ML research producing novel fraud detection capability not achievable through standard ML engineering practice.`,
    llm_model_version: 'gpt-4-turbo-2024-04-09',
    prompt_hash: 'sha256:2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d',
    quality_score: 0.91,
    quality_passed: true,
    quality_failure_reasons: [],
    citations: [
      { claim_text: 'F1 improvement from 0.71 to 0.89', evidence_field: 'git_commits[1].message', evidence_value: 'experiment: SMOTE oversampling for class imbalance (F1: 0.71→0.89)' },
      { claim_text: 'feature extraction optimized from 340ms to 12ms', evidence_field: 'git_commits[3].message', evidence_value: 'perf: optimize feature extraction from 340ms to 12ms via vectorization' },
      { claim_text: '56 hours of qualified research', evidence_field: 'jira_tickets[0].worklog_hours', evidence_value: '56' },
    ],
    approved_by: null,
    approved_at: null,
    edit_history: [],
  },
}

// ─── Clusters ─────────────────────────────────────────────────────────────────
export const CLUSTERS = [
  {
    id: 'clus-001',
    tenant_id: 'tenant-acme',
    status: 'Approved',
    created_at: '2026-01-12T08:30:00Z',
    business_component: 'Payment Gateway — Stripe v2 Integration',
    trigger_rules: [
      { heuristic: 'HighCodeChurn', weight: 0.35, fired_value: 0.82, threshold: 0.70 },
      { heuristic: 'ExperimentalBranches', weight: 0.25, fired_value: 0.91, threshold: 0.75 },
      { heuristic: 'BlockedStatus', weight: 0.20, fired_value: 0.78, threshold: 0.65 },
    ],
    risk_score: 0.87,
    aggregate_time_hours: 156.5,
    eligibility_percentage: 80.0,
    estimated_credit_cad: 31200.0,
    estimated_credit_usd: 23040.0,
    evidence_snapshot_id: 'snap-001',
    narrative_id: 'narr-001',
    eligibility_rule_version_id: 'rule-v2.1',
    merged_into_cluster_id: null,
    manual_override_pct: null,
    manual_override_reason: null,
    stale_context: false,
    proxy_used: false,
    proxy_confidence: null,
  },
  {
    id: 'clus-002',
    tenant_id: 'tenant-acme',
    status: 'Drafted',
    created_at: '2026-01-25T11:00:00Z',
    business_component: 'Cache Redesign — Redis Cluster Migration',
    trigger_rules: [
      { heuristic: 'HighCodeChurn', weight: 0.35, fired_value: 0.79, threshold: 0.70 },
      { heuristic: 'BuildExperimentation', weight: 0.30, fired_value: 0.85, threshold: 0.70 },
    ],
    risk_score: 0.82,
    aggregate_time_hours: 89.0,
    eligibility_percentage: null,
    estimated_credit_cad: null,
    estimated_credit_usd: null,
    evidence_snapshot_id: 'snap-002',
    narrative_id: 'narr-002',
    eligibility_rule_version_id: 'rule-v2.1',
    merged_into_cluster_id: null,
    manual_override_pct: null,
    manual_override_reason: null,
    stale_context: false,
    proxy_used: false,
    proxy_confidence: null,
  },
  {
    id: 'clus-003',
    tenant_id: 'tenant-acme',
    status: 'Drafted',
    created_at: '2026-02-05T09:15:00Z',
    business_component: 'ML Pipeline — Fraud Detection v3',
    trigger_rules: [
      { heuristic: 'HighCodeChurn', weight: 0.35, fired_value: 0.94, threshold: 0.70 },
      { heuristic: 'BuildExperimentation', weight: 0.30, fired_value: 0.92, threshold: 0.70 },
      { heuristic: 'RefactoringPattern', weight: 0.20, fired_value: 0.88, threshold: 0.75 },
    ],
    risk_score: 0.91,
    aggregate_time_hours: 234.0,
    eligibility_percentage: null,
    estimated_credit_cad: null,
    estimated_credit_usd: null,
    evidence_snapshot_id: 'snap-003',
    narrative_id: 'narr-003',
    eligibility_rule_version_id: 'rule-v2.1',
    merged_into_cluster_id: null,
    manual_override_pct: null,
    manual_override_reason: null,
    stale_context: true,
    proxy_used: false,
    proxy_confidence: null,
  },
  {
    id: 'clus-004',
    tenant_id: 'tenant-acme',
    status: 'Approved',
    created_at: '2026-01-08T14:00:00Z',
    business_component: 'API Rate Limiting Engine — Token Bucket Algorithm',
    trigger_rules: [
      { heuristic: 'HighCodeChurn', weight: 0.35, fired_value: 0.76, threshold: 0.70 },
      { heuristic: 'PerformanceOptimization', weight: 0.25, fired_value: 0.81, threshold: 0.75 },
    ],
    risk_score: 0.76,
    aggregate_time_hours: 67.0,
    eligibility_percentage: 75.0,
    estimated_credit_cad: 13440.0,
    estimated_credit_usd: 9945.6,
    evidence_snapshot_id: 'snap-004',
    narrative_id: 'narr-004',
    eligibility_rule_version_id: 'rule-v2.1',
    merged_into_cluster_id: null,
    manual_override_pct: null,
    manual_override_reason: null,
    stale_context: false,
    proxy_used: true,
    proxy_confidence: 'High',
  },
  {
    id: 'clus-005',
    tenant_id: 'tenant-acme',
    status: 'Interviewed',
    created_at: '2026-02-12T10:30:00Z',
    business_component: 'Database Schema — Zero-Downtime Migration Framework',
    trigger_rules: [
      { heuristic: 'HighCodeChurn', weight: 0.35, fired_value: 0.74, threshold: 0.70 },
      { heuristic: 'BlockedStatus', weight: 0.20, fired_value: 0.77, threshold: 0.65 },
    ],
    risk_score: 0.68,
    aggregate_time_hours: null,
    eligibility_percentage: null,
    estimated_credit_cad: null,
    estimated_credit_usd: null,
    evidence_snapshot_id: 'snap-005',
    narrative_id: null,
    eligibility_rule_version_id: 'rule-v2.1',
    merged_into_cluster_id: null,
    manual_override_pct: null,
    manual_override_reason: null,
    stale_context: false,
    proxy_used: false,
    proxy_confidence: null,
  },
  {
    id: 'clus-006',
    tenant_id: 'tenant-acme',
    status: 'New',
    created_at: '2026-02-20T07:45:00Z',
    business_component: 'WebSocket Real-time Dashboard — Event Streaming',
    trigger_rules: [
      { heuristic: 'ExperimentalBranches', weight: 0.25, fired_value: 0.80, threshold: 0.75 },
      { heuristic: 'HighCodeChurn', weight: 0.35, fired_value: 0.72, threshold: 0.70 },
    ],
    risk_score: 0.71,
    aggregate_time_hours: null,
    eligibility_percentage: null,
    estimated_credit_cad: null,
    estimated_credit_usd: null,
    evidence_snapshot_id: 'snap-006',
    narrative_id: null,
    eligibility_rule_version_id: 'rule-v2.1',
    merged_into_cluster_id: null,
    manual_override_pct: null,
    manual_override_reason: null,
    stale_context: false,
    proxy_used: false,
    proxy_confidence: null,
  },
  {
    id: 'clus-007',
    tenant_id: 'tenant-acme',
    status: 'Drafted',
    created_at: '2026-02-10T13:00:00Z',
    business_component: 'OAuth2 Authorization Server — PKCE Implementation',
    trigger_rules: [
      { heuristic: 'HighCodeChurn', weight: 0.35, fired_value: 0.88, threshold: 0.70 },
      { heuristic: 'RefactoringPattern', weight: 0.20, fired_value: 0.84, threshold: 0.75 },
      { heuristic: 'ExperimentalBranches', weight: 0.25, fired_value: 0.79, threshold: 0.75 },
    ],
    risk_score: 0.85,
    aggregate_time_hours: 123.0,
    eligibility_percentage: null,
    estimated_credit_cad: null,
    estimated_credit_usd: null,
    evidence_snapshot_id: 'snap-007',
    narrative_id: 'narr-007',
    eligibility_rule_version_id: 'rule-v2.1',
    merged_into_cluster_id: null,
    manual_override_pct: null,
    manual_override_reason: null,
    stale_context: false,
    proxy_used: false,
    proxy_confidence: null,
  },
  {
    id: 'clus-008',
    tenant_id: 'tenant-acme',
    status: 'Rejected',
    created_at: '2026-01-20T09:00:00Z',
    business_component: 'Image Resizing — CDN Thumbnail Pipeline',
    trigger_rules: [
      { heuristic: 'HighCodeChurn', weight: 0.35, fired_value: 0.45, threshold: 0.70 },
    ],
    risk_score: 0.42,
    aggregate_time_hours: null,
    eligibility_percentage: null,
    estimated_credit_cad: null,
    estimated_credit_usd: null,
    evidence_snapshot_id: 'snap-008',
    narrative_id: null,
    eligibility_rule_version_id: 'rule-v2.1',
    merged_into_cluster_id: null,
    manual_override_pct: null,
    manual_override_reason: null,
    stale_context: false,
    proxy_used: false,
    proxy_confidence: null,
  },
  {
    id: 'clus-009',
    tenant_id: 'tenant-acme',
    status: 'Approved',
    created_at: '2026-01-03T10:00:00Z',
    business_component: 'Search Engine — Elasticsearch Query Optimization',
    trigger_rules: [
      { heuristic: 'PerformanceOptimization', weight: 0.25, fired_value: 0.87, threshold: 0.75 },
      { heuristic: 'BuildExperimentation', weight: 0.30, fired_value: 0.79, threshold: 0.70 },
    ],
    risk_score: 0.79,
    aggregate_time_hours: 45.0,
    eligibility_percentage: 85.0,
    estimated_credit_cad: 9180.0,
    estimated_credit_usd: 6793.2,
    evidence_snapshot_id: 'snap-009',
    narrative_id: 'narr-009',
    eligibility_rule_version_id: 'rule-v2.0',
    merged_into_cluster_id: null,
    manual_override_pct: 5,
    manual_override_reason: 'CPA review confirms novel query planner heuristics qualify at higher percentage. Reference advisory file #2026-003.',
    stale_context: false,
    proxy_used: true,
    proxy_confidence: 'Medium',
  },
  {
    id: 'clus-010',
    tenant_id: 'tenant-acme',
    status: 'Interviewed',
    created_at: '2026-02-18T08:15:00Z',
    business_component: 'Distributed Lock Manager — Lease-Based Coordination',
    trigger_rules: [
      { heuristic: 'ExperimentalBranches', weight: 0.25, fired_value: 0.82, threshold: 0.75 },
      { heuristic: 'HighCodeChurn', weight: 0.35, fired_value: 0.75, threshold: 0.70 },
    ],
    risk_score: 0.73,
    aggregate_time_hours: null,
    eligibility_percentage: null,
    estimated_credit_cad: null,
    estimated_credit_usd: null,
    evidence_snapshot_id: 'snap-010',
    narrative_id: null,
    eligibility_rule_version_id: 'rule-v2.1',
    merged_into_cluster_id: null,
    manual_override_pct: null,
    manual_override_reason: null,
    stale_context: false,
    proxy_used: false,
    proxy_confidence: null,
  },
  {
    id: 'clus-011',
    tenant_id: 'tenant-acme',
    status: 'New',
    created_at: '2026-02-25T06:00:00Z',
    business_component: 'GraphQL Federation — Schema Stitching Layer',
    trigger_rules: [
      { heuristic: 'HighCodeChurn', weight: 0.35, fired_value: 0.71, threshold: 0.70 },
      { heuristic: 'RefactoringPattern', weight: 0.20, fired_value: 0.78, threshold: 0.75 },
    ],
    risk_score: 0.66,
    aggregate_time_hours: null,
    eligibility_percentage: null,
    estimated_credit_cad: null,
    estimated_credit_usd: null,
    evidence_snapshot_id: 'snap-011',
    narrative_id: null,
    eligibility_rule_version_id: 'rule-v2.1',
    merged_into_cluster_id: null,
    manual_override_pct: null,
    manual_override_reason: null,
    stale_context: false,
    proxy_used: false,
    proxy_confidence: null,
  },
  {
    id: 'clus-012',
    tenant_id: 'tenant-acme',
    status: 'Drafted',
    created_at: '2026-02-14T12:00:00Z',
    business_component: 'Kubernetes Autoscaling — Predictive HPA Algorithm',
    trigger_rules: [
      { heuristic: 'HighCodeChurn', weight: 0.35, fired_value: 0.91, threshold: 0.70 },
      { heuristic: 'BuildExperimentation', weight: 0.30, fired_value: 0.89, threshold: 0.70 },
      { heuristic: 'PerformanceOptimization', weight: 0.25, fired_value: 0.84, threshold: 0.75 },
    ],
    risk_score: 0.88,
    aggregate_time_hours: 178.0,
    eligibility_percentage: null,
    estimated_credit_cad: null,
    estimated_credit_usd: null,
    evidence_snapshot_id: 'snap-012',
    narrative_id: 'narr-012',
    eligibility_rule_version_id: 'rule-v2.1',
    merged_into_cluster_id: null,
    manual_override_pct: null,
    manual_override_reason: null,
    stale_context: false,
    proxy_used: false,
    proxy_confidence: null,
  },
]

// ─── Integrations ─────────────────────────────────────────────────────────────
export const INTEGRATIONS = [
  {
    integration: 'github',
    status: 'healthy',
    last_sync_at: '2026-03-03T14:00:00Z',
    token_expires_at: '2026-06-03T00:00:00Z',
    error_detail: null,
  },
  {
    integration: 'jira',
    status: 'degraded',
    last_sync_at: '2026-03-03T11:30:00Z',
    token_expires_at: '2026-04-15T00:00:00Z',
    error_detail: 'Rate limit exceeded on Jira Cloud API. Retry scheduled in 4 minutes.',
  },
  {
    integration: 'slack',
    status: 'healthy',
    last_sync_at: '2026-03-03T14:10:00Z',
    token_expires_at: null,
    error_detail: null,
  },
]

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const AUDIT_LOG = [
  { id: 'al-020', tenant_id: 'tenant-acme', user_id: 'u-002', action_type: 'NARRATIVE_APPROVED', resource_type: 'narrative', resource_id: 'narr-001', old_value: { approved_by: null }, new_value: { approved_by: 'u-002', approved_at: '2026-01-28T15:30:00Z' }, ip_address: '203.0.113.42', user_agent: 'Mozilla/5.0', timestamp: '2026-01-28T15:30:00Z', signature: 'hmac-001' },
  { id: 'al-019', tenant_id: 'tenant-acme', user_id: 'u-002', action_type: 'NARRATIVE_EDITED', resource_type: 'narrative', resource_id: 'narr-001', old_value: { version: 1 }, new_value: { version: 2 }, ip_address: '203.0.113.42', user_agent: 'Mozilla/5.0', timestamp: '2026-01-28T14:55:00Z', signature: 'hmac-002' },
  { id: 'al-018', tenant_id: 'tenant-acme', user_id: null, action_type: 'NARRATIVE_GENERATED', resource_type: 'narrative', resource_id: 'narr-003', old_value: null, new_value: { version: 1, quality_score: 0.91 }, ip_address: '10.0.1.5', user_agent: null, timestamp: '2026-02-07T10:30:00Z', signature: 'hmac-003' },
  { id: 'al-017', tenant_id: 'tenant-acme', user_id: null, action_type: 'EVIDENCE_SNAPSHOT_CREATED', resource_type: 'evidence_snapshot', resource_id: 'snap-003', old_value: null, new_value: { snapshot_id: 'snap-003', integrity_verified: true }, ip_address: '10.0.1.4', user_agent: null, timestamp: '2026-02-05T09:15:00Z', signature: 'hmac-004' },
  { id: 'al-016', tenant_id: 'tenant-acme', user_id: 'u-001', action_type: 'USER_ROLE_CHANGED', resource_type: 'user', resource_id: 'u-005', old_value: { role: 'Reviewer' }, new_value: { role: 'Auditor' }, ip_address: '203.0.113.10', user_agent: 'Mozilla/5.0', timestamp: '2026-02-03T09:00:00Z', signature: 'hmac-005' },
  { id: 'al-015', tenant_id: 'tenant-acme', user_id: 'u-002', action_type: 'ELIGIBILITY_OVERRIDE', resource_type: 'cluster', resource_id: 'clus-009', old_value: { eligibility_percentage: 80 }, new_value: { eligibility_percentage: 85, manual_override_pct: 5 }, ip_address: '203.0.113.42', user_agent: 'Mozilla/5.0', timestamp: '2026-01-25T16:10:00Z', signature: 'hmac-006' },
  { id: 'al-014', tenant_id: 'tenant-acme', user_id: 'u-002', action_type: 'NARRATIVE_APPROVED', resource_type: 'narrative', resource_id: 'narr-009', old_value: { approved_by: null }, new_value: { approved_by: 'u-002' }, ip_address: '203.0.113.42', user_agent: 'Mozilla/5.0', timestamp: '2026-01-24T14:00:00Z', signature: 'hmac-007' },
  { id: 'al-013', tenant_id: 'tenant-acme', user_id: null, action_type: 'CALCULATION_COMPLETED', resource_type: 'cluster', resource_id: 'clus-001', old_value: null, new_value: { eligibility_percentage: 80, credit_cad: 31200 }, ip_address: '10.0.1.6', user_agent: null, timestamp: '2026-01-28T15:35:00Z', signature: 'hmac-008' },
  { id: 'al-012', tenant_id: 'tenant-acme', user_id: null, action_type: 'NARRATIVE_GENERATED', resource_type: 'narrative', resource_id: 'narr-002', old_value: null, new_value: { version: 1, quality_score: 0.88 }, ip_address: '10.0.1.5', user_agent: null, timestamp: '2026-01-27T09:00:00Z', signature: 'hmac-009' },
  { id: 'al-011', tenant_id: 'tenant-acme', user_id: null, action_type: 'CLUSTER_CREATED', resource_type: 'cluster', resource_id: 'clus-003', old_value: null, new_value: { status: 'New', risk_score: 0.91 }, ip_address: '10.0.1.3', user_agent: null, timestamp: '2026-02-05T09:15:00Z', signature: 'hmac-010' },
  { id: 'al-010', tenant_id: 'tenant-acme', user_id: 'u-001', action_type: 'INTEGRATION_AUTHORIZED', resource_type: 'integration', resource_id: 'github', old_value: { status: 'disconnected' }, new_value: { status: 'healthy' }, ip_address: '203.0.113.10', user_agent: 'Mozilla/5.0', timestamp: '2025-09-01T10:00:00Z', signature: 'hmac-011' },
  { id: 'al-009', tenant_id: 'tenant-acme', user_id: 'u-002', action_type: 'NARRATIVE_REJECTED', resource_type: 'narrative', resource_id: 'narr-old', old_value: { status: 'Drafted' }, new_value: { status: 'Rejected' }, ip_address: '203.0.113.42', user_agent: 'Mozilla/5.0', timestamp: '2026-01-15T11:30:00Z', signature: 'hmac-012' },
  { id: 'al-008', tenant_id: 'tenant-acme', user_id: 'u-005', action_type: 'EVIDENCE_ACCESS', resource_type: 'evidence_snapshot', resource_id: 'snap-001', old_value: null, new_value: null, ip_address: '198.51.100.7', user_agent: 'Mozilla/5.0', timestamp: '2026-02-25T10:00:00Z', signature: 'hmac-013' },
  { id: 'al-007', tenant_id: 'tenant-acme', user_id: 'u-002', action_type: 'DATA_EXPORT', resource_type: 'report', resource_id: 'report-q4-2025', old_value: null, new_value: { format: 'pdf', period: 'Q4 2025' }, ip_address: '203.0.113.42', user_agent: 'Mozilla/5.0', timestamp: '2026-01-10T09:15:00Z', signature: 'hmac-014' },
  { id: 'al-006', tenant_id: 'tenant-acme', user_id: 'u-001', action_type: 'RULE_VERSION_ACTIVATED', resource_type: 'eligibility_rules', resource_id: 'rule-v2.1', old_value: { version: 'rule-v2.0' }, new_value: { version: 'rule-v2.1' }, ip_address: '203.0.113.10', user_agent: 'Mozilla/5.0', timestamp: '2026-01-20T08:00:00Z', signature: 'hmac-015' },
]

// ─── Rate Cards ───────────────────────────────────────────────────────────────
// employment_type: 'FTE' | 'Contractor'
// overhead_pct: applied on top of hourly rate for FTE (SR&ED eligible overhead)
export const RATE_CARDS = {
  'u-001': { user_id: 'u-001', employment_type: 'FTE',        hourly_rate_cad: 95.00, overhead_pct: 25 },
  'u-002': { user_id: 'u-002', employment_type: 'FTE',        hourly_rate_cad: 105.00, overhead_pct: 25 },
  'u-003': { user_id: 'u-003', employment_type: 'FTE',        hourly_rate_cad: 82.00, overhead_pct: 25 },
  'u-004': { user_id: 'u-004', employment_type: 'Contractor', hourly_rate_cad: 130.00, overhead_pct: 0  },
}

// ─── Developer Interviews (Interviewer agent results) ────────────────────────
export const DEVELOPER_INTERVIEWS = {
  'clus-005': {
    cluster_id: 'clus-005',
    developer_id: 'u-003',
    slack_sent_at: '2026-02-13T09:00:00Z',
    responded_at: '2026-02-13T11:35:00Z',
    response_word_count: 412,
    quality_tag: 'High',
    response_excerpt:
      "We needed a way to add new columns without any downtime. The existing ALTER TABLE approach would lock the entire table for minutes under production load. We tried the ghost migration tool but it had issues with our foreign key constraints, so we built a custom phased migration framework with background backfill workers and a shadow-column swap pattern.",
  },
  'clus-010': {
    cluster_id: 'clus-010',
    developer_id: 'u-004',
    slack_sent_at: '2026-02-19T10:00:00Z',
    responded_at: '2026-02-19T16:22:00Z',
    response_word_count: 287,
    quality_tag: 'Medium',
    response_excerpt:
      "The challenge was that existing distributed lock solutions like Redlock had known failure modes under network partitions. We needed lease-based coordination that could handle partial failures gracefully without causing split-brain scenarios in the payment processing pipeline.",
  },
}

// ─── Heuristic Configurations ────────────────────────────────────────────────
export const HEURISTIC_CONFIGS = [
  {
    id: 'h-001',
    name: 'HighCodeChurn',
    label: 'High Code Churn',
    description: 'Detects files with abnormally high add/delete ratios, indicative of iterative R&D exploration.',
    category: 'Code Activity',
    weight: 0.35,
    threshold: 0.70,
  },
  {
    id: 'h-002',
    name: 'RefactoringPattern',
    label: 'Refactoring Pattern',
    description: 'Identifies large-scale structural rewrites that signal architectural uncertainty resolution.',
    category: 'Code Activity',
    weight: 0.20,
    threshold: 0.75,
  },
  {
    id: 'h-003',
    name: 'BuildExperimentation',
    label: 'Build Experimentation',
    description: 'Flags repeated CI build failures followed by fixes — a proxy for technical uncertainty.',
    category: 'CI / Pipeline',
    weight: 0.30,
    threshold: 0.70,
  },
  {
    id: 'h-004',
    name: 'BlockedStatus',
    label: 'Blocked Status',
    description: 'Tickets that were moved to a blocked state signal unresolved dependencies or unknowns.',
    category: 'Project Management',
    weight: 0.20,
    threshold: 0.65,
  },
  {
    id: 'h-005',
    name: 'ExperimentalBranches',
    label: 'Experimental Branches',
    description: 'Branches prefixed with spike/, experiment/, or poc/ containing unmerged or abandoned work.',
    category: 'Code Activity',
    weight: 0.25,
    threshold: 0.75,
  },
  {
    id: 'h-006',
    name: 'PerformanceOptimization',
    label: 'Performance Optimization',
    description: 'Benchmarking commits and profiling artefacts indicating non-trivial performance research.',
    category: 'CI / Pipeline',
    weight: 0.25,
    threshold: 0.75,
  },
  {
    id: 'h-007',
    name: 'CrossTeamDependency',
    label: 'Cross-Team Dependency',
    description: 'PRs or tickets that reference components owned by other teams, often indicating novel integration work.',
    category: 'Project Management',
    weight: 0.15,
    threshold: 0.60,
  },
]

// ─── Rule Version History ─────────────────────────────────────────────────────
export const RULE_VERSIONS = [
  {
    id: 'rule-v1.0',
    created_at: '2025-09-15T10:00:00Z',
    created_by: 'u-001',
    note: 'Initial configuration — 5 heuristics at default CRA SR&ED weights.',
    snapshot: [
      { name: 'HighCodeChurn',       weight: 0.35, threshold: 0.75 },
      { name: 'RefactoringPattern',  weight: 0.20, threshold: 0.80 },
      { name: 'BuildExperimentation',weight: 0.30, threshold: 0.75 },
      { name: 'BlockedStatus',       weight: 0.20, threshold: 0.70 },
      { name: 'ExperimentalBranches',weight: 0.25, threshold: 0.80 },
    ],
    is_active: false,
  },
  {
    id: 'rule-v2.0',
    created_at: '2025-12-01T14:30:00Z',
    created_by: 'u-001',
    note: 'Lowered thresholds after pilot review — too many false negatives. Added PerformanceOptimization heuristic.',
    snapshot: [
      { name: 'HighCodeChurn',          weight: 0.35, threshold: 0.70 },
      { name: 'RefactoringPattern',     weight: 0.20, threshold: 0.75 },
      { name: 'BuildExperimentation',   weight: 0.30, threshold: 0.70 },
      { name: 'BlockedStatus',          weight: 0.20, threshold: 0.65 },
      { name: 'ExperimentalBranches',   weight: 0.25, threshold: 0.75 },
      { name: 'PerformanceOptimization',weight: 0.25, threshold: 0.75 },
    ],
    is_active: false,
  },
  {
    id: 'rule-v2.1',
    created_at: '2026-01-10T09:15:00Z',
    created_by: 'u-001',
    note: 'Added CrossTeamDependency heuristic per CPA advisory. Adjusted BuildExperimentation weight.',
    snapshot: [
      { name: 'HighCodeChurn',          weight: 0.35, threshold: 0.70 },
      { name: 'RefactoringPattern',     weight: 0.20, threshold: 0.75 },
      { name: 'BuildExperimentation',   weight: 0.30, threshold: 0.70 },
      { name: 'BlockedStatus',          weight: 0.20, threshold: 0.65 },
      { name: 'ExperimentalBranches',   weight: 0.25, threshold: 0.75 },
      { name: 'PerformanceOptimization',weight: 0.25, threshold: 0.75 },
      { name: 'CrossTeamDependency',    weight: 0.15, threshold: 0.60 },
    ],
    is_active: true,
  },
]

// ─── Comment Threads ──────────────────────────────────────────────────────────
export const COMMENTS = {
  'clus-001': [
    {
      id: 'cmt-001',
      cluster_id: 'clus-001',
      user_id: 'u-002',
      content: 'Narrative looks solid. One question — the 6-hour blocked period on PAY-412: do we have the Jira status history screenshot saved? CRA auditors sometimes want to see the raw status transition, not just our export.',
      created_at: '2026-01-28T16:10:00Z',
      resolved: false,
      replies: [
        {
          id: 'cmt-001-r1',
          user_id: 'u-001',
          content: 'Good catch. The status_history array in snap-001 covers it — `Blocked` state from Jan 7 to Jan 10 is captured in the evidence snapshot. Our T661 export includes that timeline.',
          created_at: '2026-01-28T16:45:00Z',
        },
        {
          id: 'cmt-001-r2',
          user_id: 'u-002',
          content: 'Perfect, that covers it. Approving the narrative.',
          created_at: '2026-01-28T15:30:00Z',
        },
      ],
    },
    {
      id: 'cmt-002',
      cluster_id: 'clus-001',
      user_id: 'u-005',
      content: '@u-002 For audit purposes — can you confirm the eligibility percentage is based on the blended rate calculation and not a manual estimate? The 80% figure needs a documented basis if CRA requests it.',
      created_at: '2026-02-25T10:15:00Z',
      resolved: false,
      replies: [
        {
          id: 'cmt-002-r1',
          user_id: 'u-002',
          content: 'Confirmed — 80% is derived from commit-proportion analysis across jkim and psharma worklog hours. The calculation is logged in al-013.',
          created_at: '2026-02-25T11:00:00Z',
        },
      ],
    },
  ],
  'clus-002': [
    {
      id: 'cmt-003',
      cluster_id: 'clus-002',
      user_id: 'u-002',
      content: 'The narrative mentions "no prior published benchmarks" for this workload profile. We should make sure we have a short literature search note on file — CRA has been asking for this on Redis migration claims recently.',
      created_at: '2026-01-27T10:30:00Z',
      resolved: false,
      replies: [],
    },
  ],
  'clus-003': [
    {
      id: 'cmt-004',
      cluster_id: 'clus-003',
      user_id: 'u-002',
      content: 'ML-095 is still In Progress — this cluster has stale context. Should we wait for the ticket to close before approving the narrative, or proceed on the work completed to date?',
      created_at: '2026-02-07T11:00:00Z',
      resolved: false,
      replies: [
        {
          id: 'cmt-004-r1',
          user_id: 'u-001',
          content: 'Proceed on work to date. The SR&ED claim covers Jan 28 – Feb 3, which is fully documented. ML-095 is ongoing work and will be in the next claim period.',
          created_at: '2026-02-07T14:00:00Z',
        },
      ],
    },
    {
      id: 'cmt-005',
      cluster_id: 'clus-003',
      user_id: 'u-003',
      content: 'Quick note: the SHAP explainability layer was specifically requested by our legal team to satisfy model audit requirements — not just R&D. Want to make sure the narrative frames the SR&ED portion correctly so we don\'t overclaim.',
      created_at: '2026-02-08T09:00:00Z',
      resolved: true,
      replies: [
        {
          id: 'cmt-005-r1',
          user_id: 'u-002',
          content: 'Good flag. Updated the narrative to scope SHAP to the research phase only (commit 4d5e6f7a8b9c), not the production deployment. The uncertainty was in whether SHAP could work within the latency constraint — that\'s the qualifying work.',
          created_at: '2026-02-08T11:30:00Z',
        },
      ],
    },
  ],
  'clus-007': [
    {
      id: 'cmt-006',
      cluster_id: 'clus-007',
      user_id: 'u-002',
      content: 'PKCE implementation — the eligibility here might be limited. PKCE is an RFC-defined standard; unless we\'re doing something novel beyond the spec, this could be standard software engineering rather than SR&ED.',
      created_at: '2026-02-12T09:45:00Z',
      resolved: false,
      replies: [
        {
          id: 'cmt-006-r1',
          user_id: 'u-003',
          content: 'The novelty is in adapting PKCE to our multi-tenant token broker architecture with per-tenant key rotation. The high code churn (0.88) and refactoring pattern reflect 3 failed approaches before the current design. Happy to document this in an interview.',
          created_at: '2026-02-12T14:15:00Z',
        },
      ],
    },
  ],
}

// ─── Audit Readiness scoring ──────────────────────────────────────────────────
export function getClusterReadinessScore(cluster, snapshots, narratives, interviews) {
  const checks = []

  // 1. Evidence snapshot exists (15 pts)
  const hasSnapshot = !!cluster.evidence_snapshot_id && !!snapshots[cluster.evidence_snapshot_id]
  checks.push({ key: 'evidence_snapshot', label: 'Evidence snapshot captured', weight: 15, pass: hasSnapshot,
    fix: 'Trigger a manual sync from Integrations to capture current GitHub + Jira state.' })

  // 2. Developer interview completed or proxy used (20 pts)
  const hasInterview = !!interviews[cluster.id]
  const hasProxy = cluster.proxy_used && cluster.proxy_confidence !== null
  checks.push({ key: 'interview', label: 'Developer interview or proxy hours', weight: 20, pass: hasInterview || hasProxy,
    fix: hasProxy ? null : 'Send an async Slack interview to the attributed developers from the Developer Portal.' })

  // 3. Hours logged (15 pts)
  const hasHours = cluster.aggregate_time_hours != null && cluster.aggregate_time_hours > 0
  checks.push({ key: 'hours', label: 'QRE hours logged', weight: 15, pass: hasHours,
    fix: 'Use Manual Time Entry on the cluster detail page to record estimated hours with justification.' })

  // 4. Narrative generated (10 pts)
  const hasNarrative = !!cluster.narrative_id && !!narratives[cluster.narrative_id]
  checks.push({ key: 'narrative_exists', label: 'SR&ED narrative generated', weight: 10, pass: hasNarrative,
    fix: 'Generate a narrative from the cluster detail page using the Guided Narrative Template.' })

  // 5. Narrative quality passed (10 pts)
  const narrative = cluster.narrative_id ? narratives[cluster.narrative_id] : null
  const qualityPassed = narrative?.quality_passed === true
  checks.push({ key: 'narrative_quality', label: 'Narrative quality score ≥ threshold', weight: 10, pass: qualityPassed,
    fix: 'Regenerate the narrative or edit it manually — ensure all four SR&ED criteria are addressed.' })

  // 6. Narrative approved (15 pts)
  const narrativeApproved = !!narrative?.approved_by
  checks.push({ key: 'narrative_approved', label: 'Narrative reviewed & approved', weight: 15, pass: narrativeApproved,
    fix: 'A Reviewer or Admin must approve the narrative from the cluster detail page.' })

  // 7. Risk score above 0.65 (10 pts)
  const riskOk = cluster.risk_score >= 0.65
  checks.push({ key: 'risk_score', label: 'Heuristic risk score ≥ 65%', weight: 10, pass: riskOk,
    fix: 'Review the heuristic configuration — this cluster may not qualify under current thresholds.' })

  // 8. No stale context (5 pts)
  checks.push({ key: 'fresh_context', label: 'Evidence context is current (not stale)', weight: 5, pass: !cluster.stale_context,
    fix: 'Re-sync the integration to refresh the evidence snapshot before filing.' })

  const earned = checks.filter(c => c.pass).reduce((sum, c) => sum + c.weight, 0)
  const total = checks.reduce((sum, c) => sum + c.weight, 0)
  const score = Math.round((earned / total) * 100)

  return { score, checks, earned, total }
}

// ─── Dashboard stats helpers ──────────────────────────────────────────────────
export function getDashboardStats() {
  const total = CLUSTERS.length
  const pending = CLUSTERS.filter(c => ['Drafted', 'Interviewed', 'New'].includes(c.status)).length
  const approved = CLUSTERS.filter(c => c.status === 'Approved').length
  const rejected = CLUSTERS.filter(c => c.status === 'Rejected').length

  const totalCreditCAD = CLUSTERS
    .filter(c => c.estimated_credit_cad)
    .reduce((sum, c) => sum + c.estimated_credit_cad, 0)

  const totalHours = CLUSTERS
    .filter(c => c.aggregate_time_hours)
    .reduce((sum, c) => sum + c.aggregate_time_hours, 0)

  return { total, pending, approved, rejected, totalCreditCAD, totalHours }
}

export function getCreditTrend() {
  return [
    { month: 'Oct', credit: 12400, clusters: 2 },
    { month: 'Nov', credit: 18700, clusters: 3 },
    { month: 'Dec', credit: 22100, clusters: 4 },
    { month: 'Jan', credit: 53820, clusters: 7 },
    { month: 'Feb', credit: 9180, clusters: 3 },
    { month: 'Mar', credit: 0, clusters: 2 },
  ]
}

export function getStatusBreakdown() {
  const counts = { New: 0, Interviewed: 0, Drafted: 0, Approved: 0, Rejected: 0 }
  CLUSTERS.forEach(c => counts[c.status]++)
  return Object.entries(counts).map(([name, value]) => ({ name, value }))
}

// ─── Notifications ────────────────────────────────────────────────────────────
// type: cluster_overdue | pending_approval | stale_context | new_comment |
//       mention | audit_risk | readiness_warning | narrative_ready |
//       interview_scheduled | credit_milestone
export const NOTIFICATIONS = [
  {
    id: 'notif-001',
    type: 'pending_approval',
    title: 'Cluster awaiting your approval',
    body: 'AI Inference Pipeline Optimisation has been in "Drafted" status for 6 days without review.',
    cluster_id: 'clus-001',
    cluster_name: 'AI Inference Pipeline Optimisation',
    actor_id: 'u-001',
    read: false,
    action_label: 'Review Now',
    action_href: '/clusters/clus-001',
    created_at: '2026-03-17T08:14:00Z',
    priority: 'high',
  },
  {
    id: 'notif-002',
    type: 'mention',
    title: 'Marcus Reid mentioned you',
    body: '@sarah Can you confirm the eligible period for this cluster? The SR&ED window may be tighter than our model assumes.',
    cluster_id: 'clus-001',
    cluster_name: 'AI Inference Pipeline Optimisation',
    actor_id: 'u-002',
    read: false,
    action_label: 'View Comment',
    action_href: '/clusters/clus-001',
    created_at: '2026-03-17T07:52:00Z',
    priority: 'high',
  },
  {
    id: 'notif-003',
    type: 'readiness_warning',
    title: 'Audit readiness below threshold',
    body: 'Quantum-Resistant Cryptography Module scored 48/100. Missing evidence snapshots and approved narrative.',
    cluster_id: 'clus-003',
    cluster_name: 'Quantum-Resistant Cryptography Module',
    actor_id: null,
    read: false,
    action_label: 'Fix Issues',
    action_href: '/audit-readiness',
    created_at: '2026-03-17T06:00:00Z',
    priority: 'high',
  },
  {
    id: 'notif-004',
    type: 'stale_context',
    title: 'Context window is stale',
    body: 'Distributed Caching Layer has not had a context refresh in 42 days. Narrative quality may degrade.',
    cluster_id: 'clus-007',
    cluster_name: 'Distributed Caching Layer',
    actor_id: null,
    read: false,
    action_label: 'Refresh Context',
    action_href: '/clusters/clus-007',
    created_at: '2026-03-16T14:30:00Z',
    priority: 'medium',
  },
  {
    id: 'notif-005',
    type: 'new_comment',
    title: 'New comment on your cluster',
    body: 'Jordan Kim left a note on Federated Learning Framework: "SHAP attribution looks like it may overcount — flagging for review."',
    cluster_id: 'clus-003',
    cluster_name: 'Federated Learning Framework',
    actor_id: 'u-003',
    read: false,
    action_label: 'View Thread',
    action_href: '/clusters/clus-003',
    created_at: '2026-03-16T11:18:00Z',
    priority: 'medium',
  },
  {
    id: 'notif-006',
    type: 'audit_risk',
    title: 'High risk score flagged',
    body: 'Autonomous Vehicle Perception Stack has a risk score of 0.87. CRA audit exposure is elevated.',
    cluster_id: 'clus-006',
    cluster_name: 'Autonomous Vehicle Perception Stack',
    actor_id: null,
    read: true,
    action_label: 'Review Risk',
    action_href: '/clusters/clus-006',
    created_at: '2026-03-15T16:45:00Z',
    priority: 'high',
  },
  {
    id: 'notif-007',
    type: 'narrative_ready',
    title: 'Narrative draft ready for review',
    body: 'Real-Time Anomaly Detection Engine narrative has been generated. Assign a reviewer to approve before filing.',
    cluster_id: 'clus-005',
    cluster_name: 'Real-Time Anomaly Detection Engine',
    actor_id: null,
    read: true,
    action_label: 'Assign Reviewer',
    action_href: '/clusters/clus-005',
    created_at: '2026-03-15T10:00:00Z',
    priority: 'medium',
  },
  {
    id: 'notif-008',
    type: 'interview_scheduled',
    title: 'Developer interview tomorrow',
    body: 'Priya Sharma is scheduled for a context interview on Mar 18 at 10:00 AM for Adaptive Recommendation Engine.',
    cluster_id: 'clus-002',
    cluster_name: 'Adaptive Recommendation Engine',
    actor_id: 'u-004',
    read: true,
    action_label: 'View Cluster',
    action_href: '/clusters/clus-002',
    created_at: '2026-03-14T15:30:00Z',
    priority: 'low',
  },
  {
    id: 'notif-009',
    type: 'credit_milestone',
    title: 'Credit milestone reached',
    body: 'Total estimated SR&ED credit has crossed $100,000 CAD. Consider filing sooner to accelerate refund.',
    cluster_id: null,
    cluster_name: null,
    actor_id: null,
    read: true,
    action_label: 'View Reports',
    action_href: '/reports',
    created_at: '2026-03-13T09:00:00Z',
    priority: 'low',
  },
  {
    id: 'notif-010',
    type: 'cluster_overdue',
    title: 'Cluster past review deadline',
    body: 'Blockchain Consensus Mechanism has been "New" for 21 days. Assign a developer to begin evidence collection.',
    cluster_id: 'clus-008',
    cluster_name: 'Blockchain Consensus Mechanism',
    actor_id: null,
    read: true,
    action_label: 'Open Cluster',
    action_href: '/clusters/clus-008',
    created_at: '2026-03-12T08:00:00Z',
    priority: 'medium',
  },
]

// ─── Document Vault ───────────────────────────────────────────────────────────
// tag: evidence | narrative | financial | report | correspondence | config
// type: pdf | docx | xlsx | png | csv | zip | json
export const DOCUMENTS = [
  {
    id: 'doc-001',
    name: 'T4_Slips_AcmeCorp_2025_Q4.pdf',
    type: 'pdf',
    size_kb: 248,
    cluster_id: 'clus-001',
    cluster_name: 'AI Inference Pipeline Optimisation',
    uploader_id: 'u-001',
    uploader_name: 'Sarah Chen',
    version: 3,
    tag: 'financial',
    created_at: '2026-03-15T10:30:00Z',
    versions: [
      { version: 1, size_kb: 210, uploader_name: 'Sarah Chen',  created_at: '2026-01-10T09:00:00Z', note: 'Initial upload' },
      { version: 2, size_kb: 230, uploader_name: 'Marcus Reid', created_at: '2026-02-14T11:00:00Z', note: 'Updated with Q3 payroll correction' },
      { version: 3, size_kb: 248, uploader_name: 'Sarah Chen',  created_at: '2026-03-15T10:30:00Z', note: 'Final Q4 reconciliation added' },
    ],
  },
  {
    id: 'doc-002',
    name: 'SR_ED_Narrative_InferencePipeline_v4.docx',
    type: 'docx',
    size_kb: 92,
    cluster_id: 'clus-001',
    cluster_name: 'AI Inference Pipeline Optimisation',
    uploader_id: 'u-002',
    uploader_name: 'Marcus Reid',
    version: 4,
    tag: 'narrative',
    created_at: '2026-03-12T14:00:00Z',
    versions: [
      { version: 1, size_kb: 55, uploader_name: 'Marcus Reid', created_at: '2026-01-20T10:00:00Z', note: 'AI-generated draft' },
      { version: 2, size_kb: 68, uploader_name: 'Marcus Reid', created_at: '2026-02-01T09:30:00Z', note: 'Added technological uncertainty section' },
      { version: 3, size_kb: 81, uploader_name: 'Sarah Chen',  created_at: '2026-02-20T15:00:00Z', note: 'Admin review edits' },
      { version: 4, size_kb: 92, uploader_name: 'Marcus Reid', created_at: '2026-03-12T14:00:00Z', note: 'Final CPA review pass' },
    ],
  },
  {
    id: 'doc-003',
    name: 'DevHours_Timeseries_ClusterAI.xlsx',
    type: 'xlsx',
    size_kb: 137,
    cluster_id: 'clus-001',
    cluster_name: 'AI Inference Pipeline Optimisation',
    uploader_id: 'u-001',
    uploader_name: 'Sarah Chen',
    version: 2,
    tag: 'evidence',
    created_at: '2026-03-10T08:45:00Z',
    versions: [
      { version: 1, size_kb: 120, uploader_name: 'Sarah Chen', created_at: '2026-02-05T08:00:00Z', note: 'Initial export from Jira' },
      { version: 2, size_kb: 137, uploader_name: 'Sarah Chen', created_at: '2026-03-10T08:45:00Z', note: 'Added March sprint data' },
    ],
  },
  {
    id: 'doc-004',
    name: 'GitHub_CommitLog_Export_Q4.csv',
    type: 'csv',
    size_kb: 412,
    cluster_id: 'clus-001',
    cluster_name: 'AI Inference Pipeline Optimisation',
    uploader_id: 'u-003',
    uploader_name: 'Jordan Kim',
    version: 1,
    tag: 'evidence',
    created_at: '2026-03-01T11:00:00Z',
    versions: [
      { version: 1, size_kb: 412, uploader_name: 'Jordan Kim', created_at: '2026-03-01T11:00:00Z', note: 'Full commit log Oct–Dec 2025' },
    ],
  },
  {
    id: 'doc-005',
    name: 'RecommendationEngine_Architecture.png',
    type: 'png',
    size_kb: 864,
    cluster_id: 'clus-002',
    cluster_name: 'Adaptive Recommendation Engine',
    uploader_id: 'u-003',
    uploader_name: 'Jordan Kim',
    version: 1,
    tag: 'evidence',
    created_at: '2026-02-28T16:00:00Z',
    versions: [
      { version: 1, size_kb: 864, uploader_name: 'Jordan Kim', created_at: '2026-02-28T16:00:00Z', note: 'System architecture diagram from Miro' },
    ],
  },
  {
    id: 'doc-006',
    name: 'SR_ED_Narrative_RecEngine_v2.docx',
    type: 'docx',
    size_kb: 78,
    cluster_id: 'clus-002',
    cluster_name: 'Adaptive Recommendation Engine',
    uploader_id: 'u-002',
    uploader_name: 'Marcus Reid',
    version: 2,
    tag: 'narrative',
    created_at: '2026-03-05T10:00:00Z',
    versions: [
      { version: 1, size_kb: 61, uploader_name: 'Marcus Reid', created_at: '2026-02-10T09:00:00Z', note: 'Initial AI draft' },
      { version: 2, size_kb: 78, uploader_name: 'Marcus Reid', created_at: '2026-03-05T10:00:00Z', note: 'Incorporated CPA feedback' },
    ],
  },
  {
    id: 'doc-007',
    name: 'QuantumCrypto_ResearchLog.pdf',
    type: 'pdf',
    size_kb: 519,
    cluster_id: 'clus-003',
    cluster_name: 'Quantum-Resistant Cryptography Module',
    uploader_id: 'u-003',
    uploader_name: 'Jordan Kim',
    version: 1,
    tag: 'evidence',
    created_at: '2026-02-20T13:30:00Z',
    versions: [
      { version: 1, size_kb: 519, uploader_name: 'Jordan Kim', created_at: '2026-02-20T13:30:00Z', note: 'Research literature references (NIST PQC)' },
    ],
  },
  {
    id: 'doc-008',
    name: 'CRA_Eligibility_Checklist_2025.pdf',
    type: 'pdf',
    size_kb: 184,
    cluster_id: null,
    cluster_name: null,
    uploader_id: 'u-001',
    uploader_name: 'Sarah Chen',
    version: 1,
    tag: 'report',
    created_at: '2026-01-15T09:00:00Z',
    versions: [
      { version: 1, size_kb: 184, uploader_name: 'Sarah Chen', created_at: '2026-01-15T09:00:00Z', note: 'CRA internal eligibility checklist — FY2025' },
    ],
  },
  {
    id: 'doc-009',
    name: 'AnomalyDetection_TestResults.json',
    type: 'json',
    size_kb: 62,
    cluster_id: 'clus-005',
    cluster_name: 'Real-Time Anomaly Detection Engine',
    uploader_id: 'u-003',
    uploader_name: 'Jordan Kim',
    version: 1,
    tag: 'evidence',
    created_at: '2026-03-08T17:00:00Z',
    versions: [
      { version: 1, size_kb: 62, uploader_name: 'Jordan Kim', created_at: '2026-03-08T17:00:00Z', note: 'pytest output — 94% pass rate' },
    ],
  },
  {
    id: 'doc-010',
    name: 'SR_ED_Filing_FY2024_Archive.zip',
    type: 'zip',
    size_kb: 4210,
    cluster_id: null,
    cluster_name: null,
    uploader_id: 'u-001',
    uploader_name: 'Sarah Chen',
    version: 1,
    tag: 'report',
    created_at: '2026-01-08T12:00:00Z',
    versions: [
      { version: 1, size_kb: 4210, uploader_name: 'Sarah Chen', created_at: '2026-01-08T12:00:00Z', note: 'Full FY2024 filing package — 23 documents' },
    ],
  },
  {
    id: 'doc-011',
    name: 'AutonomousVehicle_PerceptionBenchmarks.xlsx',
    type: 'xlsx',
    size_kb: 221,
    cluster_id: 'clus-006',
    cluster_name: 'Autonomous Vehicle Perception Stack',
    uploader_id: 'u-004',
    uploader_name: 'Priya Sharma',
    version: 2,
    tag: 'evidence',
    created_at: '2026-03-14T10:00:00Z',
    versions: [
      { version: 1, size_kb: 198, uploader_name: 'Priya Sharma', created_at: '2026-02-25T10:00:00Z', note: 'Initial benchmark results' },
      { version: 2, size_kb: 221, uploader_name: 'Priya Sharma', created_at: '2026-03-14T10:00:00Z', note: 'Added night-mode sensor fusion results' },
    ],
  },
  {
    id: 'doc-012',
    name: 'CPA_EngagementLetter_Signed.pdf',
    type: 'pdf',
    size_kb: 96,
    cluster_id: null,
    cluster_name: null,
    uploader_id: 'u-001',
    uploader_name: 'Sarah Chen',
    version: 1,
    tag: 'correspondence',
    created_at: '2026-01-03T14:00:00Z',
    versions: [
      { version: 1, size_kb: 96, uploader_name: 'Sarah Chen', created_at: '2026-01-03T14:00:00Z', note: 'Executed engagement letter — FY2025 SR&ED' },
    ],
  },
  {
    id: 'doc-013',
    name: 'FederatedLearning_ModelCards.pdf',
    type: 'pdf',
    size_kb: 340,
    cluster_id: 'clus-003',
    cluster_name: 'Federated Learning Framework',
    uploader_id: 'u-004',
    uploader_name: 'Priya Sharma',
    version: 1,
    tag: 'evidence',
    created_at: '2026-03-02T15:30:00Z',
    versions: [
      { version: 1, size_kb: 340, uploader_name: 'Priya Sharma', created_at: '2026-03-02T15:30:00Z', note: 'Model cards export from MLflow' },
    ],
  },
  {
    id: 'doc-014',
    name: 'DevInterview_Transcript_JordanKim_Feb26.docx',
    type: 'docx',
    size_kb: 44,
    cluster_id: 'clus-005',
    cluster_name: 'Real-Time Anomaly Detection Engine',
    uploader_id: 'u-002',
    uploader_name: 'Marcus Reid',
    version: 1,
    tag: 'evidence',
    created_at: '2026-02-26T11:00:00Z',
    versions: [
      { version: 1, size_kb: 44, uploader_name: 'Marcus Reid', created_at: '2026-02-26T11:00:00Z', note: 'Recorded + transcribed developer interview' },
    ],
  },
  {
    id: 'doc-015',
    name: 'TaxLift_HeuristicConfig_Export.json',
    type: 'json',
    size_kb: 18,
    cluster_id: null,
    cluster_name: null,
    uploader_id: 'u-001',
    uploader_name: 'Sarah Chen',
    version: 1,
    tag: 'config',
    created_at: '2026-03-16T09:00:00Z',
    versions: [
      { version: 1, size_kb: 18, uploader_name: 'Sarah Chen', created_at: '2026-03-16T09:00:00Z', note: 'Heuristic configuration backup before quarterly adjustment' },
    ],
  },
]

export function getVaultStats() {
  const totalFiles = DOCUMENTS.length
  const totalKb    = DOCUMENTS.reduce((sum, d) => sum + d.size_kb, 0)
  const clusters   = new Set(DOCUMENTS.filter(d => d.cluster_id).map(d => d.cluster_id)).size
  return { totalFiles, totalKb, clusters }
}

// ─── CPA Partner Portal ───────────────────────────────────────────────────────
export const CPA_FIRM = {
  id: 'cpa-firm-001',
  name: 'Crowe MacKay LLP',
  partner_name: 'Margaret Chen, CPA, CA',
  partner_email: 'margaret.chen@crowe.ca',
  phone: '+1 (416) 929-2500',
  city: 'Toronto, ON',
  since: '2024-09-01',
}

// status: ready_to_file | needs_attention | at_risk | onboarded
export const CPA_CLIENTS = [
  {
    id: 'cli-001',
    company_name: 'Acme Corp',
    industry: 'AI / Software',
    fiscal_year_end: 'December',
    filing_deadline: '2026-06-30',
    primary_contact: 'Sarah Chen',
    primary_contact_email: 'sarah.chen@acmecorp.com',
    clusters_total: 10,
    clusters_approved: 2,
    clusters_pending_review: 3,
    avg_readiness_score: 74,
    estimated_credit_cad: 116000,
    documents_count: 15,
    last_activity_at: '2026-03-17T08:14:00Z',
    status: 'needs_attention',
    notes: '3 narratives awaiting CPA review. Context refresh overdue on 2 clusters.',
  },
  {
    id: 'cli-002',
    company_name: 'NovaSystems Inc.',
    industry: 'Cloud Infrastructure',
    fiscal_year_end: 'June',
    filing_deadline: '2026-06-30',
    primary_contact: 'Daniel Park',
    primary_contact_email: 'd.park@novasystems.ca',
    clusters_total: 7,
    clusters_approved: 6,
    clusters_pending_review: 1,
    avg_readiness_score: 92,
    estimated_credit_cad: 204000,
    documents_count: 28,
    last_activity_at: '2026-03-16T14:30:00Z',
    status: 'ready_to_file',
    notes: 'All narratives approved. Final CPA sign-off pending before T661 submission.',
  },
  {
    id: 'cli-003',
    company_name: 'BrightPath AI',
    industry: 'Machine Learning',
    fiscal_year_end: 'March',
    filing_deadline: '2026-07-31',
    primary_contact: 'Amara Diallo',
    primary_contact_email: 'a.diallo@brightpathai.io',
    clusters_total: 5,
    clusters_approved: 1,
    clusters_pending_review: 2,
    avg_readiness_score: 51,
    estimated_credit_cad: 47000,
    documents_count: 9,
    last_activity_at: '2026-03-12T11:00:00Z',
    status: 'needs_attention',
    notes: 'Developer interviews incomplete for 3 clusters. Narrative quality below threshold.',
  },
  {
    id: 'cli-004',
    company_name: 'Vertex Labs',
    industry: 'Quantum Computing',
    fiscal_year_end: 'December',
    filing_deadline: '2026-04-15',
    primary_contact: 'Thomas Wu',
    primary_contact_email: 't.wu@vertexlabs.ca',
    clusters_total: 4,
    clusters_approved: 0,
    clusters_pending_review: 1,
    avg_readiness_score: 24,
    estimated_credit_cad: 18000,
    documents_count: 3,
    last_activity_at: '2026-02-28T09:45:00Z',
    status: 'at_risk',
    notes: 'URGENT: Filing deadline in 29 days. No clusters approved. Missing evidence on all activities.',
  },
  {
    id: 'cli-005',
    company_name: 'ClearPath Medical',
    industry: 'Healthcare Software',
    fiscal_year_end: 'May',
    filing_deadline: '2026-05-15',
    primary_contact: 'Fatima Al-Hassan',
    primary_contact_email: 'fatima@clearpathmed.com',
    clusters_total: 3,
    clusters_approved: 0,
    clusters_pending_review: 1,
    avg_readiness_score: 38,
    estimated_credit_cad: 33000,
    documents_count: 6,
    last_activity_at: '2026-03-05T15:00:00Z',
    status: 'at_risk',
    notes: 'Deadline in 59 days. HR records incomplete. No developer interviews conducted yet.',
  },
  {
    id: 'cli-006',
    company_name: 'Ironclad Software',
    industry: 'DevSecOps',
    fiscal_year_end: 'July',
    filing_deadline: '2026-07-31',
    primary_contact: 'Leo Marchetti',
    primary_contact_email: 'l.marchetti@ironclad.dev',
    clusters_total: 0,
    clusters_approved: 0,
    clusters_pending_review: 0,
    avg_readiness_score: 0,
    estimated_credit_cad: 0,
    documents_count: 0,
    last_activity_at: null,
    status: 'onboarded',
    notes: 'New client — onboarding in progress. Data integrations not yet connected.',
  },
]

export function getCPAPortalStats() {
  const total         = CPA_CLIENTS.length
  const readyToFile   = CPA_CLIENTS.filter(c => c.status === 'ready_to_file').length
  const needsAttention= CPA_CLIENTS.filter(c => c.status === 'needs_attention').length
  const atRisk        = CPA_CLIENTS.filter(c => c.status === 'at_risk').length
  const totalCredit   = CPA_CLIENTS.reduce((s, c) => s + c.estimated_credit_cad, 0)
  const totalClusters = CPA_CLIENTS.reduce((s, c) => s + c.clusters_total, 0)
  return { total, readyToFile, needsAttention, atRisk, totalCredit, totalClusters }
}

// ─── CPA Referral Program ─────────────────────────────────────────────────────
//
// Commission model:
//   TaxLift charges 8% of credit recovered as its success fee.
//   Referring CPA earns 10% of TaxLift's fee → 0.8% of credit as commission.
//   (e.g. $100K credit → $8K TaxLift fee → $800 CPA commission)
//
// Referral statuses:
//   scanning       — client just signed up, integrations being connected
//   in_review      — clusters detected, narratives being drafted & reviewed
//   package_ready  — T661 package complete, ready for CPA to action
//   filed          — T661 submitted by CPA, credit confirmed with CRA
//
// Commission statuses:
//   pending        — client still in scanning or in_review; credit TBD
//   confirmed      — package_ready; credit finalised, invoice can be raised
//   paid           — filed; TaxLift fee collected and CPA commission paid out

export const REFERRAL_RATE = 0.008 // 0.8% of credit = 10% of TaxLift's 8% fee

export const REFERRAL_CLIENTS = [
  {
    id:                  'ref-001',
    company_name:        'Zenith Biotech Inc.',
    industry:            'Life Sciences / Software',
    fiscal_year:         '2024',
    date_referred:       '2025-10-08T00:00:00Z',
    primary_contact:     'Sophie Lamarche',
    referral_status:     'filed',
    commission_status:   'paid',
    estimated_credit_cad: 312000,
    commission_cad:      2496,        // 312000 × 0.008
    commission_confirmed: true,
    commission_paid:     true,
    paid_at:             '2026-02-14T00:00:00Z',
    notes:               'T661 filed 2026-02-01. CRA confirmation received. Commission invoice settled.',
  },
  {
    id:                  'ref-002',
    company_name:        'Pulse Commerce Ltd.',
    industry:            'E-commerce SaaS',
    fiscal_year:         '2025',
    date_referred:       '2025-11-22T00:00:00Z',
    primary_contact:     'Remy Bouchard',
    referral_status:     'package_ready',
    commission_status:   'confirmed',
    estimated_credit_cad: 142000,
    commission_cad:      1136,        // 142000 × 0.008
    commission_confirmed: true,
    commission_paid:     false,
    paid_at:             null,
    notes:               'Package delivered. Awaiting CPA review and T661 sign-off.',
  },
  {
    id:                  'ref-003',
    company_name:        'Atlas Network Systems',
    industry:            'Network Infrastructure',
    fiscal_year:         '2025',
    date_referred:       '2025-12-10T00:00:00Z',
    primary_contact:     'Jordan Kim',
    referral_status:     'package_ready',
    commission_status:   'confirmed',
    estimated_credit_cad: 67000,
    commission_cad:      536,         // 67000 × 0.008
    commission_confirmed: true,
    commission_paid:     false,
    paid_at:             null,
    notes:               'Package ready. 6 of 8 clusters approved. Final 2 under review.',
  },
  {
    id:                  'ref-004',
    company_name:        'Axiom Robotics Corp.',
    industry:            'Industrial Automation',
    fiscal_year:         '2025',
    date_referred:       '2026-01-15T00:00:00Z',
    primary_contact:     'Marcus Webb',
    referral_status:     'in_review',
    commission_status:   'pending',
    estimated_credit_cad: 89000,
    commission_cad:      712,         // 89000 × 0.008 (estimated — not yet confirmed)
    commission_confirmed: false,
    commission_paid:     false,
    paid_at:             null,
    notes:               '9 clusters detected. 4 narratives drafted, 5 pending. Developer interviews scheduled.',
  },
  {
    id:                  'ref-005',
    company_name:        'Meridian Analytics Inc.',
    industry:            'Data & Analytics',
    fiscal_year:         '2025',
    date_referred:       '2026-02-28T00:00:00Z',
    primary_contact:     'Anika Patel',
    referral_status:     'scanning',
    commission_status:   'pending',
    estimated_credit_cad: 0,          // TBD — scan in progress
    commission_cad:      0,
    commission_confirmed: false,
    commission_paid:     false,
    paid_at:             null,
    notes:               'GitHub and Jira integrations connected. SR&ED scan running.',
  },
]

export function getReferralStats() {
  const totalReferred       = REFERRAL_CLIENTS.length
  const totalPipelineCredit = REFERRAL_CLIENTS.reduce((s, r) => s + r.estimated_credit_cad, 0)
  const totalCommissionEarned = REFERRAL_CLIENTS
    .filter(r => r.commission_paid)
    .reduce((s, r) => s + r.commission_cad, 0)
  const pendingPayout       = REFERRAL_CLIENTS
    .filter(r => r.commission_confirmed && !r.commission_paid)
    .reduce((s, r) => s + r.commission_cad, 0)
  const pendingCount        = REFERRAL_CLIENTS.filter(r => r.commission_status === 'pending').length
  const confirmedCount      = REFERRAL_CLIENTS.filter(r => r.commission_status === 'confirmed').length
  const paidCount           = REFERRAL_CLIENTS.filter(r => r.commission_status === 'paid').length
  const pendingCredit       = REFERRAL_CLIENTS
    .filter(r => r.commission_status === 'pending' && r.estimated_credit_cad > 0)
    .reduce((s, r) => s + r.estimated_credit_cad, 0)
  const confirmedCredit     = REFERRAL_CLIENTS
    .filter(r => r.commission_status === 'confirmed')
    .reduce((s, r) => s + r.estimated_credit_cad, 0)
  const paidCredit          = REFERRAL_CLIENTS
    .filter(r => r.commission_status === 'paid')
    .reduce((s, r) => s + r.estimated_credit_cad, 0)
  return {
    totalReferred, totalPipelineCredit, totalCommissionEarned, pendingPayout,
    pendingCount, confirmedCount, paidCount,
    pendingCredit, confirmedCredit, paidCredit,
  }
}

// Encode a referral token for /start?ref=:token
// Payload: { firmId, firmName, partnerName, refCode }
export function encodeReferralToken(payload) {
  const json = JSON.stringify({ v: 1, ...payload })
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeReferralToken(token) {
  try {
    const b64    = token.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '=='.slice(0, (4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    if (payload?.v !== 1) return null
    return payload
  } catch {
    return null
  }
}
