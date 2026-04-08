const { useState, useEffect, useRef } = React;

// ─── Constants ───────────────────────────────────────────────────────────────

const RSM_BLUE    = "#0033A1";
const RSM_MAGENTA = "#CC27B0";

const GOOGLE_FONTS = [
  { label: "Segoe UI (System default)", value: "'Segoe UI', system-ui, sans-serif", gfName: null },
  { label: "Inter",          value: "'Inter', sans-serif",          gfName: "Inter" },
  { label: "Roboto",         value: "'Roboto', sans-serif",         gfName: "Roboto" },
  { label: "Open Sans",      value: "'Open Sans', sans-serif",      gfName: "Open+Sans" },
  { label: "Nunito",         value: "'Nunito', sans-serif",         gfName: "Nunito" },
  { label: "Montserrat",     value: "'Montserrat', sans-serif",     gfName: "Montserrat" },
  { label: "IBM Plex Sans",  value: "'IBM Plex Sans', sans-serif",  gfName: "IBM+Plex+Sans" },
  { label: "Lato",           value: "'Lato', sans-serif",           gfName: "Lato" },
  { label: "DM Sans",        value: "'DM Sans', sans-serif",        gfName: "DM+Sans" },
  { label: "Figtree",        value: "'Figtree', sans-serif",        gfName: "Figtree" },
];

const FONT_SIZES = [
  { label: "Small",  base: 12 },
  { label: "Medium", base: 13 },
  { label: "Large",  base: 15 },
];

const DEFAULT_CONFIG = {
  clientName: "", contactEmail: "", notes: "",
  tenantUrl: "", apiEndpoint: "", clientId: "", clientSecret: "",
  sourceId: "",
  customAttributes: [],
  branding: {
    appName:       "Non-Employee Hub",
    companyName:   "RSM",
    primaryColor:  RSM_BLUE,
    accentColor:   RSM_MAGENTA,
    logoUrl:       "",
    fontFamily:    "'Segoe UI', system-ui, sans-serif",
    fontSize:      "Medium",
  }
};

const EMPTY_FORM = {
  accountName: "", firstName: "", lastName: "", email: "",
  phone: "", manager: "", contractingOrg: "",
  startDate: "", endDate: "", customData: {}
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const initials = (f, l) => `${(f||"?")[0]}${(l||"?")[0]}`.toUpperCase();

const STATUS_COLORS = {
  PENDING:  { bg: "#FFF3CD", color: "#856404",  darkBg: "#3D2E00", darkColor: "#FBBF24" },
  APPROVED: { bg: "#D1E7DD", color: "#0A3622",  darkBg: "#052E16", darkColor: "#34D399" },
  REJECTED: { bg: "#F8D7DA", color: "#58151C",  darkBg: "#2D0A0A", darkColor: "#F87171" },
  ACTIVE:   { bg: "#CFE2FF", color: "#084298",  darkBg: "#0C1A40", darkColor: "#60A5FA" },
  EXPIRED:  { bg: "#E2E3E5", color: "#383D41",  darkBg: "#1F2937", darkColor: "#9CA3AF" },
};

// ─── Theme ───────────────────────────────────────────────────────────────────

const getTheme = (dark) => ({
  bg:            dark ? "#0D0F1A" : "#F0F2F5",
  cardBg:        dark ? "#161929" : "#FFFFFF",
  cardBorder:    dark ? "#252842" : "#E4E7EB",
  text:          dark ? "#E8EAF4" : "#111111",
  textMuted:     dark ? "#8B93B8" : "#6B7280",
  textFaint:     dark ? "#5A6180" : "#9CA3AF",
  inputBg:       dark ? "#0D0F1A" : "#FAFAFA",
  inputBorder:   dark ? "#252842" : "#D1D5DB",
  inputText:     dark ? "#E8EAF4" : "#111111",
  navBg:         dark ? "#161929" : "#FFFFFF",
  navBorder:     dark ? "#252842" : "#DDE1E8",
  tblHeadBg:     dark ? "#0D0F1A" : "#F8F9FB",
  tblHeadColor:  dark ? "#8B93B8" : "#374151",
  tblRowHover:   dark ? "#1C1F33" : "#FAFAFA",
  tblBorder:     dark ? "#1C1F33" : "#F0F2F5",
  sectionBorder: dark ? "#252842" : "#E4E7EB",
  attrBg:        dark ? "#0D0F1A" : "#FAFAFA",
  codeBg:        dark ? "#08090F" : "#1E1E2E",
  codeText:      dark ? "#CDD6F4" : "#CDD6F4",
  previewBg:     dark ? "#1C1F33" : "#F8F9FB",
  pillActiveBg:  dark ? "#252842" : undefined,
  toggleBg:      dark ? "#252842" : "#E4E7EB",
  toggleKnob:    dark ? "#E8EAF4" : "#FFFFFF",
  notifShadow:   dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.2)",
  modalOverlay:  dark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.45)",
  connectOk:     dark ? "#34D399" : "#059669",
  connectErr:    dark ? "#F87171" : "#DC2626",
  statBorder:    dark ? "#252842" : "#E4E7EB",
  quickHover:    dark ? "#1C1F33" : "#FFFFFF",
});

// ─── Font loader ─────────────────────────────────────────────────────────────

const loadGoogleFont = (gfName) => {
  if (!gfName) return;
  const id = `gf-${gfName}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id   = id;
  link.rel  = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${gfName}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
};

// ─── Main Component ───────────────────────────────────────────────────────────

function NonEmployeeHub() {

  const [dark,         setDark]         = useState(false);
  const [config,       setConfig]       = useState(DEFAULT_CONFIG);
  const [configDraft,  setConfigDraft]  = useState(DEFAULT_CONFIG);
  const [activeTab,    setActiveTab]    = useState("dashboard");
  const [cfgSection,   setCfgSection]   = useState("connectivity");
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [formErrors,   setFormErrors]   = useState({});
  const [identities,   setIdentities]   = useState([]);
  const [approvals,    setApprovals]    = useState([]);
  const [summary,      setSummary]      = useState(null);
  const [token,        setToken]        = useState(null);
  const [tokenExpiry,  setTokenExpiry]  = useState(0);
  const [listLoading,  setListLoading]  = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [connectStatus,setConnectStatus]= useState(null);
  const [connectMsg,   setConnectMsg]   = useState("");
  const [previewOpen,  setPreviewOpen]  = useState(false);
  const [editOpen,     setEditOpen]     = useState(false);
  const [editRecord,   setEditRecord]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectComment,setRejectComment]= useState("");
  const [notification, setNotification] = useState(null);
  const [searchTerm,   setSearchTerm]   = useState("");

  const T   = getTheme(dark);
  const p   = config.branding.primaryColor || RSM_BLUE;
  const acc = config.branding.accentColor  || RSM_MAGENTA;
  const fs  = (FONT_SIZES.find(f => f.label === config.branding.fontSize) || FONT_SIZES[1]).base;
  const ff  = config.branding.fontFamily || "'Segoe UI', system-ui, sans-serif";

  // Load Google Font when branding font changes
  useEffect(() => {
    const found = GOOGLE_FONTS.find(f => f.value === config.branding.fontFamily);
    if (found && found.gfName) loadGoogleFont(found.gfName);
  }, [config.branding.fontFamily]);

  // Also load for draft (live preview in config)
  useEffect(() => {
    const found = GOOGLE_FONTS.find(f => f.value === configDraft.branding.fontFamily);
    if (found && found.gfName) loadGoogleFont(found.gfName);
  }, [configDraft.branding.fontFamily]);

  // ── Notifications ──────────────────────────────────────────────────────────
  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // ── API helpers ────────────────────────────────────────────────────────────
  const getToken = async (cfg = config) => {
    if (token && Date.now() < tokenExpiry) return token;
    const res = await fetch(`${cfg.tenantUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: cfg.clientId, client_secret: cfg.clientSecret })
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`Auth failed (${res.status}): ${t}`); }
    const d = await res.json();
    setToken(d.access_token);
    setTokenExpiry(Date.now() + (d.expires_in - 60) * 1000);
    return d.access_token;
  };

  const apiCall = async (method, path, body, cfg = config) => {
    const tok  = await getToken(cfg);
    const base = (cfg.apiEndpoint || cfg.tenantUrl).replace(/\/$/, "");
    const res  = await fetch(`${base}${path}`, {
      method,
      headers: { "Authorization": `Bearer ${tok}`, "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`API ${res.status}: ${t}`); }
    return res.status === 204 ? null : res.json();
  };

  const testConnectivity = async () => {
    setConnectStatus("testing"); setConnectMsg("");
    try { await getToken(configDraft); setConnectStatus("success"); setConnectMsg("Connected to ISC tenant successfully."); }
    catch (e) { setConnectStatus("error"); setConnectMsg(e.message); }
  };

  const loadIdentities = async () => {
    setListLoading(true);
    try {
      const qs = config.sourceId ? `?sourceId=${config.sourceId}&limit=250` : "?limit=250";
      const d  = await apiCall("GET", `/v2026/non-employees${qs}`);
      setIdentities(Array.isArray(d) ? d : []);
    } catch (e) { notify(e.message, "error"); }
    setListLoading(false);
  };

  const loadApprovals = async () => {
    setListLoading(true);
    try { const d = await apiCall("GET", "/v2026/non-employee-approvals?limit=50"); setApprovals(Array.isArray(d) ? d : []); }
    catch (e) { notify(e.message, "error"); }
    setListLoading(false);
  };

  const loadSummary = async () => {
    if (!config.sourceId || !config.tenantUrl) return;
    try { const d = await apiCall("GET", `/v2026/non-employee-requests/summary/${config.sourceId}`); setSummary(d); }
    catch (_) {}
  };

  useEffect(() => {
    if (activeTab === "manage")    loadIdentities();
    else if (activeTab === "approvals") loadApprovals();
    else if (activeTab === "dashboard") loadSummary();
  }, [activeTab]);

  // ── Form helpers ───────────────────────────────────────────────────────────
  const validateForm = () => {
    const e = {};
    if (!form.firstName.trim())  e.firstName  = "Required";
    if (!form.lastName.trim())   e.lastName   = "Required";
    if (!form.email.trim())      e.email      = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email format";
    if (form.phone && !/^\+?[\d\s\-(). ]{7,20}$/.test(form.phone)) e.phone = "Invalid format (e.g. +1 555-000-0000)";
    if (!form.startDate) e.startDate = "Required";
    if (!form.endDate)   e.endDate   = "Required";
    if (form.startDate && form.endDate && form.endDate < form.startDate) e.endDate = "Must be after start date";
    if (!form.manager.trim()) e.manager = "Required";
    config.customAttributes.forEach(a => { if (a.required && !form.customData[a.key]) e[`ca_${a.key}`] = "Required"; });
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildPayload = () => {
    const payload = {
      accountName: form.accountName || `${form.firstName.toLowerCase()}.${form.lastName.toLowerCase()}`,
      firstName: form.firstName, lastName: form.lastName,
      email: form.email,
      phone: form.phone || undefined,
      manager: { id: form.manager },
      sourceId: config.sourceId,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      endDate:   form.endDate   ? new Date(form.endDate).toISOString()   : undefined,
      data: {}
    };
    if (form.contractingOrg) payload.data.contractingOrganization = form.contractingOrg;
    config.customAttributes.forEach(a => { if (form.customData[a.key]) payload.data[a.key] = form.customData[a.key]; });
    return payload;
  };

  const handleSubmit = async () => {
    if (!validateForm()) { setPreviewOpen(false); return; }
    setLoading(true);
    try {
      await apiCall("POST", "/v2026/non-employees", buildPayload());
      notify("Non-employee identity created successfully!");
      setForm(EMPTY_FORM); setFormErrors({}); setPreviewOpen(false);
    } catch (e) { notify(e.message, "error"); }
    setLoading(false);
  };

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await apiCall("PUT", `/v2026/non-employees/${editRecord.id}`, {
        accountName: editRecord.accountName,
        firstName: editRecord.firstName, lastName: editRecord.lastName,
        email: editRecord.email, phone: editRecord.phone,
        manager: editRecord.manager, sourceId: config.sourceId,
        startDate: editRecord.startDate, endDate: editRecord.endDate,
        data: editRecord.data || {}
      });
      notify("Record updated."); setEditOpen(false); loadIdentities();
    } catch (e) { notify(e.message, "error"); }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    setLoading(true);
    try { await apiCall("DELETE", `/v2026/non-employees/${id}`); notify("Record deleted."); setDeleteTarget(null); loadIdentities(); }
    catch (e) { notify(e.message, "error"); }
    setLoading(false);
  };

  const handleApprove = async (id) => {
    setLoading(true);
    try { await apiCall("POST", `/v2026/non-employee-approvals/${id}/approve`, { comment: "Approved via Non-Employee Hub" }); notify("Approved!"); loadApprovals(); }
    catch (e) { notify(e.message, "error"); }
    setLoading(false);
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await apiCall("POST", `/v2026/non-employee-approvals/${rejectTarget}/reject`, { comment: rejectComment || "Rejected via Non-Employee Hub" });
      notify("Rejected."); setRejectTarget(null); setRejectComment(""); loadApprovals();
    } catch (e) { notify(e.message, "error"); }
    setLoading(false);
  };

  const saveConfig = () => {
    setConfig(configDraft); setToken(null); setTokenExpiry(0);
    notify("Configuration saved.");
  };

  const addCustomAttr = () => {
    if (configDraft.customAttributes.length >= 10) return;
    setConfigDraft(p => ({ ...p, customAttributes: [...p.customAttributes, { id: Date.now(), label: "", key: "", required: false, type: "text", options: "" }] }));
  };

  const updAttr = (id, field, val) =>
    setConfigDraft(p => ({ ...p, customAttributes: p.customAttributes.map(a => a.id === id ? { ...a, [field]: val } : a) }));

  const filteredIdentities = identities.filter(i => {
    if (!searchTerm) return true;
    return `${i.firstName} ${i.lastName} ${i.email} ${i.accountName}`.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // ── Style builders ─────────────────────────────────────────────────────────
  const S = {
    inp: (err) => ({
      width: "100%", padding: "8px 11px", fontSize: `${fs}px`,
      border: `1px solid ${err ? "#E53E3E" : T.inputBorder}`,
      borderRadius: "6px", outline: "none", boxSizing: "border-box",
      color: T.inputText, background: T.inputBg, transition: "border 0.15s"
    }),
    sel: {
      width: "100%", padding: "8px 11px", fontSize: `${fs}px`,
      border: `1px solid ${T.inputBorder}`, borderRadius: "6px",
      color: T.inputText, background: T.inputBg
    },
    card: {
      background: T.cardBg, borderRadius: "10px",
      border: `1px solid ${T.cardBorder}`,
      padding: "1.25rem 1.5rem", marginBottom: "1rem",
      boxShadow: dark ? "0 1px 4px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.06)"
    },
    secHead: {
      fontSize: `${fs - 1}px`, fontWeight: "600", color: p,
      marginBottom: "1rem", display: "flex", alignItems: "center", gap: "8px",
      paddingBottom: "0.6rem", borderBottom: `1.5px solid ${p}22`
    },
    lbl: { fontSize: `${fs - 1}px`, fontWeight: "500", color: T.textMuted, marginBottom: "4px" },
    errMsg: { fontSize: `${fs - 2}px`, color: "#E53E3E", marginTop: "3px" },
    th: {
      padding: "9px 12px", textAlign: "left", background: T.tblHeadBg,
      color: T.tblHeadColor, fontWeight: "600", fontSize: `${fs - 2}px`,
      textTransform: "uppercase", letterSpacing: "0.5px",
      borderBottom: `1px solid ${T.cardBorder}`
    },
    td: { padding: "10px 12px", borderBottom: `1px solid ${T.tblBorder}`, color: T.text, verticalAlign: "middle", fontSize: `${fs}px` },
    btnP: (sm) => ({
      background: p, color: "#fff", border: "none",
      padding: sm ? "5px 13px" : "8px 20px",
      borderRadius: "6px", cursor: "pointer",
      fontSize: `${sm ? fs - 1 : fs}px`, fontWeight: "500",
      display: "inline-flex", alignItems: "center", gap: "5px"
    }),
    btnS: (sm) => ({
      background: "transparent", color: p, border: `1px solid ${p}`,
      padding: sm ? "5px 12px" : "8px 18px",
      borderRadius: "6px", cursor: "pointer",
      fontSize: `${sm ? fs - 1 : fs}px`, fontWeight: "500"
    }),
    btnDanger:  { background: "transparent", color: "#DC2626", border: "1px solid #DC2626", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontSize: `${fs - 1}px` },
    btnApprove: { background: "#059669", color: "#fff", border: "none", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontSize: `${fs - 1}px` },
    badge: (status) => {
      const c = STATUS_COLORS[status] || STATUS_COLORS.EXPIRED;
      return { background: dark ? c.darkBg : c.bg, color: dark ? c.darkColor : c.color, padding: "2px 9px", borderRadius: "99px", fontSize: `${fs - 2}px`, fontWeight: "600", display: "inline-block" };
    },
    pillTab: (active) => ({
      padding: "5px 14px", borderRadius: "20px", cursor: "pointer",
      fontSize: `${fs - 1}px`, fontWeight: active ? "600" : "400",
      background: active ? p : (dark ? T.attrBg : "transparent"),
      color: active ? "#fff" : T.textMuted,
      border: active ? "none" : `1px solid ${T.cardBorder}`,
      transition: "all 0.15s"
    }),
    overlay: {
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      minHeight: "100vh", background: T.modalOverlay,
      zIndex: 500, display: "flex", alignItems: "flex-start",
      justifyContent: "center", paddingTop: "80px"
    },
    modal: {
      background: T.cardBg, borderRadius: "12px", padding: "1.5rem",
      width: "650px", maxWidth: "95%", maxHeight: "80vh", overflowY: "auto",
      boxShadow: "0 20px 60px rgba(0,0,0,0.35)"
    },
  };

  const g2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" };
  const g3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.85rem" };

  const FG = ({ label, err, required, children }) => (
    <div style={{ marginBottom: "0.7rem" }}>
      <div style={S.lbl}>{label}{required && <span style={{ color: "#E53E3E" }}> *</span>}</div>
      {children}
      {err && <div style={S.errMsg}>{err}</div>}
    </div>
  );

  // ── Dark mode toggle ───────────────────────────────────────────────────────
  const DarkToggle = () => (
    <button
      onClick={() => setDark(d => !d)}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        background: T.toggleBg, border: "none", borderRadius: "99px",
        width: "52px", height: "28px", cursor: "pointer", position: "relative",
        display: "flex", alignItems: "center", padding: "3px", flexShrink: 0,
        transition: "background 0.25s"
      }}>
      <div style={{
        width: "22px", height: "22px", borderRadius: "50%",
        background: p, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "12px", transform: dark ? "translateX(24px)" : "translateX(0px)",
        transition: "transform 0.25s"
      }}>
        {dark ? "🌙" : "☀️"}
      </div>
    </button>
  );

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const Dashboard = () => (
    <div>
      <div style={{ marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: `${fs + 7}px`, fontWeight: "600", color: T.text }}>
            {config.branding.companyName} — Non-Employee Hub
          </h2>
          <div style={{ fontSize: `${fs}px`, color: T.textMuted, marginTop: "3px" }}>
            SailPoint Identity Security Cloud · Non-Employee Lifecycle Management
          </div>
        </div>
        <button style={S.btnP(false)} onClick={() => setActiveTab("create")}>+ Create identity</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {[
          { label: "Total identities",  value: identities.length || summary?.total || 0,    icon: "👥", color: p },
          { label: "Pending approval",  value: summary?.pending  || 0,                       icon: "⏳", color: "#D97706" },
          { label: "Approved",          value: summary?.approved || 0,                       icon: "✓",  color: "#059669" },
          { label: "Rejected",          value: summary?.rejected || 0,                       icon: "✗",  color: "#DC2626" },
        ].map(s => (
          <div key={s.label} style={{ background: T.cardBg, borderRadius: "10px", border: `1px solid ${T.statBorder}`, padding: "1rem 1.25rem", boxShadow: dark ? "0 1px 4px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: `${fs - 2}px`, fontWeight: "600", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
              <div style={{ fontSize: "18px" }}>{s.icon}</div>
            </div>
            <div style={{ fontSize: `${fs + 15}px`, fontWeight: "700", color: s.color, marginTop: "6px" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
        <div style={S.card}>
          <div style={S.secHead}>Quick actions</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {[
              { label: "Create non-employee",    sub: "Add a new non-employee identity",         tab: "create",    icon: "➕" },
              { label: "Manage identities",      sub: "View and edit all records",               tab: "manage",    icon: "🗂" },
              { label: "Review approvals",       sub: "Approve or reject pending requests",      tab: "approvals", icon: "✅" },
              { label: "Configuration",          sub: "Set up tenant connectivity & branding",   tab: "config",    icon: "⚙" },
            ].map(a => (
              <div key={a.tab} onClick={() => setActiveTab(a.tab)}
                style={{ padding: "1rem", border: `1px solid ${T.cardBorder}`, borderRadius: "8px", cursor: "pointer", background: T.quickHover, transition: "all 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = p}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.cardBorder}>
                <div style={{ fontSize: "20px", marginBottom: "6px" }}>{a.icon}</div>
                <div style={{ fontWeight: "600", fontSize: `${fs}px`, color: T.text, marginBottom: "3px" }}>{a.label}</div>
                <div style={{ fontSize: `${fs - 2}px`, color: T.textMuted }}>{a.sub}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={S.card}>
          <div style={S.secHead}>Connection status</div>
          {[
            { label: "Tenant",    value: config.tenantUrl   || "Not configured" },
            { label: "Client",    value: config.clientName  || "Not set" },
            { label: "Source ID", value: config.sourceId    || "Not set" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: `${fs - 1}px`, padding: "7px 0", borderBottom: `1px solid ${T.tblBorder}` }}>
              <span style={{ color: T.textMuted }}>{r.label}</span>
              <span style={{ color: T.text, fontWeight: "500", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{r.value}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "0.75rem" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: config.tenantUrl ? "#059669" : "#9CA3AF" }}></div>
            <span style={{ fontSize: `${fs - 1}px`, color: config.tenantUrl ? T.connectOk : T.textFaint }}>
              {config.tenantUrl ? "Configured" : "Not configured"}
            </span>
          </div>
          {!config.tenantUrl && <button style={{ ...S.btnS(true), marginTop: "0.75rem", width: "100%" }} onClick={() => setActiveTab("config")}>Configure now</button>}
        </div>
      </div>
    </div>
  );

  // ── Create Identity ────────────────────────────────────────────────────────
  const stepBadge = (n, color) => (
    <span style={{ background: color, color: "#fff", width: "20px", height: "20px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", flexShrink: 0 }}>{n}</span>
  );

  const CreateIdentity = () => (
    <div>
      <div style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ margin: 0, fontSize: `${fs + 7}px`, fontWeight: "600", color: T.text }}>Create non-employee identity</h2>
      </div>

      <div style={S.card}>
        <div style={S.secHead}>{stepBadge(1, p)} Identity details</div>
        <div style={g2}>
          <FG label="First name" required err={formErrors.firstName}>
            <input style={S.inp(formErrors.firstName)} value={form.firstName} placeholder="John"
              onChange={e => { setForm(v => ({...v, firstName: e.target.value})); setFormErrors(v => ({...v, firstName: null})); }} />
          </FG>
          <FG label="Last name" required err={formErrors.lastName}>
            <input style={S.inp(formErrors.lastName)} value={form.lastName} placeholder="Smith"
              onChange={e => { setForm(v => ({...v, lastName: e.target.value})); setFormErrors(v => ({...v, lastName: null})); }} />
          </FG>
        </div>
        <div style={g2}>
          <FG label="Account name">
            <input style={S.inp(false)} value={form.accountName} placeholder="Auto-generated if blank"
              onChange={e => setForm(v => ({...v, accountName: e.target.value}))} />
          </FG>
          <FG label="Contracting organization">
            <input style={S.inp(false)} value={form.contractingOrg} placeholder="Acme Consulting LLC"
              onChange={e => setForm(v => ({...v, contractingOrg: e.target.value}))} />
          </FG>
        </div>
        <div style={g2}>
          <FG label="Email address" required err={formErrors.email}>
            <input style={S.inp(formErrors.email)} type="email" value={form.email} placeholder="john.smith@contractor.com"
              onChange={e => { setForm(v => ({...v, email: e.target.value})); setFormErrors(v => ({...v, email: null})); }} />
          </FG>
          <FG label="Phone number" err={formErrors.phone}>
            <input style={S.inp(formErrors.phone)} value={form.phone} placeholder="+1 (555) 000-0000"
              onChange={e => { setForm(v => ({...v, phone: e.target.value})); setFormErrors(v => ({...v, phone: null})); }} />
          </FG>
        </div>
        <FG label="Manager (SailPoint identity ID)" required err={formErrors.manager}>
          <input style={S.inp(formErrors.manager)} value={form.manager} placeholder="e.g. 2c9180858082150f0180893dbaf44201"
            onChange={e => { setForm(v => ({...v, manager: e.target.value})); setFormErrors(v => ({...v, manager: null})); }} />
          <div style={{ fontSize: `${fs - 2}px`, color: T.textFaint, marginTop: "3px" }}>Enter the SailPoint identity ID of the manager</div>
        </FG>
        <div style={g2}>
          <FG label="Start date" required err={formErrors.startDate}>
            <input type="date" style={S.inp(formErrors.startDate)} value={form.startDate}
              onChange={e => { setForm(v => ({...v, startDate: e.target.value})); setFormErrors(v => ({...v, startDate: null})); }} />
          </FG>
          <FG label="End date" required err={formErrors.endDate}>
            <input type="date" style={S.inp(formErrors.endDate)} value={form.endDate}
              onChange={e => { setForm(v => ({...v, endDate: e.target.value})); setFormErrors(v => ({...v, endDate: null})); }} />
          </FG>
        </div>
      </div>

      {config.customAttributes.length > 0 && (
        <div style={S.card}>
          <div style={S.secHead}>{stepBadge(2, acc)} Additional attributes</div>
          <div style={g2}>
            {config.customAttributes.map(attr => (
              <FG key={attr.id} label={attr.label} required={attr.required} err={formErrors[`ca_${attr.key}`]}>
                {attr.type === "select" ? (
                  <select style={S.sel} value={form.customData[attr.key] || ""}
                    onChange={e => setForm(v => ({...v, customData: {...v.customData, [attr.key]: e.target.value}}))}>
                    <option value="">— Select —</option>
                    {(attr.options||"").split(",").map(o=>o.trim()).filter(Boolean).map(o=><option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={attr.type} style={S.inp(formErrors[`ca_${attr.key}`])} value={form.customData[attr.key]||""} placeholder={attr.label}
                    onChange={e => setForm(v => ({...v, customData: {...v.customData, [attr.key]: e.target.value}}))} />
                )}
              </FG>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingBottom: "1rem" }}>
        <button style={S.btnS(false)} onClick={() => setPreviewOpen(true)}>Preview JSON</button>
        <button style={S.btnP(false)} onClick={handleSubmit} disabled={loading}>{loading ? "Submitting…" : "Submit to ISC"}</button>
      </div>
    </div>
  );

  // ── Manage Identities ──────────────────────────────────────────────────────
  const ManageIdentities = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h2 style={{ margin: 0, fontSize: `${fs + 7}px`, fontWeight: "600", color: T.text }}>Non-employee identities</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input style={{ ...S.inp(false), width: "220px" }} placeholder="Search…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <button style={S.btnS(false)} onClick={loadIdentities}>{listLoading ? "Loading…" : "Refresh"}</button>
          <button style={S.btnP(false)} onClick={() => setActiveTab("create")}>+ Create</button>
        </div>
      </div>
      <div style={S.card}>
        {listLoading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: T.textMuted, fontSize: `${fs}px` }}>Loading identities…</div>
        ) : filteredIdentities.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: "32px", marginBottom: "0.75rem" }}>👥</div>
            <div style={{ color: T.textMuted, fontSize: `${fs}px` }}>No non-employee records found.</div>
            <div style={{ color: T.textFaint, fontSize: `${fs - 2}px`, marginTop: "4px" }}>Ensure your Source ID is configured and you are connected.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Identity","Email","Phone","Organization","Start","End","Actions"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filteredIdentities.map(rec => (
                  <tr key={rec.id}
                    onMouseEnter={e=>e.currentTarget.style.background=T.tblRowHover}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={S.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: `${p}20`, color: p, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", flexShrink: 0 }}>
                          {initials(rec.firstName, rec.lastName)}
                        </div>
                        <div>
                          <div style={{ fontWeight: "500", color: T.text }}>{rec.firstName} {rec.lastName}</div>
                          <div style={{ fontSize: `${fs-2}px`, color: T.textFaint }}>{rec.accountName}</div>
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>{rec.email}</td>
                    <td style={S.td}>{rec.phone||"—"}</td>
                    <td style={S.td}>{rec.data?.contractingOrganization||"—"}</td>
                    <td style={S.td}>{fmtDate(rec.startDate)}</td>
                    <td style={S.td}>{fmtDate(rec.endDate)}</td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: "5px" }}>
                        <button style={S.btnS(true)} onClick={()=>{setEditRecord({...rec,startDate:rec.startDate?.slice(0,10),endDate:rec.endDate?.slice(0,10)});setEditOpen(true);}}>Edit</button>
                        <button style={S.btnDanger} onClick={()=>setDeleteTarget(rec)}>Delete</button>
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

  // ── Approvals ──────────────────────────────────────────────────────────────
  const Approvals = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h2 style={{ margin: 0, fontSize: `${fs + 7}px`, fontWeight: "600", color: T.text }}>Approval requests</h2>
        <button style={S.btnS(false)} onClick={loadApprovals}>{listLoading ? "Loading…" : "Refresh"}</button>
      </div>
      <div style={S.card}>
        {listLoading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: T.textMuted }}>Loading…</div>
        ) : approvals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: "32px", marginBottom: "0.75rem" }}>✅</div>
            <div style={{ color: T.textMuted, fontSize: `${fs}px` }}>No approval requests found.</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Subject","Requester","Created","Status","Actions"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {approvals.map(a => {
                const status = a.approvalStatus || "PENDING";
                const isPending = !a.approvalStatus || a.approvalStatus === "PENDING";
                return (
                  <tr key={a.id}
                    onMouseEnter={e=>e.currentTarget.style.background=T.tblRowHover}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={S.td}>
                      <div style={{ fontWeight: "500", color: T.text }}>{a.nonEmployee?.firstName} {a.nonEmployee?.lastName}</div>
                      <div style={{ fontSize: `${fs-2}px`, color: T.textFaint }}>{a.nonEmployee?.email}</div>
                    </td>
                    <td style={S.td}>{a.requester?.name||"—"}</td>
                    <td style={S.td}>{fmtDate(a.created)}</td>
                    <td style={S.td}><span style={S.badge(status)}>{status}</span></td>
                    <td style={S.td}>
                      {isPending ? (
                        <div style={{ display: "flex", gap: "5px" }}>
                          <button style={S.btnApprove} onClick={()=>handleApprove(a.id)} disabled={loading}>Approve</button>
                          <button style={S.btnDanger} onClick={()=>setRejectTarget(a.id)} disabled={loading}>Reject</button>
                        </div>
                      ) : <span style={{ fontSize: `${fs-2}px`, color: T.textFaint }}>Completed</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ── Configuration ──────────────────────────────────────────────────────────
  const Configuration = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h2 style={{ margin: 0, fontSize: `${fs + 7}px`, fontWeight: "600", color: T.text }}>Configuration</h2>
        <button style={S.btnP(false)} onClick={saveConfig}>Save configuration</button>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "1rem", flexWrap: "wrap" }}>
        {[["connectivity","Connectivity"],["attributes","Custom attributes"],["branding","Branding"]].map(([k,label]) => (
          <button key={k} style={S.pillTab(cfgSection===k)} onClick={()=>setCfgSection(k)}>{label}</button>
        ))}
      </div>

      {/* CONNECTIVITY */}
      {cfgSection === "connectivity" && (
        <div style={S.card}>
          <div style={S.secHead}>Client information</div>
          <div style={g2}>
            <FG label="Client name"><input style={S.inp(false)} value={configDraft.clientName} placeholder="ACME Corporation" onChange={e=>setConfigDraft(v=>({...v,clientName:e.target.value}))}/></FG>
            <FG label="Contact email"><input style={S.inp(false)} type="email" value={configDraft.contactEmail} placeholder="admin@acme.com" onChange={e=>setConfigDraft(v=>({...v,contactEmail:e.target.value}))}/></FG>
          </div>
          <FG label="Notes"><textarea style={{...S.inp(false),height:"70px",resize:"vertical"}} value={configDraft.notes} placeholder="Optional notes" onChange={e=>setConfigDraft(v=>({...v,notes:e.target.value}))}/></FG>
          <div style={{ borderTop: `1px solid ${T.sectionBorder}`, paddingTop: "1.25rem", marginTop: "0.5rem" }}>
            <div style={{...S.secHead, border: "none", paddingBottom: "0.75rem"}}>ISC tenant connection</div>
            <FG label="Tenant URL" required>
              <input style={S.inp(false)} value={configDraft.tenantUrl} placeholder="https://tenant.identitynow.com" onChange={e=>setConfigDraft(v=>({...v,tenantUrl:e.target.value}))}/>
              <div style={{fontSize:`${fs-2}px`,color:T.textFaint,marginTop:"3px"}}>Used for the OAuth token endpoint</div>
            </FG>
            <FG label="API endpoint">
              <input style={S.inp(false)} value={configDraft.apiEndpoint} placeholder="https://tenant.api.identitynow.com (leave blank to use Tenant URL)" onChange={e=>setConfigDraft(v=>({...v,apiEndpoint:e.target.value}))}/>
            </FG>
            <div style={g2}>
              <FG label="Client ID" required><input style={S.inp(false)} value={configDraft.clientId} placeholder="OAuth client ID" onChange={e=>setConfigDraft(v=>({...v,clientId:e.target.value}))}/></FG>
              <FG label="Client secret" required><input style={S.inp(false)} type="password" value={configDraft.clientSecret} placeholder="OAuth client secret" onChange={e=>setConfigDraft(v=>({...v,clientSecret:e.target.value}))}/></FG>
            </div>
            <FG label="Non-employee source ID" required>
              <input style={S.inp(false)} value={configDraft.sourceId} placeholder="e.g. 2c918083880b9dff0188135036c5b4ba" onChange={e=>setConfigDraft(v=>({...v,sourceId:e.target.value}))}/>
            </FG>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.75rem", paddingTop: "1rem", borderTop: `1px solid ${T.sectionBorder}` }}>
            <button style={S.btnS(false)} onClick={testConnectivity} disabled={connectStatus==="testing"}>{connectStatus==="testing"?"Testing…":"Test connectivity"}</button>
            {connectStatus==="success" && <span style={{color:T.connectOk,fontSize:`${fs-1}px`}}>● {connectMsg}</span>}
            {connectStatus==="error"   && <span style={{color:T.connectErr,fontSize:`${fs-2}px`,maxWidth:"400px"}}>{connectMsg}</span>}
          </div>
        </div>
      )}

      {/* CUSTOM ATTRIBUTES */}
      {cfgSection === "attributes" && (
        <div style={S.card}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem" }}>
            <div style={S.secHead}>Custom attributes ({configDraft.customAttributes.length} / 10)</div>
            <button style={S.btnP(true)} onClick={addCustomAttr} disabled={configDraft.customAttributes.length>=10}>+ Add attribute</button>
          </div>
          {configDraft.customAttributes.length === 0 && (
            <div style={{ textAlign:"center",padding:"2rem",color:T.textFaint }}>
              <div style={{ fontSize:"28px",marginBottom:"0.5rem" }}>📋</div>
              No custom attributes yet. Add up to 10 custom fields.
            </div>
          )}
          {configDraft.customAttributes.map((attr,idx)=>(
            <div key={attr.id} style={{ background:T.attrBg,border:`1px solid ${T.cardBorder}`,borderRadius:"8px",padding:"1rem",marginBottom:"0.75rem" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem" }}>
                <div style={{ fontSize:`${fs-1}px`,fontWeight:"600",color:T.textMuted }}>Attribute {idx+1}</div>
                <button style={S.btnDanger} onClick={()=>setConfigDraft(v=>({...v,customAttributes:v.customAttributes.filter(a=>a.id!==attr.id)}))}>Remove</button>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 150px",gap:"0.75rem" }}>
                <FG label="Display label"><input style={S.inp(false)} value={attr.label} placeholder="e.g. Badge number" onChange={e=>updAttr(attr.id,"label",e.target.value)}/></FG>
                <FG label="API key"><input style={S.inp(false)} value={attr.key} placeholder="e.g. badgeNumber" onChange={e=>updAttr(attr.id,"key",e.target.value)}/></FG>
                <FG label="Field type">
                  <select style={S.sel} value={attr.type} onChange={e=>updAttr(attr.id,"type",e.target.value)}>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="email">Email</option>
                    <option value="select">Dropdown</option>
                  </select>
                </FG>
              </div>
              {attr.type==="select" && (
                <FG label="Options (comma-separated)"><input style={S.inp(false)} value={attr.options||""} placeholder="Option A, Option B" onChange={e=>updAttr(attr.id,"options",e.target.value)}/></FG>
              )}
              <div style={{ display:"flex",alignItems:"center",gap:"6px",marginTop:"0.25rem" }}>
                <input type="checkbox" id={`req-${attr.id}`} checked={attr.required} onChange={e=>updAttr(attr.id,"required",e.target.checked)}/>
                <label htmlFor={`req-${attr.id}`} style={{ fontSize:`${fs-1}px`,color:T.text }}>Required field</label>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BRANDING */}
      {cfgSection === "branding" && (
        <div style={S.card}>
          <div style={S.secHead}>Branding &amp; appearance</div>

          {/* Names */}
          <div style={g2}>
            <FG label="Application name"><input style={S.inp(false)} value={configDraft.branding.appName} placeholder="Non-Employee Hub" onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,appName:e.target.value}}))}/></FG>
            <FG label="Company name"><input style={S.inp(false)} value={configDraft.branding.companyName} placeholder="Your Company" onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,companyName:e.target.value}}))}/></FG>
          </div>

          {/* Logo */}
          <FG label="Logo URL">
            <input style={S.inp(false)} value={configDraft.branding.logoUrl} placeholder="https://example.com/logo.png" onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,logoUrl:e.target.value}}))}/>
            <div style={{fontSize:`${fs-2}px`,color:T.textFaint,marginTop:"3px"}}>Hosted PNG or SVG image URL</div>
          </FG>

          {/* Colors */}
          <div style={g2}>
            <FG label="Primary color">
              <div style={{ display:"flex",gap:"8px",alignItems:"center" }}>
                <input type="color" value={configDraft.branding.primaryColor} onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,primaryColor:e.target.value}}))} style={{ width:"40px",height:"36px",border:`1px solid ${T.inputBorder}`,borderRadius:"6px",cursor:"pointer",padding:"2px",background:T.inputBg }}/>
                <input style={{...S.inp(false),flex:1}} value={configDraft.branding.primaryColor} onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,primaryColor:e.target.value}}))}/>
              </div>
            </FG>
            <FG label="Accent color">
              <div style={{ display:"flex",gap:"8px",alignItems:"center" }}>
                <input type="color" value={configDraft.branding.accentColor} onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,accentColor:e.target.value}}))} style={{ width:"40px",height:"36px",border:`1px solid ${T.inputBorder}`,borderRadius:"6px",cursor:"pointer",padding:"2px",background:T.inputBg }}/>
                <input style={{...S.inp(false),flex:1}} value={configDraft.branding.accentColor} onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,accentColor:e.target.value}}))}/>
              </div>
            </FG>
          </div>

          {/* Typography */}
          <div style={{ borderTop:`1px solid ${T.sectionBorder}`,paddingTop:"1.25rem",marginTop:"0.75rem" }}>
            <div style={{...S.secHead,border:"none",paddingBottom:"0.75rem"}}>Typography</div>
            <div style={g2}>
              <FG label="Font family">
                <select style={S.sel} value={configDraft.branding.fontFamily} onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,fontFamily:e.target.value}}))}>
                  {GOOGLE_FONTS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </FG>
              <FG label="Font size">
                <select style={S.sel} value={configDraft.branding.fontSize} onChange={e=>setConfigDraft(v=>({...v,branding:{...v.branding,fontSize:e.target.value}}))}>
                  {FONT_SIZES.map(f=><option key={f.label} value={f.label}>{f.label} ({f.base}px base)</option>)}
                </select>
              </FG>
            </div>
            {/* Font preview */}
            <div style={{ background:T.previewBg,border:`1px solid ${T.cardBorder}`,borderRadius:"8px",padding:"1rem",marginTop:"0.5rem",fontFamily:configDraft.branding.fontFamily }}>
              {(() => {
                const previewFs = (FONT_SIZES.find(f=>f.label===configDraft.branding.fontSize)||FONT_SIZES[1]).base;
                return (
                  <div>
                    <div style={{ fontSize:`${previewFs+5}px`,fontWeight:"600",color:T.text,marginBottom:"4px" }}>The quick brown fox jumps over the lazy dog</div>
                    <div style={{ fontSize:`${previewFs}px`,color:T.textMuted }}>Non-Employee Hub — SailPoint Identity Security Cloud integration. Font: {configDraft.branding.fontFamily.split(",")[0].replace(/'/g,"")} · Size: {previewFs}px</div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Header preview */}
          <div style={{ marginTop:"1.25rem" }}>
            <div style={{...S.lbl,marginBottom:"8px"}}>Header preview</div>
            <div style={{ background:configDraft.branding.primaryColor||RSM_BLUE,padding:"0 1.25rem",height:"54px",display:"flex",alignItems:"center",gap:"10px",borderRadius:"8px",borderBottom:`3px solid ${configDraft.branding.accentColor||RSM_MAGENTA}`,fontFamily:configDraft.branding.fontFamily }}>
              {configDraft.branding.logoUrl && <img src={configDraft.branding.logoUrl} alt="" style={{height:"28px",objectFit:"contain"}} onError={e=>e.target.style.display="none"}/>}
              {!configDraft.branding.logoUrl && <div style={{width:"28px",height:"28px",background:"rgba(255,255,255,0.2)",borderRadius:"4px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px"}}>🛡</div>}
              <div>
                <div style={{color:"#fff",fontWeight:"600",fontSize:`${(FONT_SIZES.find(f=>f.label===configDraft.branding.fontSize)||FONT_SIZES[1]).base+1}px`}}>{configDraft.branding.appName||"Non-Employee Hub"}</div>
                <div style={{color:"rgba(255,255,255,0.65)",fontSize:"10px",textTransform:"uppercase",letterSpacing:"0.5px"}}>{configDraft.branding.companyName||"Your Company"} · SailPoint ISC</div>
              </div>
              <div style={{marginLeft:"auto"}}>
                <div style={{background:T.toggleBg,borderRadius:"99px",width:"46px",height:"24px",display:"flex",alignItems:"center",padding:"2px",opacity:0.7}}>
                  <div style={{width:"20px",height:"20px",borderRadius:"50%",background:"rgba(255,255,255,0.9)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",transform:dark?"translateX(22px)":"translateX(0)"}}>
                    {dark?"🌙":"☀️"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:"flex",justifyContent:"flex-end",marginTop:"0.5rem" }}>
        <button style={S.btnP(false)} onClick={saveConfig}>Save configuration</button>
      </div>
    </div>
  );

  // ── Modals ─────────────────────────────────────────────────────────────────
  const PreviewModal = () => {
    if (!previewOpen) return null;
    const payload = buildPayload();
    return (
      <div style={S.overlay} onClick={()=>setPreviewOpen(false)}>
        <div style={{...S.modal,width:"680px"}} onClick={e=>e.stopPropagation()}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem" }}>
            <h3 style={{ margin:0,color:p,fontSize:`${fs+3}px`,fontWeight:"600" }}>Request payload preview</h3>
            <button style={{ border:"none",background:"none",cursor:"pointer",fontSize:"22px",color:T.textFaint,lineHeight:1 }} onClick={()=>setPreviewOpen(false)}>✕</button>
          </div>
          <div style={{ marginBottom:"0.75rem",padding:"8px 12px",background:dark?"#0C1A40":"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:"6px",fontSize:`${fs-1}px`,color:"#0369A1",fontFamily:"monospace" }}>
            POST {(config.apiEndpoint||config.tenantUrl||"https://tenant.identitynow.com").replace(/\/$/,"")}/v2026/non-employees
          </div>
          <pre style={{ background:T.codeBg,color:T.codeText,padding:"1rem",borderRadius:"8px",fontSize:"12px",overflowY:"auto",maxHeight:"45vh",margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word" }}>
            {JSON.stringify(payload,null,2)}
          </pre>
          <div style={{ display:"flex",gap:"0.75rem",marginTop:"1rem",justifyContent:"flex-end" }}>
            <button style={S.btnS(false)} onClick={()=>setPreviewOpen(false)}>Close</button>
            <button style={S.btnP(false)} onClick={handleSubmit} disabled={loading}>{loading?"Submitting…":"Submit to ISC"}</button>
          </div>
        </div>
      </div>
    );
  };

  const EditModal = () => {
    if (!editOpen||!editRecord) return null;
    return (
      <div style={S.overlay} onClick={()=>setEditOpen(false)}>
        <div style={{...S.modal,width:"700px"}} onClick={e=>e.stopPropagation()}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem" }}>
            <h3 style={{ margin:0,color:p,fontSize:`${fs+3}px`,fontWeight:"600" }}>Edit non-employee record</h3>
            <button style={{ border:"none",background:"none",cursor:"pointer",fontSize:"22px",color:T.textFaint,lineHeight:1 }} onClick={()=>setEditOpen(false)}>✕</button>
          </div>
          <div style={{ background:T.attrBg,borderRadius:"8px",padding:"6px 12px",marginBottom:"1rem",fontSize:`${fs-2}px`,color:T.textFaint }}>ID: {editRecord.id}</div>
          <div style={g2}>
            <FG label="First name"><input style={S.inp(false)} value={editRecord.firstName||""} onChange={e=>setEditRecord(v=>({...v,firstName:e.target.value}))}/></FG>
            <FG label="Last name"><input style={S.inp(false)} value={editRecord.lastName||""} onChange={e=>setEditRecord(v=>({...v,lastName:e.target.value}))}/></FG>
          </div>
          <div style={g2}>
            <FG label="Email"><input style={S.inp(false)} type="email" value={editRecord.email||""} onChange={e=>setEditRecord(v=>({...v,email:e.target.value}))}/></FG>
            <FG label="Phone"><input style={S.inp(false)} value={editRecord.phone||""} onChange={e=>setEditRecord(v=>({...v,phone:e.target.value}))}/></FG>
          </div>
          <div style={g2}>
            <FG label="Account name"><input style={S.inp(false)} value={editRecord.accountName||""} onChange={e=>setEditRecord(v=>({...v,accountName:e.target.value}))}/></FG>
            <FG label="Manager ID"><input style={S.inp(false)} value={editRecord.manager?.id||editRecord.manager||""} onChange={e=>setEditRecord(v=>({...v,manager:{id:e.target.value}}))}/></FG>
          </div>
          <div style={g2}>
            <FG label="Start date"><input type="date" style={S.inp(false)} value={editRecord.startDate||""} onChange={e=>setEditRecord(v=>({...v,startDate:e.target.value}))}/></FG>
            <FG label="End date"><input type="date" style={S.inp(false)} value={editRecord.endDate||""} onChange={e=>setEditRecord(v=>({...v,endDate:e.target.value}))}/></FG>
          </div>
          {config.customAttributes.length>0 && (
            <div style={{ marginTop:"0.75rem" }}>
              <div style={{fontSize:`${fs-2}px`,fontWeight:"600",color:T.textMuted,marginBottom:"0.75rem",textTransform:"uppercase",letterSpacing:"0.5px"}}>Custom attributes</div>
              <div style={g2}>
                {config.customAttributes.map(attr=>(
                  <FG key={attr.id} label={attr.label}>
                    <input style={S.inp(false)} value={editRecord.data?.[attr.key]||""} onChange={e=>setEditRecord(v=>({...v,data:{...v.data,[attr.key]:e.target.value}}))}/>
                  </FG>
                ))}
              </div>
            </div>
          )}
          <div style={{ display:"flex",gap:"0.75rem",justifyContent:"flex-end",marginTop:"1rem" }}>
            <button style={S.btnS(false)} onClick={()=>setEditOpen(false)}>Cancel</button>
            <button style={S.btnP(false)} onClick={handleUpdate} disabled={loading}>{loading?"Saving…":"Save changes"}</button>
          </div>
        </div>
      </div>
    );
  };

  const DeleteModal = () => {
    if (!deleteTarget) return null;
    return (
      <div style={S.overlay} onClick={()=>setDeleteTarget(null)}>
        <div style={{...S.modal,width:"440px",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
          <div style={{ fontSize:"36px",marginBottom:"0.75rem" }}>⚠️</div>
          <h3 style={{ margin:"0 0 0.5rem",color:T.text,fontSize:`${fs+3}px` }}>Delete non-employee record?</h3>
          <div style={{ color:T.textMuted,fontSize:`${fs}px`,marginBottom:"1.25rem" }}>
            This will permanently delete <strong style={{color:T.text}}>{deleteTarget.firstName} {deleteTarget.lastName}</strong>'s record from ISC. This cannot be undone.
          </div>
          <div style={{ display:"flex",gap:"0.75rem",justifyContent:"center" }}>
            <button style={S.btnS(false)} onClick={()=>setDeleteTarget(null)}>Cancel</button>
            <button style={{...S.btnP(false),background:"#DC2626"}} onClick={()=>handleDelete(deleteTarget.id)} disabled={loading}>{loading?"Deleting…":"Delete record"}</button>
          </div>
        </div>
      </div>
    );
  };

  const RejectModal = () => {
    if (!rejectTarget) return null;
    return (
      <div style={S.overlay} onClick={()=>setRejectTarget(null)}>
        <div style={{...S.modal,width:"480px"}} onClick={e=>e.stopPropagation()}>
          <h3 style={{ margin:"0 0 1rem",color:T.text,fontSize:`${fs+3}px` }}>Reject approval request</h3>
          <FG label="Rejection reason (optional)">
            <textarea style={{...S.inp(false),height:"90px",resize:"vertical"}} value={rejectComment} placeholder="Reason for rejection…" onChange={e=>setRejectComment(e.target.value)}/>
          </FG>
          <div style={{ display:"flex",gap:"0.75rem",justifyContent:"flex-end",marginTop:"0.75rem" }}>
            <button style={S.btnS(false)} onClick={()=>setRejectTarget(null)}>Cancel</button>
            <button style={{...S.btnP(false),background:"#DC2626"}} onClick={handleReject} disabled={loading}>{loading?"Rejecting…":"Reject request"}</button>
          </div>
        </div>
      </div>
    );
  };

  // ── Nav tabs ───────────────────────────────────────────────────────────────
  const TABS = [
    ["dashboard", "🏠", "Dashboard"],
    ["create",    "➕", "Create identity"],
    ["manage",    "🗂", "Manage identities"],
    ["approvals", "✅", "Approvals"],
    ["config",    "⚙",  "Configuration"],
  ];

  const anyModal = previewOpen || editOpen || !!deleteTarget || !!rejectTarget;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: ff, fontSize: `${fs}px`, minHeight: "100vh", background: T.bg, position: "relative", transition: "background 0.25s, color 0.25s" }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${p} 0%, ${p}EE 100%)`, padding: "0 1.5rem", height: "58px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `3px solid ${acc}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {config.branding.logoUrl
            ? <img src={config.branding.logoUrl} alt="" style={{ height: "30px", objectFit: "contain" }} onError={e=>e.target.style.display="none"}/>
            : <div style={{ width: "32px", height: "32px", background: "rgba(255,255,255,0.15)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 2L14 11H4L9 2Z" fill="white" fillOpacity="0.9"/>
                  <path d="M4 11H14L12.5 16H5.5L4 11Z" fill={acc} fillOpacity="0.9"/>
                </svg>
              </div>
          }
          <div>
            <div style={{ color: "#fff", fontSize: `${fs + 2}px`, fontWeight: "600", letterSpacing: "-0.3px" }}>{config.branding.appName}</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "10px", letterSpacing: "0.5px", textTransform: "uppercase" }}>{config.branding.companyName} · SailPoint ISC</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {config.clientName && <div style={{ color: "rgba(255,255,255,0.75)", fontSize: `${fs - 1}px` }}>{config.clientName}</div>}
          <DarkToggle />
        </div>
      </div>

      {/* Nav */}
      <div style={{ background: T.navBg, borderBottom: `1px solid ${T.navBorder}`, padding: "0 1.5rem", display: "flex", overflowX: "auto", transition: "background 0.25s" }}>
        {TABS.map(([t, icon, label]) => (
          <div key={t} onClick={() => setActiveTab(t)}
            style={{ padding: "0 1rem", height: "46px", display: "flex", alignItems: "center", cursor: "pointer", fontSize: `${fs - 1}px`, fontWeight: activeTab === t ? "600" : "400", whiteSpace: "nowrap", borderBottom: activeTab === t ? `2.5px solid ${p}` : "2.5px solid transparent", color: activeTab === t ? p : T.textMuted, gap: "6px", transition: "all 0.15s" }}>
            <span style={{ fontSize: "14px" }}>{icon}</span>{label}
          </div>
        ))}
      </div>

      {/* Notification */}
      {notification && (
        <div style={{ position: "absolute", top: "70px", right: "1.5rem", zIndex: 400, background: notification.type === "error" ? "#DC2626" : "#059669", color: "#fff", padding: "10px 18px", borderRadius: "8px", fontSize: `${fs - 1}px`, fontWeight: "500", boxShadow: `0 4px 12px ${T.notifShadow}`, maxWidth: "420px" }}>
          {notification.msg}
        </div>
      )}

      {/* Page */}
      <div style={{ padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" }}>
        {activeTab === "dashboard"  && <Dashboard />}
        {activeTab === "create"     && <CreateIdentity />}
        {activeTab === "manage"     && <ManageIdentities />}
        {activeTab === "approvals"  && <Approvals />}
        {activeTab === "config"     && <Configuration />}
      </div>

      {/* Modals */}
      {anyModal && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, minHeight: "100vh" }}>
          <PreviewModal /><EditModal /><DeleteModal /><RejectModal />
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(NonEmployeeHub));
