# TaxLift Backend API

Node.js / Express backend for the TaxLift SR&ED platform.
Uses SQLite via `better-sqlite3` — no external database needed.

## Requirements

- **Node.js 22.5+** — uses the built-in `node:sqlite` module (no native addon needed)
- No PostgreSQL, Redis, or other external services required

## Quick start

```bash
cd server
cp .env.example .env          # fill in JWT_SECRET at minimum
npm install
node index.js                  # or: npm start
# → http://localhost:3001
```

The frontend dev server runs on `http://localhost:5173` (Vite default).
Set `VITE_API_URL=http://localhost:3001` in the **webapp** `.env` (or `.env.local`):

```bash
# webapp/.env.local
VITE_API_URL=http://localhost:3001
```

Without `VITE_API_URL`, the frontend falls back to in-memory mock data so the
app still works standalone.

---

## API endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account, returns JWT |
| POST | `/api/auth/login` | Email + password → JWT |
| GET  | `/api/auth/me` | Decode JWT → current user (protected) |

### Clients (CPA portal)
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/clients` | List all clients for the authed user |
| POST   | `/api/clients` | Create a new client |
| GET    | `/api/clients/:id` | Get client + clusters |
| PUT    | `/api/clients/:id` | Update client fields |
| DELETE | `/api/clients/:id` | Delete client + clusters |

### Clusters
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/clusters/:id` | Get cluster detail |
| POST   | `/api/clusters` | Create cluster under a client |
| PUT    | `/api/clusters/:id` | Update cluster (narrative, status, hours) |
| DELETE | `/api/clusters/:id` | Delete cluster |

### Referrals
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/referrals` | List referrals for authed user |
| GET    | `/api/referrals/stats` | Aggregate commission stats |
| POST   | `/api/referrals` | Create referral record |
| PUT    | `/api/referrals/:id` | Update referral status / commission |

### OAuth proxy (fixes browser CORS on token exchange)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/oauth/github/callback?code=&state=` | Exchange GitHub code for access token |
| GET | `/api/oauth/atlassian/callback?code=&state=` | Exchange Atlassian code for access token |
| GET | `/api/oauth/github/user` | Proxy `/user` from GitHub API |
| GET | `/api/oauth/github/repos` | Proxy `/user/repos` from GitHub API |
| GET | `/api/oauth/github/commits?repo=owner/repo` | Proxy commit list |
| GET | `/api/oauth/atlassian/resources` | List accessible Jira cloud instances |
| GET | `/api/oauth/atlassian/issues?cloudId=&projectKey=` | Search Jira issues |

### Health
```
GET /health → { status: "ok", service: "taxlift-api", ... }
```

---

## Authentication

All protected routes require:
```
Authorization: Bearer <jwt>
```

Tokens expire in **7 days**. The frontend stores them in `localStorage` under the
key `taxlift_access_token`.

---

## Seeded demo credentials

The database is seeded on first run with these accounts:

| Email | Password | Role |
|-------|----------|------|
| `admin@taxlift.dev` | `Admin1234!` | admin |
| `sarah.chen@acmecorp.com` | `Admin1234!` | admin |
| `marcus.reid@acmecorp.com` | `Reviewer123!` | reviewer |
| `jordan.kim@acmecorp.com` | `Dev12345!` | developer |
| `margaret.chen@crowe.ca` | `Cpa12345!` | cpa |

The CPA account (`margaret.chen@crowe.ca`) owns the 6 demo clients and 5 referrals
that match the frontend mockData exactly.

---

## Setting up OAuth

### GitHub
1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**
2. Set **Authorization callback URL** to `http://localhost:5173/oauth/callback`
3. Copy **Client ID** and **Client Secret** into `server/.env`
4. The frontend's `oauthConfig.js` already reads `VITE_GITHUB_CLIENT_ID`

### Atlassian (Jira)
1. Go to [developer.atlassian.com/console/myapps](https://developer.atlassian.com/console/myapps/) → **Create app** → **OAuth 2.0 (3LO)**
2. Add callback URL: `http://localhost:5173/oauth/callback`
3. Add scopes: `read:jira-work`, `read:jira-user`, `offline_access`
4. Copy **Client ID** and **Secret** into `server/.env`

When `GITHUB_CLIENT_ID` or `ATLASSIAN_CLIENT_ID` are not set, the `/api/oauth/*`
callback endpoints return `{ demo: true }` and the frontend falls back to the
built-in demo commits/issues.

---

## Database

SQLite file is created at `server/taxlift.db` on first run.
Tables: `users`, `clients`, `clusters`, `referrals`.

To reset to clean seed data:
```bash
rm server/taxlift.db
node server/index.js   # re-seeds automatically
```

---

## Production notes

- Set a strong `JWT_SECRET` (32+ random bytes)
- Set `FRONTEND_URL` to your deployed frontend origin for CORS
- Consider a process manager like PM2: `pm2 start index.js --name taxlift-api`
- SQLite works well for single-server deployments up to ~100K rows; migrate to
  PostgreSQL (via `pg` + `drizzle-orm` or `prisma`) for multi-instance or larger scale
