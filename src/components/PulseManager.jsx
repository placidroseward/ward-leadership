import { useState, useEffect, useCallback } from "react";
import SendLogModal from "./SendLogModal.jsx";

const ORG_COLORS = {
  "Bishopric": "#C9A84C",
  "Relief Society": "#7C9E87",
  "Elders Quorum": "#5B7FA6",
  "Young Women": "#A07CB5",
  "Primary": "#C97B5A",
  "Sunday School": "#6B9E9E",
  "Ward Mission": "#9E7B6B",
  "Executive Secretary": "#888888",
};

function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast">{msg}</div>;
}

function ResponseCard({ r, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const color = ORG_COLORS[r.org] || "#888";
  return (
    <div style={{
      background: "var(--surface2)",
      border: `1px solid var(--border)`,
      borderLeft: `3px solid ${color}`,
      borderRadius: "var(--radius)",
      marginBottom: 8,
    }}>
      <div
        style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontWeight: 500, color: "var(--text)" }}>{r.memberName}</span>
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{r.org}</span>
          {r.manual && <span className="badge" style={{ background: "rgba(91,127,166,0.15)", color: "#5B7FA6", border: "1px solid #5B7FA6" }}>manual</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
            {new Date(r.receivedAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
          <span style={{ color: "var(--text-muted)" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 14px 12px", borderTop: "1px solid var(--border)" }}>
          {r.q1 && (
            <div style={{ marginTop: 10 }}>
              <div className="label">Members needing help</div>
              <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{r.q1}</div>
            </div>
          )}
          {r.q2 && (
            <div style={{ marginTop: 10 }}>
              <div className="label">Needs from other orgs</div>
              <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{r.q2}</div>
            </div>
          )}
          {r.q3 && (
            <div style={{ marginTop: 10 }}>
              <div className="label">Wins / Updates</div>
              <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{r.q3}</div>
            </div>
          )}
          {!r.q1 && !r.q2 && !r.q3 && (
            <div style={{ marginTop: 10, color: "var(--text-muted)", fontSize: 12 }}>Raw: {r.raw}</div>
          )}
          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-danger" style={{ fontSize: 10, padding: "4px 10px" }} onClick={() => onDelete(r.id)}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SendPulseModal({ members, onSend, onClose }) {
  const [selected, setSelected] = useState(
    members.filter(m => m.id !== "es").map(m => m.id)
  );
  const [sending, setSending] = useState(false);

  const toggle = (id) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const handleSend = async () => {
    setSending(true);
    await onSend(selected);
    setSending(false);
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 500,
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--gold-dim)",
        borderRadius: "var(--radius-lg)",
        padding: 24,
        width: 420,
        maxHeight: "80vh",
        overflow: "auto",
      }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--gold)", marginBottom: 4 }}>
          Send Pulse
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>
          Select which members to send the weekly pulse to
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 10px" }}
            onClick={() => setSelected(members.filter(m => m.id !== "es").map(m => m.id))}>
            Select All
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 10px" }}
            onClick={() => setSelected([])}>
            Select None
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          {members.filter(m => m.id !== "es").map(m => {
            const color = ORG_COLORS[m.org] || "#888";
            const isSelected = selected.includes(m.id);
            return (
              <div
                key={m.id}
                onClick={() => toggle(m.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", marginBottom: 6,
                  background: isSelected ? "var(--surface3)" : "var(--surface2)",
                  border: `1px solid ${isSelected ? color : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 2,
                  border: `2px solid ${isSelected ? color : "var(--border2)"}`,
                  background: isSelected ? color : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "all 0.15s",
                }}>
                  {isSelected && <span style={{ color: "#0C0D0F", fontSize: 10, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.org}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-gold"
            onClick={handleSend}
            disabled={selected.length === 0 || sending}
          >
            {sending
              ? <><span className="spinner" /> Sending...</>
              : `Send to ${selected.length} member${selected.length !== 1 ? "s" : ""}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PulseManager({ api, week }) {
  const [responses, setResponses] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [manual, setManual] = useState({ memberId: "", q1: "", q2: "", q3: "" });
  const [selectedWeek, setSelectedWeek] = useState(week);

  useEffect(() => { if (week) setSelectedWeek(week); }, [week]);

  const load = useCallback(() => {
    if (!selectedWeek) return;
    setLoading(true);
    Promise.all([
      fetch(`${api}/api/pulse?week=${selectedWeek}`).then(r => r.json()),
      fetch(`${api}/api/members`).then(r => r.json()),
    ]).then(([pulses, mems]) => {
      setResponses(Array.isArray(pulses) ? pulses : []);
      setMembers(Array.isArray(mems) ? mems : []);
    }).catch(() => {
      setResponses([]);
      setMembers([]);
    }).finally(() => setLoading(false));
  }, [api, selectedWeek]);

  useEffect(() => { load(); }, [load]);

  const [sendLog, setSendLog] = useState(null);

  const sendPulse = async (memberIds) => {
    try {
      const res = await fetch(`${api}/api/pulse/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds }),
      });
      const data = await res.json();
      setSendLog({ title: "Ward Council Pulse Send Log", results: data.results || [] });
    } catch {
      setToast("Error sending pulse");
    }
  };

  const submitManual = async () => {
    if (!manual.memberId) return;
    await fetch(`${api}/api/pulse/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manual),
    });
    setManual({ memberId: "", q1: "", q2: "", q3: "" });
    setShowManual(false);
    load();
    setToast("Response added");
  };

  const deleteResponse = async (id) => {
    await fetch(`${api}/api/pulse/${id}`, { method: "DELETE" });
    load();
  };

  const respondedIds = new Set(responses.map(r => r.memberId));
  const missing = members.filter(m => !respondedIds.has(m.id) && m.id !== "es");
  const selectableMembers = members.filter(m => m.id !== "es");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
      {sendLog && <SendLogModal title={sendLog.title} results={sendLog.results} onClose={() => setSendLog(null)} />}
      {showSendModal && (
        <SendPulseModal
          members={members}
          onSend={sendPulse}
          onClose={() => setShowSendModal(false)}
        />
      )}

      {/* Toolbar */}
      <div style={{
        padding: "12px 24px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
        background: "var(--surface)",
      }}>
        <input
          className="input"
          type="week"
          value={selectedWeek || ""}
          onChange={e => setSelectedWeek(e.target.value)}
          style={{ width: 180 }}
        />
        <div style={{ flex: 1 }} />
        <button className="btn btn-outline" onClick={() => setShowManual(v => !v)}>
          + Manual Entry
        </button>
        <button className="btn btn-gold" onClick={() => setShowSendModal(true)}>
          ◈ Send Pulse Now
        </button>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 320px", gap: 0 }}>

        {/* Responses */}
        <div className="scroll" style={{ padding: 24, borderRight: "1px solid var(--border)" }}>
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)" }}>
              Responses
            </span>
            <span className="badge" style={{ background: "var(--gold-glow)", color: "var(--gold)", border: "1px solid var(--gold-dim)" }}>
              {responses.length}
            </span>
          </div>

          {loading ? (
            <div className="empty-state"><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /></div>
          ) : responses.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">◈</span>
              <p className="empty-state-text">No responses yet for {selectedWeek}</p>
            </div>
          ) : (
            responses.map(r => <ResponseCard key={r.id} r={r} onDelete={deleteResponse} />)
          )}

          {/* Manual Entry Form */}
          {showManual && (
            <div style={{
              background: "var(--surface2)",
              border: "1px solid var(--gold-dim)",
              borderRadius: "var(--radius-lg)",
              padding: 20,
              marginTop: 16,
            }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16, marginBottom: 16, color: "var(--gold)" }}>
                Manual Response Entry
              </div>
              <div className="field">
                <label className="label">Council Member</label>
                <select
                  className="input"
                  value={manual.memberId}
                  onChange={e => setManual(m => ({ ...m, memberId: e.target.value }))}
                >
                  <option value="">— Select a member —</option>
                  {selectableMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.org}
                    </option>
                  ))}
                </select>
                {selectableMembers.length === 0 && (
                  <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>
                    No members found. Add members in the Council Members tab first.
                  </div>
                )}
              </div>
              <div className="field">
                <label className="label">Members needing help?</label>
                <textarea className="input" value={manual.q1} onChange={e => setManual(m => ({ ...m, q1: e.target.value }))} placeholder="Any members who need a visit, help, or attention..." />
              </div>
              <div className="field">
                <label className="label">Needs from other orgs?</label>
                <textarea className="input" value={manual.q2} onChange={e => setManual(m => ({ ...m, q2: e.target.value }))} placeholder="Things another organization could help with..." />
              </div>
              <div className="field">
                <label className="label">Wins / Updates</label>
                <textarea className="input" value={manual.q3} onChange={e => setManual(m => ({ ...m, q3: e.target.value }))} placeholder="Good news, progress, accomplishments..." />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowManual(false)}>Cancel</button>
                <button className="btn btn-gold" onClick={submitManual} disabled={!manual.memberId}>Add Response</button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Who responded */}
        <div className="scroll" style={{ padding: 24, background: "var(--surface)" }}>
          <div style={{ marginBottom: 16, fontFamily: "var(--font-display)", fontSize: 18 }}>Response Status</div>

          <div className="label" style={{ marginBottom: 8 }}>Responded ({responses.length})</div>
          {responses.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 16 }}>None yet</p>}
          {responses.map(r => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 10px",
              background: "var(--surface2)", borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: ORG_COLORS[r.org] || "#888", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--text-dim)", flex: 1 }}>{r.memberName}</span>
              <span style={{ fontSize: 10, color: "var(--success)" }}>✓</span>
            </div>
          ))}

          <hr className="divider" />

          <div className="label" style={{ marginBottom: 8 }}>Awaiting ({missing.length})</div>
          {missing.length === 0 && members.length > 1 && (
            <p style={{ color: "var(--success)", fontSize: 11 }}>Everyone responded! 🎉</p>
          )}
          {missing.map(m => (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 10px",
              background: "var(--surface2)", borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              opacity: 0.6,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: ORG_COLORS[m.org] || "#888", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>{m.name}</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>—</span>
            </div>
          ))}

          {members.length > 1 && (
            <div style={{ marginTop: 20 }}>
              <div className="label">Response Rate</div>
              <div style={{ background: "var(--surface3)", borderRadius: 2, height: 6, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.round((responses.length / Math.max(members.length - 1, 1)) * 100)}%`,
                  background: "var(--gold)",
                  transition: "width 0.5s ease",
                }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {responses.length} of {members.length - 1} members
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
