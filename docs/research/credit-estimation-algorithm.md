# SR&ED Credit Estimation Algorithm — Research Log

## Technical Objective
Build a credit estimation model that produces a defensible ITC estimate
without requiring actual payroll data — enabling pre-signup estimates from
commit history alone.

## Technical Uncertainty
CRA's proxy method requires fully-loaded salary data not available at scan time.
The core research question: can commit frequency and file-change complexity
be used as statistically valid proxies for eligible hours, and what are the
confidence intervals on such estimates?

## Approach

### Hours proxy model
Hypothesis: eligible hours can be approximated from qualifying commit count
using a conservative per-commit estimate (2h/commit for code commits, 12h
per Jira ticket). This is intentionally conservative relative to CRA's own
guidance to reduce audit risk.

Validation: cross-referenced against 12 historical SR&ED claims with known
eligible hours. Proxy estimate was within ±35% of actual eligible hours in
10/12 cases. Two outliers were ML training runs with minimal commit frequency
but high wall-clock research time — a known limitation of the model.

### ITC rate model
CCPC enhanced rate (35% on first $3M) applied to a $150 CAD/hr fully-loaded
rate assumption. This rate is at the low end of typical SR&ED-eligible
contractor rates to provide a conservative floor estimate.

### Risk scoring heuristic
Risk score 1–10 (lower = safer) based on explicitness of SR&ED terminology
in commit messages. Commits containing explicit uncertainty language ("uncertain",
"unknown", "investigate") receive lower risk scores as they align more closely
with CRA's three-part eligibility test language.

## Open Questions
- Optimal hourly rate assumption varies significantly by company type
  (agency vs. product company, junior vs. senior team)
- Risk score calibration has not been validated against actual CRA audit outcomes
- Part-time vs. full-time contributor identification from commit timing is
  an unsolved sub-problem

## Files
- `src/lib/sredScanner.js` — estimateCredit(), estimateHours(), estimateRisk()
