// netlify/functions/isc-proxy.js
// ─────────────────────────────────────────────────────────────────────────────
// Server-side proxy for SailPoint ISC API calls from the Non-Employee Hub.
// Runs in Node.js on Netlify — no browser CORS restrictions apply here.
//
// The browser POSTs to /.netlify/functions/isc-proxy with:
//   { action: "ping"     }                              → availability check
//   { action: "token",   tenantUrl, clientId, clientSecret }  → get bearer token
//   { action: "api",     apiBase, bearerToken, method, path, requestBody? } → forward call
//   { action: "validate",tenantUrl, clientId, clientSecret }  → 7-step connectivity test
// ─────────────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type":                 "application/json",
};

// Convert https://org.identitynow.com → https://org.api.identitynow.com
function deriveApiBase(tenantUrl) {
  try {
    const host = new URL(tenantUrl).hostname;
    if (host.endsWith(".identitynow.com"))
      return `https://${host.replace(".identitynow.com","")}.api.identitynow.com`;
    if (host.endsWith(".identitynow-demo.com"))
      return `https://${host.replace(".identitynow-demo.com","")}.api.identitynow-demo.com`;
    return tenantUrl.replace(/\/+$/, "");
  } catch {
    return (tenantUrl || "").replace(/\/+$/, "");
  }
}

// Fetch an OAuth2 client_credentials token from ISC
async function fetchToken(apiBase, clientId, clientSecret) {
  const res = await fetch(`${apiBase}/oauth/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     clientId,
      client_secret: clientSecret,
    }).toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    const msg = res.status === 401 ? `Invalid credentials (401): ${txt.slice(0,200)}`
              : res.status === 400 ? `Bad request (400): ${txt.slice(0,200)}`
              : `OAuth ${res.status}: ${txt.slice(0,300)}`;
    throw new Error(msg);
  }
  return res.json(); // { access_token, expires_in, token_type }
}

// ── action: validate — run a full 7-step connectivity test ───────────────────
async function handleValidate(tenantUrl, clientId, clientSecret) {
  const apiBase = tenantUrl.includes(".api.") ? tenantUrl.replace(/\/+$/,"") : deriveApiBase(tenantUrl);
  const mk = (id, label, status, detail="") => ({ id, label, status, detail });

  // Step 1–4: attempt OAuth token acquisition (covers connectivity + TLS + auth)
  let tokenData;
  try {
    tokenData = await fetchToken(apiBase, clientId, clientSecret);
  } catch(e) {
    const msg   = e.message;
    const isConn = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|fetch|socket/i.test(msg);
    const isTls  = /SSL|TLS|cert/i.test(msg);
    const isAuth = /401|400|invalid_client|Invalid cred/i.test(msg);
    return {
      success: false,
      error:   msg,
      steps: [
        mk("connectivity", "DNS & TLS Reachability",    isConn ? "fail" : "pass",  isConn ? msg : `${apiBase} reachable`),
        mk("tls",          "TLS Certificate Valid",      isTls  ? "fail" : (isConn ? "pending" : "pass"), isTls ? msg : "TLS handshake successful"),
        mk("api",          "API Endpoint Reachable",     (isConn||isTls) ? "pending" : "pass",            `${apiBase}/oauth/token`),
        mk("auth",         "OAuth2 Authentication",      isAuth ? "fail" : "pending",                     isAuth ? msg : ""),
        mk("org",          "Org Configuration",          "pending", ""),
        mk("identities",   "Identity Data Access",       "pending", ""),
        mk("va",           "VA Clusters",                "pending", ""),
      ],
    };
  }

  const tok = tokenData.access_token;
  const h   = { Authorization:`Bearer ${tok}`, "Content-Type":"application/json" };
  const steps = [
    mk("connectivity","DNS & TLS Reachability","pass", `${apiBase} reachable`),
    mk("tls",         "TLS Certificate Valid", "pass", "TLS handshake successful"),
    mk("api",         "API Endpoint Reachable","pass", `${apiBase}/oauth/token responding`),
    mk("auth",        "OAuth2 Authentication", "pass", "client_credentials token issued"),
  ];

  // Step 5: Org config
  let orgData = {};
  try {
    const r = await fetch(`${apiBase}/v3/org-config`, { headers:h });
    if (r.ok) {
      orgData = await r.json();
      steps.push(mk("org","Org Configuration","pass",
        `Org: ${orgData.orgName||"unknown"} | Pod: ${orgData.pod||"unknown"}`));
    } else {
      steps.push(mk("org","Org Configuration","warn",`HTTP ${r.status} — check org-config scope`));
    }
  } catch(e) { steps.push(mk("org","Org Configuration","warn",e.message)); }

  // Step 6: Identity count
  let identityCount = 0;
  try {
    const r = await fetch(`${apiBase}/v3/identities?count=true&limit=1`, { headers:h });
    const xc = r.headers.get("X-Total-Count");
    if (xc) {
      identityCount = parseInt(xc, 10);
      steps.push(mk("identities","Identity Data Access","pass",`${identityCount.toLocaleString()} identities`));
    } else if (r.ok) {
      steps.push(mk("identities","Identity Data Access","pass","Identities endpoint accessible"));
    } else {
      steps.push(mk("identities","Identity Data Access","warn",`HTTP ${r.status} — check identity:read scope`));
    }
  } catch(e) { steps.push(mk("identities","Identity Data Access","warn",e.message)); }

  // Step 7: VA clusters
  let vaCount=0, vaUnhealthy=0, vaClusters=[];
  try {
    const r = await fetch(`${apiBase}/beta/managed-clusters`, { headers:h });
    if (r.ok) {
      const d = await r.json();
      vaClusters  = Array.isArray(d) ? d : [];
      vaCount     = vaClusters.length;
      vaUnhealthy = vaClusters.filter(v=>!["CONNECTED","HEALTHY"].includes(v.status)).length;
      steps.push(mk("va","VA Clusters", vaCount>0?"pass":"warn",
        vaCount>0 ? `${vaCount} cluster${vaCount!==1?"s":""} · ${vaUnhealthy} unhealthy`
                  : "No VA clusters (may be expected)"));
    } else {
      steps.push(mk("va","VA Clusters","warn",`HTTP ${r.status} — check managed-clusters scope`));
    }
  } catch(e) { steps.push(mk("va","VA Clusters","warn",e.message)); }

  return {
    success: true,
    steps,
    tenantData: {
      orgName:      orgData.orgName || new URL(tenantUrl).hostname.split(".")[0],
      pod:          orgData.pod     || "unknown",
      identityCount,
      vaCount,
      vaUnhealthy,
      vaClusters:   vaClusters.slice(0,30),
      simulated:    false,
    },
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS")
    return { statusCode:200, headers:CORS, body:"" };

  if (event.httpMethod !== "POST")
    return { statusCode:405, headers:CORS, body:JSON.stringify({ error:"Method not allowed" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode:400, headers:CORS, body:JSON.stringify({ error:"Invalid JSON" }) }; }

  const { action, tenantUrl, clientId, clientSecret } = body;

  try {
    // ── ping ───────────────────────────────────────────────────────────────
    if (action === "ping") {
      return { statusCode:200, headers:CORS, body:JSON.stringify({ ok:true }) };
    }

    // ── token — acquire an OAuth token and return it to the client ─────────
    // The client caches this and passes it back in subsequent api calls.
    if (action === "token") {
      if (!tenantUrl || !clientId || !clientSecret)
        return { statusCode:400, headers:CORS, body:JSON.stringify({ error:"tenantUrl, clientId, clientSecret required" }) };
      const apiBase = tenantUrl.includes(".api.") ? tenantUrl.replace(/\/+$/,"") : deriveApiBase(tenantUrl);
      const tokenData = await fetchToken(apiBase, clientId, clientSecret);
      return { statusCode:200, headers:CORS, body:JSON.stringify(tokenData) };
    }

    // ── api — forward a signed REST call using a cached bearer token ───────
    // Accepts a pre-obtained bearerToken so the client doesn't have to send
    // credentials on every call. Falls back to clientId/clientSecret if no
    // bearerToken is provided.
    if (action === "api") {
      const { apiBase, bearerToken, method="GET", path, requestBody } = body;
      if (!apiBase || !path)
        return { statusCode:400, headers:CORS, body:JSON.stringify({ error:"apiBase and path are required" }) };

      let tok = bearerToken;
      if (!tok) {
        // No cached token provided — fetch one using credentials
        if (!clientId || !clientSecret)
          return { statusCode:400, headers:CORS, body:JSON.stringify({ error:"bearerToken or clientId+clientSecret required" }) };
        const tokenData = await fetchToken(apiBase, clientId, clientSecret);
        tok = tokenData.access_token;
      }

      const r = await fetch(`${apiBase}${path}`, {
        method,
        headers: { Authorization:`Bearer ${tok}`, "Content-Type":"application/json" },
        body: (method !== "GET" && method !== "HEAD" && requestBody !== undefined)
              ? JSON.stringify(requestBody) : undefined,
      });

      if (r.status === 204) return { statusCode:204, headers:CORS, body:"" };
      let data;
      try { data = await r.json(); } catch { data = { raw: await r.text() }; }
      return { statusCode:r.status, headers:CORS, body:JSON.stringify(data) };
    }

    // ── validate — full 7-step connectivity test ───────────────────────────
    if (action === "validate") {
      if (!tenantUrl || !clientId || !clientSecret)
        return { statusCode:400, headers:CORS, body:JSON.stringify({ error:"tenantUrl, clientId, clientSecret required" }) };
      const result = await handleValidate(tenantUrl, clientId, clientSecret);
      return { statusCode:200, headers:CORS, body:JSON.stringify(result) };
    }

    return { statusCode:400, headers:CORS, body:JSON.stringify({ error:`Unknown action: ${action}` }) };

  } catch(err) {
    return { statusCode:500, headers:CORS, body:JSON.stringify({ error:err.message }) };
  }
};
