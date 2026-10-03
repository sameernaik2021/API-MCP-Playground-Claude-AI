import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as mcp from './mcp-client.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch {}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(root, 'frontend')));

const hist = [], stats = { api: 0, mcp: 0, err: 0 };
const log = e => { hist.unshift({ time: new Date().toISOString(), ...e }); if (hist.length > 200) hist.pop(); e.type === 'API' ? stats.api++ : stats.mcp++; if (!e.ok) stats.err++; };

// SSRF guard: the proxy only talks to these hosts.
const HOSTS = ['api.open-meteo.com', 'restcountries.com', 'nominatim.openstreetmap.org', 'en.wikipedia.org', 'www.wikidata.org', 'api.github.com', 'gitlab.com', 'openlibrary.org', 'api.themoviedb.org', 'api.jikan.moe', 'pokeapi.co', 'api.coingecko.com', 'api.frankfurter.dev', 'api.nasa.gov', 'api.openalex.org', 'api.crossref.org', 'hacker-news.firebaseio.com', 'www.thesportsdb.com', 'api.pexels.com'];
// Where each secret goes: q = query, h = Authorization header, b = JSON body
const KEYS = { tmdb: ['q', 'api_key', 'TMDB_API_KEY'], nasa: ['q', 'api_key', 'NASA_API_KEY', 'DEMO_KEY'], pexels: ['h', 'Authorization', 'PEXELS_API_KEY'], libretranslate: ['b', 'api_key', 'LIBRETRANSLATE_API_KEY'] };
const SETTABLE = new Set(['TMDB_API_KEY', 'PEXELS_API_KEY', 'NASA_API_KEY', 'LIBRETRANSLATE_API_KEY', ...mcp.envNames()]);

app.post('/api/proxy', async (req, res) => {
  const { apiId, api, method = 'GET', url, headers = {}, body } = req.body || {};
  const id = apiId || api, t = Date.now();
  let out;
  try {
    const u = new URL(url);
    const lt = new URL(process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com').host;
    if (u.protocol !== 'https:' || ![...HOSTS, lt].includes(u.host)) throw Object.assign(new Error(), { code: 'blocked' });
    if (!['GET', 'POST'].includes(method)) throw Object.assign(new Error(), { code: 'blocked' });
    const h = { 'User-Agent': 'api-mcp-playground/1.0 (learning tool)', Accept: 'application/json' };
    for (const k of ['accept', 'content-type']) for (const [hk, hv] of Object.entries(headers)) if (hk.toLowerCase() === k) h[hk] = String(hv);
    let payload = body && typeof body === 'object' ? { ...body } : undefined;
    const k = KEYS[id];
    if (k) {
      const val = process.env[k[2]] || k[3];
      if (!val) throw Object.assign(new Error(), { code: 'missing_key' });
      if (k[0] === 'q') u.searchParams.set(k[1], val);
      else if (k[0] === 'h') h[k[1]] = val;
      else if (payload) payload[k[1]] = val;
    }
    if (payload) h['Content-Type'] = 'application/json';
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 15000);
    const r = await fetch(u, { method, headers: h, body: payload && method === 'POST' ? JSON.stringify(payload) : undefined, signal: ac.signal, redirect: 'error' });
    const text = await r.text();
    clearTimeout(to);
    let data = null;
    try { data = JSON.parse(text); } catch {}
    out = { status: r.status, statusText: r.statusText, ms: Date.now() - t, data, raw: data === null ? text.slice(0, 5000) : undefined, error: data === null && r.ok ? 'invalid_json' : undefined };
  } catch (e) {
    out = { status: 0, ms: Date.now() - t, error: e.name === 'AbortError' ? 'timeout' : ['blocked', 'missing_key'].includes(e.code) ? e.code : 'network' };
  }
  log({ type: 'API', service: id, operation: `${method} ${url}`, status: out.status || out.error, duration: out.ms, ok: out.status >= 200 && out.status < 300 && !out.error });
  res.json(out);
});

app.get('/api/settings', (_, res) => res.json([...SETTABLE].map(name => ({ name, set: !!process.env[name] }))));
app.post('/api/settings', (req, res) => {
  const { name, value } = req.body || {};
  if (!SETTABLE.has(name) || typeof value !== 'string') return res.status(400).json({ error: 'Unknown setting' });
  value ? (process.env[name] = value.trim()) : delete process.env[name]; // memory only; persist in .env yourself
  res.json({ ok: true });
});

app.get('/api/history', (_, res) => res.json(hist));
app.delete('/api/history', (_, res) => { hist.length = 0; Object.assign(stats, { api: 0, mcp: 0, err: 0 }); res.json({ ok: true }); });
app.get('/api/stats', (_, res) => res.json({ ...stats, connected: mcp.connectedCount() }));

app.get('/api/mcp/servers', (_, res) => res.json(mcp.catalog()));
const mcpRoute = (op) => async (req, res) => {
  const id = req.params.id, t = Date.now();
  try {
    const r = await op(id, req.body || {});
    const bad = !!r.result?.isError;
    if (op.log) log({ type: 'MCP', service: id, operation: req.body.name, status: bad ? 'tool error' : 'ok', duration: Date.now() - t, ok: !bad });
    res.json({ ok: true, ms: Date.now() - t, ...r });
  } catch (e) {
    log({ type: 'MCP', service: id, operation: req.body?.name || op.label, status: 'failed', duration: Date.now() - t, ok: false });
    res.json({ ok: false, error: mcp.errText(e) });
  }
};
const conn = Object.assign(id => mcp.connectMcpServer(id), { label: 'connect' });
const list = Object.assign(async id => ({ tools: await mcp.listMcpTools(id) }), { label: 'list tools' });
const call = Object.assign(async (id, b) => ({ result: await mcp.callMcpTool(id, b.name, b.arguments) }), { log: true, label: 'call' });
const disc = async id => { await mcp.disconnectMcpServer(id); return {}; };
app.post('/api/mcp/:id/connect', mcpRoute(conn));
app.post('/api/mcp/:id/tools', mcpRoute(list));
app.post('/api/mcp/:id/call', mcpRoute(call));
app.post('/api/mcp/:id/disconnect', mcpRoute(disc));

const port = process.env.PORT || 3000;
app.listen(port, '127.0.0.1', () => console.log(`API & MCP Playground → http://localhost:${port}`));
