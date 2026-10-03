import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = ['config/mcp-config.json', 'config/mcp-config.example.json'].map(p => path.join(root, p)).find(fs.existsSync);
const registry = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).mcpServers; // ONLY servers listed here can ever be started
const conns = new Map();

// Safe defaults: the filesystem server is limited to this one directory.
process.env.MCP_FS_ALLOWED_DIR ||= path.join(root, 'sandbox');
fs.mkdirSync(process.env.MCP_FS_ALLOWED_DIR, { recursive: true });
const sub = s => String(s).replace(/\$\{(\w+)\}/g, (_, k) => process.env[k] ?? '');
const short = e => String(e?.message || e).split('\n')[0].slice(0, 200);

export const envNames = () => [...new Set(Object.values(registry).flatMap(s => [...(s.env || []), s.tokenEnv].filter(Boolean)))];

export function catalog() {
  return Object.entries(registry).map(([id, s]) => ({
    id, name: s.name, category: s.category, description: s.description, location: s.url ? 'Remote' : 'Local',
    transport: s.url ? 'streamable-http' : 'stdio', auth: s.auth, license: s.license, verify: !!s.verify, note: s.note,
    command: s.command, args: s.args, url: s.url, envVars: (s.env || (s.tokenEnv ? [s.tokenEnv] : [])).map(n => ({ name: n, set: !!process.env[n] })),
    connected: conns.has(id), tools: conns.get(id)?.tools.map(t => t.name) || []
  }));
}

export async function connectMcpServer(id) {
  const s = registry[id];
  if (!s) throw new Error('Unknown MCP server');
  if (conns.has(id)) return summary(id);
  let transport;
  if (s.url) {
    const headers = s.tokenEnv && process.env[s.tokenEnv] ? { Authorization: `Bearer ${process.env[s.tokenEnv]}` } : {};
    transport = new StreamableHTTPClientTransport(new URL(s.url), { requestInit: { headers } });
  } else {
    const env = { ...getDefaultEnvironment() };
    (s.env || []).forEach(n => { if (process.env[n]) env[n] = process.env[n]; });
    transport = new StdioClientTransport({ command: s.command, args: (s.args || []).map(sub), env, stderr: 'ignore' });
  }
  const client = new Client({ name: 'api-mcp-playground', version: '1.0.0' });
  const timeout = new Promise((_, r) => setTimeout(() => r(new Error('Connection timed out after 45s')), 45000));
  try { await Promise.race([client.connect(transport), timeout]); }
  catch (e) { try { await client.close(); } catch {} throw new Error(short(e)); }
  const info = client.getServerVersion() || {};
  const { tools } = await client.listTools();
  let resources = [];
  try { resources = (await client.listResources()).resources; } catch {}
  conns.set(id, { client, info, tools, resources });
  return summary(id);
}

const summary = id => { const c = conns.get(id); return { info: { name: c.info.name, version: c.info.version }, tools: c.tools.map(toolView), resources: c.resources.map(r => ({ uri: r.uri, name: r.name })) }; };
const toolView = t => ({ name: t.name, description: t.description || '', inputSchema: t.inputSchema || { type: 'object', properties: {} } });

export async function listMcpTools(id) {
  const c = conns.get(id);
  if (!c) throw new Error('Not connected');
  c.tools = (await c.client.listTools()).tools; // fresh schema discovery
  return c.tools.map(toolView);
}

export async function callMcpTool(id, name, args) {
  const c = conns.get(id);
  if (!c) throw new Error('Not connected');
  if (!c.tools.some(t => t.name === name)) throw new Error('Unknown tool');
  return c.client.callTool({ name, arguments: args || {} });
}

export async function disconnectMcpServer(id) {
  const c = conns.get(id);
  conns.delete(id);
  if (c) try { await c.client.close(); } catch {}
}

export const connectedCount = () => conns.size;
export const errText = short;
