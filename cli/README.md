# taxlift-ci

> Capture build metrics from any CI pipeline and send them to [TaxLift AI](https://taxlift.ai) for automatic SR&ED credit attribution.

## Quick start

Add one step to your CI pipeline — that's it.

**GitHub Actions**
```yaml
- name: Record build in TaxLift
  env:
    TAXLIFT_TOKEN: ${{ secrets.TAXLIFT_TOKEN }}
  run: npx taxlift-ci --optional
```

**Any other CI (CircleCI, Jenkins, GitLab, Bitbucket, etc.)**
```bash
TAXLIFT_TOKEN=<your-token> npx taxlift-ci --optional
```

The agent auto-detects your CI platform, reads commit SHA / branch / duration, and sends a build run record to TaxLift where it is matched to an SR&ED cluster and scored for eligibility.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `TAXLIFT_TOKEN` | ✅ yes | Per-tenant API token — generate in TaxLift → Integrations → CI Token |
| `TAXLIFT_API_URL` | no | Override API base URL (default: `https://app2026-production.up.railway.app`) |
| `TAXLIFT_STATUS` | no | Override build status: `success` \| `failure` \| `cancelled` |
| `TAXLIFT_TEST_PASSED` | no | Number of passing tests |
| `TAXLIFT_TEST_FAILED` | no | Number of failing tests |
| `TAXLIFT_TEST_SKIPPED` | no | Number of skipped tests |

## Flags

| Flag | Description |
|---|---|
| `--dry-run` | Print detected metadata without sending to TaxLift |
| `--optional` | Exit 0 even on failure — prevents blocking your CI pipeline |
| `--verbose` | Print debugging output |

## How SR&ED attribution works

TaxLift scores each build run for SR&ED eligibility based on:

- **Branch name** — branches starting with `experimental/`, `spike/`, `research/`, or `poc/` are automatically eligible
- **Build failure** — failed builds indicate technological uncertainty (a core SR&ED criterion)
- **Duration** — long builds on feature branches often contain R&D iteration
- **Test failures** — tests that fail signal hard problems being solved

Eligible build runs are linked to SR&ED clusters and contribute to your annual T661 report as evidence of R&D activity.

## Supported CI platforms

GitHub Actions, GitLab CI, CircleCI, Jenkins, Bitbucket Pipelines, Travis CI, Buildkite, Azure DevOps, Drone CI — and any custom CI via `TAXLIFT_*` environment variables.
