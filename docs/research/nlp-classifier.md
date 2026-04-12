# SR&ED Signal Detection — NLP Classifier Research Log

## Technical Objective
Develop a commit message classifier that identifies SR&ED-qualifying activities
with sufficient precision (< 20% false positive rate) to be credible for a CRA
T661 submission.

## Technical Uncertainty
At project start, no established method existed for automated SR&ED eligibility
scoring of version control commit messages. CRA eligibility criteria (technological
uncertainty, systematic investigation, advancement beyond current knowledge base)
were defined in qualitative terms — translating these into quantifiable signals
was an unsolved problem.

## Investigation Phases

### Phase 1 — Regex approach (abandoned)
Initial hypothesis: a set of exact-match regex patterns derived from CRA SR&ED
terminology would be sufficient. Results: 61% false negative rate on a manually
labelled test set of 200 commits from known SR&ED claimants. The approach failed
because engineers rarely use CRA terminology in day-to-day commit messages.

### Phase 2 — Keyword-weighted scoring
Replaced exact regex with a multi-dimensional scoring model:
- Dimension 1: commit message subject line (keyword match, max 3 pts)
- Dimension 2: file paths touched (path pattern match, max 4 pts)  
- Dimension 3: diff/patch content scan (keyword match in code changes, max 5 pts)

QUALIFY_THRESHOLD tuned to 3 pts after empirical testing showed this minimised
false positives while retaining 78% of manually-confirmed qualifying commits.

### Phase 3 — Theme classification
Grouping qualifying commits into SR&ED business components required unsupervised
clustering. Investigation of k-means, LDA, and BM25 approaches. Final implementation
uses keyword-intersection-based theme detection — simpler than statistical approaches
but more interpretable for CRA reviewers and CPAs. Trade-off: lower recall on
novel themes not covered by keyword taxonomy.

## Open Questions / Technical Uncertainty Remaining
- False negative rate for unconventional commit styles (emoji commits, terse messages)
  estimated at 40%+ — mitigation under investigation
- Optimal threshold for diff-content scoring not validated against real CRA audit outcomes
- Theme classification accuracy degrades on multi-domain repos

## Files
- `src/lib/sredScanner.js` — primary classifier implementation
- `src/pages/scan/ScanRunningPage.jsx` — orchestration layer
