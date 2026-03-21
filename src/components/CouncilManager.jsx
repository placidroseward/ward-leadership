import { useState, useEffect, useCallback } from "react";

const ORG_OPTIONS = [
  { key: "bishopric", name: "Bishopric", color: "#C9A84C" },
  { key: "relief_society", name: "Relief Society", color: "#7C9E87" },
  { key: "elders_quorum", name: "Elders Quorum", color: "#5B7FA6" },
  { key: "young_women", name: "Young Women", color: "#A07CB5" },
  { key: "primary", name: "Primary", color: "#C97B5A" },
  { key: "sunday_school", name: "Sunday School", color: "#6B9E9E" },
  { key: "ward_mission", name: "Ward Mission", color: "#9E7B6B" },
  { key: "exec_secretary", name: "Executive Secretary", color: "#888888" },
];

function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast">{msg}</div>;
}

function MemberForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    name: "", role: "", phone: "", orgKey: "bishopric", carrier: "",
  });

  const CARRIERS = [
    { value: "", label: "— Select carrier —" },
    { value: "att", label: "AT&T" },
    { value: "boost", label: "Boost Mobile" },
    { value: "cricket", label: "Cricket Wireless" },
    { value: "metro", label: "Metro by T-Mobile" },
    { value: "straighttalk", label: "Straight Talk" },
    { value: "tmobile", label: "T-Mobile" },
    { value: "uscellular", label: "US Cellular" },
    { value: "verizon", label: "Verizon" },
    { value: "xfinity", label: "Xfinity Mobile" },
  ];

  const selectedOrg = ORG_OPTIONS.find(o => o.key === form.orgKey) || ORG_OPTIONS[0];

  const formatPhone = (val) => {
    // Strip non-digits
    const digits = val.replace(/\D/g, "");
    // Format as +1XXXXXXXXXX
    if (digits.length === 0) return "";
    if (digits.startsWith("1")) return `+${digits}`;
    return `+1${digits}`;
  };

  const handlePhone = (e) => {
    setForm(f => ({ ...f, phone: e.target.value }));
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.orgKey) return;
    const phone = form.phone.trim();
    // Basic validation
    const cleaned = phone.replace(/\D/g, "");
    if (phone && cleaned.length < 10) {
      alert("Phone number must be at least 10 digits (e.g. +1xxxxxxxxxx)");
      return;
    }
    onSave({
      ...form,
      phone: phone ? formatPhone(cleaned) : "",
      carrier: form.carrier || "",
      name: form.name.trim(),
      role: form.role.trim() || selectedOrg.name,
      org: selectedOrg.name,
      orgColor: selectedOrg.color,
    });
  };

  return (
    <div style={{
      background: "var(--surface2)",
      border: "1px solid var(--gold-dim)",
      borderRadius: "var(--radius-lg)",
      padding: 20,
      marginBottom: 16,
    }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--gold)", marginBottom: 16 }}>
        {initial ? "Edit Member" : "Add Council Member"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label className="label">Full Name *</label>
          <input
            className="input"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. John Smith"
          />
        </div>
        <div className="field">
          <label className="label">Role / Title</label>
          <input
            className="input"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            placeholder="e.g. Relief Society President"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label className="label">Organization *</label>
          <select className="input" value={form.orgKey} onChange={e => setForm(f => ({ ...f, orgKey: e.target.value }))}>
            {ORG_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">Phone Number</label>
          <input className="input" value={form.phone} onChange={handlePhone} placeholder="+1xxxxxxxxxx" />
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>Format: +1 followed by 10 digits</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="label">Cell Carrier</label>
          <select className="input" value={form.carrier || ""} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}>
            {CARRIERS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>Required for SMS delivery</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn-gold"
          onClick={handleSubmit}
          disabled={!form.name.trim()}
        >
          {initial ? "Save Changes" : "Add Member"}
        </button>
      </div>
    </div>
  );
}

function MemberCard({ member, onEdit, onDelete }) {
  const org = ORG_OPTIONS.find(o => o.key === member.orgKey);
  const color = org?.color || member.orgColor || "#888";

  return (
    <div style={{
      background: "var(--surface2)",
      border: "1px solid var(--border)",
      borderLeft: `3px solid ${color}`,
      borderRadius: "var(--radius)",
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 8,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: color + "22",
        border: `1px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        fontSize: 14,
        color,
        fontFamily: "var(--font-display)",
        fontWeight: 600,
      }}>
        {member.name.charAt(0)}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{member.name}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
          {member.role || member.org} · {member.org}
        </div>
        {member.phone && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: "var(--font-mono)" }}>
            {member.phone}
            {member.carrier
              ? <span style={{ marginLeft: 8, color: "var(--success)", fontFamily: "var(--font-mono)" }}>✓ {member.carrier}</span>
              : <span style={{ marginLeft: 8, color: "var(--warning)" }}>⚠ No carrier</span>
            }
          </div>
        )}
        {!member.phone && (
          <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 1 }}>
            ⚠ No phone number — cannot receive SMS
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => onEdit(member)}>
          Edit
        </button>
        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 11, color: "var(--danger)" }} onClick={() => onDelete(member.id)}>
          Remove
        </button>
      </div>
    </div>
  );
}

export default function CouncilManager({ api }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterOrg, setFilterOrg] = useState("all");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${api}/api/members`)
      .then(r => r.json())
      .then(data => setMembers(Array.isArray(data) ? data : []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const addMember = async (data) => {
    await fetch(`${api}/api/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowAdd(false);
    load();
    showToast("Member added");
  };

  const updateMember = async (data) => {
    await fetch(`${api}/api/members/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditing(null);
    load();
    showToast("Member updated");
  };

  const deleteMember = async (id) => {
    if (!confirm("Remove this council member?")) return;
    await fetch(`${api}/api/members/${id}`, { method: "DELETE" });
    load();
    showToast("Member removed");
  };

  // Group members by org for display
  const grouped = ORG_OPTIONS.map(org => ({
    ...org,
    members: members.filter(m => m.orgKey === org.key),
  })).filter(g => filterOrg === "all" || g.key === filterOrg);

  const missingPhone = members.filter(m => !m.phone || m.phone.includes("xxxxxxxxxx"));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      {/* Toolbar */}
      <div style={{
        padding: "12px 24px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
        background: "var(--surface)",
        flexWrap: "wrap",
      }}>
        <select
          className="input"
          value={filterOrg}
          onChange={e => setFilterOrg(e.target.value)}
          style={{ width: 200 }}
        >
          <option value="all">All Organizations</option>
          {ORG_OPTIONS.map(o => (
            <option key={o.key} value={o.key}>{o.name}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {members.length} member{members.length !== 1 ? "s" : ""}
        </span>
        <button className="btn btn-gold" onClick={() => { setShowAdd(true); setEditing(null); }}>
          + Add Member
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, padding: 24 }}>

        {/* Phone number warning */}
        {missingPhone.length > 0 && (
          <div style={{
            background: "rgba(160,90,90,0.1)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius-lg)",
            padding: 14,
            marginBottom: 20,
            fontSize: 12,
            color: "var(--danger)",
          }}>
            ⚠ {missingPhone.length} member{missingPhone.length !== 1 ? "s" : ""} still have placeholder phone numbers and won't receive SMS pulses:
            {" "}{missingPhone.map(m => m.name).join(", ")}
          </div>
        )}

        {/* Add form */}
        {showAdd && !editing && (
          <MemberForm
            onSave={addMember}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {/* Edit form */}
        {editing && (
          <MemberForm
            initial={editing}
            onSave={updateMember}
            onCancel={() => setEditing(null)}
          />
        )}

        {/* Members grouped by org */}
        {loading ? (
          <div className="empty-state"><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /></div>
        ) : members.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">◇</span>
            <p className="empty-state-text">No council members yet — add your first member above</p>
          </div>
        ) : (
          grouped.map(group => (
            group.members.length === 0 ? null : (
              <div key={group.key} style={{ marginBottom: 24 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  marginBottom: 10,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: group.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text)" }}>
                    {group.name}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    ({group.members.length})
                  </span>
                </div>
                {group.members.map(m => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    onEdit={(member) => { setEditing(member); setShowAdd(false); window.scrollTo(0, 0); }}
                    onDelete={deleteMember}
                  />
                ))}
              </div>
            )
          ))
        )}
      </div>
    </div>
  );
}
