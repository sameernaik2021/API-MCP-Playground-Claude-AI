'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const j = async (u, o = {}) => (await fetch(u, { headers: { 'Content-Type': 'application/json' }, ...o })).json();
const post = (u, b) => j(u, { method: 'POST', body: JSON.stringify(b || {}) });
const toast = m => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; $('#toasts').append(t); setTimeout(() => t.remove(), 2400); };
const copy = t => navigator.clipboard.writeText(t).then(() => toast('Copied'), () => toast('Copy failed'));
const download = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); };
const parse = s => { s = s.trim(); return s ? JSON.parse(s) : undefined; };

/* ---------- Centralised API definitions ---------- */
// A(id, name, icon, category, badge, description, website, docs, method, url, params, opts)
// {param} in url = path placeholder; other params are sent as query (or body when opts.b lists them).
// opts.kt = where the backend injects a secret: 'q' query, 'h' header, 'b' body.
const A = (id, name, icon, cat, badge, desc, site, doc, m, url, p, o = {}) => ({ id, name, icon, cat, badge, desc, site, doc, m, url, p, auth: o.kt ? 'key' : 'none', b: [], ...o });
const apiDefinitions = [
  A('open-meteo', 'Open-Meteo', '☀️', 'Weather', 'Free — no key', 'Forecasts for any coordinates. Use case: show current conditions on a travel app. Free for non-commercial use.', 'https://open-meteo.com', 'https://open-meteo.com/en/docs', 'GET', 'https://api.open-meteo.com/v1/forecast?current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code', { latitude: '18.52', longitude: '73.85' }),
  A('rest-countries', 'REST Countries', '🌍', 'Maps', 'Free — no key', 'Country data by name. Use case: country picker with flag, currency and languages.', 'https://restcountries.com', 'https://restcountries.com/#rest-countries', 'GET', 'https://restcountries.com/v3.1/name/{name}?fields=name,capital,population,region,currencies,languages,flags', { name: 'India' }),
  A('nominatim', 'OpenStreetMap Nominatim', '📍', 'Maps', 'Free — usage policy applies', 'Geocoding places to coordinates. Use case: address search. Max ~1 request/second, no bulk use.', 'https://nominatim.org', 'https://nominatim.org/release-docs/latest/api/Search/', 'GET', 'https://nominatim.openstreetmap.org/search?format=jsonv2', { q: 'Shaniwar Wada, Pune', limit: '3' }),
  A('wikipedia', 'Wikipedia API', '📚', 'Knowledge', 'Free — no key', 'Search article titles and summaries. Use case: instant topic lookup.', 'https://www.mediawiki.org', 'https://www.mediawiki.org/wiki/API:REST_API', 'GET', 'https://en.wikipedia.org/w/rest.php/v1/search/page', { q: 'Alan Turing', limit: '5' }),
  A('wikidata', 'Wikidata', '🧩', 'Knowledge', 'Free — no key', 'Structured entity search. Use case: resolve a name to a Q-identifier.', 'https://www.wikidata.org', 'https://www.wikidata.org/w/api.php?action=help&modules=wbsearchentities', 'GET', 'https://www.wikidata.org/w/api.php?action=wbsearchentities&language=en&format=json', { search: 'Pune', limit: '5' }),
  A('github', 'GitHub API', '🐙', 'Developer', 'Free tier — rate limited', 'Repository metadata. Unauthenticated: 60 requests/hour per IP. Use case: repo stats badge.', 'https://github.com', 'https://docs.github.com/en/rest', 'GET', 'https://api.github.com/repos/{owner}/{repo}', { owner: 'nodejs', repo: 'node' }),
  A('gitlab', 'GitLab API', '🦊', 'Developer', 'Free — public data', 'Search public projects. Use case: find popular open source projects.', 'https://gitlab.com', 'https://docs.gitlab.com/ee/api/rest/', 'GET', 'https://gitlab.com/api/v4/projects?order_by=star_count&sort=desc', { search: 'gitlab', per_page: '5' }),
  A('open-library', 'Open Library', '📖', 'Books', 'Free — no key', 'Book search with covers. Use case: reading-list app.', 'https://openlibrary.org', 'https://openlibrary.org/developers/api', 'GET', 'https://openlibrary.org/search.json', { q: 'harry potter', limit: '10' }),
  A('tmdb', 'TMDB API', '🎬', 'Movies', 'Free tier — account & API key required', 'Movie and TV metadata. Needs a free TMDB account for a v3 API key (non-commercial terms).', 'https://www.themoviedb.org', 'https://developer.themoviedb.org/docs', 'GET', 'https://api.themoviedb.org/3/search/movie', { query: 'Inception' }, { kt: 'q' }),
  A('jikan', 'Jikan (MyAnimeList)', '🎌', 'Movies', 'Free — rate limited', 'Unofficial MyAnimeList API. Use case: anime search.', 'https://jikan.moe', 'https://docs.api.jikan.moe', 'GET', 'https://api.jikan.moe/v4/anime', { q: 'Naruto', limit: '5' }),
  A('pokeapi', 'PokéAPI', '⚡', 'Knowledge', 'Free — no key', 'Pokémon data. Use case: demo/teaching API.', 'https://pokeapi.co', 'https://pokeapi.co/docs/v2', 'GET', 'https://pokeapi.co/api/v2/pokemon/{name}', { name: 'pikachu' }),
  A('coingecko', 'CoinGecko', '🪙', 'Finance', 'Free tier — rate limited', 'Crypto prices. Public endpoint is limited; CoinGecko may require a demo key later (verify).', 'https://www.coingecko.com', 'https://docs.coingecko.com', 'GET', 'https://api.coingecko.com/api/v3/simple/price?include_24hr_change=true&include_market_cap=true', { ids: 'bitcoin', vs_currencies: 'usd' }),
  A('frankfurter', 'Frankfurter', '💱', 'Finance', 'Free — no key', 'ECB exchange rates. Use case: currency converter.', 'https://frankfurter.dev', 'https://frankfurter.dev', 'GET', 'https://api.frankfurter.dev/v1/latest', { base: 'USD', symbols: 'INR,EUR,GBP' }),
  A('nasa', 'NASA APIs (APOD)', '🚀', 'Science', 'Free — key (DEMO_KEY is limited)', 'Astronomy Picture of the Day. Get a free key at api.nasa.gov; DEMO_KEY is used if none is set.', 'https://api.nasa.gov', 'https://api.nasa.gov', 'GET', 'https://api.nasa.gov/planetary/apod', { date: '' }, { kt: 'q', demo: 1 }),
  A('openalex', 'OpenAlex', '🔬', 'Science', 'Free — terms may change', 'Scholarly works. Use case: literature search. Check current usage terms (verify).', 'https://openalex.org', 'https://docs.openalex.org', 'GET', 'https://api.openalex.org/works', { search: 'machine learning', 'per-page': '5' }),
  A('crossref', 'Crossref', '🧾', 'Science', 'Free — no key', 'Publication metadata and DOIs.', 'https://www.crossref.org', 'https://www.crossref.org/documentation/retrieve-metadata/rest-api/', 'GET', 'https://api.crossref.org/works', { query: 'deep learning', rows: '5' }),
  A('hacker-news', 'Hacker News', '📰', 'News', 'Free — no key', 'Official Firebase API. Returns story IDs; fetch /item/{id}.json for details (use list=topstories).', 'https://news.ycombinator.com', 'https://github.com/HackerNews/API', 'GET', 'https://hacker-news.firebaseio.com/v0/{list}.json', { list: 'topstories' }),
  A('thesportsdb', 'TheSportsDB', '⚽', 'Sports', 'Demo only — test key "3"', 'Team search using the public test key. Full access needs a paid/Patreon key.', 'https://www.thesportsdb.com', 'https://www.thesportsdb.com/free_sports_api', 'GET', 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php', { t: 'Arsenal' }),
  A('pexels', 'Pexels', '🖼️', 'Images', 'Free — API key required', 'Photo search. Free key from a Pexels account; attribution required.', 'https://www.pexels.com/api/', 'https://www.pexels.com/api/documentation/', 'GET', 'https://api.pexels.com/v1/search', { query: 'mountains', per_page: '6' }, { kt: 'h' }),
  A('libretranslate', 'LibreTranslate', '🌐', 'Translation', 'API key or self-host required', 'The public instance needs a paid key. Self-host free and set LIBRETRANSLATE_URL (then edit the URL here).', 'https://libretranslate.com', 'https://docs.libretranslate.com', 'POST', 'https://libretranslate.com/translate', { q: 'Hello world', source: 'en', target: 'hi' }, { kt: 'b', b: ['q', 'source', 'target'] })
];
apiDefinitions.forEach(d => { d.q = Object.keys(d.p).filter(k => !d.url.includes(`{${k}}`) && !d.b.includes(k)); });

function buildRequest(d, v) {
  let u = d.url.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(v[k] ?? ''));
  const sp = new URLSearchParams();
  d.q.forEach(k => v[k] !== '' && v[k] != null && sp.set(k, v[k]));
  if (sp.toString()) u += (u.includes('?') ? '&' : '?') + sp;
  const body = d.b.length ? Object.fromEntries(d.b.map(k => [k, v[k]])) : undefined;
  return { method: d.m, url: u, headers: body ? { 'Content-Type': 'application/json' } : {}, body };
}
// Generic executor: every API call goes through the backend proxy (CORS-safe, injects secrets).
async function executeApiRequest(d, req) {
  try { return await post('/api/proxy', { apiId: d.id, ...req }); }
  catch { return { status: 0, error: 'network' }; }
}
function genJs(d, r) {
  const h = { ...r.headers }; let u = r.url, b = r.body;
  if (d.kt === 'h') h.Authorization = 'YOUR_API_KEY';
  if (d.kt === 'q') u += (u.includes('?') ? '&' : '?') + 'api_key=YOUR_API_KEY';
  if (d.kt === 'b' && b) b = { ...b, api_key: 'YOUR_API_KEY' };
  const o = [];
  if (r.method !== 'GET') o.push(`method: "${r.method}"`);
  if (Object.keys(h).length) o.push(`headers: ${JSON.stringify(h)}`);
  if (b) o.push(`body: JSON.stringify(${JSON.stringify(b)})`);
  return `const response = await fetch(\n  ${JSON.stringify(u)}${o.length ? `,\n  { ${o.join(', ')} }` : ''}\n);\n\nif (!response.ok) throw new Error("HTTP " + response.status);\nconst data = await response.json();\n\nconsole.log(data);`;
}
const hl = code => esc(code).replace(/(&quot;[^&]*?&quot;)|\b(const|await|async|import|new|from|throw|if)\b/g, (m, s, k) => s ? `<span class=s>${s}</span>` : `<span class=kw>${k}</span>`);

/* ---------- JSON viewer ---------- */
function jv(x, k, dep = 0) {
  const key = k != null ? `<span class=k>${esc(k)}</span>: ` : '';
  if (x && typeof x === 'object') {
    const a = Array.isArray(x), e = Object.entries(x);
    return `<details ${dep < 2 ? 'open' : ''}><summary>${key}${a ? '[' : '{'} <i>${e.length} ${a ? 'items' : 'keys'}</i></summary><div class=in>${e.map(([kk, v]) => jv(v, kk, dep + 1)).join('')}</div>${a ? ']' : '}'}</details>`;
  }
  return `<div>${key}<span class="${x === null ? 'z' : typeof x}">${esc(JSON.stringify(x))}</span></div>`;
}

/* ---------- Friendly errors ---------- */
const ERR = { 400: 'Bad request — check the parameter values.', 401: 'Unauthorized — the API key is missing or invalid. Add it in Settings.', 403: 'Forbidden — the provider denied access (key, terms or region restriction).', 404: 'Not found — check the path or ID.', 429: 'This service has rate-limited the request. Please wait and try again.', 500: 'The provider had an internal error. Try again later.', timeout: 'The request timed out after 15 seconds.', network: 'Network error — the service could not be reached (offline, DNS, or blocked).', missing_key: 'Missing API key — add it in Settings. Keys are stored on the backend only.', blocked: 'This host is not on the backend allowlist.', invalid_json: 'The response was not valid JSON — see the Raw tab.' };
const friendly = r => r.error && ERR[r.error] || (r.status >= 500 ? ERR[500] : ERR[r.status]) || (r.status >= 400 ? `The service returned HTTP ${r.status}.` : '');

/* ---------- Human-readable results ---------- */
const card = (t, s, img) => `<div class=c>${img ? `<img src="${esc(img)}" alt="" loading=lazy>` : ''}<b>${esc(t)}</b><small>${esc(s)}</small></div>`;
const kv = (l, v) => `<div class=c><small>${esc(l)}</small><span class=big>${esc(v)}</span></div>`;
const WMO = c => c === 0 ? 'Clear sky' : c < 4 ? 'Partly cloudy' : c < 50 ? 'Fog' : c < 70 ? 'Rain / drizzle' : c < 80 ? 'Snow' : c < 90 ? 'Showers' : 'Thunderstorm';
const firstArr = (d, n = 0) => Array.isArray(d) ? d : (d && typeof d === 'object' && n < 2 ? Object.values(d).map(v => firstArr(v, n + 1)).find(Boolean) : null);
function human(d, x) {
  if (x == null) return '';
  const id = d.id;
  if (id === 'open-meteo' && x.current) return kv('Temperature', `${x.current.temperature_2m} ${x.current_units?.temperature_2m || ''}`) + kv('Wind', `${x.current.wind_speed_10m} ${x.current_units?.wind_speed_10m || ''}`) + kv('Humidity', `${x.current.relative_humidity_2m}%`) + kv('Condition', WMO(x.current.weather_code));
  if (id === 'rest-countries' && x[0]) { const c = x[0]; return card(c.name.common, c.region, c.flags?.png) + kv('Capital', (c.capital || []).join(', ')) + kv('Population', c.population?.toLocaleString()) + kv('Currency', Object.values(c.currencies || {}).map(v => `${v.name} (${v.symbol || ''})`).join(', ')) + kv('Languages', Object.values(c.languages || {}).join(', ')); }
  if (id === 'github' && x.full_name) return card(x.full_name, x.description || '') + kv('Stars', x.stargazers_count?.toLocaleString()) + kv('Forks', x.forks_count?.toLocaleString()) + kv('Open issues', x.open_issues_count?.toLocaleString()) + `<div class=c><a class=l href="${esc(x.html_url)}" target=_blank rel=noopener>${esc(x.html_url)}</a></div>`;
  if (id === 'open-library' && x.docs) return x.docs.slice(0, 10).map(b => card(b.title, `${(b.author_name || ['Unknown'])[0]} · ${b.first_publish_year || 'n/a'}`, b.cover_i && `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`)).join('');
  if (id === 'coingecko') return Object.entries(x).map(([coin, v]) => Object.keys(v).filter(k => !k.includes('_')).map(cur => card(`${coin} / ${cur.toUpperCase()}`, `24h: ${(v[cur + '_24h_change'] ?? NaN).toFixed?.(2)}% · Market cap: ${(v[cur + '_market_cap'] ?? 0).toLocaleString()}`) + kv('Price', v[cur].toLocaleString())).join('')).join('');
  if (id === 'tmdb' && x.results) return x.results.slice(0, 10).map(m => card(m.title, `${m.release_date || 'n/a'} · ★ ${m.vote_average}`, m.poster_path && `https://image.tmdb.org/t/p/w342${m.poster_path}`)).join('');
  if (id === 'pokeapi' && x.name) return card(x.name, `Types: ${x.types.map(t => t.type.name).join(', ')}`, x.sprites?.front_default) + kv('Height', x.height) + kv('Weight', x.weight) + kv('Base XP', x.base_experience);
  if (id === 'frankfurter' && x.rates) return kv('Base', `${x.amount} ${x.base}`) + Object.entries(x.rates).map(([c, r]) => kv(c, r)).join('') + kv('Date', x.date);
  if (id === 'nasa' && x.title) return card(x.title, `${x.date} — ${(x.explanation || '').slice(0, 200)}…`, x.media_type === 'image' ? x.url : null);
  if (id === 'libretranslate' && x.translatedText) return kv('Translation', x.translatedText);
  if (id === 'hacker-news' && Array.isArray(x)) return x.slice(0, 12).map(n => `<div class=c><a class=l target=_blank rel=noopener href="https://news.ycombinator.com/item?id=${n}">Story #${n}</a></div>`).join('');
  const arr = firstArr(x);
  if (arr?.length) return arr.slice(0, 10).map(o => {
    if (typeof o !== 'object') return card(String(o), '');
    const t = o.title?.[0] || o.title || o.name || o.display_name || o.label || o.strTeam || o.names_with_flag || o.id;
    const t2 = typeof t === 'object' ? t?.title || JSON.stringify(t) : t;
    const img = o.images?.jpg?.image_url || o.src?.medium || o.strBadge || o.strTeamBadge;
    const s = o.description || o.excerpt || o.display_name || o.strDescriptionEN || o.synopsis || o.DOI || o.full_name || o.web_url || '';
    return card(t2 ?? 'Item', String(s).replace(/<[^>]+>/g, '').slice(0, 160), img);
  }).join('');
  return '';
}

/* ---------- App state & views ---------- */
const CATS = ['Weather', 'Maps', 'Knowledge', 'Developer', 'Books', 'Movies', 'Finance', 'Science', 'News', 'Sports', 'Images', 'Translation'];
const S = { view: 'dash', f: { q: '', cat: '', free: false, key: false, sort: 'name' }, api: null, mcpList: [], mcp: null, tool: null, res: null, resView: 'human', lastResp: null };
const NAV = [['dash', '🏠 Dashboard'], ['all', 'All APIs'], ['free', 'Free / no-key APIs'], ['key', 'API-key APIs'], '-', ...CATS.map(c => [c, c]), '-', ['mcp', '🔌 MCP Servers'], ['settings', '⚙️ Settings']];
function side() {
  $('#side').innerHTML = `<h1>API &amp; MCP Playground</h1>` + NAV.map(n => n === '-' ? '<hr>' : `<a data-a=go data-v="${n[0]}" class="${S.view === n[0] || (S.view === 'apis' && S.nav === n[0]) || (S.nav === n[0]) ? 'on' : ''}">${n[1]}</a>`).join('') + `<hr><a data-a=theme>🌗 Toggle theme</a>`;
}
async function render() {
  side();
  const m = $('#main');
  if (S.view === 'dash') return dash(m);
  if (S.view === 'apis') return apis(m);
  if (S.view === 'play') return play(m);
  if (S.view === 'mcp') return mcpView(m);
  if (S.view === 'mcpone') return mcpOne(m);
  if (S.view === 'settings') return settings(m);
}
async function dash(m) {
  m.innerHTML = '<p><span class=spin></span>Loading…</p>';
  const [st, h, servers] = await Promise.all([j('/api/stats'), j('/api/history'), j('/api/mcp/servers')]);
  S.mcpList = servers;
  const nokey = apiDefinitions.filter(d => d.auth === 'none').length;
  const c = (l, v) => `<div class="box stat"><b>${v}</b><span>${l}</span></div>`;
  m.innerHTML = `<h2>Dashboard</h2><p class=sub>Explore, test and learn 20 public APIs and 20 MCP servers.</p><div class=stats>${c('Total APIs', apiDefinitions.length)}${c('No-key APIs', nokey)}${c('Key / account APIs', apiDefinitions.length - nokey)}${c('MCP servers', servers.length)}${c('Connected MCP', st.connected)}${c('API requests', st.api)}${c('MCP tool calls', st.mcp)}${c('Errors', st.err)}</div>
  <div class=box><div class="row sp"><b>Recent activity</b><button class=btn data-a=clearhist>Clear history</button></div><div class=scroll><table><tr><th>Time<th>Type<th>Service<th>Operation<th>Status<th>Duration</tr>${h.slice(0, 25).map(e => `<tr><td>${new Date(e.time).toLocaleTimeString()}<td>${e.type}<td>${esc(e.service)}<td title="${esc(e.operation)}">${esc(e.operation)}<td class="${e.ok ? 'ok' : 'bad'}">${esc(e.status)}<td>${e.duration} ms</tr>`).join('') || '<tr><td colspan=6>No requests yet — try an API.</tr>'}</table></div></div>`;
}
function apis(m) {
  const f = S.f;
  let l = apiDefinitions.filter(d => (!f.q || (d.name + d.desc + d.cat).toLowerCase().includes(f.q.toLowerCase())) && (!f.cat || d.cat === f.cat) && (!f.free || /^(Free|Demo)/.test(d.badge)) && (!f.key || d.auth === 'key'));
  l.sort((a, b) => (a[f.sort] || '').localeCompare(b[f.sort] || ''));
  m.innerHTML = `<h2>${esc(S.title || 'All APIs')}</h2><p class=sub>${l.length} of 20 APIs</p>
  <div class=bar><input id=q placeholder="Search APIs…" value="${esc(f.q)}"><select id=cat><option value="">All categories${CATS.map(c => `<option ${f.cat === c ? 'selected' : ''}>${c}`).join('')}</select>
  <label class=chip><input type=checkbox id=free ${f.free ? 'checked' : ''}> Free only</label><label class=chip><input type=checkbox id=key ${f.key ? 'checked' : ''}> Key required</label>
  <select id=sort><option value=name>Sort: name<option value=cat ${f.sort === 'cat' ? 'selected' : ''}>Sort: category</select></div>
  <div class=grid>${l.map(d => `<div class=card><div class="row sp"><span class=ico>${d.icon}</span><span class=chip>${d.cat}</span></div><b>${esc(d.name)}</b><div class=row><span class="chip ${/^Demo/.test(d.badge) ? 'demo' : /^Free/.test(d.badge) ? 'free' : 'key'}">${esc(d.badge)}</span><span class="chip ${d.auth === 'key' ? 'key' : 'free'}">${d.auth === 'key' ? 'Key required' : 'No key'}</span></div><p>${esc(d.desc)}</p><div class=row><button class="btn pri" data-a=try data-v="${d.id}">Try API</button><a class=btn href="${d.doc}" target=_blank rel=noopener>Documentation</a></div></div>`).join('') || '<p>No APIs match these filters.</p>'}</div>`;
}
function play(m) {
  const d = S.api, r = buildRequest(d, d.p);
  m.innerHTML = `<p><a class=l data-a=go data-v=all style="cursor:pointer">← All APIs</a></p><div class="row sp"><h2>${d.icon} ${esc(d.name)}</h2><div class=row><span class="chip free">${esc(d.badge)}</span><span class="chip ${d.auth === 'key' ? 'key' : 'free'}">${d.auth === 'key' ? (d.demo ? 'Key optional (DEMO_KEY fallback)' : 'API key via Settings') : 'No authentication'}</span></div></div><p class=sub>${esc(d.desc)}</p>
  <div class=row><a class=btn href="${d.doc}" target=_blank rel=noopener>Open documentation</a><a class=btn href="${d.site}" target=_blank rel=noopener>Official website</a></div>
  <div class="tabs mt"><a class=on data-a=ptab data-v=pg>Playground</a><a data-a=ptab data-v=js>JavaScript</a></div>
  <div id=pg><div class=box><b>REQUEST</b><div class="url mt"><select id=meth><option ${d.m === 'GET' ? 'selected' : ''}>GET<option ${d.m === 'POST' ? 'selected' : ''}>POST</select><input id=url value="${esc(r.url)}"><button class="btn pri" id=run data-a=run>RUN REQUEST</button></div>
  <div class=fields>${Object.entries(d.p).map(([k, v]) => `<label class=fld>${k}<input data-p="${k}" value="${esc(v)}"></label>`).join('')}</div>
  <div class=fields style="grid-template-columns:1fr 1fr"><label class=fld>Headers (JSON)<textarea id=hdr>${esc(JSON.stringify(r.headers))}</textarea></label><label class=fld>Body (JSON)<textarea id=bdy>${r.body ? esc(JSON.stringify(r.body, null, 2)) : ''}</textarea></label></div></div>
  <div class="box mt"><b>RESPONSE</b><div id=resp><p class=sub>Press RUN REQUEST to call the live API. Nothing here is mocked.</p></div></div></div>
  <div id=js class=hide><div class=box><div class="row sp"><b>JavaScript</b><button class="btn pri" data-a=copyjs>COPY CODE</button></div><pre id=code class=mt></pre></div></div>`;
  S.lastResp = null; syncCode();
}
const vals = () => Object.fromEntries([...document.querySelectorAll('[data-p]')].map(i => [i.dataset.p, i.value]));
const curReq = () => ({ method: $('#meth').value, url: $('#url').value, headers: parse($('#hdr').value) || {}, body: parse($('#bdy').value) });
function syncCode() { try { $('#code').innerHTML = hl(genJs(S.api, curReq())); } catch { $('#code').textContent = 'Headers/body must be valid JSON.'; } }
async function run() {
  let req; try { req = curReq(); } catch { return toast('Headers or body are not valid JSON'); }
  const b = $('#run'); b.disabled = true; $('#resp').innerHTML = '<p><span class=spin></span>Running…</p>';
  const r = await executeApiRequest(S.api, req); b.disabled = false; showRes(r);
}
function showRes(r) {
  S.lastResp = r; const ok = r.status >= 200 && r.status < 300, f = friendly(r);
  const hum = !r.error && r.data != null ? human(S.api, r.data) : '';
  $('#resp').innerHTML = `<div class="row mt"><span class="status ${ok && !r.error ? 'ok' : 'bad'}">Status: ${r.status || 'ERR'} ${esc(r.statusText || '')}</span><span class=chip>Response time: ${r.ms ?? 0} ms</span></div>${f ? `<div class=err>${esc(f)}</div>` : ''}
  ${r.data != null || r.raw ? `<div class="tabs mt"><a class="${hum ? 'on' : ''}" data-a=rtab data-v=human>Human-readable</a><a class="${hum ? '' : 'on'}" data-a=rtab data-v=json>JSON viewer</a><a data-a=rtab data-v=raw>Raw JSON</a></div>
  <div id=rh class="res ${hum ? '' : 'hide'}">${hum}</div><div id=rj class="${hum ? 'hide' : ''}"><div class=row style="margin-bottom:8px"><button class=btn data-a=expand data-v=1>Expand all</button><button class=btn data-a=expand data-v=0>Collapse all</button></div><div class=jv>${r.data != null ? jv(r.data) : '<pre>Not JSON</pre>'}</div></div><div id=rr class=hide><pre>${esc(r.data != null ? JSON.stringify(r.data, null, 2) : r.raw)}</pre></div>
  <div class="row mt"><button class=btn data-a=copyres>Copy response</button><button class=btn data-a=dlres>Download JSON</button></div>` : ''}`;
}

/* ---------- MCP ---------- */
const mcpCode = (id, tool, args) => `import { Client } from "@modelcontextprotocol/sdk/client/index.js";\nimport { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";\n\nconst client = new Client({ name: "demo", version: "1.0.0" });\nawait client.connect(new StdioClientTransport(/* command + args from config */));\n\nconst { tools } = await client.listTools();\nconst result = await client.callTool({\n  name: ${JSON.stringify(tool || 'tool_name')},\n  arguments: ${JSON.stringify(args || {}, null, 2).replace(/\n/g, '\n  ')}\n});\nconsole.log(result);\nawait client.close();`;
async function mcpView(m) {
  m.innerHTML = '<p><span class=spin></span>Loading…</p>'; S.mcpList = await j('/api/mcp/servers');
  m.innerHTML = `<h2>MCP Servers</h2><p class=sub>Servers run in the Node backend via the official MCP SDK — never in your browser. Only servers in config/mcp-config.json can start.</p><div class=grid>${S.mcpList.map(s => `<div class=card><div class="row sp"><b>${esc(s.name)}</b><span class=chip>${esc(s.category)}</span></div><div class=row><span class=chip>${s.location}</span><span class=chip>${esc(s.transport)}</span><span class="chip ${s.auth === 'None' ? 'free' : 'key'}">Auth: ${esc(s.auth)}</span>${s.verify ? '<span class="chip demo">Verify package</span>' : ''}</div><p>${esc(s.description)}<br><small>${esc(s.license)}${s.note ? ' · ' + esc(s.note) : ''}</small></p><small><span class="dot ${s.connected ? 'on' : ''}"></span>${s.connected ? `Connected · tools: ${esc(s.tools.join(', '))}` : 'Not connected — connect to discover tools and resources'}</small><div class=row><button class="btn pri" data-a=mopen data-v="${s.id}" data-c=1>Connect</button><button class=btn data-a=mopen data-v="${s.id}">List / Run tool</button><button class=btn data-a=mopen data-v="${s.id}">Configuration</button><button class=btn data-a=mcopy data-v="${s.id}">Copy example</button></div></div>`).join('')}</div>`;
}
function mcpOne(m) {
  const s = S.mcp, t = S.tool;
  m.innerHTML = `<p><a class=l data-a=go data-v=mcp style="cursor:pointer">← MCP Servers</a></p><h2>${esc(s.name)}</h2><p class=sub>${esc(s.description)}</p>
  <div class=box><b>MCP SERVER</b><div class=fields><div class=fld>Connection type<b style="color:var(--tx)">${esc(s.transport)}</b></div><div class=fld>${s.url ? 'URL' : 'Command'}<code>${esc(s.url || s.command)}</code></div><div class="fld" style="grid-column:1/-1">Arguments<code>${esc((s.args || []).join(' ') || '—')}</code></div><div class="fld" style="grid-column:1/-1">Environment variables (values never shown)<code>${s.envVars.map(e => `${esc(e.name)} ${e.set ? '✓ set' : '✗ not set'}`).join(' · ') || 'none'}</code></div></div>
  ${s.verify ? '<div class=err>This package/endpoint is archived, community-maintained, or may have changed. Verify it before relying on it.</div>' : ''}
  <div class=row><button class="btn pri" id=cbtn data-a=${s.connected ? 'mdisc' : 'mconn'}>${s.connected ? 'DISCONNECT' : 'CONNECT'}</button><span><span class="dot ${s.connected ? 'on' : ''}"></span>${s.connected ? 'Connected' : 'Disconnected'}${S.info ? ` · ${esc(S.info.name)} ${esc(S.info.version || '')}` : ''}</span></div><div id=merr></div></div>
  <div class="box mt ${s.connected ? '' : 'hide'}"><b>Available tools</b> <small>(${(S.tools || []).length}${S.resources?.length ? `, ${S.resources.length} resources` : ''})</small><div class=row style="margin:10px 0">${(S.tools || []).map(x => `<button class="btn tool ${t?.name === x.name ? 'on' : ''}" data-a=mtool data-v="${esc(x.name)}">${esc(x.name)}</button>`).join('')}</div>
  ${t ? `<p class=sub>${esc(t.description)}</p><div class=fields>${schemaForm(t.inputSchema)}</div><button class="btn pri" id=mrun data-a=mrun>RUN TOOL</button>` : '<p class=sub>Select a tool — its form is generated from the schema the server reports.</p>'}</div>
  <div class="box mt ${t ? '' : 'hide'}"><div class="row sp"><b>Node.js client code</b><button class=btn data-a=mcopycode>Copy</button></div><pre id=mcode class=mt>${hl(mcpCode(s.id, t?.name, mArgsSafe()))}</pre></div>
  <div class=box id=mres style="margin-top:16px;display:${S.res ? 'block' : 'none'}">${S.res || ''}</div>`;
}
function schemaForm(sc) {
  const req = sc.required || [], p = sc.properties || {};
  if (!Object.keys(p).length) return '<small>This tool takes no input.</small>';
  return Object.entries(p).map(([k, v]) => {
    const l = `${esc(v.title || k)}${req.includes(k) ? ' *' : ''}`, tip = esc(v.description || '');
    let t = [].concat(v.type || 'string')[0];
    if (v.enum) return `<label class=fld title="${tip}">${l}<select data-m="${esc(k)}" data-t=string><option value="">—${v.enum.map(e => `<option>${esc(e)}`).join('')}</select></label>`;
    if (t === 'boolean') return `<label class=fld title="${tip}">${l}<input type=checkbox data-m="${esc(k)}" data-t=boolean></label>`;
    if (t === 'integer' || t === 'number') return `<label class=fld title="${tip}">${l}<input type=number step=any data-m="${esc(k)}" data-t=number></label>`;
    if (t === 'array' || t === 'object') return `<label class=fld style="grid-column:1/-1" title="${tip}">${l} (JSON)<textarea data-m="${esc(k)}" data-t=json>${t === 'array' ? '[]' : '{}'}</textarea></label>`;
    return `<label class=fld title="${tip}">${l}<input data-m="${esc(k)}" data-t=string placeholder="${tip.slice(0, 60)}"></label>`;
  }).join('');
}
function mArgs() {
  const a = {};
  for (const i of document.querySelectorAll('[data-m]')) {
    const t = i.dataset.t, k = i.dataset.m;
    if (t === 'boolean') a[k] = i.checked;
    else if (i.value === '') continue;
    else if (t === 'number') a[k] = Number(i.value);
    else if (t === 'json') a[k] = JSON.parse(i.value);
    else a[k] = i.value;
  }
  return a;
}
const mArgsSafe = () => { try { return document.querySelector('[data-m]') ? mArgs() : {}; } catch { return {}; } };
async function mconnect(id) {
  const b = $('#cbtn'); if (b) { b.disabled = true; b.innerHTML = '<span class=spin></span>Connecting…'; }
  const r = await post(`/api/mcp/${id}/connect`);
  S.mcp = (await j('/api/mcp/servers')).find(x => x.id === id);
  if (r.ok) { S.info = r.info; S.tools = r.tools; S.resources = r.resources; toast('Connected'); } else { S.info = null; S.tools = []; }
  render(); if (!r.ok) $('#merr').innerHTML = `<div class=err>MCP connection failed: ${esc(r.error)}. Check that the command is installed and required env vars are set.</div>`;
}
function mresult(r) {
  const c = r.result?.content || [], bad = !r.ok || r.result?.isError;
  const txt = c.map(x => x.type === 'text' ? `<pre>${esc(x.text)}</pre>` : x.type === 'image' ? `<img style="max-width:100%" src="data:${x.mimeType};base64,${x.data}">` : `<pre>${esc(JSON.stringify(x))}</pre>`).join('');
  S.resRaw = r.result ?? r;
  return `<b>TOOL RESULT</b><div class="row mt"><span class="status ${bad ? 'bad' : 'ok'}">${bad ? 'Failed' : 'Success'}</span><span class=chip>Execution time: ${r.ms ?? 0} ms</span></div>${r.ok ? '' : `<div class=err>MCP tool call failed: ${esc(r.error)}</div>`}${r.result?.isError ? '<div class=err>The tool reported an error — see output below.</div>' : ''}<p class=sub>Human-readable</p>${txt}<p class=sub>JSON</p><div class=jv>${jv(S.resRaw)}</div>`;
}

async function settings(m) {
  const list = await j('/api/settings');
  m.innerHTML = `<h2>Settings</h2><p class=sub>Secrets are sent once to the backend and kept in its process environment. They are never returned to the browser and never stored in localStorage. To persist them, put them in <code>.env</code>.</p><div class=grid>${list.map(s => `<div class=card><b>${esc(s.name)}</b><span class="chip ${s.set ? 'free' : 'key'}">${s.set ? 'Configured' : 'Not set'}</span><input type=password autocomplete=off placeholder="${s.set ? '••••••••••••••••' : 'Enter value'}" id="k_${esc(s.name)}"><div class=row><button class="btn pri" data-a=savekey data-v="${esc(s.name)}">Save</button>${s.set ? `<button class=btn data-a=clearkey data-v="${esc(s.name)}">Remove</button>` : ''}</div></div>`).join('')}</div>`;
}

/* ---------- Events ---------- */
const act = {
  nav: () => document.body.classList.toggle('nav'),
  theme: () => { const h = document.documentElement; h.dataset.theme = h.dataset.theme === 'dark' ? 'light' : 'dark'; },
  go(v) {
    document.body.classList.remove('nav'); S.nav = v; S.title = null; S.res = null; S.tool = null;
    S.f = { q: '', cat: '', free: false, key: false, sort: 'name' };
    if (v === 'dash' || v === 'mcp' || v === 'settings') S.view = v;
    else { S.view = 'apis'; S.title = { all: 'All APIs', free: 'Free / no-key APIs', key: 'API-key APIs' }[v] || v; if (v === 'free') S.f.free = true; else if (v === 'key') S.f.key = true; else if (v !== 'all') S.f.cat = v; }
    render();
  },
  try(id) { S.api = apiDefinitions.find(d => d.id === id); S.view = 'play'; render(); window.scrollTo(0, 0); },
  run, ptab(v, el) { document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a === el)); $('#pg').classList.toggle('hide', v !== 'pg'); $('#js').classList.toggle('hide', v !== 'js'); },
  rtab(v, el) { el.parentNode.querySelectorAll('a').forEach(a => a.classList.toggle('on', a === el)); ['human:rh', 'json:rj', 'raw:rr'].forEach(p => { const [n, i] = p.split(':'); $('#' + i).classList.toggle('hide', n !== v); }); },
  expand(v) { document.querySelectorAll('.jv details').forEach(d => d.open = v === '1'); },
  copyjs: () => copy($('#code').textContent),
  copyres: () => copy(JSON.stringify(S.lastResp.data ?? S.lastResp.raw, null, 2)),
  dlres: () => download(`${S.api.id}-response.json`, JSON.stringify(S.lastResp.data ?? { raw: S.lastResp.raw }, null, 2)),
  async clearhist() { await j('/api/history', { method: 'DELETE' }); toast('History cleared'); render(); },
  async mopen(id, el) { S.mcp = (await j('/api/mcp/servers')).find(x => x.id === id); S.view = 'mcpone'; S.res = null; S.tool = null; S.tools = []; S.info = null; S.resources = []; if (S.mcp.connected) { const r = await post(`/api/mcp/${id}/tools`); S.tools = r.tools || []; } render(); if (el.dataset.c && !S.mcp.connected) mconnect(id); },
  mconn: () => mconnect(S.mcp.id),
  async mdisc() { await post(`/api/mcp/${S.mcp.id}/disconnect`); S.mcp.connected = false; S.tools = []; S.tool = null; S.info = null; render(); },
  mtool(n) { S.tool = S.tools.find(t => t.name === n); S.res = null; render(); },
  async mrun() {
    let args; try { args = mArgs(); } catch { return toast('A JSON field is invalid'); }
    const b = $('#mrun'); b.disabled = true; b.innerHTML = '<span class=spin></span>Running…';
    const r = await post(`/api/mcp/${S.mcp.id}/call`, { name: S.tool.name, arguments: args });
    S.res = mresult(r); const keep = args; render();
    document.querySelectorAll('[data-m]').forEach(i => { const v = keep[i.dataset.m]; if (v !== undefined) i.type === 'checkbox' ? i.checked = v : i.value = typeof v === 'object' ? JSON.stringify(v) : v; });
  },
  mcopycode: () => copy($('#mcode').textContent),
  async mcopy(id) { const s = (await j('/api/mcp/servers')).find(x => x.id === id); copy(mcpCode(id, s.tools[0], {}) + `\n\n// config: ${s.command || s.url} ${(s.args || []).join(' ')}`); },
  async savekey(n) { const i = $('#k_' + n); if (!i.value) return toast('Enter a value first'); await post('/api/settings', { name: n, value: i.value }); i.value = ''; toast('Saved on backend'); render(); },
  async clearkey(n) { await post('/api/settings', { name: n, value: '' }); toast('Removed'); render(); }
};
document.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && act[b.dataset.a]) { e.preventDefault(); act[b.dataset.a](b.dataset.v, b); } });
document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('[data-p]')) { const d = S.api, r = buildRequest(d, vals()); $('#url').value = r.url; if (r.body) $('#bdy').value = JSON.stringify(r.body, null, 2); syncCode(); }
  else if (['url', 'hdr', 'bdy', 'meth'].includes(t.id)) syncCode();
  else if (S.view === 'apis' && ['q', 'cat', 'free', 'key', 'sort'].includes(t.id)) { S.f[t.id] = t.type === 'checkbox' ? t.checked : t.value; const p = t.selectionStart; apis($('#main')); const n = $('#' + t.id); n.focus(); if (p != null && n.setSelectionRange && t.type === 'text' || t.id === 'q') n.setSelectionRange(p, p); }
  else if (t.dataset.m && S.tool) $('#mcode').innerHTML = hl(mcpCode(S.mcp.id, S.tool.name, mArgsSafe()));
});
render();
