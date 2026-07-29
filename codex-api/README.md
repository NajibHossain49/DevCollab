# DevCollab CodeX API (self-hosted code execution)

A small, self-hostable code-execution service that the DevCollab `ws-server`
calls to run user-submitted code. It is API-compatible with the CodeX API by
Jaagrav (originally at `api.codex.jaagrav.in`, whose public instance is
unreliable/offline), so the ws-server needs no code changes — just point
`CODEX_API_URL` at your deployment of this service.

Unlike Piston, this service runs the language toolchains **directly** (no
Docker-in-Docker / privileged mode), so it deploys on ordinary Docker hosts
such as Render, Railway, or Fly.io.

## API

### `POST /`

Body (`application/x-www-form-urlencoded` or JSON):

| Field      | Description                                                        |
| ---------- | ------------------------------------------------------------------ |
| `code`     | Source code to execute (required)                                  |
| `language` | Language slug: `py`, `js`, `ts`, `java`, `cpp`, `go`, `rs` (required)|
| `input`    | Optional stdin passed to the program                               |

Response (JSON):

```json
{ "timeStamp": 1730000000000, "status": 200, "output": "…", "error": "" }
```

On a compile/runtime error `error` is populated (and `status` is 200; the
caller decides success from a non-empty `error`).

### `GET /status`

Simple liveness/uptime probe.

## Supported languages

| Slug   | Toolchain              |
| ------ | ---------------------- |
| `py`   | python3                |
| `js`   | node 20                |
| `ts`   | tsx (esbuild, no type-check) |
| `java` | default-jdk (Java 17)  |
| `cpp`  | g++                    |
| `go`   | golang-go              |
| `rs`   | rustc                  |

> TypeScript is transpiled and run (types are stripped, not type-checked).

## Local run

```bash
npm install
node index.js            # listens on PORT (default 3000)

# Requires python3, node, g++, a JDK, and go on your PATH. Or use Docker:
docker build -t devcollab-codex .
docker run --rm -p 3000:3000 devcollab-codex
```

## Deploy on Render (Docker)

1. Push this repo to GitHub.
2. Render → **New → Web Service** → pick the repo.
3. **Root Directory:** `codex-api`  •  **Runtime:** Docker.
4. Instance type: at least the 512 MB free tier (Java/Go compile is memory
   hungry; upgrade if you hit out-of-memory).
5. Deploy, then copy the service URL (e.g. `https://devcollab-codex.onrender.com`).
6. In the **ws-server** service, set `CODEX_API_URL` to that URL and redeploy.

## Security note

This service executes arbitrary user code inside its own container. Keep it
isolated (a dedicated service instance), do not mount secrets into it, and
prefer restricting who can reach it. The blast radius is limited to the
ephemeral container, which is acceptable for low-volume / educational use.
