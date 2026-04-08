const { useState, useEffect, useContext, createContext } = React;

// ─── Constants ────────────────────────────────────────────────────────────────
const RSM_BLUE = "#0033A1", RSM_MAGENTA = "#CC27B0";

const GOOGLE_FONTS = [
  { label: "Segoe UI (system default)", value: "'Segoe UI', system-ui, sans-serif", gfName: null },
  { label: "Inter",         value: "'Inter', sans-serif",         gfName: "Inter" },
  { label: "Roboto",        value: "'Roboto', sans-serif",        gfName: "Roboto" },
  { label: "Open Sans",     value: "'Open Sans', sans-serif",     gfName: "Open+Sans" },
  { label: "Nunito",        value: "'Nunito', sans-serif",        gfName: "Nunito" },
  { label: "Montserrat",    value: "'Montserrat', sans-serif",    gfName: "Montserrat" },
  { label: "IBM Plex Sans", value: "'IBM Plex Sans', sans-serif", gfName: "IBM+Plex+Sans" },
  { label: "DM Sans",       value: "'DM Sans', sans-serif",       gfName: "DM+Sans" },
  { label: "Figtree",       value: "'Figtree', sans-serif",       gfName: "Figtree" },
];
const FONT_SIZES = [{ label: "Small", base: 12 }, { label: "Medium", base: 13 }, { label: "Large", base: 15 }];
const VALID_TYPES = ["none","noNumbers","emailFormat","phoneFormat","alphanumericOnly","numericOnly"];
const VALID_LABELS = { none:"None", noNumbers:"No numbers", emailFormat:"Email format", phoneFormat:"Phone format", alphanumericOnly:"Alphanumeric only", numericOnly:"Numeric only" };
const TERM_REASONS = ["Resignation","Termination for cause","Contract end","Project completion","Conversion to employee","Redundancy","Other"];
const DISCONNECTED_CONNECTORS = ["delimited-file","DelimitedFile","No connector","Manual","disconnected"];

const DEFAULT_SCHEMA_FIELD = { label:"", required:false, validationType:"none", isPicklist:false, allowNewPicklistValues:true, isUniqueId:false, uniqueIdSeedFormat:"100000", isDupeField:false, isConversionField:false, isLegalHoldField:false, isImmutable:false };

const DEFAULT_CONFIG = {
  clientName:"", contactEmail:"", notes:"",
  tenantUrl:"", apiEndpoint:"", clientId:"", clientSecret:"",
  sourceId:"",
  customAttributes:[],
  schemaFieldConfig:{},
  dupeCriteriaFields:[],
  branding:{ appName:"Non-Employee Hub", companyName:"RSM", primaryColor:RSM_BLUE, accentColor:RSM_MAGENTA, logoUrl:"", fontFamily:"'Segoe UI', system-ui, sans-serif", fontSize:"Medium" }
};

const EMPTY_FORM = { accountName:"", firstName:"", lastName:"", email:"", phone:"", manager:"", contractingOrg:"", startDate:"", endDate:"", customData:{}, schemaData:{}, isConversion:false, isLegalHold:false };

const STATUS_COLORS = {
  PENDING:  { bg:"#FFF3CD", color:"#856404",  darkBg:"#3D2E00", darkColor:"#FBBF24" },
  APPROVED: { bg:"#D1E7DD", color:"#0A3622",  darkBg:"#052E16", darkColor:"#34D399" },
  REJECTED: { bg:"#F8D7DA", color:"#58151C",  darkBg:"#2D0A0A", darkColor:"#F87171" },
  ACTIVE:   { bg:"#CFE2FF", color:"#084298",  darkBg:"#0C1A40", darkColor:"#60A5FA" },
  EXPIRED:  { bg:"#E2E3E5", color:"#383D41",  darkBg:"#1F2937", darkColor:"#9CA3AF" },
};

const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—";
const initials = (f,l) => `${(f||"?")[0]}${(l||"?")[0]}`.toUpperCase();

const getTheme = (dark) => ({
  bg:dark?"#0D0F1A":"#F0F2F5", cardBg:dark?"#161929":"#FFFFFF", cardBorder:dark?"#252842":"#E4E7EB",
  text:dark?"#E8EAF4":"#111111", textMuted:dark?"#8B93B8":"#6B7280", textFaint:dark?"#5A6180":"#9CA3AF",
  inputBg:dark?"#0D0F1A":"#FAFAFA", inputBorder:dark?"#252842":"#D1D5DB", inputText:dark?"#E8EAF4":"#111111",
  navBg:dark?"#161929":"#FFFFFF", navBorder:dark?"#252842":"#DDE1E8",
  tblHeadBg:dark?"#0D0F1A":"#F8F9FB", tblHeadColor:dark?"#8B93B8":"#374151",
  tblRowHover:dark?"#1C1F33":"#FAFAFA", tblBorder:dark?"#1C1F33":"#F0F2F5",
  attrBg:dark?"#0D0F1A":"#FAFAFA", codeBg:dark?"#08090F":"#1E1E2E", codeText:"#CDD6F4",
  previewBg:dark?"#1C1F33":"#F8F9FB", toggleBg:dark?"#252842":"#E4E7EB",
  modalOverlay:dark?"rgba(0,0,0,0.7)":"rgba(0,0,0,0.45)",
  connectOk:dark?"#34D399":"#059669", connectErr:dark?"#F87171":"#DC2626",
  notifShadow:dark?"rgba(0,0,0,0.5)":"rgba(0,0,0,0.2)",
  sectionBorder:dark?"#252842":"#E4E7EB", quickHover:dark?"#1C1F33":"#FFFFFF",
  warnBg:dark?"#2D2200":"#FFFBEB", warnBorder:dark?"#92400E":"#FCD34D",
  dangerBg:dark?"#2D0A0A":"#FEF2F2", dangerBorder:dark?"#7F1D1D":"#FECACA",
  successBg:dark?"#052E16":"#ECFDF5", successBorder:dark?"#065F46":"#A7F3D0",
  infoBg:dark?"#0C1A40":"#EFF6FF", infoBorder:dark?"#1E3A6E":"#BFDBFE",
});

const loadGoogleFont = (gfName) => {
  if (!gfName || document.getElementById(`gf-${gfName}`)) return;
  const l = document.createElement("link");
  l.id=`gf-${gfName}`; l.rel="stylesheet";
  l.href=`https://fonts.googleapis.com/css2?family=${gfName}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(l);
};

// Validation helpers
const validateField = (value, validationType) => {
  if (!value) return null;
  const v = String(value);
  if (validationType === "noNumbers"       && /\d/.test(v))         return "Must not contain numbers";
  if (validationType === "emailFormat"     && !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v)) return "Invalid email (must include @ and valid TLD)";
  if (validationType === "phoneFormat"     && !/^\+?[\d\s\-(). ]{7,20}$/.test(v))         return "Invalid phone format";
  if (validationType === "alphanumericOnly"&& /[^a-zA-Z0-9]/.test(v))  return "Alphanumeric characters only";
  if (validationType === "numericOnly"     && /\D/.test(v))            return "Numeric characters only";
  return null;
};

const parseNextId = (existingValues, seedFormat) => {
  const nums = existingValues.map(v => { const m = String(v).match(/\d+/); return m ? parseInt(m[0],10) : 0; }).filter(n=>!isNaN(n));
  const seedNums = seedFormat.match(/\d+/g) || ["0"];
  const seedNum = parseInt(seedNums[seedNums.length-1], 10);
  const maxNum = nums.length > 0 ? Math.max(...nums) : seedNum - 1;
  const nextNum = maxNum + 1;
  const prefix = seedFormat.replace(/\d[\d]*$/, "");
  const numLen = seedNums[seedNums.length-1].length;
  return prefix + String(nextNum).padStart(numLen, "0");
};

// ─── Context ──────────────────────────────────────────────────────────────────
const Ctx = createContext(null);

// ─── FG — DEFINED OUTSIDE to prevent unmount/remount on parent re-render ─────
function FG({ label, err, required, hint, children }) {
  const { T, fs } = useContext(Ctx);
  return (
    <div style={{ marginBottom: "0.7rem" }}>
      <div style={{ fontSize:`${fs-1}px`, fontWeight:"500", color:T.textMuted, marginBottom:"4px" }}>
        {label}{required && <span style={{ color:"#E53E3E" }}> *</span>}
      </div>
      {children}
      {hint && <div style={{ fontSize:`${fs-2}px`, color:T.textFaint, marginTop:"3px" }}>{hint}</div>}
      {err  && <div style={{ fontSize:`${fs-2}px`, color:"#E53E3E",   marginTop:"3px" }}>{err}</div>}
    </div>
  );
}

function DarkToggle({ dark, setDark }) {
  const { T, p } = useContext(Ctx);
  return (
    <button onClick={()=>setDark(d=>!d)} title={dark?"Light mode":"Dark mode"}
      style={{ background:T.toggleBg, border:"none", borderRadius:"99px", width:"52px", height:"28px", cursor:"pointer", display:"flex", alignItems:"center", padding:"3px", flexShrink:0, transition:"background 0.25s" }}>
      <div style={{ width:"22px", height:"22px", borderRadius:"50%", background:p, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", transform:dark?"translateX(24px)":"translateX(0)", transition:"transform 0.25s" }}>
        {dark?"🌙":"☀️"}
      </div>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function NonEmployeeHub() {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [dark,          setDark]          = useState(false);
  const [config,        setConfig]        = useState(DEFAULT_CONFIG);
  const [configDraft,   setConfigDraft]   = useState(DEFAULT_CONFIG);
  const [activeTab,     setActiveTab]     = useState("dashboard");
  const [cfgSection,    setCfgSection]    = useState("connectivity");
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [formErrors,    setFormErrors]    = useState({});
  const [identities,    setIdentities]    = useState([]);
  const [approvals,     setApprovals]     = useState([]);
  const [summary,       setSummary]       = useState(null);
  const [token,         setToken]         = useState(null);
  const [tokenExpiry,   setTokenExpiry]   = useState(0);
  const [listLoading,   setListLoading]   = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [connectStatus, setConnectStatus] = useState(null);
  const [connectMsg,    setConnectMsg]    = useState("");
  const [previewOpen,   setPreviewOpen]   = useState(false);
  const [editOpen,      setEditOpen]      = useState(false);
  const [editRecord,    setEditRecord]    = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [rejectTarget,  setRejectTarget]  = useState(null);
  const [rejectComment, setRejectComment] = useState("");
  const [notification,  setNotification]  = useState(null);
  const [searchTerm,    setSearchTerm]    = useState("");

  // ── Sources & schema state ─────────────────────────────────────────────────
  const [sources,         setSources]         = useState([]);
  const [sourcesLoading,  setSourcesLoading]  = useState(false);
  const [sourceSubTab,    setSourceSubTab]     = useState("browse");
  const [showAllSources,  setShowAllSources]   = useState(false);
  const [sourceSchemas,   setSourceSchemas]    = useState([]);
  const [schemaLoading,   setSchemaLoading]    = useState(false);
  const [sourceAccounts,  setSourceAccounts]   = useState([]);
  const [acctLoading,     setAcctLoading]      = useState(false);
  const [picklistCache,   setPicklistCache]    = useState({});
  const [nextUniqueId,    setNextUniqueId]     = useState("");
  const [expandedField,   setExpandedField]    = useState(null);
  const [dupeWarning,     setDupeWarning]      = useState(null);
  const [dupeChecking,    setDupeChecking]     = useState(false);
  const [createSrcMode,   setCreateSrcMode]    = useState(false);
  const [newSrc,          setNewSrc]           = useState({ name:"", description:"", owner:"", seedFormat:"100000", schemaAttrs:[] });

  // ── Emergency termination state ────────────────────────────────────────────
  const [termSearch,    setTermSearch]    = useState("");
  const [termResults,   setTermResults]   = useState([]);
  const [termSearching, setTermSearching] = useState(false);
  const [termTarget,    setTermTarget]    = useState(null);
  const [termForm,      setTermForm]      = useState({ reason:"", type:"immediate", schedDate:"", notes:"", legalHold:false });
  const [termConfirm,   setTermConfirm]   = useState(false);
  const [termProgress,  setTermProgress]  = useState([]);
  const [termDone,      setTermDone]      = useState(false);
  const [terminating,   setTerminating]   = useState(false);

  // ─── Derived theme values ────────────────────────────────────────────────
  const T   = getTheme(dark);
  const p   = config.branding.primaryColor || RSM_BLUE;
  const acc = config.branding.accentColor  || RSM_MAGENTA;
  const fs  = (FONT_SIZES.find(f=>f.label===config.branding.fontSize)||FONT_SIZES[1]).base;
  const ff  = config.branding.fontFamily   || "'Segoe UI', system-ui, sans-serif";

  // Active schema attributes (from ISC schema)
  const schemaAttrs = sourceSchemas[0]?.attributes || [];
  const hasSchema   = schemaAttrs.length > 0;
  const sfc = config.schemaFieldConfig || {};

  // Unique ID field
  const uidField = Object.entries(sfc).find(([,v])=>v.isUniqueId)?.[0];
  const dupeFields = Object.entries(sfc).filter(([,v])=>v.isDupeField).map(([k])=>k);

  useEffect(() => {
    const f = GOOGLE_FONTS.find(f=>f.value===config.branding.fontFamily); if(f?.gfName) loadGoogleFont(f.gfName);
  }, [config.branding.fontFamily]);
  useEffect(() => {
    const f = GOOGLE_FONTS.find(f=>f.value===configDraft.branding.fontFamily); if(f?.gfName) loadGoogleFont(f.gfName);
  }, [configDraft.branding.fontFamily]);

  // ── Style helpers ─────────────────────────────────────────────────────────
  const inp = (err) => ({ width:"100%", padding:"8px 11px", fontSize:`${fs}px`, border:`1px solid ${err?"#E53E3E":T.inputBorder}`, borderRadius:"6px", outline:"none", boxSizing:"border-box", color:T.inputText, background:T.inputBg, transition:"border 0.15s" });
  const sel = { width:"100%", padding:"8px 11px", fontSize:`${fs}px`, border:`1px solid ${T.inputBorder}`, borderRadius:"6px", color:T.inputText, background:T.inputBg };
  const card = { background:T.cardBg, borderRadius:"10px", border:`1px solid ${T.cardBorder}`, padding:"1.25rem 1.5rem", marginBottom:"1rem", boxShadow:dark?"0 1px 4px rgba(0,0,0,0.3)":"0 1px 3px rgba(0,0,0,0.06)" };
  const secHead = { fontSize:`${fs-1}px`, fontWeight:"600", color:p, marginBottom:"1rem", display:"flex", alignItems:"center", gap:"8px", paddingBottom:"0.6rem", borderBottom:`1.5px solid ${p}22` };
  const th = { padding:"9px 12px", textAlign:"left", background:T.tblHeadBg, color:T.tblHeadColor, fontWeight:"600", fontSize:`${fs-2}px`, textTransform:"uppercase", letterSpacing:"0.5px", borderBottom:`1px solid ${T.cardBorder}` };
  const td = { padding:"10px 12px", borderBottom:`1px solid ${T.tblBorder}`, color:T.text, verticalAlign:"middle", fontSize:`${fs}px` };
  const btnP = (sm) => ({ background:p, color:"#fff", border:"none", padding:sm?"5px 13px":"8px 20px", borderRadius:"6px", cursor:"pointer", fontSize:`${sm?fs-1:fs}px`, fontWeight:"500", display:"inline-flex", alignItems:"center", gap:"5px" });
  const btnS = (sm) => ({ background:"transparent", color:p, border:`1px solid ${p}`, padding:sm?"5px 12px":"8px 18px", borderRadius:"6px", cursor:"pointer", fontSize:`${sm?fs-1:fs}px`, fontWeight:"500" });
  const btnDgr = { background:"transparent", color:"#DC2626", border:"1px solid #DC2626", padding:"5px 12px", borderRadius:"6px", cursor:"pointer", fontSize:`${fs-1}px` };
  const btnApp = { background:"#059669", color:"#fff", border:"none", padding:"5px 12px", borderRadius:"6px", cursor:"pointer", fontSize:`${fs-1}px` };
  const btnWarn = { background:"#D97706", color:"#fff", border:"none", padding:"6px 14px", borderRadius:"6px", cursor:"pointer", fontSize:`${fs-1}px`, fontWeight:"500" };
  const badge = (status) => { const c=STATUS_COLORS[status]||STATUS_COLORS.EXPIRED; return { background:dark?c.darkBg:c.bg, color:dark?c.darkColor:c.color, padding:"2px 9px", borderRadius:"99px", fontSize:`${fs-2}px`, fontWeight:"600", display:"inline-block" }; };
  const pillTab = (active) => ({ padding:"5px 14px", borderRadius:"20px", cursor:"pointer", fontSize:`${fs-1}px`, fontWeight:active?"600":"400", background:active?p:(dark?T.attrBg:"transparent"), color:active?"#fff":T.textMuted, border:active?"none":`1px solid ${T.cardBorder}`, transition:"all 0.15s" });
  const overlay = { position:"absolute", top:0, left:0, right:0, bottom:0, minHeight:"100vh", background:T.modalOverlay, zIndex:500, display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:"80px" };
  const modal  = { background:T.cardBg, borderRadius:"12px", padding:"1.5rem", width:"680px", maxWidth:"95%", maxHeight:"82vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.35)" };
  const g2 = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.85rem" };
  const g3 = { display:"grid", gridTemplateColumns:"1fr 1fr 140px", gap:"0.75rem" };
  const statCard = { background:T.cardBg, borderRadius:"10px", border:`1px solid ${T.cardBorder}`, padding:"1rem 1.25rem", boxShadow:dark?"0 1px 4px rgba(0,0,0,0.3)":"0 1px 3px rgba(0,0,0,0.05)" };
  const stepBadge = (n,col) => <span style={{ background:col, color:"#fff", width:"20px", height:"20px", borderRadius:"50%", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:"11px", fontWeight:"700", flexShrink:0 }}>{n}</span>;
  const infoBox = (bg,border,icon,msg) => <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:"8px", padding:"10px 14px", fontSize:`${fs-1}px`, display:"flex", gap:"8px", alignItems:"flex-start", marginBottom:"0.75rem" }}><span>{icon}</span><span style={{ color:T.text }}>{msg}</span></div>;
  const flagBadge = (label, color) => <span style={{ background:`${color}20`, color, border:`1px solid ${color}40`, padding:"1px 7px", borderRadius:"99px", fontSize:`${fs-3}px`, fontWeight:"600", marginLeft:"5px" }}>{label}</span>;

  // ── Notification ──────────────────────────────────────────────────────────
  const notify = (msg, type="success") => { setNotification({msg,type}); setTimeout(()=>setNotification(null),4500); };

  // ── API — all ISC calls route through /.netlify/functions/isc-proxy ─────────
  // Browsers block direct cross-origin calls to ISC (CORS). The Netlify Function
  // runs server-side where CORS doesn't apply. Pattern borrowed from MIH v7:
  //   1. getToken()  → proxy fetches a bearer token, client caches it
  //   2. apiCall()   → proxy forwards the signed request using the cached token
  //   3. testConnectivity() → proxy runs a full 7-step validation and returns
  //      structured pass/fail results per step.

  const PROXY = "/.netlify/functions/isc-proxy";

  const PROXY_HINT =
    "Netlify Function proxy not reachable. " +
    "Ensure: (1) netlify/functions/isc-proxy.js is in your deployment folder, " +
    "(2) netlify.toml includes functions = \"netlify/functions\", " +
    "(3) the app is deployed to Netlify (or run 'npx netlify dev' locally). " +
    "The proxy is required — browsers block direct ISC API calls (CORS).";

  // Derive ISC API base from tenant UI URL
  // https://org.identitynow.com → https://org.api.identitynow.com
  const deriveApiBase = (url) => {
    if (!url) return "";
    try {
      const host = new URL(url).hostname;
      if (host.endsWith(".identitynow.com"))
        return `https://${host.replace(".identitynow.com","")}.api.identitynow.com`;
      if (host.endsWith(".identitynow-demo.com"))
        return `https://${host.replace(".identitynow-demo.com","")}.api.identitynow-demo.com`;
    } catch {}
    return url.replace(/\/+$/, "");
  };

  // Resolve the API base — explicit apiEndpoint takes priority, then derive from tenantUrl
  const getApiBase = (cfg=config) => {
    const ep = (cfg.apiEndpoint || "").replace(/\/+$/, "");
    if (ep) return ep;
    return deriveApiBase(cfg.tenantUrl);
  };

  // Ping the proxy to confirm it's deployed
  const checkProxy = async () => {
    try {
      const r = await fetch(PROXY, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"ping" }),
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) return false;
      return (await r.json()).ok === true;
    } catch { return false; }
  };

  // Get a bearer token via proxy. Cached client-side until near-expiry.
  const getToken = async (cfg=config) => {
    if (token && Date.now() < tokenExpiry) return token;
    if (!cfg.clientId)     throw new Error("Client ID is required.");
    if (!cfg.clientSecret) throw new Error("Client Secret is required.");
    const apiBase = getApiBase(cfg);
    if (!apiBase)          throw new Error("No API Endpoint configured — enter it in Configuration.");
    let res;
    try {
      res = await fetch(PROXY, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"token", tenantUrl:apiBase, clientId:cfg.clientId, clientSecret:cfg.clientSecret }),
      });
    } catch { throw new Error(PROXY_HINT); }
    if (!res.ok) {
      const t = await res.text();
      const parsed = (() => { try { return JSON.parse(t); } catch { return {}; } })();
      const err = parsed.error || t;
      if (res.status === 503 || res.status === 502) throw new Error(PROXY_HINT);
      if (res.status === 401) throw new Error("Invalid Client ID or Client Secret — check credentials (401).");
      if (res.status === 400) throw new Error(`Bad request (400): ${err}`);
      throw new Error(`Token request failed (${res.status}): ${err}`);
    }
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    setToken(d.access_token);
    setTokenExpiry(Date.now() + ((d.expires_in || 3600) - 60) * 1000);
    return d.access_token;
  };

  // Forward an ISC REST call through the proxy using the cached bearer token
  const apiCall = async (method, path, body, cfg=config) => {
    const tok     = await getToken(cfg);
    const apiBase = getApiBase(cfg);
    let res;
    try {
      res = await fetch(PROXY, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"api", apiBase, bearerToken:tok, method, path, requestBody:body }),
      });
    } catch { throw new Error(PROXY_HINT); }
    // Token expired mid-session — clear cache and let caller retry
    if (res.status === 401) { setToken(null); setTokenExpiry(0); throw new Error("Session token expired — please retry."); }
    if (!res.ok) { const t=await res.text(); throw new Error(`API ${res.status}: ${t}`); }
    return res.status === 204 ? null : res.json();
  };

  const patchCall = async (path, ops, cfg=config) => {
    const tok     = await getToken(cfg);
    const apiBase = getApiBase(cfg);
    let res;
    try {
      res = await fetch(PROXY, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"api", apiBase, bearerToken:tok, method:"PATCH", path, requestBody:ops }),
      });
    } catch { throw new Error(PROXY_HINT); }
    if (!res.ok) { const t=await res.text(); throw new Error(`PATCH ${res.status}: ${t}`); }
    return res.status === 204 ? null : res.json();
  };

  // Full connectivity test — checks proxy, then runs 7-step ISC validation
  const testConnectivity = async () => {
    setConnectStatus("testing"); setConnectMsg("Checking proxy…");
    const apiBase = getApiBase(configDraft);
    if (!apiBase)                  { setConnectStatus("error"); setConnectMsg("No API Endpoint configured."); return; }
    if (!configDraft.clientId)     { setConnectStatus("error"); setConnectMsg("Client ID is required."); return; }
    if (!configDraft.clientSecret) { setConnectStatus("error"); setConnectMsg("Client Secret is required."); return; }

    const proxyOk = await checkProxy();
    if (!proxyOk) { setConnectStatus("error"); setConnectMsg(PROXY_HINT); return; }

    setConnectMsg("Proxy ✓ — validating ISC tenant…");
    try {
      const res = await fetch(PROXY, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"validate", tenantUrl:apiBase, clientId:configDraft.clientId, clientSecret:configDraft.clientSecret }),
      });
      const result = await res.json();
      if (result.success) {
        const td = result.tenantData || {};
        setConnectStatus("success");
        setConnectMsg(
          `Connected ✓  |  Org: ${td.orgName || apiBase}  |  Pod: ${td.pod || "—"}  |  ` +
          `${(td.identityCount || 0).toLocaleString()} identities  |  ${td.vaCount || 0} VA clusters`
        );
        // Force a fresh token on the next real operation
        setToken(null); setTokenExpiry(0);
      } else {
        setConnectStatus("error");
        setConnectMsg(result.error || "Validation failed — check credentials and API endpoint.");
      }
    } catch(e) { setConnectStatus("error"); setConnectMsg(e.message); }
  };

  const loadIdentities = async () => {
    setListLoading(true);
    try { const qs=config.sourceId?`?sourceId=${config.sourceId}&limit=250`:"?limit=250"; const d=await apiCall("GET",`/v2026/non-employees${qs}`); setIdentities(Array.isArray(d)?d:[]); }
    catch(e) { notify(e.message,"error"); } setListLoading(false);
  };
  const loadApprovals = async () => {
    setListLoading(true);
    try { const d=await apiCall("GET","/v2026/non-employee-approvals?limit=50"); setApprovals(Array.isArray(d)?d:[]); }
    catch(e) { notify(e.message,"error"); } setListLoading(false);
  };
  const loadSummary = async () => {
    if (!config.sourceId||!config.tenantUrl) return;
    try { const d=await apiCall("GET",`/v2026/non-employee-requests/summary/${config.sourceId}`); setSummary(d); } catch(_){}
  };

  // Sources
  const loadSources = async () => {
    setSourcesLoading(true);
    try { const d=await apiCall("GET","/v2026/sources?limit=250"); setSources(Array.isArray(d)?d:[]); }
    catch(e) { notify(e.message,"error"); } setSourcesLoading(false);
  };
  const loadSourceSchema = async (srcId) => {
    setSchemaLoading(true);
    try { const d=await apiCall("GET",`/v2026/sources/${srcId}/schemas`); setSourceSchemas(Array.isArray(d)?d:[]); }
    catch(e) { notify(e.message,"error"); } setSchemaLoading(false);
  };
  const loadSourceAccounts = async (srcId) => {
    const sid = srcId || config.sourceId;
    if (!sid) return [];
    setAcctLoading(true);
    try {
      const d=await apiCall("GET",`/v2026/accounts?filters=sourceId eq "${sid}"&limit=1000`);
      const accts = Array.isArray(d)?d:[];
      setSourceAccounts(accts);
      // build picklist cache
      const cache={};
      accts.forEach(a => { if (!a.attributes) return; Object.entries(a.attributes).forEach(([k,v]) => { if (!cache[k]) cache[k]=[]; if (v && !cache[k].includes(String(v))) cache[k].push(String(v)); }); });
      setPicklistCache(cache);
      // compute next unique ID
      if (uidField) {
        const vals = accts.map(a=>a.attributes?.[uidField]).filter(Boolean);
        const seedFmt = sfc[uidField]?.uniqueIdSeedFormat || "100000";
        const next = parseNextId(vals, seedFmt);
        setNextUniqueId(next);
        setForm(f=>({...f, schemaData:{...f.schemaData, [uidField]:next}}));
      }
      setAcctLoading(false);
      return accts;
    } catch(e) { notify(e.message,"error"); setAcctLoading(false); return []; }
  };

  const checkDuplicates = async () => {
    if (!config.sourceId || dupeFields.length===0) return;
    const vals = dupeFields.map(f=>form.schemaData[f]).filter(Boolean);
    if (vals.length===0) return;
    setDupeChecking(true); setDupeWarning(null);
    try {
      const filterParts = dupeFields.map(f=>`attributes.${f} eq "${form.schemaData[f]||""}"`).filter((_,i)=>form.schemaData[dupeFields[i]]);
      const q = filterParts.join(" and ");
      const d = await apiCall("GET",`/v2026/accounts?filters=sourceId eq "${config.sourceId}" and ${q}`);
      setDupeWarning(Array.isArray(d)?d:[]);
    } catch(e) { setDupeWarning([]); } setDupeChecking(false);
  };

  const createSource = async () => {
    if (!newSrc.name.trim()||!newSrc.owner.trim()) { notify("Name and owner ID are required","error"); return; }
    setLoading(true);
    try {
      const body = {
        name: newSrc.name, description: newSrc.description,
        owner: { type:"IDENTITY", id:newSrc.owner },
        connectorName:"DelimitedFile", connector:"delimited-file", type:"DelimitedFile",
        connectorAttributes:{}, deleteThreshold:10, authoritative:false,
        schemas:[{ name:"account", nativeObjectType:"User",
          attributes: newSrc.schemaAttrs.map(a=>({ name:a.name, type:a.type, isMultiValued:false, readOnly:false, managed:true, minable:false, description:a.description||"" }))
        }]
      };
      const created = await apiCall("POST","/v2026/sources",body);
      notify(`Source "${created.name}" created! ID: ${created.id}`);
      setCreateSrcMode(false);
      setConfig(c=>({...c, sourceId:created.id}));
      setConfigDraft(c=>({...c, sourceId:created.id}));
      await loadSources();
    } catch(e) { notify(e.message,"error"); } setLoading(false);
  };

  // Termination
  const searchIdentitiesForTermination = async () => {
    if (!termSearch.trim()) return;
    setTermSearching(true); setTermResults([]);
    try {
      const f = encodeURIComponent(`name co "${termSearch}" or attributes.mail co "${termSearch}"`);
      const d = await apiCall("GET",`/v2026/identities?filters=${f}&limit=20`);
      setTermResults(Array.isArray(d)?d:[]);
    } catch(e) { notify(e.message,"error"); } setTermSearching(false);
  };

  const executeTermination = async () => {
    if (!termTarget) return;
    setTerminating(true); setTermProgress([]); setTermDone(false);
    const log = (msg,status="ok") => setTermProgress(p=>[...p,{msg,status,ts:new Date().toLocaleTimeString()}]);

    try {
      log("Retrieving identity accounts…");
      const accounts = await apiCall("GET",`/v2026/accounts?filters=identityId eq "${termTarget.id}"&limit=100`);
      const acctList = Array.isArray(accounts)?accounts:[];

      if (termForm.type==="immediate") {
        for (const acct of acctList) {
          try {
            await patchCall(`/v2026/accounts/${acct.id}`,[{op:"replace",path:"/disabled",value:true}]);
            log(`Disabled account: ${acct.name} (${acct.sourceName||acct.sourceId})`);
          } catch(e) { log(`Failed to disable ${acct.name}: ${e.message}`,"error"); }
        }
      }

      // Update NELM record end date if applicable
      try {
        const neRes = await apiCall("GET",`/v2026/non-employees?limit=250`);
        const neList = Array.isArray(neRes)?neRes:[];
        const match = neList.find(ne=>ne.email===termTarget.attributes?.mail||ne.email===termTarget.email);
        if (match) {
          const endDate = termForm.type==="scheduled"?termForm.schedDate:new Date().toISOString().slice(0,10);
          await apiCall("PUT",`/v2026/non-employees/${match.id}`,{
            ...match, endDate:new Date(endDate).toISOString(),
            data:{ ...(match.data||{}), legalHold:termForm.legalHold, terminationReason:termForm.reason, terminationNotes:termForm.notes }
          });
          log("Updated non-employee record with termination date");
        }
      } catch(e) { log(`Note: NELM update skipped (${e.message})`,"warn"); }

      if (termForm.legalHold) log("⚖ Legal hold flag applied — record preserved for compliance");
      log("✓ Termination workflow complete","ok");
      setTermDone(true);
    } catch(e) { log(`Critical error: ${e.message}`,"error"); }
    setTerminating(false);
  };

  useEffect(() => {
    if (activeTab==="manage")         loadIdentities();
    else if (activeTab==="approvals") loadApprovals();
    else if (activeTab==="dashboard") loadSummary();
    else if (activeTab==="sources")   loadSources();
  }, [activeTab]);

  // When sourceId changes and we have it, load schema
  useEffect(() => {
    if (config.sourceId) { loadSourceSchema(config.sourceId); loadSourceAccounts(config.sourceId); }
  }, [config.sourceId]);

  // Form
  const validateForm = () => {
    const e={};
    if (!form.firstName.trim())  e.firstName="Required";
    if (!form.lastName.trim())   e.lastName="Required";
    if (!form.email.trim())      e.email="Required";
    else if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(form.email)) e.email="Invalid email format";
    if (form.phone&&!/^\+?[\d\s\-(). ]{7,20}$/.test(form.phone))   e.phone="Invalid phone format";
    if (!form.startDate) e.startDate="Required";
    if (!form.endDate)   e.endDate="Required";
    if (form.startDate&&form.endDate&&form.endDate<form.startDate) e.endDate="Must be after start date";
    if (!form.manager.trim()) e.manager="Required";
    // Schema field validation
    schemaAttrs.forEach(attr => {
      const cfg = sfc[attr.name] || {};
      if (cfg.required && !form.schemaData[attr.name]) e[`sf_${attr.name}`]="Required";
      else {
        const valErr = validateField(form.schemaData[attr.name], cfg.validationType||"none");
        if (valErr) e[`sf_${attr.name}`]=valErr;
      }
    });
    config.customAttributes.forEach(a => { if (a.required&&!form.customData[a.key]) e[`ca_${a.key}`]="Required"; });
    setFormErrors(e); return Object.keys(e).length===0;
  };

  const buildPayload = () => {
    const data = {};
    if (form.contractingOrg) data.contractingOrganization=form.contractingOrg;
    if (form.isConversion)   data.isConversion=true;
    if (form.isLegalHold)    data.legalHold=true;
    schemaAttrs.forEach(a => { if (form.schemaData[a.name]) data[a.name]=form.schemaData[a.name]; });
    config.customAttributes.forEach(a => { if (form.customData[a.key]) data[a.key]=form.customData[a.key]; });
    return { accountName:form.accountName||`${form.firstName.toLowerCase()}.${form.lastName.toLowerCase()}`, firstName:form.firstName, lastName:form.lastName, email:form.email, phone:form.phone||undefined, manager:{id:form.manager}, sourceId:config.sourceId, startDate:form.startDate?new Date(form.startDate).toISOString():undefined, endDate:form.endDate?new Date(form.endDate).toISOString():undefined, data };
  };

  const handleSubmit = async () => {
    if (!validateForm()) { setPreviewOpen(false); return; }
    if (dupeWarning && dupeWarning.length>0) { notify("Resolve duplicate warnings before submitting","error"); return; }
    setLoading(true);
    try { await apiCall("POST","/v2026/non-employees",buildPayload()); notify("Non-employee identity created!"); setForm(EMPTY_FORM); setFormErrors({}); setPreviewOpen(false); setDupeWarning(null); }
    catch(e) { notify(e.message,"error"); } setLoading(false);
  };
  const handleUpdate = async () => {
    setLoading(true);
    try { await apiCall("PUT",`/v2026/non-employees/${editRecord.id}`,{ accountName:editRecord.accountName, firstName:editRecord.firstName, lastName:editRecord.lastName, email:editRecord.email, phone:editRecord.phone, manager:editRecord.manager, sourceId:config.sourceId, startDate:editRecord.startDate, endDate:editRecord.endDate, data:editRecord.data||{} }); notify("Record updated."); setEditOpen(false); loadIdentities(); }
    catch(e) { notify(e.message,"error"); } setLoading(false);
  };
  const handleDelete = async (id) => {
    // Check legal hold
    const rec = identities.find(i=>i.id===id);
    if (rec?.data?.legalHold) { notify("Cannot delete — this record has an active legal hold","error"); setDeleteTarget(null); return; }
    setLoading(true);
    try { await apiCall("DELETE",`/v2026/non-employees/${id}`); notify("Record deleted."); setDeleteTarget(null); loadIdentities(); }
    catch(e) { notify(e.message,"error"); } setLoading(false);
  };
  const handleApprove = async (id) => {
    setLoading(true);
    try { await apiCall("POST",`/v2026/non-employee-approvals/${id}/approve`,{comment:"Approved via Non-Employee Hub"}); notify("Approved!"); loadApprovals(); }
    catch(e) { notify(e.message,"error"); } setLoading(false);
  };
  const handleReject = async () => {
    setLoading(true);
    try { await apiCall("POST",`/v2026/non-employee-approvals/${rejectTarget}/reject`,{comment:rejectComment||"Rejected via Non-Employee Hub"}); notify("Rejected."); setRejectTarget(null); setRejectComment(""); loadApprovals(); }
    catch(e) { notify(e.message,"error"); } setLoading(false);
  };
  const saveConfig = () => { setConfig(configDraft); setToken(null); setTokenExpiry(0); notify("Configuration saved."); };
  const addCustomAttr = () => { if (configDraft.customAttributes.length>=10) return; setConfigDraft(v=>({...v,customAttributes:[...v.customAttributes,{id:Date.now(),label:"",key:"",required:false,type:"text",options:""}]})); };
  const updAttr = (id,field,val) => setConfigDraft(v=>({...v,customAttributes:v.customAttributes.map(a=>a.id===id?{...a,[field]:val}:a)}));
  const filteredIdentities = identities.filter(i=>!searchTerm||`${i.firstName} ${i.lastName} ${i.email} ${i.accountName}`.toLowerCase().includes(searchTerm.toLowerCase()));

  const updateSchemaFieldConfig = (attrName, field, value) => {
    setConfig(c=>({ ...c, schemaFieldConfig:{ ...c.schemaFieldConfig, [attrName]:{ ...(DEFAULT_SCHEMA_FIELD), ...(c.schemaFieldConfig[attrName]||{}), [field]:value } } }));
    // If setting isUniqueId true, unset all others
    if (field==="isUniqueId"&&value===true) {
      setConfig(c=>{ const nc={...c.schemaFieldConfig}; Object.keys(nc).forEach(k=>{ if(k!==attrName) nc[k]={...nc[k],isUniqueId:false}; }); return {...c,schemaFieldConfig:nc}; });
    }
  };

  const isDisconnectedSource = (src) => DISCONNECTED_CONNECTORS.some(cn=>src.connectorName?.toLowerCase().includes(cn.toLowerCase())||src.connector?.toLowerCase().includes(cn.toLowerCase())||src.type?.toLowerCase().includes("delimited")||src.type?.toLowerCase().includes("manual"));

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE RENDERERS — called as renderX(), never <ComponentName />
  // ─────────────────────────────────────────────────────────────────────────

  const renderDashboard = () => (
    <div>
      <div style={{ marginBottom:"1.25rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <h2 style={{ margin:0, fontSize:`${fs+7}px`, fontWeight:"600", color:T.text }}>{config.branding.companyName} — Non-Employee Hub</h2>
          <div style={{ fontSize:`${fs}px`, color:T.textMuted, marginTop:"3px" }}>SailPoint Identity Security Cloud · Non-Employee Lifecycle Management</div>
        </div>
        <button style={btnP(false)} onClick={()=>setActiveTab("create")}>+ Create identity</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"0.75rem", marginBottom:"1.25rem" }}>
        {[
          {label:"Total identities", value:identities.length||summary?.total||0, icon:"👥", color:p},
          {label:"Pending approval",  value:summary?.pending||0,  icon:"⏳", color:"#D97706"},
          {label:"Approved",          value:summary?.approved||0, icon:"✓",  color:"#059669"},
          {label:"Rejected",          value:summary?.rejected||0, icon:"✗",  color:"#DC2626"},
        ].map(s=>(
          <div key={s.label} style={statCard}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ fontSize:`${fs-2}px`, fontWeight:"600", color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.5px" }}>{s.label}</div>
              <div style={{ fontSize:"18px" }}>{s.icon}</div>
            </div>
            <div style={{ fontSize:`${fs+15}px`, fontWeight:"700", color:s.color, marginTop:"6px" }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:"1rem" }}>
        <div style={card}>
          <div style={secHead}>Quick actions</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
            {[
              {label:"Create non-employee", sub:"Add a new non-employee identity",    tab:"create",      icon:"➕"},
              {label:"Manage identities",   sub:"View and edit all records",          tab:"manage",      icon:"🗂"},
              {label:"Review approvals",    sub:"Approve or reject pending requests", tab:"approvals",   icon:"✅"},
              {label:"Sources & schema",    sub:"Manage ISC sources and field config",tab:"sources",     icon:"🔌"},
              {label:"Emergency termination",sub:"Urgent off-boarding workflow",      tab:"termination", icon:"🚨"},
              {label:"Configuration",       sub:"Tenant connectivity & branding",     tab:"config",      icon:"⚙"},
            ].map(a=>(
              <div key={a.tab} onClick={()=>setActiveTab(a.tab)}
                style={{ padding:"0.85rem", border:`1px solid ${T.cardBorder}`, borderRadius:"8px", cursor:"pointer", background:T.quickHover, transition:"border 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=p} onMouseLeave={e=>e.currentTarget.style.borderColor=T.cardBorder}>
                <div style={{ fontSize:"18px", marginBottom:"5px" }}>{a.icon}</div>
                <div style={{ fontWeight:"600", fontSize:`${fs}px`, color:T.text, marginBottom:"2px" }}>{a.label}</div>
                <div style={{ fontSize:`${fs-2}px`, color:T.textMuted }}>{a.sub}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={card}>
          <div style={secHead}>System status</div>
          {[{label:"Tenant",value:config.tenantUrl||"Not configured"},{label:"Source ID",value:config.sourceId||"Not set"},{label:"Schema fields",value:schemaAttrs.length?`${schemaAttrs.length} attributes`:hasSchema?"Loaded":"Not loaded"},{label:"Client",value:config.clientName||"Not set"}].map(r=>(
            <div key={r.label} style={{ display:"flex", justifyContent:"space-between", fontSize:`${fs-1}px`, padding:"7px 0", borderBottom:`1px solid ${T.tblBorder}` }}>
              <span style={{ color:T.textMuted }}>{r.label}</span>
              <span style={{ color:T.text, fontWeight:"500", maxWidth:"150px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"right" }}>{r.value}</span>
            </div>
          ))}
          <div style={{ display:"flex", alignItems:"center", gap:"6px", marginTop:"0.75rem" }}>
            <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:config.tenantUrl?"#059669":"#9CA3AF" }}></div>
            <span style={{ fontSize:`${fs-1}px`, color:config.tenantUrl?T.connectOk:T.textFaint }}>{config.tenantUrl?"Configured":"Not configured"}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCreate = () => {
    const schemaFields = schemaAttrs.filter(a=>!(sfc[a.name]?.isConversionField)&&!(sfc[a.name]?.isLegalHoldField));
    const hasDupeFields = dupeFields.length > 0 && dupeFields.some(f=>form.schemaData[f]);
    return (
      <div>
        <h2 style={{ margin:"0 0 1.25rem", fontSize:`${fs+7}px`, fontWeight:"600", color:T.text }}>Create non-employee identity</h2>

        {/* Dupe warning */}
        {dupeWarning && dupeWarning.length>0 && (
          <div style={{ background:T.warnBg, border:`1px solid ${T.warnBorder}`, borderRadius:"8px", padding:"1rem", marginBottom:"1rem" }}>
            <div style={{ fontWeight:"600", color:"#92400E", marginBottom:"0.5rem" }}>⚠ Potential duplicates found ({dupeWarning.length})</div>
            {dupeWarning.slice(0,3).map(d=>(
              <div key={d.id} style={{ fontSize:`${fs-1}px`, color:T.text, padding:"4px 0", borderBottom:`1px solid ${T.warnBorder}40` }}>
                {d.attributes?.firstName||""} {d.attributes?.lastName||""} · {d.attributes?.email||d.name} · Account: {d.name}
              </div>
            ))}
            <div style={{ marginTop:"0.5rem", display:"flex", gap:"0.5rem" }}>
              <button style={btnDgr} onClick={()=>setDupeWarning(null)}>Dismiss &amp; continue</button>
              <button style={btnS(true)} onClick={checkDuplicates}>Re-check</button>
            </div>
          </div>
        )}
        {dupeWarning && dupeWarning.length===0 && infoBox(T.successBg,T.successBorder,"✓","No duplicates found based on configured matching criteria.")}

        <div style={card}>
          <div style={secHead}>{stepBadge(1,p)} Identity details</div>
          <div style={g2}>
            <FG label="First name" required err={formErrors.firstName}><input style={inp(formErrors.firstName)} value={form.firstName} placeholder="John" onChange={e=>{setForm(v=>({...v,firstName:e.target.value}));setFormErrors(v=>({...v,firstName:null}));}}/></FG>
            <FG label="Last name" required err={formErrors.lastName}><input style={inp(formErrors.lastName)} value={form.lastName} placeholder="Smith" onChange={e=>{setForm(v=>({...v,lastName:e.target.value}));setFormErrors(v=>({...v,lastName:null}));}}/></FG>
          </div>
          <div style={g2}>
            <FG label="Account name"><input style={inp(false)} value={form.accountName} placeholder="Auto-generated if blank" onChange={e=>setForm(v=>({...v,accountName:e.target.value}))}/></FG>
            <FG label="Contracting organization"><input style={inp(false)} value={form.contractingOrg} placeholder="Acme Consulting LLC" onChange={e=>setForm(v=>({...v,contractingOrg:e.target.value}))}/></FG>
          </div>
          <div style={g2}>
            <FG label="Email address" required err={formErrors.email}><input style={inp(formErrors.email)} type="email" value={form.email} placeholder="john.smith@contractor.com" onChange={e=>{setForm(v=>({...v,email:e.target.value}));setFormErrors(v=>({...v,email:null}));}}/></FG>
            <FG label="Phone number" err={formErrors.phone}><input style={inp(formErrors.phone)} value={form.phone} placeholder="+1 (555) 000-0000" onChange={e=>{setForm(v=>({...v,phone:e.target.value}));setFormErrors(v=>({...v,phone:null}));}}/></FG>
          </div>
          <FG label="Manager (SailPoint identity ID)" required err={formErrors.manager} hint="SailPoint internal identity ID of the non-employee's manager">
            <input style={inp(formErrors.manager)} value={form.manager} placeholder="e.g. 2c9180858082150f0180893dbaf44201" onChange={e=>{setForm(v=>({...v,manager:e.target.value}));setFormErrors(v=>({...v,manager:null}));}}/>
          </FG>
          <div style={g2}>
            <FG label="Start date" required err={formErrors.startDate}><input type="date" style={inp(formErrors.startDate)} value={form.startDate} onChange={e=>{setForm(v=>({...v,startDate:e.target.value}));setFormErrors(v=>({...v,startDate:null}));}}/></FG>
            <FG label="End date" required err={formErrors.endDate}><input type="date" style={inp(formErrors.endDate)} value={form.endDate} onChange={e=>{setForm(v=>({...v,endDate:e.target.value}));setFormErrors(v=>({...v,endDate:null}));}}/></FG>
          </div>
        </div>

        {/* Schema-driven fields from ISC source */}
        {hasSchema && schemaFields.length>0 && (
          <div style={card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
              <div style={secHead}>{stepBadge(2,acc)} Source attributes</div>
              {hasDupeFields && (
                <button style={btnS(true)} onClick={checkDuplicates} disabled={dupeChecking}>
                  {dupeChecking?"Checking…":"🔍 Check duplicates"}
                </button>
              )}
            </div>
            <div style={g2}>
              {schemaFields.map(attr => {
                const cfg = sfc[attr.name] || {};
                const label = cfg.label || attr.name;
                const err = formErrors[`sf_${attr.name}`];
                const isUid = cfg.isUniqueId;
                const vals = picklistCache[attr.name] || [];
                return (
                  <FG key={attr.name} label={label+(isUid?" (auto-ID)":"")} required={cfg.required} err={err}>
                    {cfg.isPicklist && vals.length>0 ? (
                      <div>
                        <select style={sel} value={form.schemaData[attr.name]||""} onChange={e=>setForm(v=>({...v,schemaData:{...v.schemaData,[attr.name]:e.target.value}}))}>
                          <option value="">— Select —</option>
                          {vals.map(v=><option key={v} value={v}>{v}</option>)}
                          {cfg.allowNewPicklistValues&&<option value="__new__">+ Enter new value…</option>}
                        </select>
                        {form.schemaData[attr.name]==="__new__"&&<input style={{...inp(false),marginTop:"6px"}} placeholder={`New ${label} value`} onChange={e=>setForm(v=>({...v,schemaData:{...v.schemaData,[attr.name]:e.target.value}}))}/>}
                      </div>
                    ) : attr.type==="DATE" ? (
                      <input type="date" style={inp(err)} value={form.schemaData[attr.name]||""} onChange={e=>setForm(v=>({...v,schemaData:{...v.schemaData,[attr.name]:e.target.value}}))} readOnly={cfg.isImmutable&&!!form.schemaData[attr.name]}/>
                    ) : attr.type==="BOOLEAN" ? (
                      <div style={{ display:"flex", alignItems:"center", gap:"8px", paddingTop:"8px" }}>
                        <input type="checkbox" checked={!!form.schemaData[attr.name]} onChange={e=>setForm(v=>({...v,schemaData:{...v.schemaData,[attr.name]:e.target.checked}}))}/>
                        <span style={{ fontSize:`${fs-1}px`, color:T.textMuted }}>{label}</span>
                      </div>
                    ) : (
                      <input type={attr.type==="INT"?"number":"text"} style={{...inp(err), background:isUid?`${p}08`:T.inputBg}} value={form.schemaData[attr.name]||""}
                        readOnly={isUid&&cfg.isImmutable}
                        placeholder={isUid?`Auto: ${nextUniqueId||"loading…"}`:label}
                        onChange={e=>setForm(v=>({...v,schemaData:{...v.schemaData,[attr.name]:e.target.value}}))}/>
                    )}
                    {cfg.isDupeField && <div style={{ fontSize:`${fs-3}px`, color:p, marginTop:"2px" }}>◆ Used for duplicate detection</div>}
                  </FG>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom attributes (config-defined, shown only if no schema) */}
        {!hasSchema && config.customAttributes.length>0 && (
          <div style={card}>
            <div style={secHead}>{stepBadge(2,acc)} Additional attributes</div>
            <div style={g2}>
              {config.customAttributes.map(attr=>(
                <FG key={attr.id} label={attr.label} required={attr.required} err={formErrors[`ca_${attr.key}`]}>
                  {attr.type==="select"
                    ?<select style={sel} value={form.customData[attr.key]||""} onChange={e=>setForm(v=>({...v,customData:{...v.customData,[attr.key]:e.target.value}}))}>
                        <option value="">— Select —</option>
                        {(attr.options||"").split(",").map(o=>o.trim()).filter(Boolean).map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    :<input type={attr.type} style={inp(formErrors[`ca_${attr.key}`])} value={form.customData[attr.key]||""} placeholder={attr.label} onChange={e=>setForm(v=>({...v,customData:{...v.customData,[attr.key]:e.target.value}}))}/>}
                </FG>
              ))}
            </div>
          </div>
        )}

        {/* Status flags */}
        <div style={card}>
          <div style={secHead}>Status flags</div>
          <div style={{ display:"flex", gap:"2rem", flexWrap:"wrap" }}>
            <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer" }}>
              <input type="checkbox" checked={form.isConversion} onChange={e=>setForm(v=>({...v,isConversion:e.target.checked}))}/>
              <div>
                <div style={{ fontSize:`${fs}px`, fontWeight:"500", color:T.text }}>🔄 Conversion to employee</div>
                <div style={{ fontSize:`${fs-2}px`, color:T.textMuted }}>This non-employee is converting to a full-time employee</div>
              </div>
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer" }}>
              <input type="checkbox" checked={form.isLegalHold} onChange={e=>setForm(v=>({...v,isLegalHold:e.target.checked}))}/>
              <div>
                <div style={{ fontSize:`${fs}px`, fontWeight:"500", color:T.text }}>⚖ Legal hold</div>
                <div style={{ fontSize:`${fs-2}px`, color:T.textMuted }}>Preserve record — cannot be deleted while hold is active</div>
              </div>
            </label>
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:"0.75rem", paddingBottom:"1rem" }}>
          <button style={btnS(false)} onClick={()=>setPreviewOpen(true)}>Preview JSON</button>
          <button style={btnP(false)} onClick={handleSubmit} disabled={loading}>{loading?"Submitting…":"Submit to ISC"}</button>
        </div>
      </div>
    );
  };

  const renderManage = () => (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
        <h2 style={{ margin:0, fontSize:`${fs+7}px`, fontWeight:"600", color:T.text }}>Non-employee identities</h2>
        <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
          <input style={{...inp(false),width:"220px"}} placeholder="Search…" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
          <button style={btnS(false)} onClick={loadIdentities}>{listLoading?"Loading…":"Refresh"}</button>
          <button style={btnP(false)} onClick={()=>setActiveTab("create")}>+ Create</button>
        </div>
      </div>
      <div style={card}>
        {listLoading?<div style={{textAlign:"center",padding:"3rem",color:T.textMuted}}>Loading identities…</div>
        :filteredIdentities.length===0?<div style={{textAlign:"center",padding:"3rem"}}><div style={{fontSize:"32px",marginBottom:"0.75rem"}}>👥</div><div style={{color:T.textMuted}}>No non-employee records found.</div></div>
        :(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Identity","Email","Start","End","Flags","Actions"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {filteredIdentities.map(rec=>(
                  <tr key={rec.id} onMouseEnter={e=>e.currentTarget.style.background=T.tblRowHover} onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={td}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                        <div style={{width:"32px",height:"32px",borderRadius:"50%",background:`${p}20`,color:p,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:"700",flexShrink:0}}>{initials(rec.firstName,rec.lastName)}</div>
                        <div><div style={{fontWeight:"500",color:T.text}}>{rec.firstName} {rec.lastName}</div><div style={{fontSize:`${fs-2}px`,color:T.textFaint}}>{rec.accountName}</div></div>
                      </div>
                    </td>
                    <td style={td}>{rec.email}</td>
                    <td style={td}>{fmtDate(rec.startDate)}</td>
                    <td style={td}>{fmtDate(rec.endDate)}</td>
                    <td style={td}>
                      {rec.data?.legalHold   && flagBadge("LEGAL HOLD","#7C3AED")}
                      {rec.data?.isConversion && flagBadge("CONVERSION","#0369A1")}
                    </td>
                    <td style={td}>
                      <div style={{display:"flex",gap:"5px"}}>
                        <button style={btnS(true)} onClick={()=>{setEditRecord({...rec,startDate:rec.startDate?.slice(0,10),endDate:rec.endDate?.slice(0,10)});setEditOpen(true);}}>Edit</button>
                        <button style={btnDgr} onClick={()=>setDeleteTarget(rec)} disabled={!!rec.data?.legalHold} title={rec.data?.legalHold?"Legal hold — cannot delete":""}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderApprovals = () => (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
        <h2 style={{margin:0,fontSize:`${fs+7}px`,fontWeight:"600",color:T.text}}>Approval requests</h2>
        <button style={btnS(false)} onClick={loadApprovals}>{listLoading?"Loading…":"Refresh"}</button>
      </div>
      <div style={card}>
        {listLoading?<div style={{textAlign:"center",padding:"3rem",color:T.textMuted}}>Loading…</div>
        :approvals.length===0?<div style={{textAlign:"center",padding:"3rem"}}><div style={{fontSize:"32px",marginBottom:"0.75rem"}}>✅</div><div style={{color:T.textMuted}}>No approval requests found.</div></div>
        :(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Subject","Requester","Created","Status","Actions"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {approvals.map(a=>{
                const status=a.approvalStatus||"PENDING";
                const isPending=!a.approvalStatus||a.approvalStatus==="PENDING";
                return (
                  <tr key={a.id} onMouseEnter={e=>e.currentTarget.style.background=T.tblRowHover} onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={td}><div style={{fontWeight:"500",color:T.text}}>{a.nonEmployee?.firstName} {a.nonEmployee?.lastName}</div><div style={{fontSize:`${fs-2}px`,color:T.textFaint}}>{a.nonEmployee?.email}</div></td>
                    <td style={td}>{a.requester?.name||"—"}</td>
                    <td style={td}>{fmtDate(a.created)}</td>
                    <td style={td}><span style={badge(status)}>{status}</span></td>
                    <td style={td}>{isPending?<div style={{display:"flex",gap:"5px"}}><button style={btnApp} onClick={()=>handleApprove(a.id)} disabled={loading}>Approve</button><button style={btnDgr} onClick={()=>setRejectTarget(a.id)} disabled={loading}>Reject</button></div>:<span style={{fontSize:`${fs-2}px`,color:T.textFaint}}>Completed</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderSources = () => {
    const displaySources = showAllSources ? sources : sources.filter(isDisconnectedSource);
    const activeSrc = sources.find(s=>s.id===config.sourceId);
    return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
          <h2 style={{margin:0,fontSize:`${fs+7}px`,fontWeight:"600",color:T.text}}>Sources &amp; schema management</h2>
          <div style={{display:"flex",gap:"0.5rem"}}>
            <button style={btnS(false)} onClick={()=>setCreateSrcMode(true)}>+ Create new source</button>
            <button style={btnP(false)} onClick={loadSources}>{sourcesLoading?"Loading…":"Refresh sources"}</button>
          </div>
        </div>

        {activeSrc && (
          <div style={{...card, border:`2px solid ${p}`, marginBottom:"1rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontWeight:"600",color:p,fontSize:`${fs+1}px`}}>Active source: {activeSrc.name}</div><div style={{fontSize:`${fs-1}px`,color:T.textMuted}}>ID: {activeSrc.id} · {activeSrc.connectorName||activeSrc.type} · {schemaAttrs.length} schema attributes</div></div>
              <button style={btnS(true)} onClick={()=>loadSourceAccounts()}>Load accounts &amp; compute IDs</button>
            </div>
            {acctLoading && <div style={{marginTop:"0.5rem",fontSize:`${fs-1}px`,color:T.textMuted}}>Loading accounts…</div>}
            {sourceAccounts.length>0 && <div style={{marginTop:"0.5rem",fontSize:`${fs-1}px`,color:T.connectOk}}>✓ {sourceAccounts.length} accounts loaded{uidField&&nextUniqueId?` · Next ${uidField}: ${nextUniqueId}`:""}</div>}
          </div>
        )}

        <div style={{display:"flex",gap:"8px",marginBottom:"1rem",flexWrap:"wrap"}}>
          {[["browse","Browse & select"],["schema","Schema & field config"]].map(([k,label])=>(
            <button key={k} style={pillTab(sourceSubTab===k)} onClick={()=>setSourceSubTab(k)}>{label}</button>
          ))}
          <label style={{display:"flex",alignItems:"center",gap:"6px",fontSize:`${fs-1}px`,color:T.textMuted,marginLeft:"0.5rem",cursor:"pointer"}}>
            <input type="checkbox" checked={showAllSources} onChange={e=>setShowAllSources(e.target.checked)}/>
            Show all sources (not just disconnected)
          </label>
        </div>

        {sourceSubTab==="browse" && (
          <div style={card}>
            {sourcesLoading?<div style={{textAlign:"center",padding:"3rem",color:T.textMuted}}>Loading sources from ISC…</div>
            :displaySources.length===0?<div style={{textAlign:"center",padding:"3rem"}}><div style={{fontSize:"28px",marginBottom:"0.5rem"}}>🔌</div><div style={{color:T.textMuted}}>{sources.length===0?"No sources loaded yet. Click Refresh.":"No disconnected sources found. Enable 'Show all sources' to see all."}</div></div>
            :(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["Source name","Connector","Owner","Status","Actions"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {displaySources.map(src=>(
                    <tr key={src.id} onMouseEnter={e=>e.currentTarget.style.background=T.tblRowHover} onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <td style={td}>
                        <div style={{fontWeight:"500",color:T.text}}>{src.name}{src.id===config.sourceId&&<span style={{...badge("ACTIVE"),marginLeft:"8px"}}>Active</span>}</div>
                        <div style={{fontSize:`${fs-2}px`,color:T.textFaint}}>ID: {src.id}</div>
                      </td>
                      <td style={td}><span style={{fontSize:`${fs-1}px`}}>{src.connectorName||src.connector||src.type||"—"}</span></td>
                      <td style={td}>{src.owner?.name||"—"}</td>
                      <td style={td}><span style={{...badge(src.healthy?"APPROVED":"EXPIRED")}}>{src.status||"Unknown"}</span></td>
                      <td style={td}>
                        <div style={{display:"flex",gap:"5px"}}>
                          <button style={btnP(true)} onClick={async()=>{setConfig(c=>({...c,sourceId:src.id}));setConfigDraft(c=>({...c,sourceId:src.id}));await loadSourceSchema(src.id);setSourceSubTab("schema");notify(`Source "${src.name}" selected`);}}>Select</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {sourceSubTab==="schema" && (
          <div>
            {!hasSchema?<div style={{...card,textAlign:"center",padding:"3rem"}}><div style={{fontSize:"28px",marginBottom:"0.5rem"}}>📋</div><div style={{color:T.textMuted}}>No schema loaded. Select a source from the Browse tab first.</div></div>:(
              <div>
                {schemaLoading && <div style={{textAlign:"center",padding:"2rem",color:T.textMuted}}>Loading schema…</div>}
                <div style={{...card, marginBottom:"0.75rem", padding:"1rem 1.25rem", background:T.attrBg}}>
                  <div style={{fontSize:`${fs-1}px`,color:T.textMuted,marginBottom:"4px"}}>Duplicate detection criteria</div>
                  <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                    {schemaAttrs.map(a=>(
                      <label key={a.name} style={{display:"flex",alignItems:"center",gap:"5px",cursor:"pointer",fontSize:`${fs-1}px`}}>
                        <input type="checkbox" checked={!!(sfc[a.name]?.isDupeField)} onChange={e=>updateSchemaFieldConfig(a.name,"isDupeField",e.target.checked)}/>
                        {sfc[a.name]?.label||a.name}
                      </label>
                    ))}
                  </div>
                  {dupeFields.length>0 && <div style={{fontSize:`${fs-2}px`,color:p,marginTop:"6px"}}>Active dupe fields: {dupeFields.join(", ")}</div>}
                </div>

                {schemaAttrs.map(attr=>{
                  const cfg = sfc[attr.name]||DEFAULT_SCHEMA_FIELD;
                  const isOpen = expandedField===attr.name;
                  return (
                    <div key={attr.name} style={{background:T.cardBg,border:`1px solid ${T.cardBorder}`,borderRadius:"8px",marginBottom:"0.5rem",overflow:"hidden"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.75rem 1rem",cursor:"pointer"}} onClick={()=>setExpandedField(isOpen?null:attr.name)}>
                        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                          <div style={{fontWeight:"500",color:T.text,fontSize:`${fs}px`}}>{cfg.label||attr.name}</div>
                          <div style={{fontSize:`${fs-2}px`,color:T.textFaint,fontFamily:"monospace"}}>{attr.name}</div>
                          <span style={{fontSize:`${fs-2}px`,background:T.attrBg,border:`1px solid ${T.cardBorder}`,borderRadius:"4px",padding:"1px 6px",color:T.textMuted}}>{attr.type}</span>
                          {cfg.isUniqueId    && flagBadge("UID","#0369A1")}
                          {cfg.isDupeField   && flagBadge("DUPE","#7C3AED")}
                          {cfg.isPicklist    && flagBadge("PICKLIST","#059669")}
                          {cfg.required      && flagBadge("REQ","#DC2626")}
                          {cfg.isLegalHoldField && flagBadge("LEGAL HOLD","#7C3AED")}
                          {cfg.isConversionField && flagBadge("CONVERSION","#0369A1")}
                        </div>
                        <span style={{color:T.textFaint,fontSize:"16px"}}>{isOpen?"▲":"▼"}</span>
                      </div>
                      {isOpen && (
                        <div style={{borderTop:`1px solid ${T.cardBorder}`,padding:"1rem",background:T.attrBg}}>
                          <div style={g2}>
                            <FG label="Display label"><input style={inp(false)} value={cfg.label||""} placeholder={attr.name} onChange={e=>updateSchemaFieldConfig(attr.name,"label",e.target.value)}/></FG>
                            <FG label="Validation rule">
                              <select style={sel} value={cfg.validationType||"none"} onChange={e=>updateSchemaFieldConfig(attr.name,"validationType",e.target.value)}>
                                {VALID_TYPES.map(v=><option key={v} value={v}>{VALID_LABELS[v]}</option>)}
                              </select>
                            </FG>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"0.75rem",marginBottom:"0.75rem"}}>
                            {[["required","Required"],["isPicklist","Picklist"],["allowNewPicklistValues","Allow new picklist values"],["isUniqueId","Unique identifier"],["isImmutable","Immutable (read-only after creation)"],["isConversionField","Conversion flag field"],["isLegalHoldField","Legal hold flag field"]].map(([field,label])=>(
                              <label key={field} style={{display:"flex",alignItems:"flex-start",gap:"6px",cursor:"pointer",fontSize:`${fs-1}px`,color:T.text}}>
                                <input type="checkbox" checked={!!cfg[field]} onChange={e=>updateSchemaFieldConfig(attr.name,field,e.target.checked)} style={{marginTop:"2px"}}/>
                                {label}
                              </label>
                            ))}
                          </div>
                          {cfg.isUniqueId && (
                            <FG label="Unique ID seed format" hint='Examples: "100000" (numeric), "EMP-000000" (prefixed). Tool auto-increments from highest existing value.'>
                              <input style={inp(false)} value={cfg.uniqueIdSeedFormat||"100000"} placeholder="100000" onChange={e=>updateSchemaFieldConfig(attr.name,"uniqueIdSeedFormat",e.target.value)}/>
                            </FG>
                          )}
                          {cfg.isPicklist && picklistCache[attr.name]?.length>0 && (
                            <div style={{fontSize:`${fs-1}px`,color:T.textMuted,marginTop:"0.5rem"}}>
                              Existing values ({picklistCache[attr.name].length}): {picklistCache[attr.name].slice(0,8).join(", ")}{picklistCache[attr.name].length>8?"…":""}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Create source modal */}
        {createSrcMode && (
          <div style={overlay} onClick={()=>setCreateSrcMode(false)}>
            <div style={{...modal,width:"740px"}} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
                <h3 style={{margin:0,color:p,fontSize:`${fs+3}px`,fontWeight:"600"}}>Create new disconnected source in ISC</h3>
                <button style={{border:"none",background:"none",cursor:"pointer",fontSize:"22px",color:T.textFaint,lineHeight:1}} onClick={()=>setCreateSrcMode(false)}>✕</button>
              </div>
              {infoBox(T.infoBg,T.infoBorder,"ℹ","This creates a DelimitedFile (disconnected/manual) source in your ISC tenant. Accounts in this source will be managed entirely through this tool.")}
              <div style={g2}>
                <FG label="Source name" required><input style={inp(false)} value={newSrc.name} placeholder="Non-Employees 2026" onChange={e=>setNewSrc(v=>({...v,name:e.target.value}))}/></FG>
                <FG label="Owner identity ID" required hint="SailPoint identity ID of the source owner"><input style={inp(false)} value={newSrc.owner} placeholder="2c9180858082150f…" onChange={e=>setNewSrc(v=>({...v,owner:e.target.value}))}/></FG>
              </div>
              <FG label="Description"><input style={inp(false)} value={newSrc.description} placeholder="Non-employee identities managed via Non-Employee Hub" onChange={e=>setNewSrc(v=>({...v,description:e.target.value}))}/></FG>
              <FG label="Unique ID seed format" hint='Starting value for auto-incrementing IDs. Examples: "100000", "EMP-000000", "NE-0001"'>
                <input style={inp(false)} value={newSrc.seedFormat} placeholder="100000" onChange={e=>setNewSrc(v=>({...v,seedFormat:e.target.value}))}/>
              </FG>
              <div style={{borderTop:`1px solid ${T.sectionBorder}`,paddingTop:"1rem",marginTop:"0.5rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
                  <div style={{fontSize:`${fs-1}px`,fontWeight:"600",color:T.text}}>Schema attributes ({newSrc.schemaAttrs.length})</div>
                  <button style={btnS(true)} onClick={()=>setNewSrc(v=>({...v,schemaAttrs:[...v.schemaAttrs,{id:Date.now(),name:"",type:"STRING",description:"",isRequired:false}]}))}>+ Add attribute</button>
                </div>
                {newSrc.schemaAttrs.length===0 && <div style={{textAlign:"center",padding:"1.5rem",color:T.textFaint}}>No attributes defined. Click "+ Add attribute" to build your schema.</div>}
                {newSrc.schemaAttrs.map((a,i)=>(
                  <div key={a.id} style={{display:"grid",gridTemplateColumns:"2fr 120px 1fr 80px 40px",gap:"0.5rem",marginBottom:"0.5rem",alignItems:"end"}}>
                    <FG label={i===0?"Attribute name":null}><input style={inp(false)} value={a.name} placeholder="attributeName" onChange={e=>setNewSrc(v=>({...v,schemaAttrs:v.schemaAttrs.map(x=>x.id===a.id?{...x,name:e.target.value}:x)}))}/></FG>
                    <FG label={i===0?"Type":null}><select style={sel} value={a.type} onChange={e=>setNewSrc(v=>({...v,schemaAttrs:v.schemaAttrs.map(x=>x.id===a.id?{...x,type:e.target.value}:x)}))}>
                      {["STRING","INT","DATE","BOOLEAN","LONG"].map(t=><option key={t} value={t}>{t}</option>)}
                    </select></FG>
                    <FG label={i===0?"Description":null}><input style={inp(false)} value={a.description||""} placeholder="Optional" onChange={e=>setNewSrc(v=>({...v,schemaAttrs:v.schemaAttrs.map(x=>x.id===a.id?{...x,description:e.target.value}:x)}))}/></FG>
                    <FG label={i===0?"Required":null}>
                      <div style={{display:"flex",alignItems:"center",gap:"6px",height:"36px"}}>
                        <input type="checkbox" checked={!!a.isRequired} onChange={e=>setNewSrc(v=>({...v,schemaAttrs:v.schemaAttrs.map(x=>x.id===a.id?{...x,isRequired:e.target.checked}:x)}))}/>
                        <span style={{fontSize:`${fs-1}px`,color:T.textMuted}}>Req</span>
                      </div>
                    </FG>
                    <div style={{display:"flex",alignItems:"flex-end",paddingBottom:"0px"}}>
                      <button style={{...btnDgr,padding:"8px 10px"}} onClick={()=>setNewSrc(v=>({...v,schemaAttrs:v.schemaAttrs.filter(x=>x.id!==a.id)}))}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:"0.75rem",justifyContent:"flex-end",marginTop:"1rem"}}>
                <button style={btnS(false)} onClick={()=>setCreateSrcMode(false)}>Cancel</button>
                <button style={btnP(false)} onClick={createSource} disabled={loading}>{loading?"Creating…":"Create source in ISC"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTermination = () => {
    const progressColor = {ok:T.connectOk, error:"#DC2626", warn:"#D97706"};
    return (
      <div>
        <div style={{marginBottom:"1.25rem"}}>
          <h2 style={{margin:"0 0 4px",fontSize:`${fs+7}px`,fontWeight:"600",color:"#DC2626"}}>🚨 Emergency termination</h2>
          <div style={{fontSize:`${fs}px`,color:T.textMuted}}>Immediate or scheduled off-boarding workflow with full audit trail</div>
        </div>
        {infoBox(T.dangerBg,T.dangerBorder,"⚠","This workflow disables all accounts for the selected identity and updates their non-employee record. Use with caution — actions may be irreversible.")}

        {!termTarget ? (
          <div style={card}>
            <div style={secHead}>Search for identity to terminate</div>
            <div style={{display:"flex",gap:"0.75rem",marginBottom:"1rem"}}>
              <input style={{...inp(false),flex:1}} placeholder="Search by name or email address…" value={termSearch} onChange={e=>setTermSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")searchIdentitiesForTermination();}}/>
              <button style={btnDgr} onClick={searchIdentitiesForTermination} disabled={termSearching}>{termSearching?"Searching…":"Search"}</button>
            </div>
            {termResults.length>0 && (
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["Identity","Email","Department","Status","Select"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {termResults.map(id=>(
                    <tr key={id.id} onMouseEnter={e=>e.currentTarget.style.background=T.tblRowHover} onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <td style={td}><div style={{fontWeight:"500",color:T.text}}>{id.displayName||id.name}</div><div style={{fontSize:`${fs-2}px`,color:T.textFaint}}>ID: {id.id}</div></td>
                      <td style={td}>{id.attributes?.mail||id.email||"—"}</td>
                      <td style={td}>{id.attributes?.department||"—"}</td>
                      <td style={td}><span style={badge(id.inactive?"EXPIRED":"ACTIVE")}>{id.inactive?"Inactive":"Active"}</span></td>
                      <td style={td}><button style={{...btnWarn,fontSize:`${fs-1}px`}} onClick={()=>setTermTarget(id)}>Select for termination</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {termResults.length===0&&termSearch&&!termSearching && <div style={{textAlign:"center",padding:"2rem",color:T.textFaint}}>No identities found matching "{termSearch}"</div>}
          </div>
        ) : termDone ? (
          <div style={card}>
            <div style={{textAlign:"center",padding:"1rem"}}>
              <div style={{fontSize:"40px",marginBottom:"0.75rem"}}>✅</div>
              <h3 style={{color:T.text,margin:"0 0 0.5rem"}}>Termination complete</h3>
              <div style={{color:T.textMuted,marginBottom:"1.5rem"}}>All actions completed for {termTarget.displayName||termTarget.name}</div>
            </div>
            <div style={{background:T.attrBg,borderRadius:"8px",padding:"1rem",marginBottom:"1rem"}}>
              {termProgress.map((step,i)=>(
                <div key={i} style={{display:"flex",gap:"10px",alignItems:"flex-start",padding:"4px 0",borderBottom:i<termProgress.length-1?`1px solid ${T.tblBorder}`:"none"}}>
                  <span style={{color:progressColor[step.status]||T.text,fontSize:"14px",flexShrink:0}}>{step.status==="ok"?"✓":step.status==="error"?"✗":"!"}</span>
                  <span style={{fontSize:`${fs-1}px`,color:T.text,flex:1}}>{step.msg}</span>
                  <span style={{fontSize:`${fs-3}px`,color:T.textFaint}}>{step.ts}</span>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:"0.75rem",justifyContent:"center"}}>
              <button style={btnS(false)} onClick={()=>{setTermTarget(null);setTermDone(false);setTermProgress([]);setTermSearch("");setTermResults([]);setTermForm({reason:"",type:"immediate",schedDate:"",notes:"",legalHold:false});}}>Start new termination</button>
              <button style={btnP(false)} onClick={()=>setActiveTab("manage")}>Go to manage identities</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{...card,border:`2px solid #DC262640`,marginBottom:"1rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:"600",color:"#DC2626",fontSize:`${fs+1}px`}}>Selected: {termTarget.displayName||termTarget.name}</div>
                  <div style={{fontSize:`${fs-1}px`,color:T.textMuted,marginTop:"2px"}}>ID: {termTarget.id} · {termTarget.attributes?.mail||termTarget.email||""} · {termTarget.attributes?.department||"No department"}</div>
                </div>
                <button style={btnS(true)} onClick={()=>{setTermTarget(null);setTermForm({reason:"",type:"immediate",schedDate:"",notes:"",legalHold:false});}}>Change</button>
              </div>
            </div>

            <div style={card}>
              <div style={secHead}>Termination details</div>
              <div style={g2}>
                <FG label="Reason for termination" required>
                  <select style={sel} value={termForm.reason} onChange={e=>setTermForm(v=>({...v,reason:e.target.value}))}>
                    <option value="">— Select reason —</option>
                    {TERM_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </FG>
                <FG label="Termination type" required>
                  <select style={sel} value={termForm.type} onChange={e=>setTermForm(v=>({...v,type:e.target.value}))}>
                    <option value="immediate">Immediate — disable accounts now</option>
                    <option value="scheduled">Scheduled — set future end date only</option>
                  </select>
                </FG>
              </div>
              {termForm.type==="scheduled" && (
                <FG label="Scheduled termination date" required>
                  <input type="date" style={inp(false)} value={termForm.schedDate} onChange={e=>setTermForm(v=>({...v,schedDate:e.target.value}))} min={new Date().toISOString().slice(0,10)}/>
                </FG>
              )}
              <FG label="Notes (optional)">
                <textarea style={{...inp(false),height:"80px",resize:"vertical"}} value={termForm.notes} placeholder="Additional context for the audit trail…" onChange={e=>setTermForm(v=>({...v,notes:e.target.value}))}/>
              </FG>
              <div style={{borderTop:`1px solid ${T.sectionBorder}`,paddingTop:"1rem",marginTop:"0.25rem"}}>
                <label style={{display:"flex",alignItems:"flex-start",gap:"10px",cursor:"pointer"}}>
                  <input type="checkbox" checked={termForm.legalHold} onChange={e=>setTermForm(v=>({...v,legalHold:e.target.checked}))} style={{marginTop:"3px"}}/>
                  <div>
                    <div style={{fontWeight:"600",fontSize:`${fs}px`,color:"#7C3AED"}}>⚖ Apply legal hold</div>
                    <div style={{fontSize:`${fs-1}px`,color:T.textMuted}}>Preserves the identity record and prevents deletion even after termination. Use for active litigation, investigations, or compliance holds.</div>
                  </div>
                </label>
              </div>
            </div>

            {!termConfirm ? (
              <div style={{display:"flex",justifyContent:"flex-end",gap:"0.75rem",paddingBottom:"1rem"}}>
                <button style={btnS(false)} onClick={()=>setTermTarget(null)}>Cancel</button>
                <button style={{background:"#DC2626",color:"#fff",border:"none",padding:"8px 20px",borderRadius:"6px",cursor:"pointer",fontSize:`${fs}px`,fontWeight:"500"}} onClick={()=>{if(!termForm.reason){notify("Reason is required","error");return;}if(termForm.type==="scheduled"&&!termForm.schedDate){notify("Scheduled date is required","error");return;}setTermConfirm(true);}}>
                  Proceed to confirmation
                </button>
              </div>
            ) : (
              <div style={{...card,border:"2px solid #DC2626",background:T.dangerBg}}>
                <div style={{fontWeight:"600",color:"#DC2626",marginBottom:"0.75rem",fontSize:`${fs+1}px`}}>⚠ Confirm termination</div>
                <div style={{fontSize:`${fs}px`,color:T.text,marginBottom:"0.5rem"}}>
                  You are about to <strong>{termForm.type==="immediate"?"immediately disable all accounts for":"schedule termination of"}</strong> <strong>{termTarget.displayName||termTarget.name}</strong>.
                </div>
                <div style={{fontSize:`${fs-1}px`,color:T.textMuted,marginBottom:"1rem"}}>
                  Reason: {termForm.reason} {termForm.legalHold&&"· Legal hold will be applied"} {termForm.type==="scheduled"&&`· Effective: ${termForm.schedDate}`}
                </div>
                {terminating && (
                  <div style={{background:T.attrBg,borderRadius:"8px",padding:"0.75rem",marginBottom:"0.75rem",maxHeight:"200px",overflowY:"auto"}}>
                    {termProgress.map((step,i)=>(
                      <div key={i} style={{display:"flex",gap:"8px",fontSize:`${fs-1}px`,color:progressColor[step.status]||T.text,padding:"2px 0"}}><span>{step.status==="ok"?"✓":step.status==="error"?"✗":"!"}</span><span>{step.msg}</span></div>
                    ))}
                    {terminating&&<div style={{color:T.textMuted,fontSize:`${fs-1}px`,marginTop:"4px"}}>Processing…</div>}
                  </div>
                )}
                <div style={{display:"flex",gap:"0.75rem"}}>
                  <button style={btnS(false)} onClick={()=>setTermConfirm(false)} disabled={terminating}>Back</button>
                  <button style={{background:"#DC2626",color:"#fff",border:"none",padding:"8px 20px",borderRadius:"6px",cursor:"pointer",fontSize:`${fs}px`,fontWeight:"600",opacity:terminating?0.6:1}} onClick={executeTermination} disabled={terminating}>
                    {terminating?"Executing…":"Execute termination"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderConfig = () => (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
        <h2 style={{margin:0,fontSize:`${fs+7}px`,fontWeight:"600",color:T.text}}>Configuration</h2>
        <button style={btnP(false)} onClick={saveConfig}>Save configuration</button>
      </div>
      <div style={{display:"flex",gap:"8px",marginBottom:"1rem",flexWrap:"wrap"}}>
        {[["connectivity","Connectivity"],["attributes","Custom attributes"],["branding","Branding"]].map(([k,label])=>(
          <button key={k} style={pillTab(cfgSection===k)} onClick={()=>setCfgSection(k)}>{label}</button>
        ))}
      </div>

      {cfgSection==="connectivity" && (
        <div style={card}>
          <div style={secHead}>Client information</div>
          <div style={g2}>
            <FG label="Client name"><input style={inp(false)} value={configDraft.clientName} placeholder="ACME Corporation" onChange={e=>setConfigDraft(v=>({...v,clientName:e.target.value}))}/></FG>
            <FG label="Contact email"><input style={inp(false)} type="email" value={configDraft.contactEmail} placeholder="admin@acme.com" onChange={e=>setConfigDraft(v=>({...v,contactEmail:e.target.value}))}/></FG>
          </div>
          <FG label="Notes"><textarea style={{...inp(false),height:"70px",resize:"vertical"}} value={configDraft.notes} placeholder="Optional notes" onChange={e=>setConfigDraft(v=>({...v,notes:e.target.value}))}/></FG>

          <div style={{borderTop:`1px solid ${T.sectionBorder}`,paddingTop:"1.25rem",marginTop:"0.5rem"}}>
            <div style={{...secHead,borderBottom:"none",paddingBottom:"0.75rem"}}>ISC tenant connection</div>

            <div style={{background:T.infoBg,border:`1px solid ${T.infoBorder}`,borderRadius:"8px",padding:"0.85rem 1rem",marginBottom:"1rem",fontSize:`${fs-1}px`,color:T.text,lineHeight:"1.7"}}>
              <strong>API Endpoint</strong> is the primary field — enter <code style={{background:T.attrBg,padding:"1px 5px",borderRadius:"3px",fontSize:`${fs-2}px`}}>https://org.api.identitynow.com</code> (note the <code style={{background:T.attrBg,padding:"1px 5px",borderRadius:"3px",fontSize:`${fs-2}px`}}>.api.</code> subdomain). If left blank, the app auto-derives it from your Tenant URL. All API calls and OAuth token requests use this endpoint. CORS is handled automatically by the built-in server-side proxy (isc-proxy.js Netlify Function).
            </div>

            <FG label="API endpoint" required hint="e.g. https://org.api.identitynow.com — used for OAuth token AND all API calls">
              <input style={inp(false)} value={configDraft.apiEndpoint} placeholder="https://your-org.api.identitynow.com" onChange={e=>setConfigDraft(v=>({...v,apiEndpoint:e.target.value}))}/>
            </FG>
            <FG label="Tenant URL" hint="e.g. https://your-org.identitynow.com — the API endpoint is auto-derived from this if the field above is blank">
              <input style={inp(false)} value={configDraft.tenantUrl} placeholder="https://your-org.identitynow.com" onChange={e=>setConfigDraft(v=>({...v,tenantUrl:e.target.value}))}/>
            </FG>
            <div style={g2}>
              <FG label="Client ID" required><input style={inp(false)} value={configDraft.clientId} placeholder="OAuth client ID" onChange={e=>setConfigDraft(v=>({...v,clientId:e.target.value}))}/></FG>
              <FG label="Client secret" required><input style={inp(false)} type="password" value={configDraft.clientSecret} placeholder="OAuth client secret" onChange={e=>setConfigDraft(v=>({...v,clientSecret:e.target.value}))}/></FG>
            </div>
            <FG label="Non-employee source ID"><input style={inp(false)} value={configDraft.sourceId} placeholder="e.g. 2c918083880b9dff0188135036c5b4ba" onChange={e=>setConfigDraft(v=>({...v,sourceId:e.target.value}))}/></FG>
          </div>

          <div style={{display:"flex",alignItems:"flex-start",gap:"1rem",marginTop:"1.25rem",paddingTop:"1rem",borderTop:`1px solid ${T.sectionBorder}`,flexWrap:"wrap"}}>
            <button style={btnS(false)} onClick={testConnectivity} disabled={connectStatus==="testing"}>{connectStatus==="testing"?"Testing…":"Test connectivity"}</button>
            {connectStatus==="success"&&<div style={{color:T.connectOk,fontSize:`${fs-1}px`,fontWeight:"500",flex:1}}>✓ {connectMsg}</div>}
            {connectStatus==="error"  &&<div style={{color:T.connectErr,fontSize:`${fs-2}px`,flex:1,lineHeight:"1.6",whiteSpace:"pre-wrap"}}>{connectMsg}</div>}
          </div>
        </div>
      )}

      {cfgSection==="attributes" && (
        <div style={card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
            <div style={secHead}>Custom attributes ({configDraft.customAttributes.length} / 10) — used when no ISC schema is loaded</div>
            <button style={btnP(true)} onClick={addCustomAttr} disabled={configDraft.customAttributes.length>=10}>+ Add</button>
          </div>
          {configDraft.customAttributes.length===0&&<div style={{textAlign:"center",padding:"2rem",color:T.textFaint}}><div style={{fontSize:"28px",marginBottom:"0.5rem"}}>📋</div>No custom attributes. These appear on the create form when no source schema is loaded.</div>}
          {configDraft.customAttributes.map((attr,idx)=>(
            <div key={attr.id} style={{background:T.attrBg,border:`1px solid ${T.cardBorder}`,borderRadius:"8px",padding:"1rem",marginBottom:"0.75rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.75rem"}}>
                <div style={{fontSize:`${fs-1}px`,fontWeight:"600",color:T.textMuted}}>Attribute {idx+1}</div>
                <button style={btnDgr} onClick={()=>setConfigDraft(v=>({...v,customAttributes:v.customAttributes.filter(a=>a.id!==attr.id)}))}>Remove</button>
              </div>
              <div style={g3}>
                <FG label="Label"><input style={inp(false)} value={attr.label} placeholder="Display label" onChange={e=>updAttr(attr.id,"label",e.target.value)}/></FG>
                <FG label="API key"><input style={inp(false)} value={attr.key} placeholder="apiKeyName" onChange={e=>updAttr(attr.id,"key",e.target.value)}/></FG>
                <FG label="Type"><select style={sel} value={attr.type} onChange={e=>updAttr(attr.id,"type",e.target.value)}><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="email">Email</option><option value="select">Dropdown</option></select></FG>
              </div>
              {attr.type==="select"&&<FG label="Options (comma-separated)"><input style={inp(false)} value={attr.options||""} placeholder="Option A, Option B" onChange={e=>updAttr(attr.id,"options",e.target.value)}/></FG>}
              <label style={{display:"flex",alignItems:"center",gap:"6px",fontSize:`${fs-1}px`,color:T.text,cursor:"pointer"}}>
                <input type="checkbox" checked={!!attr.required} onChange={e=>updAttr(attr.id,"required",e.target.checked)}/>Required
              </label>
            </div>
          ))}
        </div>
      )}

      {cfgSection==="branding" && (
        <div style={card}>
          <div style={secHead}>Branding &amp; appearance</div>
          <div style={g2}>
            <FG label="Application name"><input style={inp(false)} value={configDraft.branding.appName} placeholder="Non-Employee Hub" onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,appName:e.target.value}}))}/></FG>
            <FG label="Company name"><input style={inp(false)} value={configDraft.branding.companyName} placeholder="Your Company" onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,companyName:e.target.value}}))}/></FG>
          </div>
          <FG label="Logo URL" hint="Hosted PNG or SVG image URL"><input style={inp(false)} value={configDraft.branding.logoUrl} placeholder="https://example.com/logo.png" onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,logoUrl:e.target.value}}))}/></FG>
          <div style={g2}>
            <FG label="Primary color"><div style={{display:"flex",gap:"8px",alignItems:"center"}}><input type="color" value={configDraft.branding.primaryColor} onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,primaryColor:e.target.value}}))} style={{width:"40px",height:"36px",border:`1px solid ${T.inputBorder}`,borderRadius:"6px",cursor:"pointer",padding:"2px",background:T.inputBg}}/><input style={{...inp(false),flex:1}} value={configDraft.branding.primaryColor} onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,primaryColor:e.target.value}}))}/></div></FG>
            <FG label="Accent color"><div style={{display:"flex",gap:"8px",alignItems:"center"}}><input type="color" value={configDraft.branding.accentColor} onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,accentColor:e.target.value}}))} style={{width:"40px",height:"36px",border:`1px solid ${T.inputBorder}`,borderRadius:"6px",cursor:"pointer",padding:"2px",background:T.inputBg}}/><input style={{...inp(false),flex:1}} value={configDraft.branding.accentColor} onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,accentColor:e.target.value}}))}/></div></FG>
          </div>
          <div style={{borderTop:`1px solid ${T.sectionBorder}`,paddingTop:"1.25rem",marginTop:"0.75rem"}}>
            <div style={{...secHead,borderBottom:"none",paddingBottom:"0.75rem"}}>Typography</div>
            <div style={g2}>
              <FG label="Font family"><select style={sel} value={configDraft.branding.fontFamily} onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,fontFamily:e.target.value}}))}>
                {GOOGLE_FONTS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
              </select></FG>
              <FG label="Font size"><select style={sel} value={configDraft.branding.fontSize} onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,fontSize:e.target.value}}))}>
                {FONT_SIZES.map(f=><option key={f.label} value={f.label}>{f.label} ({f.base}px)</option>)}
              </select></FG>
            </div>
            {(()=>{const pfs=(FONT_SIZES.find(f=>f.label===configDraft.branding.fontSize)||FONT_SIZES[1]).base;return<div style={{background:T.previewBg,border:`1px solid ${T.cardBorder}`,borderRadius:"8px",padding:"1rem",fontFamily:configDraft.branding.fontFamily}}><div style={{fontSize:`${pfs+5}px`,fontWeight:"600",color:T.text,marginBottom:"4px"}}>The quick brown fox jumps over the lazy dog</div><div style={{fontSize:`${pfs}px`,color:T.textMuted}}>Non-Employee Hub · {configDraft.branding.fontFamily.split(",")[0].replace(/'/g,"")} · {pfs}px base</div></div>;})()}
          </div>
          <div style={{marginTop:"1.25rem"}}>
            <div style={{fontSize:`${fs-1}px`,fontWeight:"500",color:T.textMuted,marginBottom:"8px"}}>Header preview</div>
            <div style={{background:configDraft.branding.primaryColor||RSM_BLUE,padding:"0 1.25rem",height:"54px",display:"flex",alignItems:"center",gap:"10px",borderRadius:"8px",borderBottom:`3px solid ${configDraft.branding.accentColor||RSM_MAGENTA}`,fontFamily:configDraft.branding.fontFamily}}>
              {!configDraft.branding.logoUrl&&<div style={{width:"28px",height:"28px",background:"rgba(255,255,255,0.2)",borderRadius:"4px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px"}}>🛡</div>}
              <div><div style={{color:"#fff",fontWeight:"600"}}>{configDraft.branding.appName||"Non-Employee Hub"}</div><div style={{color:"rgba(255,255,255,0.65)",fontSize:"10px",textTransform:"uppercase",letterSpacing:"0.5px"}}>{configDraft.branding.companyName||"Your Company"} · SailPoint ISC</div></div>
            </div>
          </div>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:"0.5rem"}}><button style={btnP(false)} onClick={saveConfig}>Save configuration</button></div>
    </div>
  );

  // ── Modals ────────────────────────────────────────────────────────────────
  const renderPreviewModal = () => {
    if (!previewOpen) return null;
    return (
      <div style={overlay} onClick={()=>setPreviewOpen(false)}>
        <div style={{...modal,width:"700px"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
            <h3 style={{margin:0,color:p,fontSize:`${fs+3}px`,fontWeight:"600"}}>Request payload preview</h3>
            <button style={{border:"none",background:"none",cursor:"pointer",fontSize:"22px",color:T.textFaint,lineHeight:1}} onClick={()=>setPreviewOpen(false)}>✕</button>
          </div>
          <div style={{marginBottom:"0.75rem",padding:"8px 12px",background:dark?"#0C1A40":"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:"6px",fontSize:`${fs-1}px`,color:"#0369A1",fontFamily:"monospace"}}>
            POST {(config.apiEndpoint||config.tenantUrl||"https://tenant.identitynow.com").replace(/\/$/,"")}/v2026/non-employees
          </div>
          <pre style={{background:T.codeBg,color:T.codeText,padding:"1rem",borderRadius:"8px",fontSize:"12px",overflowY:"auto",maxHeight:"48vh",margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{JSON.stringify(buildPayload(),null,2)}</pre>
          <div style={{display:"flex",gap:"0.75rem",marginTop:"1rem",justifyContent:"flex-end"}}>
            <button style={btnS(false)} onClick={()=>setPreviewOpen(false)}>Close</button>
            <button style={btnP(false)} onClick={handleSubmit} disabled={loading}>{loading?"Submitting…":"Submit to ISC"}</button>
          </div>
        </div>
      </div>
    );
  };

  const renderEditModal = () => {
    if (!editOpen||!editRecord) return null;
    return (
      <div style={overlay} onClick={()=>setEditOpen(false)}>
        <div style={{...modal,width:"720px"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
            <h3 style={{margin:0,color:p,fontSize:`${fs+3}px`,fontWeight:"600"}}>Edit non-employee record</h3>
            <button style={{border:"none",background:"none",cursor:"pointer",fontSize:"22px",color:T.textFaint,lineHeight:1}} onClick={()=>setEditOpen(false)}>✕</button>
          </div>
          <div style={{background:T.attrBg,borderRadius:"8px",padding:"6px 12px",marginBottom:"1rem",fontSize:`${fs-2}px`,color:T.textFaint}}>ID: {editRecord.id}</div>
          <div style={g2}>
            <FG label="First name"><input style={inp(false)} value={editRecord.firstName||""} onChange={e=>setEditRecord(v=>({...v,firstName:e.target.value}))}/></FG>
            <FG label="Last name"><input style={inp(false)} value={editRecord.lastName||""} onChange={e=>setEditRecord(v=>({...v,lastName:e.target.value}))}/></FG>
          </div>
          <div style={g2}>
            <FG label="Email"><input style={inp(false)} type="email" value={editRecord.email||""} onChange={e=>setEditRecord(v=>({...v,email:e.target.value}))}/></FG>
            <FG label="Phone"><input style={inp(false)} value={editRecord.phone||""} onChange={e=>setEditRecord(v=>({...v,phone:e.target.value}))}/></FG>
          </div>
          <div style={g2}>
            <FG label="Account name"><input style={inp(false)} value={editRecord.accountName||""} onChange={e=>setEditRecord(v=>({...v,accountName:e.target.value}))}/></FG>
            <FG label="Manager ID"><input style={inp(false)} value={editRecord.manager?.id||editRecord.manager||""} onChange={e=>setEditRecord(v=>({...v,manager:{id:e.target.value}}))}/></FG>
          </div>
          <div style={g2}>
            <FG label="Start date"><input type="date" style={inp(false)} value={editRecord.startDate||""} onChange={e=>setEditRecord(v=>({...v,startDate:e.target.value}))}/></FG>
            <FG label="End date"><input type="date" style={inp(false)} value={editRecord.endDate||""} onChange={e=>setEditRecord(v=>({...v,endDate:e.target.value}))}/></FG>
          </div>
          <div style={{borderTop:`1px solid ${T.sectionBorder}`,paddingTop:"1rem",marginTop:"0.5rem"}}>
            <div style={{display:"flex",gap:"2rem",flexWrap:"wrap"}}>
              <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer"}}>
                <input type="checkbox" checked={!!editRecord.data?.isConversion} onChange={e=>setEditRecord(v=>({...v,data:{...(v.data||{}),isConversion:e.target.checked}}))}/>
                <span style={{fontSize:`${fs-1}px`,color:T.text}}>🔄 Conversion to employee</span>
              </label>
              <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer"}}>
                <input type="checkbox" checked={!!editRecord.data?.legalHold} onChange={e=>setEditRecord(v=>({...v,data:{...(v.data||{}),legalHold:e.target.checked}}))}/>
                <span style={{fontSize:`${fs-1}px`,color:T.text}}>⚖ Legal hold</span>
              </label>
            </div>
          </div>
          <div style={{display:"flex",gap:"0.75rem",justifyContent:"flex-end",marginTop:"1rem"}}>
            <button style={btnS(false)} onClick={()=>setEditOpen(false)}>Cancel</button>
            <button style={btnP(false)} onClick={handleUpdate} disabled={loading}>{loading?"Saving…":"Save changes"}</button>
          </div>
        </div>
      </div>
    );
  };

  const renderDeleteModal = () => {
    if (!deleteTarget) return null;
    const hasHold = !!deleteTarget.data?.legalHold;
    return (
      <div style={overlay} onClick={()=>setDeleteTarget(null)}>
        <div style={{...modal,width:"440px",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:"36px",marginBottom:"0.75rem"}}>{hasHold?"⚖":"⚠️"}</div>
          <h3 style={{margin:"0 0 0.5rem",color:T.text,fontSize:`${fs+3}px`}}>{hasHold?"Legal hold active":"Delete non-employee record?"}</h3>
          <div style={{color:T.textMuted,fontSize:`${fs}px`,marginBottom:"1.25rem"}}>
            {hasHold?"This record has an active legal hold and cannot be deleted. Remove the legal hold in the Edit view first."
              :<>This permanently deletes <strong style={{color:T.text}}>{deleteTarget.firstName} {deleteTarget.lastName}</strong>'s record from ISC. This cannot be undone.</>}
          </div>
          <div style={{display:"flex",gap:"0.75rem",justifyContent:"center"}}>
            <button style={btnS(false)} onClick={()=>setDeleteTarget(null)}>Cancel</button>
            {!hasHold&&<button style={{...btnP(false),background:"#DC2626"}} onClick={()=>handleDelete(deleteTarget.id)} disabled={loading}>{loading?"Deleting…":"Delete record"}</button>}
          </div>
        </div>
      </div>
    );
  };

  const renderRejectModal = () => {
    if (!rejectTarget) return null;
    return (
      <div style={overlay} onClick={()=>setRejectTarget(null)}>
        <div style={{...modal,width:"480px"}} onClick={e=>e.stopPropagation()}>
          <h3 style={{margin:"0 0 1rem",color:T.text,fontSize:`${fs+3}px`}}>Reject approval request</h3>
          <FG label="Rejection reason (optional)"><textarea style={{...inp(false),height:"90px",resize:"vertical"}} value={rejectComment} placeholder="Reason…" onChange={e=>setRejectComment(e.target.value)}/></FG>
          <div style={{display:"flex",gap:"0.75rem",justifyContent:"flex-end",marginTop:"0.75rem"}}>
            <button style={btnS(false)} onClick={()=>setRejectTarget(null)}>Cancel</button>
            <button style={{...btnP(false),background:"#DC2626"}} onClick={handleReject} disabled={loading}>{loading?"Rejecting…":"Reject request"}</button>
          </div>
        </div>
      </div>
    );
  };

  const TABS = [
    ["dashboard",   "🏠", "Dashboard"],
    ["create",      "➕", "Create identity"],
    ["manage",      "🗂", "Manage identities"],
    ["approvals",   "✅", "Approvals"],
    ["sources",     "🔌", "Sources"],
    ["termination", "🚨", "Emergency termination"],
    ["config",      "⚙",  "Configuration"],
  ];

  const anyModal = previewOpen||editOpen||!!deleteTarget||!!rejectTarget||createSrcMode;

  return (
    <Ctx.Provider value={{ T, fs, p, acc, dark }}>
      <div style={{ fontFamily:ff, fontSize:`${fs}px`, minHeight:"100vh", background:T.bg, position:"relative", transition:"background 0.25s" }}>
        {/* Header */}
        <div style={{ background:`linear-gradient(135deg, ${p} 0%, ${p}EE 100%)`, padding:"0 1.5rem", height:"58px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:`3px solid ${acc}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            {config.branding.logoUrl?<img src={config.branding.logoUrl} alt="" style={{height:"30px",objectFit:"contain"}} onError={e=>e.target.style.display="none"}/>
              :<div style={{width:"32px",height:"32px",background:"rgba(255,255,255,0.15)",borderRadius:"6px",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L14 11H4L9 2Z" fill="white" fillOpacity="0.9"/><path d="M4 11H14L12.5 16H5.5L4 11Z" fill={acc} fillOpacity="0.9"/></svg></div>}
            <div>
              <div style={{color:"#fff",fontSize:`${fs+2}px`,fontWeight:"600",letterSpacing:"-0.3px"}}>{config.branding.appName}</div>
              <div style={{color:"rgba(255,255,255,0.65)",fontSize:"10px",letterSpacing:"0.5px",textTransform:"uppercase"}}>{config.branding.companyName} · SailPoint ISC</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
            {config.clientName&&<div style={{color:"rgba(255,255,255,0.75)",fontSize:`${fs-1}px`}}>{config.clientName}</div>}
            <DarkToggle dark={dark} setDark={setDark}/>
          </div>
        </div>
        {/* Nav */}
        <div style={{background:T.navBg,borderBottom:`1px solid ${T.navBorder}`,padding:"0 1.5rem",display:"flex",overflowX:"auto",transition:"background 0.25s"}}>
          {TABS.map(([t,icon,label])=>(
            <div key={t} onClick={()=>setActiveTab(t)}
              style={{padding:"0 0.85rem",height:"46px",display:"flex",alignItems:"center",cursor:"pointer",fontSize:`${fs-1}px`,fontWeight:activeTab===t?"600":"400",whiteSpace:"nowrap",borderBottom:activeTab===t?`2.5px solid ${t==="termination"?"#DC2626":p}`:"2.5px solid transparent",color:activeTab===t?(t==="termination"?"#DC2626":p):T.textMuted,gap:"5px",transition:"all 0.15s"}}>
              <span style={{fontSize:"13px"}}>{icon}</span>{label}
            </div>
          ))}
        </div>
        {/* Notification */}
        {notification&&(
          <div style={{position:"absolute",top:"70px",right:"1.5rem",zIndex:400,background:notification.type==="error"?"#DC2626":"#059669",color:"#fff",padding:"10px 18px",borderRadius:"8px",fontSize:`${fs-1}px`,fontWeight:"500",boxShadow:`0 4px 12px ${T.notifShadow}`,maxWidth:"420px"}}>
            {notification.msg}
          </div>
        )}
        {/* Page — plain function calls */}
        <div style={{padding:"1.5rem",maxWidth:"1150px",margin:"0 auto"}}>
          {activeTab==="dashboard"   && renderDashboard()}
          {activeTab==="create"      && renderCreate()}
          {activeTab==="manage"      && renderManage()}
          {activeTab==="approvals"   && renderApprovals()}
          {activeTab==="sources"     && renderSources()}
          {activeTab==="termination" && renderTermination()}
          {activeTab==="config"      && renderConfig()}
        </div>
        {/* Modals */}
        {anyModal&&(
          <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,minHeight:"100vh"}}>
            {renderPreviewModal()}{renderEditModal()}{renderDeleteModal()}{renderRejectModal()}
            {/* createSrcMode modal is rendered inline in renderSources() */}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(NonEmployeeHub));
