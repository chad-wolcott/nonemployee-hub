// netlify/functions/isc-proxy.js
// ─────────────────────────────────────────────────────────────────────────────
// Server-side proxy for SailPoint ISC API calls from the Non-Employee Hub.
// Runs in Node.js on Netlify — no browser CORS restrictions apply here.
//
// Correct v2026 endpoints used throughout:
//   Org config  → GET /v2026/org-config
//   Identities  → GET /v2026/identities?count=true&limit=1  (X-Total-Count header)
//   VA clusters → GET /v2026/managed-clusters
//
// Actions accepted (POST body):
//   { action: "ping" }
//   { action: "token",    tenantUrl, clientId, clientSecret }
//   { action: "api",      apiBase, bearerToken, method, path, requestBody? }
//   { action: "validate", tenantUrl, clientId, clientSecret }
// ─────────────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type":                 "application/json",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Convert tenant UI URL → API base URL
// https://org.identitynow.com → https://org.api.identitynow.com
function deriveApiBase(url) {
  if (!url) return "";
  try {
    const host = new URL(url).hostname;
    if (host.endsWith(".identitynow.com"))
      return `https://${host.replace(".identitynow.com", "")}.api.identitynow.com`;
    if (host.endsWith(".identitynow-demo.com"))
      return `https://${host.replace(".identitynow-demo.com", "")}.api.identitynow-demo.com`;
  } catch {}
  return url.replace(/\/+$/, "");
}

// Normalise the API base — if the caller already passed an .api. URL leave it,
// otherwise derive it. Always strip trailing slashes.
function resolveApiBase(tenantUrl) {
  const clean = (tenantUrl || "").replace(/\/+$/, "");
  if (clean.includes(".api.")) return clean;
  return deriveApiBase(clean);
}

// Read a Response body safely as text (stream can only be consumed once)
async function readBody(res) {
  try { return await res.text(); } catch { return ""; }
}

// Parse text to JSON, return fallback on failure
function tryJson(text, fallback = {}) {
  try { return JSON.parse(text); } catch { return fallback; }
}

// Fetch an OAuth2 client_credentials token and return the full token object
async function fetchToken(apiBase, clientId, clientSecret) {
  let res;
  try {
    res = await fetch(`${apiBase}/oauth/token`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     clientId,
        client_secret: clientSecret,
      }).toString(),
    });
  } catch (e) {
    throw new Error(`Cannot reach ${apiBase}/oauth/token — ${e.message}`);
  }

  const body = await readBody(res);
  if (!res.ok) {
    const msg =
      res.status === 401 ? `Invalid Client ID or Client Secret (401) — ${body.slice(0, 200)}`
    : res.status === 400 ? `Bad OAuth request (400) — ${body.slice(0, 200)}`
    : `OAuth error ${res.status} — ${body.slice(0, 300)}`;
    throw new Error(msg);
  }

  const data = tryJson(body);
  if (!data.access_token) {
    throw new Error(`OAuth response missing access_token — ${body.slice(0, 200)}`);
  }
  return data; // { access_token, expires_in, token_type }
}

// ── Step helpers ──────────────────────────────────────────────────────────────
const mk = (id, label, status, detail = "") => ({ id, label, status, detail });

// ── Full connectivity validation ──────────────────────────────────────────────
async function handleValidate(tenantUrl, clientId, clientSecret) {
  const apiBase = resolveApiBase(tenantUrl);

  // ── Steps 1–4: OAuth token acquisition covers DNS + TLS + auth ───────────
  let tokenData;
  try {
    tokenData = await fetchToken(apiBase, clientId, clientSecret);
  } catch (e) {
    const msg     = e.message;
    const isConn  = /reach|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|fetch/i.test(msg);
    const isTls   = /SSL|TLS|cert/i.test(msg);
    const isAuth  = /401|400|Invalid Client|Bad OAuth/i.test(msg);
    return {
      success: false,
      error:   msg,
      steps: [
        mk("connectivity", "DNS & TLS reachability",  isConn ? "fail" : "pass",  isConn ? msg : `${apiBase} reachable`),
        mk("tls",          "TLS certificate valid",    isTls  ? "fail" : (isConn ? "pending" : "pass"), isTls ? msg : "TLS OK"),
        mk("api",          "API endpoint reachable",   (isConn || isTls) ? "pending" : "pass", `${apiBase}/oauth/token`),
        mk("auth",         "OAuth2 authentication",    isAuth ? "fail" : "pending", isAuth ? msg : ""),
        mk("org",          "Org configuration",        "pending", ""),
        mk("identities",   "Identity count",           "pending", ""),
        mk("va",           "VA cluster health",        "pending", ""),
      ],
    };
  }

  const tok = tokenData.access_token;
  const h   = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };

  const steps = [
    mk("connectivity", "DNS & TLS reachability", "pass", `${apiBase} reachable`),
    mk("tls",          "TLS certificate valid",   "pass", "TLS handshake successful"),
    mk("api",          "API endpoint reachable",  "pass", `${apiBase}/oauth/token responding`),
    mk("auth",         "OAuth2 authentication",   "pass", "client_credentials token issued"),
  ];

  // ── Step 5: Org config ──  GET /v2026/org-config ─────────────────────────
  // Returns: { orgName, pod, region, ... }
  let orgData = {};
  try {
    const r    = await fetch(`${apiBase}/v2026/org-config`, { headers: h });
    const body = await readBody(r);
    if (r.ok) {
      orgData = tryJson(body, {});
      const pod = orgData.pod || orgData.region || "unknown";
      steps.push(mk("org", "Org configuration", "pass",
        `Org: ${orgData.orgName || "unknown"} | Pod: ${pod}`));
    } else if (r.status === 403 || r.status === 401) {
      steps.push(mk("org", "Org configuration", "warn",
        `HTTP ${r.status} — idn:org-config:read scope required. ` +
        `Org name inferred from URL: ${apiBase.split(".")[0].replace("https://","")}`));
    } else {
      steps.push(mk("org", "Org configuration", "warn", `HTTP ${r.status} from /v2026/org-config`));
    }
  } catch (e) {
    steps.push(mk("org", "Org configuration", "warn", e.message));
  }

  // ── Step 6: Identity count ── GET /v2026/identities?count=true&limit=1 ───
  // Total count is returned in the X-Total-Count response header when count=true.
  let identityCount = 0;
  try {
    const r    = await fetch(`${apiBase}/v2026/identities?count=true&limit=1`, { headers: h });
    const body = await readBody(r);
    if (r.ok) {
      const xTotal = r.headers.get("X-Total-Count");
      if (xTotal !== null) {
        identityCount = parseInt(xTotal, 10);
        steps.push(mk("identities", "Identity count", "pass",
          `${identityCount.toLocaleString()} identities (X-Total-Count header)`));
      } else {
        // Header absent — fall back to counting the returned array
        const arr = tryJson(body, []);
        identityCount = Array.isArray(arr) ? arr.length : 0;
        steps.push(mk("identities", "Identity count", "warn",
          `X-Total-Count header absent — sample size: ${identityCount} (idn:identity:read scope may be needed for count)`));
      }
    } else if (r.status === 403 || r.status === 401) {
      steps.push(mk("identities", "Identity count", "warn",
        `HTTP ${r.status} — idn:identity:read scope required`));
    } else {
      steps.push(mk("identities", "Identity count", "warn",
        `HTTP ${r.status} from /v2026/identities`));
    }
  } catch (e) {
    steps.push(mk("identities", "Identity count", "warn", e.message));
  }

  // ── Step 7: VA clusters ── GET /v2026/managed-clusters ───────────────────
  // Each cluster has: { id, name, status, ... }
  // Healthy statuses: "CONNECTED" | "HEALTHY"
  // Degraded: "DISCONNECTED" | "DEGRADED" | "WARNING" | anything else
  let vaCount = 0, vaUnhealthy = 0, vaClusters = [];
  try {
    const r    = await fetch(`${apiBase}/v2026/managed-clusters`, { headers: h });
    const body = await readBody(r);
    if (r.ok) {
      const data  = tryJson(body, []);
      vaClusters  = Array.isArray(data) ? data : [];
      vaCount     = vaClusters.length;
      vaUnhealthy = vaClusters.filter(
        c => !["CONNECTED", "HEALTHY"].includes((c.status || "").toUpperCase())
      ).length;
      if (vaCount === 0) {
        steps.push(mk("va", "VA cluster health", "warn",
          "No managed clusters found (may be expected for this tenant)"));
      } else if (vaUnhealthy === 0) {
        steps.push(mk("va", "VA cluster health", "pass",
          `${vaCount} cluster${vaCount !== 1 ? "s" : ""} — all healthy`));
      } else {
        steps.push(mk("va", "VA cluster health", "warn",
          `${vaCount} cluster${vaCount !== 1 ? "s" : ""} — ${vaUnhealthy} unhealthy`));
      }
    } else if (r.status === 403 || r.status === 401) {
      steps.push(mk("va", "VA cluster health", "warn",
        `HTTP ${r.status} — idn:managed-cluster:read scope required`));
    } else {
      steps.push(mk("va", "VA cluster health", "warn",
        `HTTP ${r.status} from /v2026/managed-clusters`));
    }
  } catch (e) {
    steps.push(mk("va", "VA cluster health", "warn", e.message));
  }

  // ── Build tenantData ──────────────────────────────────────────────────────
  const tenantData = {
    orgName:       orgData.orgName || resolveApiBase(tenantUrl).split(".")[0].replace("https://", ""),
    pod:           orgData.pod || orgData.region || "unknown",
    identityCount,
    vaCount,
    vaUnhealthy,
    vaClusters:    vaClusters.slice(0, 30).map(c => ({
      id:     c.id,
      name:   c.name,
      status: c.status,
    })),
    simulated: false,
  };

  return { success: true, steps, tenantData };
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: CORS, body: "" };

  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON body" }) }; }

  const { action, tenantUrl, clientId, clientSecret } = body;

  try {

    // ── ping ─────────────────────────────────────────────────────────────────
    if (action === "ping") {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }

    // ── token ─────────────────────────────────────────────────────────────────
    // Acquire an OAuth token server-side and return it to the client for caching.
    if (action === "token") {
      if (!tenantUrl || !clientId || !clientSecret)
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "tenantUrl, clientId and clientSecret are required" }) };
      const apiBase   = resolveApiBase(tenantUrl);
      const tokenData = await fetchToken(apiBase, clientId, clientSecret);
      return { statusCode: 200, headers: CORS, body: JSON.stringify(tokenData) };
    }

    // ── api ───────────────────────────────────────────────────────────────────
    // Forward a signed REST call using a cached bearer token (or credentials).
    if (action === "api") {
      const { apiBase, bearerToken, method = "GET", path, requestBody } = body;
      if (!apiBase || !path)
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "apiBase and path are required" }) };

      // Use the supplied token; if missing, fetch a fresh one
      let tok = bearerToken;
      if (!tok) {
        if (!clientId || !clientSecret)
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "bearerToken or clientId+clientSecret required" }) };
        const td = await fetchToken(apiBase, clientId, clientSecret);
        tok = td.access_token;
      }

      let r;
      try {
        r = await fetch(`${apiBase}${path}`, {
          method,
          headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
          body: (method !== "GET" && method !== "HEAD" && requestBody !== undefined)
                ? JSON.stringify(requestBody) : undefined,
        });
      } catch (e) {
        return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: `Upstream fetch failed: ${e.message}` }) };
      }

      if (r.status === 204) return { statusCode: 204, headers: CORS, body: "" };

      const rawBody = await readBody(r);
      const data    = tryJson(rawBody, { raw: rawBody });

      // Forward X-Total-Count if present (needed by identity-count calls)
      const totalCount = r.headers.get("X-Total-Count");
      const respHeaders = { ...CORS };
      if (totalCount !== null) respHeaders["X-Total-Count"] = totalCount;

      return { statusCode: r.status, headers: respHeaders, body: JSON.stringify(data) };
    }

    // ── validate ──────────────────────────────────────────────────────────────
    if (action === "validate") {
      if (!tenantUrl || !clientId || !clientSecret)
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "tenantUrl, clientId and clientSecret are required" }) };
      const result = await handleValidate(tenantUrl, clientId, clientSecret);
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown action: ${action}` }) };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
