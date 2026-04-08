import { useState, useEffect, useCallback } from "react";

const RSM_BLUE = "#0033A1";
const RSM_MAGENTA = "#CC27B0";

const DEFAULT_CONFIG = {
  clientName: "", contactEmail: "", notes: "",
  tenantUrl: "", apiEndpoint: "", clientId: "", clientSecret: "",
  sourceId: "",
  customAttributes: [],
  branding: {
    appName: "Non-Employee Hub",
    companyName: "RSM",
    primaryColor: RSM_BLUE,
    accentColor: RSM_MAGENTA,
    logoUrl: "",
  }
};

const EMPTY_FORM = {
  accountName: "", firstName: "", lastName: "", email: "",
  phone: "", manager: "", contractingOrg: "",
  startDate: "", endDate: "", customData: {}
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const initials = (f, l) => `${(f||"?")[0]}${(l||"?")[0]}`.toUpperCase();
const statusColors = {
  PENDING: { bg: "#FFF3CD", color: "#856404" },
  APPROVED: { bg: "#D1E7DD", color: "#0A3622" },
  REJECTED: { bg: "#F8D7DA", color: "#58151C" },
  ACTIVE: { bg: "#CFE2FF", color: "#084298" },
  EXPIRED: { bg: "#E2E3E5", color: "#383D41" },
};

export default function NonEmployeeHub() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [configDraft, setConfigDraft] = useState(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [configSection, setConfigSection] = useState("connectivity");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [identities, setIdentities] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [token, setToken] = useState(null);
  const [tokenExpiry, setTokenExpiry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [connectStatus, setConnectStatus] = useState(null);
  const [connectMsg, setConnectMsg] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectComment, setRejectComment] = useState("");

  const p = config.branding.primaryColor || RSM_BLUE;
  const acc = config.branding.accentColor || RSM_MAGENTA;

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const getToken = async (cfg = config) => {
    if (token && Date.now() < tokenExpiry) return token;
    const url = `${cfg.tenantUrl}/oauth/token`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret
      })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Authentication failed (${res.status}): ${txt}`);
    }
    const data = await res.json();
    setToken(data.access_token);
    setTokenExpiry(Date.now() + (data.expires_in - 60) * 1000);
    return data.access_token;
  };

  const apiCall = async (method, path, body, cfg = config) => {
    const tok = await getToken(cfg);
    const base = (cfg.apiEndpoint || cfg.tenantUrl).replace(/\/$/, "");
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "Authorization": `Bearer ${tok}`, "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`API error ${res.status}: ${txt}`);
    }
    if (res.status === 204) return null;
    return res.json();
  };

  const testConnectivity = async () => {
    setConnectStatus("testing");
    setConnectMsg("");
    try {
      await getToken(configDraft);
      setConnectStatus("success");
      setConnectMsg("Connected to ISC tenant successfully.");
    } catch (e) {
      setConnectStatus("error");
      setConnectMsg(e.message);
    }
  };

  const loadIdentities = async () => {
    setListLoading(true);
    try {
      const qs = config.sourceId ? `?sourceId=${config.sourceId}&limit=250` : "?limit=250";
      const data = await apiCall("GET", `/v2026/non-employees${qs}`);
      setIdentities(Array.isArray(data) ? data : []);
    } catch (e) { notify(e.message, "error"); }
    setListLoading(false);
  };

  const loadApprovals = async () => {
    setListLoading(true);
    try {
      const data = await apiCall("GET", "/v2026/non-employee-approvals?limit=50");
      setApprovals(Array.isArray(data) ? data : []);
    } catch (e) { notify(e.message, "error"); }
    setListLoading(false);
  };

  const loadSummary = async () => {
    if (!config.sourceId || !config.tenantUrl) return;
    try {
      const data = await apiCall("GET", `/v2026/non-employee-requests/summary/${config.sourceId}`);
      setSummary(data);
    } catch (_) {}
  };

  useEffect(() => {
    if (activeTab === "manage") loadIdentities();
    else if (activeTab === "approvals") loadApprovals();
    else if (activeTab === "dashboard") loadSummary();
  }, [activeTab]);

  const validateForm = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email format";
    if (form.phone && !/^\+?[\d\s\-(). ]{7,20}$/.test(form.phone)) e.phone = "Invalid phone (e.g. +1 555-000-0000)";
    if (!form.startDate) e.startDate = "Required";
    if (!form.endDate) e.endDate = "Required";
    if (form.startDate && form.endDate && form.endDate < form.startDate) e.endDate = "End date must be after start date";
    if (!form.manager.trim()) e.manager = "Required";
    config.customAttributes.forEach(a => {
      if (a.required && !form.customData[a.key]) e[`custom_${a.key}`] = "Required";
    });
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildPayload = () => {
    const payload = {
      accountName: form.accountName || `${form.firstName.toLowerCase()}.${form.lastName.toLowerCase()}`,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone || undefined,
      manager: { id: form.manager },
      sourceId: config.sourceId,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
      data: {}
    };
    if (form.contractingOrg) payload.data.contractingOrganization = form.contractingOrg;
    config.customAttributes.forEach(a => {
      if (form.customData[a.key]) payload.data[a.key] = form.customData[a.key];
    });
    return payload;
  };

  const handleSubmit = async () => {
    if (!validateForm()) { setPreviewOpen(false); return; }
    setLoading(true);
    try {
      await apiCall("POST", "/v2026/non-employees", buildPayload());
      notify("Non-employee identity created successfully!");
      setForm(EMPTY_FORM);
      setFormErrors({});
      setPreviewOpen(false);
    } catch (e) { notify(e.message, "error"); }
    setLoading(false);
  };

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await apiCall("PUT", `/v2026/non-employees/${editRecord.id}`, {
        accountName: editRecord.accountName,
        firstName: editRecord.firstName,
        lastName: editRecord.lastName,
        email: editRecord.email,
        phone: editRecord.phone,
        manager: editRecord.manager,
        sourceId: config.sourceId,
        startDate: editRecord.startDate,
        endDate: editRecord.endDate,
        data: editRecord.data || {}
      });
      notify("Record updated successfully!");
      setEditOpen(false);
      loadIdentities();
    } catch (e) { notify(e.message, "error"); }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    setLoading(true);
    try {
      await apiCall("DELETE", `/v2026/non-employees/${id}`);
      notify("Record deleted.");
      setDeleteConfirm(null);
      loadIdentities();
    } catch (e) { notify(e.message, "error"); }
    setLoading(false);
  };

  const handleApprove = async (id) => {
    setLoading(true);
    try {
      await apiCall("POST", `/v2026/non-employee-approvals/${id}/approve`, { comment: "Approved via Non-Employee Hub" });
      notify("Request approved!");
      loadApprovals();
    } catch (e) { notify(e.message, "error"); }
    setLoading(false);
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await apiCall("POST", `/v2026/non-employee-approvals/${rejectModal}/reject`, { comment: rejectComment || "Rejected via Non-Employee Hub" });
      notify("Request rejected.");
      setRejectModal(null);
      setRejectComment("");
      loadApprovals();
    } catch (e) { notify(e.message, "error"); }
    setLoading(false);
  };

  const saveConfig = () => {
    setConfig(configDraft);
    setToken(null);
    setTokenExpiry(0);
    notify("Configuration saved.");
  };

  const addCustomAttr = () => {
    if (configDraft.customAttributes.length >= 10) return;
    setConfigDraft(prev => ({
      ...prev,
      customAttributes: [...prev.customAttributes, { id: Date.now(), label: "", key: "", required: false, type: "text", options: "" }]
    }));
  };

  const updAttr = (id, field, val) => setConfigDraft(prev => ({
    ...prev,
    customAttributes: prev.customAttributes.map(a => a.id === id ? { ...a, [field]: val } : a)
  }));

  const filteredIdentities = identities.filter(i => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return `${i.firstName} ${i.lastName} ${i.email} ${i.accountName}`.toLowerCase().includes(s);
  });

  // ─── Styles ───────────────────────────────────────────────────────────────
  const S = {
    wrap: { fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: "100vh", background: "#F0F2F5", position: "relative" },
    header: {
      background: `linear-gradient(135deg, ${p} 0%, ${p}DD 100%)`,
      padding: "0 1.5rem", height: "58px", display: "flex", alignItems: "center",
      justifyContent: "space-between", borderBottom: `3px solid ${acc}`
    },
    headerBrand: { display: "flex", alignItems: "center", gap: "10px" },
    headerTitle: { color: "#fff", fontSize: "16px", fontWeight: "600", letterSpacing: "-0.3px" },
    headerSub: { color: "rgba(255,255,255,0.65)", fontSize: "11px", letterSpacing: "0.5px", textTransform: "uppercase" },
    headerRight: { color: "rgba(255,255,255,0.75)", fontSize: "12px" },
    nav: { background: "#fff", borderBottom: "1px solid #DDE1E8", padding: "0 1.5rem", display: "flex", overflowX: "auto" },
    navItem: (active) => ({
      padding: "0 1rem", height: "46px", display: "flex", alignItems: "center", cursor: "pointer",
      fontSize: "13px", fontWeight: active ? "600" : "400", whiteSpace: "nowrap",
      borderBottom: active ? `2.5px solid ${p}` : "2.5px solid transparent",
      color: active ? p : "#6B7280", gap: "6px",
      transition: "all 0.15s"
    }),
    page: { padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" },
    card: { background: "#fff", borderRadius: "10px", border: "1px solid #E4E7EB", padding: "1.25rem 1.5rem", marginBottom: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
    secHead: { fontSize: "13px", fontWeight: "600", color: p, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "8px", paddingBottom: "0.6rem", borderBottom: `1.5px solid ${p}22` },
    lbl: { fontSize: "12px", fontWeight: "500", color: "#4B5563", marginBottom: "4px" },
    inp: (err) => ({ width: "100%", padding: "8px 11px", border: `1px solid ${err ? "#E53E3E" : "#D1D5DB"}`, borderRadius: "6px", fontSize: "13px", outline: "none", boxSizing: "border-box", color: "#111", background: "#FAFAFA", transition: "border 0.15s" }),
    sel: { width: "100%", padding: "8px 11px", border: "1px solid #D1D5DB", borderRadius: "6px", fontSize: "13px", color: "#111", background: "#FAFAFA" },
    errMsg: { fontSize: "11px", color: "#E53E3E", marginTop: "3px" },
    g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" },
    g3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.85rem" },
    g4: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.85rem" },
    btnP: (sm) => ({ background: p, color: "#fff", border: "none", padding: sm ? "6px 14px" : "8px 20px", borderRadius: "6px", cursor: "pointer", fontSize: sm ? "12px" : "13px", fontWeight: "500", display: "flex", alignItems: "center", gap: "5px" }),
    btnS: (sm) => ({ background: "#fff", color: p, border: `1px solid ${p}`, padding: sm ? "5px 12px" : "8px 18px", borderRadius: "6px", cursor: "pointer", fontSize: sm ? "12px" : "13px", fontWeight: "500" }),
    btnDanger: { background: "#fff", color: "#DC2626", border: "1px solid #DC2626", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
    btnApprove: { background: "#059669", color: "#fff", border: "none", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
    tbl: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
    th: { padding: "9px 12px", textAlign: "left", background: "#F8F9FB", color: "#374151", fontWeight: "600", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #E4E7EB" },
    td: { padding: "10px 12px", borderBottom: "1px solid #F0F2F5", color: "#374151", verticalAlign: "middle" },
    badge: (status) => {
      const c = statusColors[status] || { bg: "#E2E3E5", color: "#383D41" };
      return { background: c.bg, color: c.color, padding: "2px 9px", borderRadius: "99px", fontSize: "11px", fontWeight: "600", display: "inline-block" };
    },
    statCard: { background: "#fff", borderRadius: "10px", border: "1px solid #E4E7EB", padding: "1rem 1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
    overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, minHeight: "100vh", background: "rgba(0,0,0,0.45)", zIndex: 500, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "80px" },
    modal: { background: "#fff", borderRadius: "12px", padding: "1.5rem", width: "650px", maxWidth: "95%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
    pillTab: (active) => ({ padding: "5px 14px", borderRadius: "20px", cursor: "pointer", fontSize: "12px", fontWeight: active ? "600" : "400", background: active ? p : "transparent", color: active ? "#fff" : "#6B7280", border: active ? "none" : "1px solid #D1D5DB", transition: "all 0.15s" }),
  };

  const FG = ({ label, err, required, children }) => (
    <div style={{ marginBottom: "0.7rem" }}>
      <div style={S.lbl}>{label}{required && <span style={{ color: "#E53E3E" }}> *</span>}</div>
      {children}
      {err && <div style={S.errMsg}>{err}</div>}
    </div>
  );

  // ─── Dashboard ────────────────────────────────────────────────────────────
  const Dashboard = () => (
    <div>
      <div style={{ marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "#111" }}>
            {config.branding.companyName} — Non-Employee Hub
          </h2>
          <div style={{ fontSize: "13px", color: "#6B7280", marginTop: "3px" }}>
            SailPoint Identity Security Cloud · Non-Employee Lifecycle Management
          </div>
        </div>
        <button style={S.btnP(false)} onClick={() => setActiveTab("create")}>
          <span style={{ fontSize: "16px" }}>+</span> Create Identity
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {[
          { label: "Total Identities", value: identities.length || summary?.total || 0, icon: "👥", color: p },
          { label: "Pending Approval", value: summary?.pending || 0, icon: "⏳", color: "#D97706" },
          { label: "Approved", value: summary?.approved || 0, icon: "✓", color: "#059669" },
          { label: "Rejected", value: summary?.rejected || 0, icon: "✗", color: "#DC2626" },
        ].map(s => (
          <div key={s.label} style={S.statCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
              <div style={{ fontSize: "18px" }}>{s.icon}</div>
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: s.color, marginTop: "6px" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
        <div style={S.card}>
          <div style={S.secHead}>Quick actions</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {[
              { label: "Create Non-Employee", sub: "Add a new non-employee identity", tab: "create", icon: "➕" },
              { label: "Manage Identities", sub: "View and edit all identities", tab: "manage", icon: "🗂" },
              { label: "Review Approvals", sub: "Approve or reject pending requests", tab: "approvals", icon: "✅" },
              { label: "Configuration", sub: "Set up tenant connectivity", tab: "config", icon: "⚙" },
            ].map(a => (
              <div key={a.tab} onClick={() => setActiveTab(a.tab)} style={{ padding: "1rem", border: "1px solid #E4E7EB", borderRadius: "8px", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = p}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#E4E7EB"}>
                <div style={{ fontSize: "20px", marginBottom: "6px" }}>{a.icon}</div>
                <div style={{ fontWeight: "600", fontSize: "13px", color: "#111", marginBottom: "3px" }}>{a.label}</div>
                <div style={{ fontSize: "11px", color: "#6B7280" }}>{a.sub}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={S.card}>
          <div style={S.secHead}>Connection status</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { label: "Tenant", value: config.tenantUrl || "Not configured" },
              { label: "Client", value: config.clientName || "Not set" },
              { label: "Source ID", value: config.sourceId || "Not set" },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "6px 0", borderBottom: "1px solid #F0F2F5" }}>
                <span style={{ color: "#6B7280" }}>{r.label}</span>
                <span style={{ color: "#111", fontWeight: "500", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{r.value}</span>
              </div>
            ))}
            <div style={{ marginTop: "0.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: config.tenantUrl ? "#059669" : "#9CA3AF" }}></div>
                <span style={{ fontSize: "12px", color: config.tenantUrl ? "#059669" : "#9CA3AF" }}>
                  {config.tenantUrl ? "Configured" : "Not configured"}
                </span>
              </div>
            </div>
          </div>
          {!config.tenantUrl && (
            <button style={{ ...S.btnS(true), marginTop: "0.75rem", width: "100%", justifyContent: "center" }} onClick={() => setActiveTab("config")}>
              Configure now
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ─── Create Identity ──────────────────────────────────────────────────────
  const CreateIdentity = () => (
    <div>
      <div style={{ marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "#111" }}>Create non-employee identity</h2>
      </div>

      <div style={S.card}>
        <div style={S.secHead}>
          <span style={{ background: p, color: "#fff", width: "20px", height: "20px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700" }}>1</span>
          Identity details
        </div>
        <div style={S.g2}>
          <FG label="First name" required err={formErrors.firstName}>
            <input style={S.inp(formErrors.firstName)} value={form.firstName} placeholder="John"
              onChange={e => { setForm(p => ({ ...p, firstName: e.target.value })); setFormErrors(p => ({ ...p, firstName: null })); }} />
          </FG>
          <FG label="Last name" required err={formErrors.lastName}>
            <input style={S.inp(formErrors.lastName)} value={form.lastName} placeholder="Smith"
              onChange={e => { setForm(p => ({ ...p, lastName: e.target.value })); setFormErrors(p => ({ ...p, lastName: null })); }} />
          </FG>
        </div>
        <div style={S.g2}>
          <FG label="Account name" err={null}>
            <input style={S.inp(false)} value={form.accountName} placeholder="Auto-generated if left blank"
              onChange={e => setForm(p => ({ ...p, accountName: e.target.value }))} />
          </FG>
          <FG label="Contracting organization" err={null}>
            <input style={S.inp(false)} value={form.contractingOrg} placeholder="Acme Consulting LLC"
              onChange={e => setForm(p => ({ ...p, contractingOrg: e.target.value }))} />
          </FG>
        </div>
        <div style={S.g2}>
          <FG label="Email address" required err={formErrors.email}>
            <input style={S.inp(formErrors.email)} type="email" value={form.email} placeholder="john.smith@contractor.com"
              onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setFormErrors(p => ({ ...p, email: null })); }} />
          </FG>
          <FG label="Phone number" err={formErrors.phone}>
            <input style={S.inp(formErrors.phone)} value={form.phone} placeholder="+1 (555) 000-0000"
              onChange={e => { setForm(p => ({ ...p, phone: e.target.value })); setFormErrors(p => ({ ...p, phone: null })); }} />
          </FG>
        </div>
        <FG label="Manager (SailPoint identity ID)" required err={formErrors.manager}>
          <input style={S.inp(formErrors.manager)} value={form.manager} placeholder="e.g. 2c9180858082150f0180893dbaf44201"
            onChange={e => { setForm(p => ({ ...p, manager: e.target.value })); setFormErrors(p => ({ ...p, manager: null })); }} />
          <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "3px" }}>Enter the SailPoint identity ID of the non-employee's manager</div>
        </FG>
        <div style={S.g2}>
          <FG label="Start date" required err={formErrors.startDate}>
            <input type="date" style={S.inp(formErrors.startDate)} value={form.startDate}
              onChange={e => { setForm(p => ({ ...p, startDate: e.target.value })); setFormErrors(p => ({ ...p, startDate: null })); }} />
          </FG>
          <FG label="End date" required err={formErrors.endDate}>
            <input type="date" style={S.inp(formErrors.endDate)} value={form.endDate}
              onChange={e => { setForm(p => ({ ...p, endDate: e.target.value })); setFormErrors(p => ({ ...p, endDate: null })); }} />
          </FG>
        </div>
      </div>

      {config.customAttributes.length > 0 && (
        <div style={S.card}>
          <div style={S.secHead}>
            <span style={{ background: acc, color: "#fff", width: "20px", height: "20px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700" }}>2</span>
            Additional attributes
          </div>
          <div style={S.g2}>
            {config.customAttributes.map(attr => (
              <FG key={attr.id} label={attr.label} required={attr.required} err={formErrors[`custom_${attr.key}`]}>
                {attr.type === "select" ? (
                  <select style={S.sel} value={form.customData[attr.key] || ""} onChange={e => setForm(p => ({ ...p, customData: { ...p.customData, [attr.key]: e.target.value } }))}>
                    <option value="">— Select —</option>
                    {(attr.options || "").split(",").map(o => o.trim()).filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={attr.type} style={S.inp(formErrors[`custom_${attr.key}`])} value={form.customData[attr.key] || ""} placeholder={attr.label}
                    onChange={e => setForm(p => ({ ...p, customData: { ...p.customData, [attr.key]: e.target.value } }))} />
                )}
              </FG>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingBottom: "1rem" }}>
        <button style={S.btnS(false)} onClick={() => { setPreviewOpen(true); }}>Preview JSON</button>
        <button style={S.btnP(false)} onClick={handleSubmit} disabled={loading}>
          {loading ? "Submitting…" : "Submit to ISC"}
        </button>
      </div>
    </div>
  );

  // ─── Manage Identities ────────────────────────────────────────────────────
  const ManageIdentities = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "#111" }}>Non-employee identities</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input style={{ ...S.inp(false), width: "220px" }} placeholder="Search by name or email…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <button style={S.btnS(false)} onClick={loadIdentities}>{listLoading ? "Loading…" : "Refresh"}</button>
          <button style={S.btnP(false)} onClick={() => setActiveTab("create")}>+ Create</button>
        </div>
      </div>
      <div style={S.card}>
        {listLoading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#6B7280" }}>Loading identities…</div>
        ) : filteredIdentities.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: "32px", marginBottom: "0.75rem" }}>👥</div>
            <div style={{ color: "#6B7280", fontSize: "14px" }}>No non-employee records found.</div>
            <div style={{ color: "#9CA3AF", fontSize: "12px", marginTop: "4px" }}>Ensure your Source ID is configured and you are connected to your ISC tenant.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.tbl}>
              <thead>
                <tr>
                  {["Identity", "Email", "Phone", "Organization", "Start", "End", "Actions"].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredIdentities.map(rec => (
                  <tr key={rec.id} style={{ transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#FAFAFA"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}>
                    <td style={S.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: `${p}15`, color: p, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", flexShrink: 0 }}>
                          {initials(rec.firstName, rec.lastName)}
                        </div>
                        <div>
                          <div style={{ fontWeight: "500", color: "#111", fontSize: "13px" }}>{rec.firstName} {rec.lastName}</div>
                          <div style={{ fontSize: "11px", color: "#9CA3AF" }}>{rec.accountName}</div>
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>{rec.email}</td>
                    <td style={S.td}>{rec.phone || "—"}</td>
                    <td style={S.td}>{rec.data?.contractingOrganization || "—"}</td>
                    <td style={S.td}>{fmtDate(rec.startDate)}</td>
                    <td style={S.td}>{fmtDate(rec.endDate)}</td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: "5px" }}>
                        <button style={S.btnS(true)} onClick={() => { setEditRecord({ ...rec, startDate: rec.startDate?.slice(0, 10), endDate: rec.endDate?.slice(0, 10) }); setEditOpen(true); }}>Edit</button>
                        <button style={S.btnDanger} onClick={() => setDeleteConfirm(rec)}>Delete</button>
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

  // ─── Approvals ────────────────────────────────────────────────────────────
  const Approvals = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "#111" }}>Approval requests</h2>
        <button style={S.btnS(false)} onClick={loadApprovals}>{listLoading ? "Loading…" : "Refresh"}</button>
      </div>
      <div style={S.card}>
        {listLoading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#6B7280" }}>Loading approval requests…</div>
        ) : approvals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: "32px", marginBottom: "0.75rem" }}>✅</div>
            <div style={{ color: "#6B7280", fontSize: "14px" }}>No approval requests found.</div>
          </div>
        ) : (
          <table style={S.tbl}>
            <thead>
              <tr>
                {["Subject", "Requester", "Source", "Created", "Status", "Actions"].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {approvals.map(a => {
                const status = a.approvalStatus || "PENDING";
                const isPending = !a.approvalStatus || a.approvalStatus === "PENDING";
                return (
                  <tr key={a.id}>
                    <td style={S.td}>
                      <div style={{ fontWeight: "500" }}>{a.nonEmployee?.firstName} {a.nonEmployee?.lastName}</div>
                      <div style={{ fontSize: "11px", color: "#9CA3AF" }}>{a.nonEmployee?.email}</div>
                    </td>
                    <td style={S.td}>{a.requester?.name || "—"}</td>
                    <td style={S.td}>{a.sourceId || "—"}</td>
                    <td style={S.td}>{fmtDate(a.created)}</td>
                    <td style={S.td}><span style={S.badge(status)}>{status}</span></td>
                    <td style={S.td}>
                      {isPending ? (
                        <div style={{ display: "flex", gap: "5px" }}>
                          <button style={S.btnApprove} onClick={() => handleApprove(a.id)} disabled={loading}>Approve</button>
                          <button style={S.btnDanger} onClick={() => setRejectModal(a.id)} disabled={loading}>Reject</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Completed</span>
                      )}
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

  // ─── Configuration ────────────────────────────────────────────────────────
  const Configuration = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "#111" }}>Configuration</h2>
        <button style={S.btnP(false)} onClick={saveConfig}>Save configuration</button>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
        {[["connectivity", "Connectivity"], ["attributes", "Custom attributes"], ["branding", "Branding"]].map(([k, label]) => (
          <button key={k} style={S.pillTab(configSection === k)} onClick={() => setConfigSection(k)}>{label}</button>
        ))}
      </div>

      {configSection === "connectivity" && (
        <div style={S.card}>
          <div style={S.secHead}>Client information</div>
          <div style={S.g2}>
            <FG label="Client name"><input style={S.inp(false)} value={configDraft.clientName} placeholder="ACME Corporation" onChange={e => setConfigDraft(p => ({ ...p, clientName: e.target.value }))} /></FG>
            <FG label="Contact email"><input style={S.inp(false)} type="email" value={configDraft.contactEmail} placeholder="admin@acme.com" onChange={e => setConfigDraft(p => ({ ...p, contactEmail: e.target.value }))} /></FG>
          </div>
          <FG label="Notes"><textarea style={{ ...S.inp(false), height: "70px", resize: "vertical" }} value={configDraft.notes} placeholder="Optional notes about this tenant configuration" onChange={e => setConfigDraft(p => ({ ...p, notes: e.target.value }))} /></FG>

          <div style={{ ...S.secHead, marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid #F0F2F5", borderBottom: "none" }}>ISC tenant connection</div>
          <FG label="Tenant URL" required>
            <input style={S.inp(false)} value={configDraft.tenantUrl} placeholder="https://tenant.identitynow.com" onChange={e => setConfigDraft(p => ({ ...p, tenantUrl: e.target.value }))} />
            <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "3px" }}>Base URL of your ISC tenant (used for OAuth token endpoint)</div>
          </FG>
          <FG label="API endpoint">
            <input style={S.inp(false)} value={configDraft.apiEndpoint} placeholder="https://tenant.api.identitynow.com (leave blank to use Tenant URL)" onChange={e => setConfigDraft(p => ({ ...p, apiEndpoint: e.target.value }))} />
            <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "3px" }}>Leave blank to use the Tenant URL for both auth and API calls</div>
          </FG>
          <div style={S.g2}>
            <FG label="Client ID" required><input style={S.inp(false)} value={configDraft.clientId} placeholder="OAuth client ID" onChange={e => setConfigDraft(p => ({ ...p, clientId: e.target.value }))} /></FG>
            <FG label="Client secret" required><input style={S.inp(false)} type="password" value={configDraft.clientSecret} placeholder="OAuth client secret" onChange={e => setConfigDraft(p => ({ ...p, clientSecret: e.target.value }))} /></FG>
          </div>
          <FG label="Non-employee source ID" required>
            <input style={S.inp(false)} value={configDraft.sourceId} placeholder="e.g. 2c918083880b9dff0188135036c5b4ba" onChange={e => setConfigDraft(p => ({ ...p, sourceId: e.target.value }))} />
            <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "3px" }}>The SailPoint source ID designated for non-employee identities</div>
          </FG>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #F0F2F5" }}>
            <button style={S.btnS(false)} onClick={testConnectivity} disabled={connectStatus === "testing"}>
              {connectStatus === "testing" ? "Testing…" : "Test connectivity"}
            </button>
            {connectStatus === "success" && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#059669", fontSize: "13px" }}>
                <span>●</span> {connectMsg}
              </div>
            )}
            {connectStatus === "error" && (
              <div style={{ color: "#DC2626", fontSize: "12px", maxWidth: "500px" }}>✗ {connectMsg}</div>
            )}
          </div>
        </div>
      )}

      {configSection === "attributes" && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div style={S.secHead}>Custom attributes ({configDraft.customAttributes.length} / 10)</div>
            <button style={S.btnP(true)} onClick={addCustomAttr} disabled={configDraft.customAttributes.length >= 10}>+ Add attribute</button>
          </div>

          {configDraft.customAttributes.length === 0 && (
            <div style={{ textAlign: "center", padding: "2rem", color: "#9CA3AF" }}>
              <div style={{ fontSize: "28px", marginBottom: "0.5rem" }}>📋</div>
              No custom attributes defined. Add up to 10 custom fields that will appear on the identity creation form.
            </div>
          )}

          {configDraft.customAttributes.map((attr, idx) => (
            <div key={attr.id} style={{ background: "#FAFAFA", border: "1px solid #E4E7EB", borderRadius: "8px", padding: "1rem", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>Attribute {idx + 1}</div>
                <button style={S.btnDanger} onClick={() => setConfigDraft(p => ({ ...p, customAttributes: p.customAttributes.filter(a => a.id !== attr.id) }))}>Remove</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: "0.75rem" }}>
                <FG label="Display label">
                  <input style={S.inp(false)} value={attr.label} placeholder="e.g. Badge Number" onChange={e => updAttr(attr.id, "label", e.target.value)} />
                </FG>
                <FG label="Attribute key (API field name)">
                  <input style={S.inp(false)} value={attr.key} placeholder="e.g. badgeNumber" onChange={e => updAttr(attr.id, "key", e.target.value)} />
                </FG>
                <FG label="Field type">
                  <select style={S.sel} value={attr.type} onChange={e => updAttr(attr.id, "type", e.target.value)}>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="email">Email</option>
                    <option value="select">Dropdown</option>
                  </select>
                </FG>
              </div>
              {attr.type === "select" && (
                <FG label="Dropdown options (comma-separated)">
                  <input style={S.inp(false)} value={attr.options || ""} placeholder="Option A, Option B, Option C" onChange={e => updAttr(attr.id, "options", e.target.value)} />
                </FG>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "0.25rem" }}>
                <input type="checkbox" id={`req-${attr.id}`} checked={attr.required} onChange={e => updAttr(attr.id, "required", e.target.checked)} />
                <label htmlFor={`req-${attr.id}`} style={{ fontSize: "12px", color: "#374151" }}>Required field</label>
              </div>
            </div>
          ))}
        </div>
      )}

      {configSection === "branding" && (
        <div style={S.card}>
          <div style={S.secHead}>UI branding</div>
          <div style={S.g2}>
            <FG label="Application name"><input style={S.inp(false)} value={configDraft.branding.appName} placeholder="Non-Employee Hub" onChange={e => setConfigDraft(p => ({ ...p, branding: { ...p.branding, appName: e.target.value } }))} /></FG>
            <FG label="Company name"><input style={S.inp(false)} value={configDraft.branding.companyName} placeholder="Your Company" onChange={e => setConfigDraft(p => ({ ...p, branding: { ...p.branding, companyName: e.target.value } }))} /></FG>
          </div>
          <FG label="Logo URL">
            <input style={S.inp(false)} value={configDraft.branding.logoUrl} placeholder="https://example.com/logo.png" onChange={e => setConfigDraft(p => ({ ...p, branding: { ...p.branding, logoUrl: e.target.value } }))} />
            <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "3px" }}>Hosted image URL for your company logo (PNG, SVG recommended)</div>
          </FG>
          <div style={S.g2}>
            <FG label="Primary color">
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="color" value={configDraft.branding.primaryColor} onChange={e => setConfigDraft(p => ({ ...p, branding: { ...p.branding, primaryColor: e.target.value } }))} style={{ width: "40px", height: "36px", border: "1px solid #D1D5DB", borderRadius: "6px", cursor: "pointer", padding: "2px" }} />
                <input style={{ ...S.inp(false), flex: 1 }} value={configDraft.branding.primaryColor} onChange={e => setConfigDraft(p => ({ ...p, branding: { ...p.branding, primaryColor: e.target.value } }))} />
              </div>
            </FG>
            <FG label="Accent color">
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="color" value={configDraft.branding.accentColor} onChange={e => setConfigDraft(p => ({ ...p, branding: { ...p.branding, accentColor: e.target.value } }))} style={{ width: "40px", height: "36px", border: "1px solid #D1D5DB", borderRadius: "6px", cursor: "pointer", padding: "2px" }} />
                <input style={{ ...S.inp(false), flex: 1 }} value={configDraft.branding.accentColor} onChange={e => setConfigDraft(p => ({ ...p, branding: { ...p.branding, accentColor: e.target.value } }))} />
              </div>
            </FG>
          </div>

          <div style={{ marginTop: "1.25rem" }}>
            <div style={S.lbl}>Header preview</div>
            <div style={{ background: configDraft.branding.primaryColor || RSM_BLUE, padding: "0 1.25rem", height: "54px", display: "flex", alignItems: "center", gap: "10px", borderRadius: "8px", borderBottom: `3px solid ${configDraft.branding.accentColor || RSM_MAGENTA}` }}>
              {configDraft.branding.logoUrl && <img src={configDraft.branding.logoUrl} alt="" style={{ height: "28px", objectFit: "contain" }} onError={e => e.target.style.display = "none"} />}
              {!configDraft.branding.logoUrl && (
                <div style={{ width: "28px", height: "28px", background: "rgba(255,255,255,0.2)", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>🛡</div>
              )}
              <div>
                <div style={{ color: "#fff", fontWeight: "600", fontSize: "14px" }}>{configDraft.branding.appName || "Non-Employee Hub"}</div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{configDraft.branding.companyName || "Your Company"} · SailPoint ISC</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
        <button style={S.btnP(false)} onClick={saveConfig}>Save configuration</button>
      </div>
    </div>
  );

  // ─── JSON Preview Modal ───────────────────────────────────────────────────
  const PreviewModal = () => {
    if (!previewOpen) return null;
    const payload = buildPayload();
    return (
      <div style={S.overlay} onClick={() => setPreviewOpen(false)}>
        <div style={{ ...S.modal, width: "680px" }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, color: p, fontSize: "16px", fontWeight: "600" }}>Request payload preview</h3>
            <button style={{ border: "none", background: "none", cursor: "pointer", fontSize: "22px", color: "#9CA3AF", lineHeight: 1 }} onClick={() => setPreviewOpen(false)}>✕</button>
          </div>
          <div style={{ marginBottom: "0.75rem", padding: "8px 12px", background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: "6px", fontSize: "12px", color: "#0369A1" }}>
            <strong>POST</strong> {(config.apiEndpoint || config.tenantUrl).replace(/\/$/, "")}/v2026/non-employees
          </div>
          <pre style={{ background: "#1E1E2E", color: "#CDD6F4", padding: "1rem", borderRadius: "8px", fontSize: "12px", overflowY: "auto", maxHeight: "45vh", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {JSON.stringify(payload, null, 2)}
          </pre>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", justifyContent: "flex-end" }}>
            <button style={S.btnS(false)} onClick={() => setPreviewOpen(false)}>Close</button>
            <button style={S.btnP(false)} onClick={handleSubmit} disabled={loading}>{loading ? "Submitting…" : "Submit to ISC"}</button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Edit Modal ───────────────────────────────────────────────────────────
  const EditModal = () => {
    if (!editOpen || !editRecord) return null;
    return (
      <div style={S.overlay} onClick={() => setEditOpen(false)}>
        <div style={{ ...S.modal, width: "680px" }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, color: p, fontSize: "16px", fontWeight: "600" }}>Edit non-employee record</h3>
            <button style={{ border: "none", background: "none", cursor: "pointer", fontSize: "22px", color: "#9CA3AF", lineHeight: 1 }} onClick={() => setEditOpen(false)}>✕</button>
          </div>
          <div style={{ background: "#F8F9FB", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "12px", color: "#6B7280" }}>
            ID: {editRecord.id}
          </div>
          <div style={S.g2}>
            <FG label="First name"><input style={S.inp(false)} value={editRecord.firstName || ""} onChange={e => setEditRecord(p => ({ ...p, firstName: e.target.value }))} /></FG>
            <FG label="Last name"><input style={S.inp(false)} value={editRecord.lastName || ""} onChange={e => setEditRecord(p => ({ ...p, lastName: e.target.value }))} /></FG>
          </div>
          <div style={S.g2}>
            <FG label="Email"><input style={S.inp(false)} type="email" value={editRecord.email || ""} onChange={e => setEditRecord(p => ({ ...p, email: e.target.value }))} /></FG>
            <FG label="Phone"><input style={S.inp(false)} value={editRecord.phone || ""} onChange={e => setEditRecord(p => ({ ...p, phone: e.target.value }))} /></FG>
          </div>
          <div style={S.g2}>
            <FG label="Account name"><input style={S.inp(false)} value={editRecord.accountName || ""} onChange={e => setEditRecord(p => ({ ...p, accountName: e.target.value }))} /></FG>
            <FG label="Manager ID"><input style={S.inp(false)} value={editRecord.manager?.id || editRecord.manager || ""} onChange={e => setEditRecord(p => ({ ...p, manager: { id: e.target.value } }))} /></FG>
          </div>
          <div style={S.g2}>
            <FG label="Start date"><input type="date" style={S.inp(false)} value={editRecord.startDate || ""} onChange={e => setEditRecord(p => ({ ...p, startDate: e.target.value }))} /></FG>
            <FG label="End date"><input type="date" style={S.inp(false)} value={editRecord.endDate || ""} onChange={e => setEditRecord(p => ({ ...p, endDate: e.target.value }))} /></FG>
          </div>
          {config.customAttributes.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#6B7280", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>Custom attributes</div>
              <div style={S.g2}>
                {config.customAttributes.map(attr => (
                  <FG key={attr.id} label={attr.label}>
                    <input style={S.inp(false)} value={editRecord.data?.[attr.key] || ""} onChange={e => setEditRecord(p => ({ ...p, data: { ...p.data, [attr.key]: e.target.value } }))} />
                  </FG>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button style={S.btnS(false)} onClick={() => setEditOpen(false)}>Cancel</button>
            <button style={S.btnP(false)} onClick={handleUpdate} disabled={loading}>{loading ? "Saving…" : "Save changes"}</button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Delete Confirm Modal ─────────────────────────────────────────────────
  const DeleteModal = () => {
    if (!deleteConfirm) return null;
    return (
      <div style={S.overlay} onClick={() => setDeleteConfirm(null)}>
        <div style={{ ...S.modal, width: "440px" }} onClick={e => e.stopPropagation()}>
          <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
            <div style={{ fontSize: "40px", marginBottom: "0.75rem" }}>⚠️</div>
            <h3 style={{ margin: "0 0 0.5rem", color: "#111", fontSize: "16px" }}>Delete non-employee record?</h3>
            <div style={{ color: "#6B7280", fontSize: "13px", marginBottom: "1.25rem" }}>
              This will permanently delete <strong>{deleteConfirm.firstName} {deleteConfirm.lastName}</strong>'s record from ISC. This action cannot be undone.
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button style={S.btnS(false)} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={{ ...S.btnP(false), background: "#DC2626" }} onClick={() => handleDelete(deleteConfirm.id)} disabled={loading}>
                {loading ? "Deleting…" : "Delete record"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Reject Comment Modal ─────────────────────────────────────────────────
  const RejectModal = () => {
    if (!rejectModal) return null;
    return (
      <div style={S.overlay} onClick={() => setRejectModal(null)}>
        <div style={{ ...S.modal, width: "480px" }} onClick={e => e.stopPropagation()}>
          <h3 style={{ margin: "0 0 1rem", color: "#111", fontSize: "16px" }}>Reject approval request</h3>
          <FG label="Rejection reason (optional)">
            <textarea style={{ ...S.inp(false), height: "90px", resize: "vertical" }} value={rejectComment} placeholder="Provide a reason for rejection…" onChange={e => setRejectComment(e.target.value)} />
          </FG>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.75rem" }}>
            <button style={S.btnS(false)} onClick={() => setRejectModal(null)}>Cancel</button>
            <button style={{ ...S.btnP(false), background: "#DC2626" }} onClick={handleReject} disabled={loading}>{loading ? "Rejecting…" : "Reject request"}</button>
          </div>
        </div>
      </div>
    );
  };

  const TABS = [
    ["dashboard", "🏠", "Dashboard"],
    ["create", "➕", "Create identity"],
    ["manage", "🗂", "Manage identities"],
    ["approvals", "✅", "Approvals"],
    ["config", "⚙", "Configuration"],
  ];

  const anyModalOpen = previewOpen || editOpen || !!deleteConfirm || !!rejectModal;

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerBrand}>
          {config.branding.logoUrl ? (
            <img src={config.branding.logoUrl} alt="" style={{ height: "30px", objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
          ) : (
            <div style={{ width: "32px", height: "32px", background: "rgba(255,255,255,0.15)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L14 11H4L9 2Z" fill="white" fillOpacity="0.9"/>
                <path d="M4 11H14L12.5 16H5.5L4 11Z" fill={acc} fillOpacity="0.9"/>
              </svg>
            </div>
          )}
          <div>
            <div style={S.headerTitle}>{config.branding.appName}</div>
            <div style={S.headerSub}>{config.branding.companyName} · SailPoint ISC</div>
          </div>
        </div>
        {config.clientName && <div style={S.headerRight}>{config.clientName}</div>}
      </div>

      {/* Nav */}
      <div style={S.nav}>
        {TABS.map(([t, icon, label]) => (
          <div key={t} style={S.navItem(activeTab === t)} onClick={() => setActiveTab(t)}>
            <span style={{ fontSize: "14px" }}>{icon}</span> {label}
          </div>
        ))}
      </div>

      {/* Notification */}
      {notification && (
        <div style={{ position: "absolute", top: "70px", right: "1.5rem", zIndex: 400, background: notification.type === "error" ? "#DC2626" : "#059669", color: "#fff", padding: "10px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: "500", boxShadow: "0 4px 12px rgba(0,0,0,0.2)", maxWidth: "420px" }}>
          {notification.msg}
        </div>
      )}

      {/* Page content */}
      <div style={S.page}>
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "create" && <CreateIdentity />}
        {activeTab === "manage" && <ManageIdentities />}
        {activeTab === "approvals" && <Approvals />}
        {activeTab === "config" && <Configuration />}
      </div>

      {/* Modals */}
      {anyModalOpen && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, minHeight: "100vh" }}>
          <PreviewModal />
          <EditModal />
          <DeleteModal />
          <RejectModal />
        </div>
      )}
    </div>
  );
}
