# DevCollab — Deployment Guide

This guide walks through deploying DevCollab to production. The app is a monorepo
with two deployable pieces plus two managed data stores:

| Piece | Service | What it does |
| --- | --- | --- |
| `apps/ws-server` | **Render** | Express REST API + WebSocket server (`/ws`) |
| `apps/web` | **Vercel** | Next.js 15 frontend (App Router) |
| PostgreSQL | **Neon** | Primary database (Prisma) |
| Redis | **Upstash** | Rate limiting / ephemeral state |

Config files already in the repo:

- `apps/ws-server/render.yaml` — Render Blueprint for the backend
- `apps/web/vercel.json` — Vercel build config for the frontend

---

## Architecture at a glance

```
                 ┌──────────────────────────┐
  Browser  ───▶  │  Vercel (Next.js)        │
                 │  apps/web                 │
                 └───────────┬──────────────┘
                             │  HTTPS (REST)  +  WSS (/ws)
                             ▼
                 ┌──────────────────────────┐
                 │  Render (ws-server)       │
                 │  Express + WebSocket      │
                 └──────┬──────────┬────────┘
                        │          │
                 ┌──────▼───┐  ┌───▼────────┐
                 │  Neon    │  │  Upstash   │
                 │ Postgres │  │   Redis    │
                 └──────────┘  └────────────┘
```

---

## Step-by-step setup

### 0. Prerequisites

- The repo pushed to GitHub.
- A GitHub OAuth App (or two — see note below).
- Accounts on [Render](https://render.com), [Vercel](https://vercel.com),
  [Neon](https://neon.tech), and [Upstash](https://upstash.com) (all have free tiers).
- A shared auth secret. Generate one:
  ```bash
  openssl rand -base64 32
  ```
  This exact value is used for **both** `NEXTAUTH_SECRET` (backend) and
  `AUTH_SECRET` (frontend). They MUST match or WebSocket JWT verification fails.

### 1. Provision the database (Neon)

1. Create a new project in Neon → it gives you a Postgres connection string.
2. Copy the **pooled** connection string; make sure it ends with `?sslmode=require`.
   Example:
   ```
   postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/devcollab?sslmode=require
   ```
3. Save it — this is `DATABASE_URL`.

> Migrations are applied automatically on each Render deploy via
> `prisma migrate deploy` (see `preDeployCommand` in `render.yaml`).

### 2. Provision Redis (Upstash)

1. Create a Redis database in Upstash.
2. Copy the **TLS** connection string (starts with `rediss://`).
   Example:
   ```
   rediss://default:xxxx@apn1-xxx.upstash.io:6379
   ```
3. Save it — this is `REDIS_URL`.

### 3. Create the GitHub OAuth App

1. Go to <https://github.com/settings/developers> → **New OAuth App**.
2. Set the **Authorization callback URL** to the frontend callback:
   ```
   https://<your-vercel-domain>/api/auth/callback/github
   ```
3. Copy the **Client ID** and generate a **Client Secret**.

> The frontend (NextAuth) is what performs the OAuth handshake, so the callback
> points at the Vercel domain. The same Client ID/Secret are also set on the
> backend for consistency. You can create separate OAuth apps for the deployed
> site and local dev if you prefer distinct callback URLs.

### 4. Deploy the backend (Render)

1. Render Dashboard → **New** → **Blueprint** → select your repo.
2. Render reads `apps/ws-server/render.yaml`. (If it doesn't auto-detect, set the
   Blueprint file path to `apps/ws-server/render.yaml`.)
3. Fill in the env vars marked `sync: false` (see the table below).
4. For `NEXTAUTH_URL`, use the Render service URL Render assigns you, e.g.
   `https://devcollab-ws-server.onrender.com`.
5. Deploy. Once live, verify:
   ```bash
   curl https://<your-render-domain>/health
   ```
   You should get a JSON body with `"status": "ok"`.

### 5. Deploy the frontend (Vercel)

1. Vercel Dashboard → **Add New Project** → import your repo.
2. **Important:** set **Root Directory** to `apps/web`.
   Vercel then uses `apps/web/vercel.json`, which builds the workspace via Turbo
   (so `@devcollab/shared-types` is built first).
3. Add the frontend env vars (see the table below).
   - `NEXT_PUBLIC_API_URL` → the Render HTTPS URL.
   - `NEXT_PUBLIC_WS_URL`  → the Render URL as `wss://…/ws`.
   - `AUTH_URL`            → your Vercel domain.
4. Deploy.

### 6. Wire the two sides together

After both are live, make sure the cross-references are correct and redeploy if
you change any env var:

- Backend `CORS_ORIGINS` includes the Vercel domain (e.g. `https://devcollab.vercel.app`).
- Backend `NEXTAUTH_URL` = the Render domain.
- Frontend `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` point at the Render domain.
- Frontend `AUTH_URL` = the Vercel domain.
- GitHub OAuth callback URL = `https://<vercel-domain>/api/auth/callback/github`.
- `NEXTAUTH_SECRET` (backend) == `AUTH_SECRET` (frontend).

---

## Environment variables

### Backend — `apps/ws-server` (Render)

| Variable | Required | Example / value | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✅ | `postgresql://…neon.tech/devcollab?sslmode=require` | Neon pooled connection string |
| `REDIS_URL` | ✅ | `rediss://default:…@…upstash.io:6379` | Upstash TLS URL |
| `NEXTAUTH_SECRET` | ✅ | 32+ char random string | Must equal frontend `AUTH_SECRET` |
| `NEXTAUTH_URL` | ✅ | `https://devcollab-ws-server.onrender.com` | This service's own public URL |
| `CORS_ORIGINS` | ⬜ | `https://devcollab.vercel.app` | Comma-separated allowed frontend origins |
| `GITHUB_CLIENT_ID` | ✅ | `Iv1.abc123…` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | ✅ | `xxxxxxxx` | GitHub OAuth app client secret |
| `GROQ_API_KEY` | ⬜ | `gsk_…` | Enables AI features; omit to disable |
| `PISTON_API_URL` | ⬜ | `https://emkc.org/api/v2/piston` | Code execution engine; self-host for prod |
| `NODE_ENV` | ⬜ | `production` | Set by `render.yaml` |
| `LOG_LEVEL` | ⬜ | `info` | `debug` \| `info` \| `warn` \| `error` |
| `PORT` | ⬜ | *(auto)* | Injected by Render; do not set manually |

### Frontend — `apps/web` (Vercel)

| Variable | Required | Example / value | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | ✅ | `https://devcollab-ws-server.onrender.com` | Backend REST base URL |
| `NEXT_PUBLIC_WS_URL` | ✅ | `wss://devcollab-ws-server.onrender.com/ws` | Backend WebSocket URL (note `/ws`) |
| `AUTH_SECRET` | ✅ | 32+ char random string | Must equal backend `NEXTAUTH_SECRET` |
| `AUTH_URL` | ✅ | `https://devcollab.vercel.app` | Canonical frontend URL |
| `AUTH_GITHUB_ID` | ✅ | `Iv1.abc123…` | GitHub OAuth app client ID |
| `AUTH_GITHUB_SECRET` | ✅ | `xxxxxxxx` | GitHub OAuth app client secret |

> `NEXT_PUBLIC_*` values are baked into the browser bundle at build time — never
> put secrets there, and redeploy after changing them.

---

## Health check

The backend exposes `GET /health`, used by Render's `healthCheckPath`:

```json
{
  "status": "ok",
  "timestamp": "2026-07-29T05:35:00.000Z",
  "uptimeSeconds": 128,
  "services": {
    "database": "up",
    "redis": "up",
    "websocket": "up"
  },
  "connections": 3
}
```

- Returns **200** when the critical dependencies (database + WebSocket server)
  are up.
- Returns **503** when the database is unreachable or the WebSocket server isn't
  running, so Render can restart the instance.
- A Redis outage is reported as `"status": "degraded"` but still returns **200**,
  since Redis only backs rate limiting and shouldn't take the whole service down.

---

## Verifying a deploy

```bash
# Backend is healthy
curl -i https://<render-domain>/health

# CORS allows the frontend origin (should echo the origin header)
curl -i -H "Origin: https://<vercel-domain>" https://<render-domain>/health

# Frontend loads
curl -I https://<vercel-domain>
```

Then open the site, sign in with GitHub, create a room, and confirm real-time
editing works (the WebSocket connects to `wss://…/ws`).

---

## Troubleshooting

**CORS errors in the browser console**
- Ensure `CORS_ORIGINS` on Render contains the exact frontend origin, including
  scheme and no trailing slash (e.g. `https://devcollab.vercel.app`).
- The backend logs `Blocked by CORS` with the offending origin — check Render logs.
- Redeploy the backend after changing `CORS_ORIGINS`.

**WebSocket won't connect / immediately closes**
- `NEXT_PUBLIC_WS_URL` must use `wss://` (not `ws://`) in production and end with `/ws`.
- Confirm `NEXTAUTH_SECRET` (backend) and `AUTH_SECRET` (frontend) are identical —
  a mismatch makes JWT verification fail and the socket closes with code 1008.
  Both apps log a secret fingerprint at startup you can compare.

**Login fails / redirect loop**
- The GitHub OAuth callback URL must be `https://<vercel-domain>/api/auth/callback/github`.
- `AUTH_URL` must equal the deployed Vercel domain.

**`/health` returns 503**
- `database: down` → check `DATABASE_URL`; Neon requires `?sslmode=require`.
- `websocket: down` → the server failed to start; check Render logs.

**`/health` shows `redis: down` / status `degraded`**
- Check `REDIS_URL`; Upstash requires the `rediss://` (TLS) URL. The service
  still serves traffic, but rate limiting is impaired.

**Render build fails on Prisma**
- The build runs `prisma generate` and `prisma migrate deploy`. If migrations
  fail, verify `DATABASE_URL` is reachable from Render and the schema is committed.

**Vercel build can't resolve `@devcollab/shared-types`**
- Confirm **Root Directory** is set to `apps/web` so `vercel.json` is used; its
  build command runs `turbo run build --filter=@devcollab/web`, which builds the
  shared package first.

**First request after idle is slow**
- Render's free tier spins services down when idle; the first request cold-starts
  the instance. Upgrade the plan to keep it warm.
