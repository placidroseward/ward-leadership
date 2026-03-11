import { useState } from "react";

export default function UserProfile({ api, user, onUpdate, onClose, lightMode, onToggleLightMode }) {
  const [form, setForm] = useState({
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    username: user.username || "",
    calling: user.calling || "",
    phone: user.phone || "",
    stayLoggedIn: user.stayLoggedIn || false,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState(null);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${api}/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onUpdate({ ...user, ...form });
      setMsg("Profile saved");
      setTimeout(() => setMsg(null), 2500);
    } catch (e) { setMsg("Error: " + e.message); }
    setSaving(false);
  };

  const changePassword = async () => {
    if (pwForm.next !== pwForm.confirm) return setPwMsg("Passwords don't match");
    if (!pwForm.next) return setPwMsg("Password cannot be empty");
    try {
      const res = await fetch(`${api}/api/users/${user.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: pwForm.current, next: pwForm.next }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPwForm({ current: "", next: "", confirm: "" });
      setPwMsg("Password updated");
      setTimeout(() => setPwMsg(null), 2500);
    } catch (e) { setPwMsg("Error: " + e.message); }
  };

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", width: 480, maxHeight: "90vh",
        overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--surface2)",
        }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)" }}>
            My Profile
          </span>
          <button className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Display Settings */}
          <div style={{
            background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: 14, marginBottom: 20,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>
                {lightMode ? "☀ Light Mode" : "◑ Dark Mode"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                Toggle display theme
              </div>
            </div>
            <button
              onClick={onToggleLightMode}
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: lightMode ? "var(--gold)" : "var(--surface3)",
                border: "1px solid var(--border2)", cursor: "pointer",
                position: "relative", transition: "background 0.2s",
              }}
            >
              <span style={{
                position: "absolute", top: 3,
                left: lightMode ? 22 : 3,
                width: 16, height: 16, borderRadius: "50%",
                background: lightMode ? "#0C0D0F" : "var(--text-muted)",
                transition: "left 0.2s",
              }} />
            </button>
          </div>

          {/* Profile fields */}
          <div className="two-col" style={{ marginBottom: 14 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">First Name</label>
              <input className="input" value={form.firstName} onChange={e => f("firstName", e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">Last Name</label>
              <input className="input" value={form.lastName} onChange={e => f("lastName", e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="label">Username</label>
            <input className="input" value={form.username} onChange={e => f("username", e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Calling</label>
            <input className="input" value={form.calling} onChange={e => f("calling", e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={e => f("phone", e.target.value)} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <input type="checkbox" id="sli" checked={form.stayLoggedIn}
              onChange={e => f("stayLoggedIn", e.target.checked)}
              style={{ accentColor: "var(--gold)", width: 14, height: 14 }} />
            <label htmlFor="sli" style={{ fontSize: 12, color: "var(--text-dim)", cursor: "pointer" }}>
              Stay logged in
            </label>
          </div>

          {msg && <div style={{ fontSize: 11, color: msg.startsWith("Error") ? "var(--danger)" : "var(--success)", marginBottom: 12 }}>{msg}</div>}

          <button className="btn btn-gold" style={{ width: "100%", marginBottom: 24 }} onClick={save} disabled={saving}>
            {saving ? <><span className="spinner" /> Saving...</> : "Save Profile"}
          </button>

          <hr className="divider" />

          {/* Change Password */}
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--text)", marginBottom: 14 }}>Change Password</div>
          <div className="field">
            <label className="label">Current Password</label>
            <input className="input" type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} />
          </div>
          <div className="field">
            <label className="label">New Password</label>
            <input className="input" type="password" value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} />
          </div>
          <div className="field">
            <label className="label">Confirm New Password</label>
            <input className="input" type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
          </div>
          {pwMsg && <div style={{ fontSize: 11, color: pwMsg.startsWith("Error") || pwMsg.includes("match") ? "var(--danger)" : "var(--success)", marginBottom: 10 }}>{pwMsg}</div>}
          <button className="btn btn-outline" style={{ width: "100%" }} onClick={changePassword}>Update Password</button>
        </div>
      </div>
    </div>
  );
}
