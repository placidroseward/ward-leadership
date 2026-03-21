import { useState, useEffect, useCallback } from "react";
import SendLogModal from "./SendLogModal.jsx";

const TYPE_COLORS = {
  opening: "#C9A84C",
  discussion: "#5B7FA6",
  report: "#7C9E87",
  action: "#A07CB5",
  closing: "#9E7B6B",
};

function AgendaItem({ item, idx, onChange, onDelete }) {
  const [editing, setEditing] = useState(false);
  const color = TYPE_COLORS[item.type] || "#888";

  return (
    <div style={{
      background: "var(--surface2)",
      border: `1px solid var(--border)`,
      borderLeft: `3px solid ${color}`,
      borderRadius: "var(--radius)",
      marginBottom: 6,
    }}>
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{
          minWidth: 24, height: 24, borderRadius: "50%",
          background: "var(--surface3)", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: "var(--text-muted)", fontWeight: 600, flexShrink: 0,
        }}>{idx + 1}</span>

        <div style={{ flex: 1 }}>
          {editing ? (
            <div>
              <div className="field" style={{ marginBottom: 8 }}>
                <input className="input" value={item.title} onChange={e => onChange({ ...item, title: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div>
                  <label className="label">Duration (min)</label>
                  <input className="input" type="number" value={item.duration} onChange={e => onChange({ ...item, duration: +e.target.value })} />
                </div>
                <div>
                  <label className="label">Owner</label>
                  <input className="input" value={item.owner} onChange={e => onChange({ ...item, owner: e.target.value })} />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={item.type} onChange={e => onChange({ ...item, type: e.target.value })}>
                    {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="field" style={{ marginBottom: 8 }}>
                <label className="label">Notes</label>
                <textarea className="input" value={item.notes || ""} onChange={e => onChange({ ...item, notes: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setEditing(false)} style={{ fontSize: 10, padding: "4px 10px" }}>Done</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 500, color: "var(--text)", fontSize: 13 }}>{item.title}</span>
                {item.collaborationFlag && (
                  <span className="badge" style={{ background: "rgba(201,168,76,0.15)", color: "var(--gold)", border: "1px solid var(--gold-dim)", fontSize: 9 }}>
                    ✦ Collab
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)" }}>
                <span style={{ color }}>{item.type}</span>
                <span>⏱ {item.duration} min</span>
                <span>👤 {item.owner}</span>
              </div>
              {item.notes && <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>{item.notes}</div>}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setEditing(e => !e)}>✎</button>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11, color: "var(--danger)" }} onClick={() => onDelete(item.order)}>✕</button>
        </div>
      </div>
    </div>
  );
}

export default function AgendaBuilder({ api, week }) {
  const [agendas, setAgendas] = useState([]);
  const [selected, setSelected] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendLog, setSendLog] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [minutesUrl, setMinutesUrl] = useState("");
  const [minutesText, setMinutesText] = useState("");
  const [minutesMode, setMinutesMode] = useState("url"); // "url" or "text"
  const [minutesSaved, setMinutesSaved] = useState(false);
  const [savingMinutes, setSavingMinutes] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(() => {
    fetch(`${api}/api/agendas`).then(r => r.json()).then(data => {
      setAgendas(data);
      if (!selected && data.length > 0) setSelected(data[0]);
    });
  }, [api]);

  useEffect(() => { load(); }, [load]);

  // Load existing minutes for this week
  useEffect(() => {
    fetch(`${api}/api/minutes?week=${week}`).then(r => r.json()).then(data => {
      if (data.length > 0) {
        const m = data[0];
        if (m.url) { setMinutesMode("url"); setMinutesUrl(m.url); }
        else if (m.text) { setMinutesMode("text"); setMinutesText(m.text); }
        setMinutesSaved(true);
      }
    }).catch(() => {});
  }, [api, week]);

  const saveMinutes = async () => {
    setSavingMinutes(true);
    try {
      await fetch(`${api}/api/minutes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week,
          url: minutesMode === "url" ? minutesUrl : null,
          text: minutesMode === "text" ? minutesText : null,
        }),
      });
      setMinutesSaved(true);
      showToast("Minutes saved — will be included in next agenda generation");
    } catch { showToast("Error saving minutes"); }
    setSavingMinutes(false);
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${api}/api/agendas/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week }),
      });
      const agenda = await res.json();
      if (agenda.error) throw new Error(agenda.error);
      load();
      setSelected(agenda);
      showToast("Agenda generated!");
    } catch (e) { showToast("Error: " + e.message); }
    setGenerating(false);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    await fetch(`${api}/api/agendas/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selected),
    });
    setSaving(false);
    showToast("Saved");
    load();
  };

  const sendAgenda = async () => {
    if (!selected) return;
    setSending(true);
    try {
      await save();
      const res = await fetch(`${api}/api/agendas/${selected.id}/send`, { method: "POST" });
      const data = await res.json();
      setSendLog({ title: "Ward Council Agenda Send Log", results: data.results || [] });
      load();
    } catch { showToast("Error sending"); }
    setSending(false);
  };

  const deleteAgenda = async (id) => {
    await fetch(`${api}/api/agendas/${id}`, { method: "DELETE" });
    setSelected(null);
    load();
  };

  const updateItem = (updated) => {
    setSelected(a => ({ ...a, items: a.items.map(i => i.order === updated.order ? updated : i) }));
  };

  const deleteItem = (order) => {
    setSelected(a => ({ ...a, items: a.items.filter(i => i.order !== order) }));
  };

  const totalMinutes = selected?.items?.reduce((sum, i) => sum + (i.duration || 0), 0) || 0;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {toast && <div className="toast">{toast}</div>}
      {sendLog && <SendLogModal title={sendLog.title} results={sendLog.results} onClose={() => setSendLog(null)} />}

      {/* Left: Agenda list */}
      <div className="scroll" style={{ width: 280, borderRight: "1px solid var(--border)", padding: 16, flexShrink: 0, background: "var(--surface)" }}>
        <div style={{ marginBottom: 12 }}>
          <button className="btn btn-gold" style={{ width: "100%" }} onClick={generate} disabled={generating}>
            {generating ? <><span className="spinner" /> Generating...</> : "✦ Generate Agenda"}
          </button>
        </div>

        {/* Minutes panel */}
        <div style={{
          background: "var(--surface2)",
          border: `1px solid ${minutesSaved ? "var(--gold-dim)" : "var(--border)"}`,
          borderRadius: "var(--radius)",
          padding: 12,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-display)", color: minutesSaved ? "var(--gold)" : "var(--text)", marginBottom: 8 }}>
            {minutesSaved ? "✓ Minutes Ready" : "📋 Previous Minutes"}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {["url", "text"].map(m => (
              <button key={m} className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 8px", background: minutesMode === m ? "var(--surface3)" : "transparent", color: minutesMode === m ? "var(--gold)" : "var(--text-muted)" }}
                onClick={() => setMinutesMode(m)}>
                {m === "url" ? "OneNote Link" : "Paste Text"}
              </button>
            ))}
          </div>
          {minutesMode === "url" ? (
            <input
              className="input"
              style={{ fontSize: 11, marginBottom: 8 }}
              placeholder="Paste OneNote share link..."
              value={minutesUrl}
              onChange={e => { setMinutesUrl(e.target.value); setMinutesSaved(false); }}
            />
          ) : (
            <textarea
              className="input"
              style={{ fontSize: 11, marginBottom: 8, minHeight: 80, resize: "vertical" }}
              placeholder="Paste minutes text here..."
              value={minutesText}
              onChange={e => { setMinutesText(e.target.value); setMinutesSaved(false); }}
            />
          )}
          <button className="btn btn-outline" style={{ width: "100%", fontSize: 11 }} onClick={saveMinutes} disabled={savingMinutes || (!minutesUrl && !minutesText)}>
            {savingMinutes ? "Saving..." : "Save Minutes"}
          </button>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 }}>
            Minutes will be reviewed by AI when generating the next agenda.
          </div>
        </div>

        <div className="label" style={{ marginBottom: 8 }}>Agendas</div>
        {agendas.length === 0 && (
          <div className="empty-state" style={{ padding: "24px 0" }}>
            <span className="empty-state-icon" style={{ fontSize: 20 }}>◉</span>
            <p className="empty-state-text">No agendas yet</p>
          </div>
        )}
        {agendas.map(a => (
          <div
            key={a.id}
            onClick={() => setSelected(a)}
            style={{
              padding: "10px 12px",
              background: selected?.id === a.id ? "var(--surface3)" : "var(--surface2)",
              border: `1px solid ${selected?.id === a.id ? "var(--gold-dim)" : "var(--border)"}`,
              borderRadius: "var(--radius)",
              marginBottom: 6,
              cursor: "pointer",
              transition: "all 0.1s",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 500, color: selected?.id === a.id ? "var(--gold)" : "var(--text)" }}>
              {a.week}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {a.items?.length || 0} items · {a.status}
            </div>
          </div>
        ))}
      </div>

      {/* Right: Agenda editor */}
      {!selected ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="empty-state">
            <span className="empty-state-icon">◉</span>
            <p className="empty-state-text">Select or generate an agenda</p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Agenda header */}
          <div style={{
            padding: "12px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface)",
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)" }}>{selected.title || selected.week}</div>
              <div style={{ fontSize: 11, color: totalMinutes > 60 ? "var(--danger)" : "var(--text-muted)", marginTop: 2 }}>
                {totalMinutes} min total {totalMinutes > 60 ? "⚠ Over 60 min limit" : "✓"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" style={{ fontSize: 10, color: "var(--danger)" }} onClick={() => deleteAgenda(selected.id)}>Delete</button>
              <button className="btn btn-outline" onClick={save} disabled={saving}>
                {saving ? <><span className="spinner" /> Saving...</> : "Save"}
              </button>
              <button className="btn btn-gold" onClick={sendAgenda} disabled={sending}>
                {sending ? <><span className="spinner" /> Sending...</> : "◈ Send via SMS"}
              </button>
            </div>
          </div>

          <div className="scroll" style={{ flex: 1, padding: 24 }}>
            {/* Role Assignments */}
            {selected.assignments && (
              <div style={{
                background: "var(--surface2)",
                border: "1px solid var(--border2)",
                borderRadius: "var(--radius-lg)",
                padding: 16,
                marginBottom: 20,
                display: "flex",
                gap: 24,
                flexWrap: "wrap",
              }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text)", width: "100%", marginBottom: 4 }}>
                  Meeting Assignments
                </div>
                {[
                  { label: "Opening Prayer", value: selected.assignments.openingPrayer },
                  { label: "Spiritual Thought", value: selected.assignments.spiritualThought },
                  { label: "Closing Prayer", value: selected.assignments.closingPrayer },
                ].map(a => (
                  <div key={a.label} style={{ flex: 1, minWidth: 140 }}>
                    <div className="label">{a.label}</div>
                    <div style={{ fontSize: 13, color: "var(--gold)", fontFamily: "var(--font-display)", fontWeight: 500 }}>{a.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Cross-org themes */}
            {selected.crossOrgThemes?.length > 0 && (
              <div style={{
                background: "var(--gold-glow)",
                border: "1px solid var(--gold-dim)",
                borderRadius: "var(--radius-lg)",
                padding: 16,
                marginBottom: 20,
              }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--gold)", marginBottom: 10 }}>
                  ✦ Cross-Organization Themes
                </div>
                {selected.crossOrgThemes.map((t, i) => (
                  <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < selected.crossOrgThemes.length - 1 ? "1px solid rgba(201,168,76,0.2)" : "none" }}>
                    <div style={{ fontWeight: 500, color: "var(--text)", fontSize: 13 }}>{t.theme}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{t.summary}</div>
                    <div style={{ marginTop: 4 }}>
                      {(t.orgsInvolved || []).map(o => (
                        <span key={o} style={{ fontSize: 10, color: "var(--gold)", background: "rgba(201,168,76,0.1)", padding: "1px 6px", borderRadius: 2, marginRight: 4 }}>{o}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Agenda items */}
            <div style={{ marginBottom: 16, fontFamily: "var(--font-display)", fontSize: 16 }}>Agenda Items</div>
            {(selected.items || []).map((item, idx) => (
              <AgendaItem key={item.order} item={item} idx={idx} onChange={updateItem} onDelete={deleteItem} />
            ))}

            {/* AI Insights */}
            {selected.insights?.length > 0 && (
              <div style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: 16,
                marginTop: 20,
              }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text)", marginBottom: 10 }}>
                  AI Insights
                </div>
                {selected.insights.map((ins, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 12, color: "var(--text-dim)" }}>
                    <span style={{ color: "var(--gold)", flexShrink: 0 }}>◦</span>
                    {ins}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
