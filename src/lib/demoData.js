/**
 * demoData.js — Hardcoded demo data for Acme Technologies Inc.
 * Used exclusively by DemoPage.jsx — no auth required.
 *
 * Fictional company: Acme Technologies Inc. — 12-person Toronto SaaS company
 * building a B2B analytics platform.
 */

export const DEMO_COMPANY = {
  name: 'Acme Technologies Inc.',
  employees: 12,
  location: 'Toronto, ON',
  industry: 'B2B SaaS Analytics',
  repos: ['acme/analytics-core', 'acme/ml-pipeline', 'acme/mobile-sdk'],
  fiscal_year: 'FY 2025',
}

export const DEMO_SUMMARY = {
  credit_low: 112000,
  credit_high: 158000,
  qualifying_commits: 155,
  rd_hours: 840,
  cluster_count: 4,
}

export const DEMO_CLUSTERS = [
  {
    id: 'demo-1',
    name: 'Adaptive Query Optimization Engine',
    theme: 'Algorithm Development',
    qualifying_commits: 47,
    estimated_credit: 38400,
    rd_hours: 218,
    progress: 72,
    color_class: 'bg-indigo-500',
    badge_class: 'bg-indigo-50 text-indigo-700',
    repos: ['acme/analytics-core'],
  },
  {
    id: 'demo-2',
    name: 'Real-time Anomaly Detection ML Pipeline',
    theme: 'Machine Learning & AI',
    qualifying_commits: 61,
    estimated_credit: 52700,
    rd_hours: 307,
    progress: 88,
    color_class: 'bg-violet-500',
    badge_class: 'bg-violet-50 text-violet-700',
    repos: ['acme/ml-pipeline'],
  },
  {
    id: 'demo-3',
    name: 'Cross-platform SDK Rendering Engine',
    theme: 'Software Architecture',
    qualifying_commits: 29,
    estimated_credit: 24100,
    rd_hours: 184,
    progress: 58,
    color_class: 'bg-blue-500',
    badge_class: 'bg-blue-50 text-blue-700',
    repos: ['acme/mobile-sdk'],
  },
  {
    id: 'demo-4',
    name: 'Distributed Cache Coherence Protocol',
    theme: 'Systems & Infrastructure',
    qualifying_commits: 18,
    estimated_credit: 14800,
    rd_hours: 131,
    progress: 41,
    color_class: 'bg-cyan-500',
    badge_class: 'bg-cyan-50 text-cyan-700',
    repos: ['acme/analytics-core'],
  },
]

export const DEMO_NARRATIVE_QUALITY = {
  score: 78,
  label: 'Good',
  color: 'amber',
  dimensions: [
    { name: 'Technological Uncertainty', code: 'TU', score: 17, max: 20, status: 'pass' },
    { name: 'Systematic Investigation',  code: 'SI', score: 14, max: 20, status: 'partial' },
    { name: 'Technological Advancement', code: 'TA', score: 16, max: 20, status: 'pass' },
    { name: 'Work Directly Undertaken',  code: 'WD', score: 15, max: 20, status: 'pass' },
    { name: 'Qualified Expenditures',    code: 'QE', score: 16, max: 20, status: 'pass' },
  ],
}

// Full unlocked narrative for cluster 1 (teaser for demo)
export const DEMO_NARRATIVE_CLUSTER1 = {
  cluster_name: 'Adaptive Query Optimization Engine',
  dimensions: {
    technological_uncertainty:
      "Acme's engineering team faced significant uncertainty in developing an adaptive query optimization engine capable of dynamically selecting execution strategies based on real-time workload characteristics. At the outset of the project, it was unclear whether a rule-based planner could be extended to incorporate live runtime telemetry without introducing prohibitive latency overhead or destabilizing existing query pipelines. The team could not determine in advance whether gradient-boosted models or lightweight neural networks would generalize across the diverse cardinality distributions observed in production multi-tenant workloads, nor which feature representations would capture workload variance with sufficient fidelity.",

    systematic_investigation:
      "To resolve these uncertainties, Acme adopted a rigorous experimental methodology spanning three iterative phases. In the first phase, the team instrumented the query planner to emit per-operator timing and cardinality estimates, establishing a baseline dataset of 12,000 production query plans captured over eight weeks. In the second phase, gradient-boosted classifiers and lightweight neural networks were trained against this dataset and evaluated against held-out query sets using RMSE and latency-prediction accuracy. Each model family was subjected to ablation studies to isolate the contribution of individual telemetry features. In the third phase, the winning model was integrated into the planner under A/B test conditions, with latency regressions continuously tracked via a custom p99 monitoring harness and rollback thresholds defined in advance.",

    technological_advancement:
      "The project resulted in a statistically significant advance over the state of the art for adaptive query optimization in multi-tenant SaaS environments. Specifically, Acme's team demonstrated a 34% reduction in p99 query latency across the analytics-core production workload and a 41% decrease in CPU-hours consumed per complex aggregation — metrics that exceeded published benchmarks from comparable open-source planners operating under similar cardinality conditions. Critically, these results were achieved without requiring schema annotations or manual query hints from application developers, representing a novel contribution to the application of online learning techniques within database query planning systems.",

    work_directly_undertaken:
      "All experimental and development work was performed in-house by Acme's engineering team. The primary contributors were Sarah Kim (Query Planner Lead), Marcus Obi (ML Infrastructure), and three backend engineers who collectively owned the telemetry instrumentation, model training pipeline, and integration test suite. Activities included designing the telemetry schema, labelling and curating training data, implementing and tuning the classifier pipeline, authoring integration tests for the planner, and diagnosing latency regressions in the planner's cost model. No portion of the research or experimental work was subcontracted or performed by external parties.",

    qualified_expenditures:
      "Eligible SR&ED expenditures for this cluster total approximately $238,600, comprising $214,000 in salary and benefits for the six engineers directly engaged in experimental work (allocated on a percentage-of-time basis using Jira time-tracking records), $18,400 in cloud compute costs attributable to model training and A/B testing infrastructure, and $6,200 in software licences for profiling and observability tooling. Overhead costs have been calculated at the 15% prescribed proxy rate per CRA guidance. All expenditures are supported by contemporaneous records including commit timestamps, Jira tickets, and cloud billing statements.",
  },
}

export const DEMO_GRANTS = [
  {
    name: 'NRC-IRAP',
    full_name: 'National Research Council — Industrial Research Assistance Program',
    score: 87,
    max_amount: 500000,
    badge: 'Federal',
    is_high: true,
    description: 'Strong match based on your ML pipeline work and systematic R&D documentation.',
  },
  {
    name: 'SDTC',
    full_name: 'Sustainable Development Technology Canada',
    score: 64,
    max_amount: 3000000,
    badge: 'Federal',
    is_high: false,
    description: 'Moderate match — strengthening your energy-efficiency narrative could improve eligibility.',
  },
  {
    name: 'OINTC',
    full_name: 'Ontario Innovation Tax Credit',
    score: 91,
    max_amount: 200000,
    badge: 'Provincial',
    is_high: true,
    description: 'Excellent match. Your Toronto operations and qualifying expenditures align strongly.',
  },
]
