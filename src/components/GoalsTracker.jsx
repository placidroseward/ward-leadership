import { useState, useEffect, useCallback } from "react";

const ORG_OPTIONS = [
  "Bishopric", "Relief Society", "Elders Quorum", "Young Women",
  "Primary", "Sunday School", "Ward Mission",
];

const ORG_COLORS = {
  "Bishopric": "#C9A84C",
  "Relief Society": "#7C9E87",
  "Elders Quorum": "#5B7FA6",
  "Young Women": "#A07CB5",
  "Primary": "#C97B5A",
  "Sunday School": "#6B9E9E",
  "Ward Mission": "#9E7B6B",
};

const STATUS_STYLES = {
  active: { bg: "rgba(91,127,166,0.15)", color: "#5B7FA6" },
  "in-progress": { bg: "rgba(201,168,76,0.15)", color: "#C9A84C" },
  completed: { bg: "rgba(90,138,110,0.15)", color: "#5A8A6E" },
  paused: { bg: "rgba(90,90,90,0.15)", color: "#888" },
};

function GoalCard({ goal, onUpdate, onDelete, onAddNote }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [editData, setEditData] = useState({ ...goal });

  const statusStyle = STATUS_STYLES[goal.status] || STATUS_STYLES.active;

  const saveEdit = () => {
    onUpdate(goal.id, editData);
    setEditing(false);
  };

  const submitNote = () => {
    if (!noteText.trim()) return;
    onAddNote(goal.id, noteText.trim());
    setNoteText("");
  };

  return (
    <div style={{
      background: "var(--surface2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      marginBottom: 12,
      overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      {/* Card header */}
      <div
        style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}
        onClick={() => { if (!editing) setExpanded(e => !e); }}
      >
        <div style={{ flex: 1 }}>
          {editing ? (
            <input className="input" value={editData.title} onChange={e => setEditData(d => ({ ...d, title: e.target.value }))} onClick={e => e.stopPropagation()} />
          ) : (
            <div style={{ fontWeight: 500, fontSize: 14, color: "var(--text)", marginBottom: 6 }}>{goal.title}</div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="badge" style={{ ...statusStyle, border: `1px solid ${statusStyle.color}`, fontSize: 10 }}>
              {goal.status}
            </span>
            {goal.orgs.map(o => (
              <span key={o} className="tag" style={{ color: ORG_COLORS[o] || "#888", borderColor: ORG_COLORS[o] || "#888", background: "transparent", fontSize: 10 }}>
                {o}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setEditing(e => !e)}>✎</button>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11, color: "var(--danger)" }} onClick={() => onDelete(goal.id)}>✕</button>
        </div>
      </div>

      {/* Expanded content */}
      {(expanded || editing) && (
        <div style={{ padding: "0 18px 16px", borderTop: "1px solid var(--border)" }}>
          {editing ? (
            <div style={{ paddingTop: 14 }}>
              <div className="field">
                <label className="label">Description</label>
                <textarea className="input" value={editData.description} onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Progress</label>
                <input className="input" value={editData.progress} onChange={e => setEditData(d => ({ ...d, progress: e.target.value }))} placeholder="Current progress update..." />
              </div>
              <div className="field">
                <label className="label">Status</label>
                <select className="input" value={editData.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}>
                  {Object.keys(STATUS_STYLES).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Organizations Involved</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ORG_OPTIONS.map(o => (
                    <button
                      key={o}
                      className="btn"
                      style={{
                        padding: "4px 10px",
                        fontSize: 11,
                        background: editData.orgs.includes(o) ? (ORG_COLORS[o] + "25") : "transparent",
                        borderColor: editData.orgs.includes(o) ? ORG_COLORS[o] : "var(--border)",
                        color: editData.orgs.includes(o) ? ORG_COLORS[o] : "var(--text-muted)",
                      }}
                      onClick={() => setEditData(d => ({
                        ...d,
                        orgs: d.orgs.includes(o) ? d.orgs.filter(x => x !== o) : [...d.orgs, o],
                      }))}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => { setEditing(false); setEditData({ ...goal }); }}>Cancel</button>
                <button className="btn btn-gold" onClick={saveEdit}>Save</button>
              </div>
            </div>
          ) : (
            <div style={{ paddingTop: 12 }}>
              {goal.description && (
                <p style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 12 }}>{goal.description}</p>
              )}

              {/* Progress */}
              <div style={{ marginBottom: 14 }}>
                <div className="label">Current Progress</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", background: "var(--surface3)", padding: "8px 12px", borderRadius: "var(--radius)", borderLeft: "2px solid var(--gold-dim)" }}>
                  {goal.progress || "No progress noted yet"}
                </div>
              </div>

              {/* Notes / meeting history */}
              {goal.notes?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div className="label">Meeting Notes</div>
                  {goal.notes.map((n) => (
                    <div key={n.id} style={{
                      display: "flex", gap: 10, marginBottom: 6,
                      fontSize: 11, color: "var(--text-dim)", padding: "6px 0",
                      borderBottom: "1px solid var(--border)",
                    }}>
                      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                        {new Date(n.addedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                      <span>{n.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Add note */}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  placeholder="Add a meeting note..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitNote()}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-outline" onClick={submitNote} disabled={!noteText.trim()}>Add</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GoalsTracker({ api }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [newGoal, setNewGoal] = useState({ title: "", description: "", orgs: [], progress: "" });

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${api}/api/goals`).then(r => r.json()).then(data => {
      setGoals(data);
      setLoading(false);
    });
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const createGoal = async () => {
    if (!newGoal.title.trim()) return;
    await fetch(`${api}/api/goals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newGoal),
    });
    setNewGoal({ title: "", description: "", orgs: [], progress: "" });
    setShowNew(false);
    load();
    showToast("Goal created");
  };

  const updateGoal = async (id, data) => {
    await fetch(`${api}/api/goals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    load();
    showToast("Goal updated");
  };

  const deleteGoal = async (id) => {
    await fetch(`${api}/api/goals/${id}`, { method: "DELETE" });
    load();
    showToast("Goal deleted");
  };

  const addNote = async (id, text) => {
    await fetch(`${api}/api/goals/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    load();
  };

  const getSuggestions = async () => {
    setSuggesting(true);
    try {
      const res = await fetch(`${api}/api/goals/suggest`, { method: "POST" });
      const data = await res.json();
      setSuggestions(data);
    } catch { showToast("Error getting suggestions"); }
    setSuggesting(false);
  };

  const addFromSuggestion = (s) => {
    setNewGoal({ title: s.title, description: s.description + "\n\nWhy now: " + s.why, orgs: s.orgs, progress: "Not started" });
    setSuggestions([]);
    setShowNew(true);
  };

  const filtered = filter === "all" ? goals : goals.filter(g => g.status === filter);
  const counts = { all: goals.length, active: 0, "in-progress": 0, completed: 0, paused: 0 };
  goals.forEach(g => { if (counts[g.status] !== undefined) counts[g.status]++; });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {toast && <div className="toast">{toast}</div>}

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
        {/* Status filter tabs */}
        <div style={{ display: "flex", gap: 2 }}>
          {["all", "active", "in-progress", "completed", "paused"].map(s => (
            <button
              key={s}
              className="btn btn-ghost"
              style={{
                padding: "5px 12px",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: filter === s ? "var(--gold)" : "var(--text-muted)",
                borderBottom: filter === s ? "2px solid var(--gold)" : "2px solid transparent",
                borderRadius: 0,
              }}
              onClick={() => setFilter(s)}
            >
              {s} <span style={{ opacity: 0.6 }}>({counts[s] || 0})</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <button className="btn btn-outline" onClick={getSuggestions} disabled={suggesting}>
          {suggesting ? <><span className="spinner" /> Thinking...</> : "✦ AI Suggest Goals"}
        </button>
        <button className="btn btn-gold" onClick={() => setShowNew(v => !v)}>
          + New Goal
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, padding: 24 }}>
        {/* AI Suggestions */}
        {suggestions.length > 0 && (
          <div style={{
            background: "var(--gold-glow)",
            border: "1px solid var(--gold-dim)",
            borderRadius: "var(--radius-lg)",
            padding: 16,
            marginBottom: 20,
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--gold)", marginBottom: 12 }}>
              ✦ AI-Suggested Collaborative Goals
            </div>
            {suggestions.map((s, i) => (
              <div key={i} style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: 14,
                marginBottom: 8,
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{s.description}</div>
                  <div style={{ fontSize: 10, color: "var(--gold)", fontStyle: "italic" }}>Why now: {s.why}</div>
                  <div style={{ marginTop: 6 }}>
                    {(s.orgs || []).map(o => (
                      <span key={o} style={{ fontSize: 10, color: ORG_COLORS[o] || "#888", background: "transparent", padding: "1px 6px", border: `1px solid ${ORG_COLORS[o] || "#888"}`, borderRadius: 2, marginRight: 4 }}>{o}</span>
                    ))}
                  </div>
                </div>
                <button className="btn btn-gold" style={{ fontSize: 10, padding: "5px 12px", flexShrink: 0 }} onClick={() => addFromSuggestion(s)}>Add</button>
              </div>
            ))}
            <button className="btn btn-ghost" style={{ fontSize: 10, marginTop: 4 }} onClick={() => setSuggestions([])}>Dismiss</button>
          </div>
        )}

        {/* New goal form */}
        {showNew && (
          <div style={{
            background: "var(--surface2)",
            border: "1px solid var(--gold-dim)",
            borderRadius: "var(--radius-lg)",
            padding: 20,
            marginBottom: 20,
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--gold)", marginBottom: 16 }}>
              New Collaborative Goal
            </div>
            <div className="field">
              <label className="label">Goal Title</label>
              <input className="input" value={newGoal.title} onChange={e => setNewGoal(g => ({ ...g, title: e.target.value }))} placeholder="e.g. Increase youth activity attendance by 20%" />
            </div>
            <div className="field">
              <label className="label">Description</label>
              <textarea className="input" value={newGoal.description} onChange={e => setNewGoal(g => ({ ...g, description: e.target.value }))} placeholder="What are we trying to accomplish and why?" />
            </div>
            <div className="field">
              <label className="label">Initial Progress Note</label>
              <input className="input" value={newGoal.progress} onChange={e => setNewGoal(g => ({ ...g, progress: e.target.value }))} placeholder="Not started / where we're beginning from..." />
            </div>
            <div className="field">
              <label className="label">Organizations Involved (select all that apply)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {ORG_OPTIONS.map(o => (
                  <button
                    key={o}
                    className="btn"
                    style={{
                      padding: "5px 12px",
                      fontSize: 11,
                      background: newGoal.orgs.includes(o) ? (ORG_COLORS[o] + "25") : "transparent",
                      borderColor: newGoal.orgs.includes(o) ? ORG_COLORS[o] : "var(--border)",
                      color: newGoal.orgs.includes(o) ? ORG_COLORS[o] : "var(--text-muted)",
                    }}
                    onClick={() => setNewGoal(g => ({
                      ...g,
                      orgs: g.orgs.includes(o) ? g.orgs.filter(x => x !== o) : [...g.orgs, o],
                    }))}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => { setShowNew(false); setSuggestions([]); }}>Cancel</button>
              <button className="btn btn-gold" onClick={createGoal} disabled={!newGoal.title.trim() || newGoal.orgs.length === 0}>
                Create Goal
              </button>
            </div>
          </div>
        )}

        {/* Goals list */}
        {loading ? (
          <div className="empty-state"><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">◎</span>
            <p className="empty-state-text">
              {filter === "all" ? "No goals yet — create one or let AI suggest some" : `No ${filter} goals`}
            </p>
          </div>
        ) : (
          filtered.map(g => (
            <GoalCard key={g.id} goal={g} onUpdate={updateGoal} onDelete={deleteGoal} onAddNote={addNote} />
          ))
        )}
      </div>
    </div>
  );
}
