// netlify/functions/isc-proxy.js
// ─────────────────────────────────────────────────────────────────────────────
// RSM Non-Employee Hub — SailPoint ISC Server-Side Proxy
//
// Proxies all ISC API calls server-side to bypass browser CORS restrictions.
// Core logic ported directly from the working MIH sailpoint-proxy.js.
//
// Supported actions (POST body):
//   ping             → availability check
//   token            → OAuth2 client_credentials exchange, returns token to client
//   api              → forward a signed REST call using a cached bearer token
//   validate         → full 7-step connectivity + data retrieval
// ─────────────────────────────────────────────────────────────────────────────

const https = require('https')
const http  = require('http')

// ── CORS headers ──────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type':                 'application/json',
}

// ── Low-level HTTP helper (uses Node.js https/http — more reliable than fetch
//    for reading raw response headers like X-Total-Count) ─────────────────────
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url)
    const lib     = parsed.protocol === 'https:' ? https : http
    const timeout = options.timeout || 12000

    const reqOptions = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   options.method || 'GET',
      headers:  options.headers || {},
      timeout,
    }

    const req = lib.request(reqOptions, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end',  () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
    })

    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
    req.on('error',   (err) => reject(err))

    if (options.body) req.write(options.body)
    req.end()
  })
}

// ── Derive API base URL from tenant URL ───────────────────────────────────────
// https://acme.identitynow.com      → https://acme.api.identitynow.com
// https://acme.identitynow-demo.com → https://acme.api.identitynow-demo.com
// *.rsm.security                    → same origin (vanity/reverse-proxy)
function getApiBase(tenantUrl) {
  try {
    const u    = new URL(tenantUrl)
    const host = u.hostname
    const org  = host.split('.')[0]
    if (host.endsWith('.identitynow.com'))
      return `https://${org}.api.identitynow.com`
    if (host.endsWith('.identitynow-demo.com'))
      return `https://${org}.api.identitynow-demo.com`
    return `https://${host}`   // vanity URL — API on same origin
  } catch {
    throw new Error(`Invalid tenant URL: ${tenantUrl}`)
  }
}

// ── OAuth2 token acquisition ──────────────────────────────────────────────────
async function getToken(tenantUrl, clientId, clientSecret) {
  const apiBase    = getApiBase(tenantUrl)
  const bodyParams = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`

  const res = await httpRequest(`${apiBase}/oauth/token`, {
    method:  'POST',
    headers: {
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(bodyParams).toString(),
    },
    body: bodyParams,
  })

  if (res.status !== 200) {
    let detail = ''
    try { detail = JSON.parse(res.body)?.error_description || '' } catch {}
    throw new Error(`Token request failed (HTTP ${res.status})${detail ? ': ' + detail : ''}`)
  }

  const token = JSON.parse(res.body)
  return { accessToken: token.access_token, expiresIn: token.expires_in, tokenType: token.token_type }
}

// ── Org info ── /v3/org-config with beta fallback ─────────────────────────────
async function getOrgInfo(tenantUrl, accessToken) {
  const apiBase = getApiBase(tenantUrl)

  // Primary: v3 org-config (stable, no experimental header needed)
  const res = await httpRequest(`${apiBase}/v3/org-config`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })

  if (res.status === 200) {
    const data = JSON.parse(res.body)
    return {
      orgName: data.orgName || data.name,
      pod:     data.pod,
      region:  data.region,
    }
  }

  // Fallback: beta tenant-config
  const res2 = await httpRequest(`${apiBase}/beta/tenant-config/product`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (res2.status === 200) {
    const data = JSON.parse(res2.body)
    return { orgName: data.name || data.displayName, pod: data.pod }
  }

  return { orgName: null, pod: null }
}

// ── Identity count ── /v2025/identities with X-SailPoint-Experimental header ─
// Reads X-Total-Count response header (Node.js normalises headers to lowercase).
// Falls back to POST /v3/search/count if the v2025 endpoint is restricted.
async function getIdentityCount(tenantUrl, accessToken) {
  const apiBase = getApiBase(tenantUrl)

  // Primary: v2025 identities list with count=true
  const res = await httpRequest(`${apiBase}/v2025/identities?limit=1&count=true`, {
    headers: {
      Authorization:              `Bearer ${accessToken}`,
      Accept:                     'application/json',
      'X-SailPoint-Experimental': 'true',
    },
  })

  if (res.status === 200) {
    // Node.js http module lowercases all header names
    const count = parseInt(res.headers['x-total-count'] || '0', 10)
    return { count, source: 'v2025-identities' }
  }

  // Fallback: v3 search/count (no experimental header, no scope restriction)
  const countBody = JSON.stringify({ indices: ['identities'], query: { query: '*' } })
  const res2 = await httpRequest(`${apiBase}/v3/search/count`, {
    method:  'POST',
    headers: {
      Authorization:    `Bearer ${accessToken}`,
      Accept:           'application/json',
      'Content-Type':  'application/json',
      'Content-Length': Buffer.byteLength(countBody).toString(),
    },
    body: countBody,
  })

  if (res2.status === 204 || res2.status === 200) {
    const count = parseInt(res2.headers['x-total-count'] || '0', 10)
    return { count, source: 'search-count' }
  }

  throw new Error(`Identity count failed — v2025 HTTP ${res.status}, search/count HTTP ${res2.status}`)
}

// ── VA clusters ── multi-strategy approach ────────────────────────────────────
//
// Strategy 1: GET /v2026/managed-clusters → /v3/managed-clusters
//   v3 shape:  clientStatus.status === 'NORMAL' means healthy
//   v2026 shape: health.healthy (bool) or health.status, or clientStatus.status
//
// Strategy 2: GET /v2026/managed-clients (individual VA nodes, grouped by cluster)
//   clientStatus.status === 'NORMAL' = healthy node; anything else = unhealthy
async function getVaClusters(tenantUrl, accessToken) {
  const apiBase = getApiBase(tenantUrl)
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }

  // Helper: extract a normalised status string from any cluster object shape
  function clusterStatus(c) {
    // v3 / v2025 shape: clientStatus.status — 'NORMAL' is healthy
    if (c.clientStatus?.status) {
      const s = c.clientStatus.status.toUpperCase()
      return s === 'NORMAL' ? 'CONNECTED' : s
    }
    // v2026 shape: health object
    if (c.health !== undefined) {
      if (typeof c.health.healthy === 'boolean')
        return c.health.healthy ? 'CONNECTED' : (c.health.status || 'UNHEALTHY')
      if (c.health.status) {
        const s = c.health.status.toUpperCase()
        return ['HEALTHY', 'OK', 'SUCCEEDED', 'NORMAL'].includes(s) ? 'CONNECTED' : s
      }
    }
    // Top-level status string
    if (c.status) {
      const s = c.status.toUpperCase()
      return ['HEALTHY', 'NORMAL', 'ACTIVE', 'CONNECTED', 'OK'].includes(s) ? 'CONNECTED' : s
    }
    return 'CONNECTED'  // unknown — assume healthy
  }

  // Helper: cluster type name (string in v3, object reference in v2026)
  function clusterTypeName(c) {
    if (!c.type) return ''
    if (typeof c.type === 'string') return c.type.toUpperCase()
    if (typeof c.type === 'object') return (c.type.name || c.type.clusterType || '').toUpperCase()
    return ''
  }

  // Helper: is this a VA cluster? Include if type is VA or unset (exclude CCG/SAAS/PROXY)
  function isVaCluster(c) {
    const t = clusterTypeName(c)
    if (!t) return true
    if (t === 'VA') return true
    return !['CCG', 'SAAS', 'PROXY'].includes(t)
  }

  // Strategy 1 — managed-clusters list (try v2026 first, then v3)
  for (const version of ['v2026', 'v3']) {
    let res
    try {
      res = await httpRequest(`${apiBase}/${version}/managed-clusters`, { headers, timeout: 12000 })
    } catch (err) {
      console.warn(`[getVaClusters] ${version}/managed-clusters request error: ${err.message}`)
      continue
    }

    console.log(`[getVaClusters] ${version}/managed-clusters → HTTP ${res.status}`)
    if (res.status !== 200) {
      console.warn(`[getVaClusters] ${version} error body: ${res.body.slice(0, 300)}`)
      continue
    }

    let allClusters
    try { allClusters = JSON.parse(res.body) } catch { continue }
    if (!Array.isArray(allClusters)) { continue }

    console.log(`[getVaClusters] ${version} returned ${allClusters.length} cluster(s)`)
    if (allClusters.length > 0)
      console.log('[getVaClusters] First cluster:', JSON.stringify(allClusters[0]).slice(0, 600))

    const vaClusters = allClusters.filter(isVaCluster)

    if (vaClusters.length > 0 || allClusters.length === 0) {
      const enriched  = vaClusters.map(c => ({
        id:     c.id,
        name:   c.name || c.id,
        type:   clusterTypeName(c) || 'VA',
        status: clusterStatus(c),
      }))
      const unhealthy = enriched.filter(c => c.status !== 'CONNECTED').length
      return { vaCount: enriched.length, unhealthyCount: unhealthy, clusters: enriched }
    }

    console.warn('[getVaClusters] Type filter excluded all clusters — falling back to managed-clients')
    break
  }

  // Strategy 2 — managed-clients (individual VA nodes, grouped by clusterId)
  console.log('[getVaClusters] Trying strategy 2: managed-clients')
  try {
    const res = await httpRequest(`${apiBase}/v2026/managed-clients`, { headers, timeout: 12000 })
    console.log(`[getVaClusters] managed-clients → HTTP ${res.status}`)

    if (res.status === 200) {
      const clients = JSON.parse(res.body)
      if (!Array.isArray(clients))
        return { vaCount: 0, unhealthyCount: 0, clusters: [], note: 'managed-clients not an array' }

      console.log(`[getVaClusters] ${clients.length} client(s) returned`)
      if (clients.length > 0)
        console.log('[getVaClusters] First client:', JSON.stringify(clients[0]).slice(0, 500))

      const clusterMap = new Map()
      for (const client of clients) {
        const cid   = client.clusterId || client.cluster?.id || 'unknown'
        const cname = client.clusterName || client.cluster?.name || cid
        const isHealthy = (client.clientStatus?.status || '').toUpperCase() === 'NORMAL'

        if (!clusterMap.has(cid))
          clusterMap.set(cid, { id: cid, name: cname, totalClients: 0, unhealthyClients: 0 })

        const entry = clusterMap.get(cid)
        entry.totalClients++
        if (!isHealthy) entry.unhealthyClients++
      }

      const clusters = Array.from(clusterMap.values()).map(c => ({
        id:     c.id,
        name:   c.name,
        type:   'VA',
        status: c.unhealthyClients === 0 ? 'CONNECTED' : `${c.unhealthyClients}/${c.totalClients} unhealthy`,
      }))
      const unhealthy = clusters.filter(c => c.status !== 'CONNECTED').length
      return { vaCount: clusters.length, unhealthyCount: unhealthy, clusters }
    }

    console.warn(`[getVaClusters] managed-clients HTTP ${res.status}: ${res.body.slice(0, 300)}`)
  } catch (err) {
    console.warn(`[getVaClusters] managed-clients error: ${err.message}`)
  }

  return { vaCount: 0, unhealthyCount: 0, clusters: [], note: 'Both strategies failed — check Netlify function logs' }
}

// ── Full validation ── 7-step connectivity test ───────────────────────────────
async function fullValidation(tenantUrl, clientId, clientSecret) {
  const steps = []
  let accessToken = null
  const apiBase   = getApiBase(tenantUrl)

  // Step 1: DNS + TLS reachability (HEAD to tenant URL)
  const start = Date.now()
  try {
    const res = await httpRequest(tenantUrl, { method: 'HEAD', timeout: 8000 })
    steps.push({
      id: 'connectivity', label: 'DNS & TLS Reachability', status: res.status < 500 ? 'pass' : 'fail',
      detail: `Reachable in ${Date.now() - start}ms — HTTP ${res.status}`,
    })
    if (res.status >= 500) return { success: false, steps, error: 'Tenant URL returned server error' }
  } catch (err) {
    steps.push({ id: 'connectivity', label: 'DNS & TLS Reachability', status: 'fail', detail: err.message })
    return { success: false, steps, error: `Tenant URL is unreachable: ${err.message}` }
  }

  // Step 2: TLS (implicit from HTTPS success above)
  steps.push({ id: 'tls', label: 'TLS Certificate Valid', status: 'pass', detail: `HTTPS established to ${apiBase}` })

  // Step 3: API endpoint reachable (HEAD to /oauth/token)
  try {
    const res = await httpRequest(`${apiBase}/oauth/token`, { method: 'HEAD', timeout: 8000 })
    steps.push({
      id: 'api', label: 'API Endpoint Reachable', status: res.status < 500 ? 'pass' : 'fail',
      detail: `${apiBase}/oauth/token → HTTP ${res.status}`,
    })
    if (res.status >= 500) return { success: false, steps, error: 'API endpoint returned server error' }
  } catch (err) {
    steps.push({ id: 'api', label: 'API Endpoint Reachable', status: 'fail', detail: err.message })
    return { success: false, steps, error: 'API endpoint unreachable' }
  }

  // Step 4: OAuth token
  try {
    const tok   = await getToken(tenantUrl, clientId, clientSecret)
    accessToken = tok.accessToken
    steps.push({ id: 'auth', label: 'OAuth2 Authentication', status: 'pass', detail: `Token issued — expires in ${tok.expiresIn}s` })
  } catch (err) {
    steps.push({ id: 'auth', label: 'OAuth2 Authentication', status: 'fail', detail: err.message })
    return { success: false, steps, error: `Authentication failed: ${err.message}` }
  }

  // Steps 5–7: data retrieval (non-fatal — warn on failure, don't abort)
  let orgInfo = {}, identityCount = 0, vaInfo = {}

  try {
    orgInfo = await getOrgInfo(tenantUrl, accessToken)
    steps.push({
      id: 'org', label: 'Org Configuration', status: 'pass',
      detail: orgInfo.orgName
        ? `Org: ${orgInfo.orgName}${orgInfo.pod ? ' | Pod: ' + orgInfo.pod : ''}`
        : 'Org info retrieved',
    })
  } catch (err) {
    steps.push({ id: 'org', label: 'Org Configuration', status: 'warn', detail: `Non-fatal: ${err.message}` })
  }

  try {
    const ic      = await getIdentityCount(tenantUrl, accessToken)
    identityCount = ic.count
    steps.push({ id: 'identities', label: 'Identity Count', status: 'pass', detail: `${identityCount.toLocaleString()} identities` })
  } catch (err) {
    steps.push({ id: 'identities', label: 'Identity Count', status: 'warn', detail: `Non-fatal: ${err.message}` })
  }

  try {
    vaInfo = await getVaClusters(tenantUrl, accessToken)
    steps.push({
      id: 'va', label: 'VA Cluster Health', status: vaInfo.note ? 'warn' : 'pass',
      detail: vaInfo.note
        ? `VA check non-fatal: ${vaInfo.note}`
        : `${vaInfo.vaCount} cluster${vaInfo.vaCount !== 1 ? 's' : ''}${vaInfo.unhealthyCount > 0 ? ` — ${vaInfo.unhealthyCount} unhealthy` : ' — all healthy'}`,
    })
  } catch (err) {
    steps.push({ id: 'va', label: 'VA Cluster Health', status: 'warn', detail: `Non-fatal: ${err.message}` })
  }

  return {
    success: true,
    steps,
    tenantData: {
      orgName:       orgInfo.orgName,
      pod:           orgInfo.pod,
      identityCount,
      vaCount:       vaInfo.vaCount       || 0,
      vaUnhealthy:   vaInfo.unhealthyCount || 0,
      vaClusters:    vaInfo.clusters       || [],
      simulated:     false,
    },
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS')
    return { statusCode: 200, headers: CORS, body: '' }

  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body' }) } }

  const { action, tenantUrl, clientId, clientSecret } = body

  try {
    // ── ping ──────────────────────────────────────────────────────────────────
    if (action === 'ping')
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) }

    // ── token — fetch an OAuth token and return it to the client for caching ─
    if (action === 'token') {
      if (!tenantUrl || !clientId || !clientSecret)
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'tenantUrl, clientId and clientSecret are required' }) }
      const tok = await getToken(tenantUrl, clientId, clientSecret)
      // Return the full token data so the client can cache it with expiry
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ access_token: tok.accessToken, expires_in: tok.expiresIn, token_type: tok.tokenType }) }
    }

    // ── api — forward a signed REST call using a cached bearer token ──────────
    if (action === 'api') {
      const { apiBase, bearerToken, method = 'GET', path, requestBody } = body

      if (!apiBase || !path)
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'apiBase and path are required' }) }

      let tok = bearerToken
      if (!tok) {
        if (!clientId || !clientSecret)
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'bearerToken or clientId+clientSecret required' }) }
        const td = await getToken(tenantUrl || apiBase, clientId, clientSecret)
        tok = td.accessToken
      }

      const reqHeaders = {
        Authorization:              `Bearer ${tok}`,
        Accept:                     'application/json',
        'Content-Type':             'application/json',
        'X-SailPoint-Experimental': 'true',
      }
      const bodyStr = (method !== 'GET' && method !== 'HEAD' && requestBody !== undefined)
        ? JSON.stringify(requestBody) : undefined
      if (bodyStr) reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr).toString()

      const res = await httpRequest(`${apiBase}${path}`, { method, headers: reqHeaders, body: bodyStr })

      if (res.status === 204) return { statusCode: 204, headers: CORS, body: '' }

      // Forward X-Total-Count to client (needed for identity count calls)
      const respHeaders = { ...CORS }
      if (res.headers['x-total-count']) respHeaders['X-Total-Count'] = res.headers['x-total-count']

      let data
      try { data = JSON.parse(res.body) } catch { data = { raw: res.body } }
      return { statusCode: res.status, headers: respHeaders, body: JSON.stringify(data) }
    }

    // ── validate — full 7-step connectivity test ───────────────────────────────
    if (action === 'validate') {
      if (!tenantUrl || !clientId || !clientSecret)
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'tenantUrl, clientId and clientSecret are required' }) }
      const result = await fullValidation(tenantUrl, clientId, clientSecret)
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result) }
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown action: ${action}` }) }

  } catch (err) {
    console.error('[isc-proxy] Error:', err)
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message || 'Internal proxy error' }) }
  }
}
