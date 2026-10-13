// Status relay for the "My Computer" window on barathanaslan.com.
//
//   POST /v1/report   the Mac mini posts a summary of `tailmon json`
//                     (bearer token; see ../reporter/report.py)
//   GET  /v1/status   the website reads the last summary
//
// Visitors only ever read a cached summary: nothing they do reaches the
// machines. Reports are re-sanitised here against a fixed allow-list, so even
// a leaked token could only publish a few numbers for three known hosts.

const HOSTS = ['barathans-mini', 'barathans-5090', 'barathans-macbook'];
const STATUSES = ['live', 'offline', 'no-agent'];
const HARDWARE = ['os', 'cpu_cores', 'mem_total_gb', 'gpu_name', 'vram_total_gb'];
const OSES = { macos: 'macOS', darwin: 'macOS', windows: 'Windows', linux: 'Linux' };
const MAX_BODY_BYTES = 8 * 1024;
const CACHE_SECONDS = 30;

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
};

function json(body, status = 200, extra = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: Object.assign({
            'Content-Type': 'application/json; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
        }, CORS, extra),
    });
}

function number(value, max) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.round(Math.min(Math.max(n, 0), max));
}

function clean(raw, previous, now) {
    if (!raw || !HOSTS.includes(raw.id)) return null;
    const status = STATUSES.includes(raw.status) ? raw.status : 'offline';
    const gpuName = typeof raw.gpu_name === 'string' && /^[\w .()+-]{1,48}$/.test(raw.gpu_name) ? raw.gpu_name : null;
    const live = status === 'live';
    return {
        id: raw.id,
        status,
        os: Object.hasOwn(OSES, String(raw.os || '').toLowerCase()) ? OSES[String(raw.os).toLowerCase()] : null,
        cpu_pct: live ? number(raw.cpu_pct, 100) : null,
        cpu_cores: number(raw.cpu_cores, 512),
        mem_pct: live ? number(raw.mem_pct, 100) : null,
        mem_total_gb: number(raw.mem_total_gb, 4096),
        gpu_name: gpuName,
        gpu_pct: live ? number(raw.gpu_pct, 100) : null,
        vram_total_gb: number(raw.vram_total_gb, 1024),
        uptime_h: live ? number(raw.uptime_h, 1000000) : null,
        last_live: status === 'offline' ? (previous && previous.last_live) || null : now,
    };
}

async function authorised(request, env) {
    const header = request.headers.get('Authorization') || '';
    if (!env.REPORT_TOKEN || !header.startsWith('Bearer ')) return false;
    const enc = new TextEncoder();
    const given = enc.encode(header.slice(7));
    const expected = enc.encode(env.REPORT_TOKEN);
    if (given.byteLength !== expected.byteLength) return false;
    return crypto.subtle.timingSafeEqual(given, expected);
}

async function report(request, env) {
    if (!(await authorised(request, env))) return json({ error: 'unauthorised' }, 401);
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > MAX_BODY_BYTES) return json({ error: 'too large' }, 413);
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json({ error: 'too large' }, 413);

    let body;
    try {
        body = JSON.parse(text);
    } catch (e) {
        return json({ error: 'bad json' }, 400);
    }
    if (!body || !Array.isArray(body.hosts)) return json({ error: 'bad shape' }, 400);

    const now = new Date().toISOString();
    const previous = (await env.STATUS.get('status', { type: 'json' })) || { hosts: [] };
    const prevById = Object.fromEntries((previous.hosts || []).map(h => [h.id, h]));
    const hosts = [];
    for (const raw of body.hosts.slice(0, HOSTS.length)) {
        const host = clean(raw, prevById[raw && raw.id], now);
        if (host && !hosts.some(h => h.id === host.id)) hosts.push(host);
    }
    // Asleep machines report no hardware; keep what we last knew. A host
    // missing from the report (Tailscale down on the mini) becomes "unknown"
    // but keeps its history.
    for (const host of hosts) {
        const prev = prevById[host.id];
        if (prev) HARDWARE.forEach(key => { if (host[key] === null) host[key] = prev[key] ?? null; });
    }
    for (const id of HOSTS) {
        if (!hosts.some(h => h.id === id) && prevById[id]) {
            hosts.push(Object.assign({}, prevById[id], {
                status: 'unknown', cpu_pct: null, mem_pct: null, gpu_pct: null, uptime_h: null,
            }));
        }
    }
    await env.STATUS.put('status', JSON.stringify({ reported_at: now, hosts }));
    return json({ ok: true, hosts: hosts.length });
}

async function status(request, env, ctx) {
    const cache = caches.default;
    const key = new Request(new URL('/v1/status', request.url).toString());
    const hit = await cache.match(key);
    if (hit) return hit;

    const stored = (await env.STATUS.get('status', { type: 'json' })) || { reported_at: null, hosts: [] };
    const response = json({
        schema: 1,
        now: new Date().toISOString(),
        reported_at: stored.reported_at,
        hosts: stored.hosts,
    }, 200, { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` });
    ctx.waitUntil(cache.put(key, response.clone()));
    return response;
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
        if (url.pathname === '/v1/status' && (request.method === 'GET' || request.method === 'HEAD')) {
            return status(request, env, ctx);
        }
        if (url.pathname === '/v1/report' && request.method === 'POST') return report(request, env);
        return json({ error: 'not found' }, 404);
    },
};
