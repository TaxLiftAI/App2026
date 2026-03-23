# Credible — Web App MVP

React + Vite + TailwindCSS frontend for the Credible R&D Tax Credit Compliance Platform.

## Quick Start

```bash
cd webapp
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

## Demo Login

Select any persona on the login screen to explore role-based access:

| Persona | Role | Access |
|---|---|---|
| Sarah Chen | Admin | Everything incl. Users, Integrations |
| Marcus Reid | Reviewer | Clusters, Narratives, Reports, Audit Log |
| Jordan Kim | Developer | Dashboard only |
| David Okafor | Auditor | Read-only: Clusters, Reports, Audit Log |

## Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/dashboard` | Stats, credit trend chart, recent clusters, integration health |
| Clusters | `/clusters` | Filterable/sortable cluster queue |
| Cluster Detail | `/clusters/:id` | Evidence tabs (Commits / Jira / Builds) + Narrative review |
| Reports | `/reports` | Financial summary with period selector and export |
| Users | `/users` | Invite users, change roles, manage interview opt-outs |
| Audit Log | `/audit-log` | Immutable audit trail with action/actor filters |
| Integrations | `/integrations` | GitHub / Jira / Slack connection status and sync controls |

## Key Reviewer Workflow

1. Go to **Clusters** → filter by `Drafted`
2. Click a cluster to open the detail view
3. Review the **Evidence Snapshot** (Commits / Jira / Build Logs tabs)
4. Read the **Compliance Narrative** and its evidence citations
5. Click **Approve Narrative** (or **Reject**)
6. On approval, the Accountant agent would trigger financial calculation (mocked)

## Architecture Notes

- All data lives in `src/data/mockData.js` — schemas match the OpenAPI v1.0 spec exactly
- `src/lib/utils.js` — formatting helpers and role-based access control
- `src/context/AuthContext.jsx` — JWT auth simulation (swap for real auth on backend integration)
- No backend calls yet — replace `mockData.js` imports with `fetch('/api/v1/...')` calls when the API is live

## Tech Stack

- **React 18** + **Vite 6**
- **TailwindCSS 3**
- **React Router v6** — client-side routing
- **Recharts** — Dashboard area chart and status pie chart
- **Lucide React** — Icons
