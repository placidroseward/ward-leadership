import { useState, useEffect } from "react";

function EditUserModal({ user, api, currentUser, orgs, onSave, onClose }) {
  const [form, setForm] = useState({
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || "",
    calling: user.calling || "",
    phone: user.phone || "",
    role: user.role || "user",
    isWardCouncil: !!user.isWardCouncil,
    orgKey: user.orgKey || "",
  });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${api}/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onSave();
      onClose();
    } catch (e) { setMsg("Error: " + e.message); }
    setSaving(false);
  };

  const resetPassword = async () => {
    if (!window.confirm(`Reset password for ${user.firstName}? They will set a new one on next login.`)) return;
    setResetting(true);
    try {
      const res = await fetch(`${api}/api/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "x-user-id": currentUser.id },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMsg("Password reset — user will set a new one on next login");
    } catch (e) { setMsg("Error: " + e.message); }
    setResetting(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", width: 460, maxHeight: "90vh",
        overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--surface2)",
        }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text)" }}>
            Edit — {user.firstName} {user.lastName}
          </span>
          <button className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          <div className="two-col" style={{ marginBottom: 14 }}>
            <div>
              <label className="label">First Name</label>
              <input className="input" value={form.firstName} onChange={e => f("firstName", e.target.value)} />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input className="input" value={form.lastName} onChange={e => f("lastName", e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="label">Email Address</label>
            <input className="input" type="email" value={form.email} onChange={e => f("email", e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Calling</label>
            <input className="input" value={form.calling} onChange={e => f("calling", e.target.value)} placeholder="e.g. Relief Society President" />
          </div>
          <div className="two-col" style={{ marginBottom: 16 }}>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={e => f("phone", e.target.value)} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={e => f("role", e.target.value)}
                disabled={user.id === currentUser.id}>
                <option value="user">User</option>
                <option value="bishopric">Bishopric</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label className="label" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={!!form.isWardCouncil}
                onChange={e => f("isWardCouncil", e.target.checked)} />
              Member of Ward Council
            </label>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
              Grants access to the Ward Council and Mission Plan tabs, and adds this user to the pulse + agenda roster.
            </div>
          </div>
          {form.isWardCouncil && (
            <div className="field">
              <label className="label">Organization</label>
              <select className="input" value={form.orgKey || ""} onChange={e => f("orgKey", e.target.value)}>
                <option value="">— Select organization —</option>
                {orgs.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}
              </select>
            </div>
          )}

          {msg && (
            <div style={{
              fontSize: 11, marginBottom: 14,
              color: msg.startsWith("Error") ? "var(--danger)" : "var(--success)"
            }}>{msg}</div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
            <button className="btn btn-ghost" style={{ fontSize: 10, color: "var(--text-muted)" }}
              onClick={resetPassword} disabled={resetting}>
              {resetting ? "Resetting..." : "↺ Reset Password"}
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-gold" onClick={save} disabled={saving}>
                {saving ? <><span className="spinner" /> Saving...</> : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserManager({ api, currentUser }) {
  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", calling: "",
    phone: "", role: "user",
    isWardCouncil: false, orgKey: "",
  });
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);

  const load = () => {
    fetch(`${api}/api/users`, { headers: { "x-user-id": currentUser.id } })
      .then(r => r.json()).then(data => { setUsers(data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch(`${api}/api/orgs`, { headers: { "x-user-id": currentUser.id } })
      .then(r => r.json()).then(data => { if (Array.isArray(data)) setOrgs(data); })
      .catch(() => {});
  }, []);

  const add = async () => {
    if (!form.email || !form.firstName) return setMsg("First name and email are required");
    try {
      const res = await fetch(`${api}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setForm({
        firstName: "", lastName: "", email: "", calling: "",
        phone: "", role: "user",
        isWardCouncil: false, orgKey: "",
      });
      setMsg("User added — they can set their password on first login");
      setTimeout(() => setMsg(null), 3000);
      load();
    } catch (e) { setMsg("Error: " + e.message); }
  };

  const remove = async (id) => {
    if (id === currentUser.id) return setMsg("You cannot remove yourself");
    if (!window.confirm("Remove this user? They will no longer be able to log in.")) return;
    await fetch(`${api}/api/users/${id}`, { method: "DELETE", headers: { "x-user-id": currentUser.id } });
    load();
  };

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      {editingUser && (
        <EditUserModal
          user={editingUser} api={api} currentUser={currentUser} orgs={orgs}
          onSave={load} onClose={() => setEditingUser(null)}
        />
      )}

      <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)", marginBottom: 6 }}>User Management</div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 24 }}>
        Add users who can access this dashboard. They will set their own password on first login.
      </div>

      {/* Add user form */}
      <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 20, marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--text)", marginBottom: 14 }}>Add New User</div>
        <div className="two-col" style={{ marginBottom: 12 }}>
          <div>
            <label className="label">First Name *</label>
            <input className="input" value={form.firstName} onChange={e => f("firstName", e.target.value)} placeholder="First name" />
          </div>
          <div>
            <label className="label">Last Name</label>
            <input className="input" value={form.lastName} onChange={e => f("lastName", e.target.value)} placeholder="Last name" />
          </div>
        </div>
        <div className="two-col" style={{ marginBottom: 12 }}>
          <div>
            <label className="label">Email Address *</label>
            <input className="input" type="email" value={form.email} onChange={e => f("email", e.target.value)} placeholder="email@example.com" />
          </div>
          <div>
            <label className="label">Calling</label>
            <input className="input" value={form.calling} onChange={e => f("calling", e.target.value)} placeholder="e.g. Relief Society President" />
          </div>
        </div>
        <div className="two-col" style={{ marginBottom: 12 }}>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={e => f("phone", e.target.value)} placeholder="+1xxxxxxxxxx" />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={e => f("role", e.target.value)}>
              <option value="user">User</option>
              <option value="bishopric">Bishopric</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label className="label" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={!!form.isWardCouncil}
              onChange={e => f("isWardCouncil", e.target.checked)} />
            Member of Ward Council
          </label>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
            Grants access to the Ward Council and Mission Plan tabs, and adds this user to the pulse + agenda roster.
          </div>
        </div>
        {form.isWardCouncil && (
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="label">Organization</label>
            <select className="input" value={form.orgKey || ""} onChange={e => f("orgKey", e.target.value)}>
              <option value="">— Select organization —</option>
              {orgs.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}
            </select>
          </div>
        )}

        {msg && <div style={{ fontSize: 11, color: msg.startsWith("Error") ? "var(--danger)" : "var(--success)", marginBottom: 10 }}>{msg}</div>}
        <button className="btn btn-gold" onClick={add}>Add User</button>
      </div>

      {/* Users list */}
      <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--text)", marginBottom: 12 }}>
        Current Users ({users.length})
      </div>
      {loading ? (
        <div style={{ color: "var(--text-dim)", fontSize: 12 }}>Loading...</div>
      ) : users.map(u => (
        <div key={u.id} style={{
          background: "var(--surface2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "12px 16px", marginBottom: 8,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: u.id === currentUser.id ? "var(--gold-dim)" : "var(--surface3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: u.id === currentUser.id ? "var(--gold)" : "var(--text-muted)",
            flexShrink: 0, fontFamily: "var(--font-display)",
          }}>
            {(u.firstName?.[0] || u.email?.[0] || "?").toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
              {u.firstName} {u.lastName}
              {u.id === currentUser.id && <span style={{ fontSize: 10, color: "var(--gold)", marginLeft: 8 }}>YOU</span>}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{u.email}</div>
            {u.calling && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{u.calling}</div>}
            {u.isWardCouncil && (
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                <span style={{
                  display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                  background: u.orgColor || "var(--text-muted)", marginRight: 6, verticalAlign: "middle",
                }} />
                <span style={{ verticalAlign: "middle" }}>Ward Council{u.org ? ` · ${u.org}` : ""}</span>
              </div>
            )}
            {u.phone && (
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                {u.phone}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 2,
              background: u.role === "admin" ? "rgba(201,168,76,0.15)" : u.role === "bishopric" ? "rgba(201,168,76,0.08)" : "var(--surface3)",
              color: u.role === "admin" ? "var(--gold)" : u.role === "bishopric" ? "var(--gold)" : "var(--text-muted)",
              border: `1px solid ${u.role === "admin" ? "var(--gold-dim)" : u.role === "bishopric" ? "var(--gold-dim)" : "var(--border)"}`,
              letterSpacing: "0.1em",
            }}>
              {u.role || "user"}
            </span>
            <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 8px" }}
              onClick={() => setEditingUser(u)}>
              ✎ Edit
            </button>
            {u.id !== currentUser.id && (
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 8px", color: "var(--danger)" }}
                onClick={() => remove(u.id)}>
                Remove
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
