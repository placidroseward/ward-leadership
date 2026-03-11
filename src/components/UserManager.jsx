import { useState, useEffect } from "react";

export default function UserManager({ api, currentUser }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", calling: "", phone: "", role: "user" });
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch(`${api}/api/users`, { headers: { "x-user-id": currentUser.id } })
      .then(r => r.json()).then(data => { setUsers(data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
      setForm({ firstName: "", lastName: "", email: "", calling: "", phone: "", role: "user" });
      setMsg("User added — they can set their password on first login");
      setTimeout(() => setMsg(null), 3000);
      load();
    } catch (e) { setMsg("Error: " + e.message); }
  };

  const remove = async (id) => {
    if (id === currentUser.id) return setMsg("You cannot remove yourself");
    await fetch(`${api}/api/users/${id}`, { method: "DELETE", headers: { "x-user-id": currentUser.id } });
    load();
  };

  const toggleAdmin = async (u) => {
    await fetch(`${api}/api/users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
      body: JSON.stringify({ role: u.role === "admin" ? "user" : "admin" }),
    });
    load();
  };

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
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
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
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
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 2,
              background: u.role === "admin" ? "rgba(201,168,76,0.15)" : "var(--surface3)",
              color: u.role === "admin" ? "var(--gold)" : "var(--text-muted)",
              border: `1px solid ${u.role === "admin" ? "var(--gold-dim)" : "var(--border)"}`,
              letterSpacing: "0.1em",
            }}>
              {u.role || "user"}
            </span>
            {u.id !== currentUser.id && (
              <>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 8px" }} onClick={() => toggleAdmin(u)}>
                  {u.role === "admin" ? "Demote" : "Make Admin"}
                </button>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 8px", color: "var(--danger)" }} onClick={() => remove(u.id)}>
                  Remove
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
