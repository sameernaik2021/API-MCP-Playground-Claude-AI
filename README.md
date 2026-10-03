# API & MCP Playground

A developer-tool style playground to call 20 public APIs and 20 MCP servers. Vanilla HTML/CSS/JS frontend, Node.js (Express) backend, official MCP SDK. No fake responses: every call hits the real service.

## Architecture
```
frontend/  index.html, styles.css, app.js   (no build step)
backend/   server.js (HTTP API, proxy, history, settings), mcp-client.js (generic MCP layer), package.json
config/    mcp-config.example.json          (the MCP registry / allowlist)
```
- All API calls go browser → `/api/proxy` → provider. This avoids CORS, injects secrets server-side, enforces a host allowlist and records history (in memory).
- MCP: browser → `/api/mcp/:id/{connect,tools,call,disconnect}` → backend → MCP server (stdio or streamable HTTP). Tool forms are generated from the `inputSchema` returned by `tools/list`.
- Reusable functions: `connectMcpServer()`, `listMcpTools()`, `callMcpTool()`, `disconnectMcpServer()`; `executeApiRequest()` and `apiDefinitions` in `app.js`.

## Install & run
Requires Node >= 20.12 (and `uv` for Python-based MCP servers: git, fetch, time, sqlite, redis, docker).
```
cd backend
npm install
npm start          # http://localhost:3000
```
Frontend and backend run together (Express serves `frontend/`).

## Configuration
1. `cp .env.example .env` and fill in keys (`TMDB_API_KEY`, `PEXELS_API_KEY`, `NASA_API_KEY`, `LIBRETRANSLATE_API_KEY`, ...).
2. `cp config/mcp-config.example.json config/mcp-config.json` and edit.
3. Keys can also be entered on the Settings page. They go to the backend process memory only, are never returned to the browser and never use localStorage. Persist them in `.env`.

## Adding a new API
Add one `A(...)` entry to `apiDefinitions` in `frontend/app.js`, and its host to `HOSTS` in `backend/server.js`. For keyed APIs set `kt` (`q`, `h` or `b`) and add the env var to `KEYS` in `server.js`. Optionally add a renderer branch in `human()`.

## Adding a new MCP server
Add an entry to `config/mcp-config.json` (`command`/`args`/`env` for stdio or `url`/`tokenEnv` for remote). No code changes needed.

## Security
- Only servers in the config can start; the browser never sends commands.
- Filesystem MCP is limited to `MCP_FS_ALLOWED_DIR` (default `./sandbox`).
- Env vars are passed to a child process only if listed in that server's `env`.
- Server binds to 127.0.0.1. Do not expose it publicly: it has no authentication.
- Docker/Kubernetes/database servers are powerful. Use restricted credentials.
- Errors returned to the UI are short messages, never stack traces.

## Free-tier / correctness notes
Badges reflect policies as last known and can change: check each provider's terms. Entries marked "Verify package" (archived or community MCP servers) and OpenAlex, CoinGecko and LibreTranslate terms need verification. An MCP server does not make a paid underlying service free.

## CORS & rate limits
CORS does not apply because the backend calls the providers. Providers rate-limit by server IP: GitHub 60/h unauthenticated, Nominatim ~1 req/s, Jikan and CoinGecko limited. HTTP 429 is shown with a friendly message.

## Troubleshooting
- `MCP connection failed`: install `npx`/`uvx`, check env vars on the server card.
- `Missing API key`: set it in Settings or `.env`.
- Network error: check connectivity or provider outage.
