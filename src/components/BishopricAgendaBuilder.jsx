import { useState, useEffect, useCallback } from "react";
import SendLogModal from "./SendLogModal.jsx";

const SHEETS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdl23Rb1bXooszhKH3On8dHLgfG4Oqpz5V0my6ip4NupYOZr_SuEo8kGXBY-waCDPhMiZE__jw-ZfU/pub?gid=201628214&single=true&output=csv";

const SHEETS_EDIT_URL =
  "https://docs.google.com/spreadsheets/d/1MhtUPBuSjRuQ6Y3qcEYqVsnGq5rSfR-coFsy5dGHzqs/edit";

function RoundTableItem({ item, idx, onChange, onDelete }) {
  const [editing, setEditing] = useState(false);
  return (
    <div style={{
      background: "var(--surface2)", border: "1px solid var(--border)",
      borderLeft: "3px solid var(--eq)", borderRadius: "var(--radius)", marginBottom: 6,
    }}>
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{
          minWidth: 24, height: 24, borderRadius: "50%", background: "var(--surface3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: "var(--text-muted)", fontWeight: 600, flexShrink: 0,
        }}>{idx + 1}</span>
        <div style={{ flex: 1 }}>
          {editing ? (
            <div>
              <div className="field" style={{ marginBottom: 8 }}>
                <label className="label">Topic / Item</label>
                <input className="input" value={item.title}
                  onChange={e => onChange({ ...item, title: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div>
                  <label className="label">Raised By</label>
                  <input className="input" value={item.raisedBy || ""}
                    onChange={e => onChange({ ...item, raisedBy: e.target.value })} />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={item.category || "general"}
                    onChange={e => onChange({ ...item, category: e.target.value })}>
                    <option value="general">General Discussion</option>
                    <option value="bishop-info">Bishop Info / Instruction</option>
                    <option value="ward-matter">Ward Matter</option>
                    <option value="stake-church">Stake / Region / Church</option>
                    <option value="inspiration">Idea / Inspiration</option>
                  </select>
                </div>
              </div>
              <div className="field" style={{ marginBottom: 8 }}>
                <label className="label">Notes</label>
                <textarea className="input" value={item.notes || ""}
                  onChange={e => onChange({ ...item, notes: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setEditing(false)}
                  style={{ fontSize: 10, padding: "4px 10px" }}>Done</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 500, color: "var(--text)", fontSize: 13 }}>{item.title || "(untitled)"}</span>
                {item.category && item.category !== "general" && (
                  <span className="badge" style={{
                    background: "rgba(90,127,166,0.15)", color: "var(--eq)",
                    border: "1px solid rgba(90,127,166,0.3)", fontSize: 9,
                  }}>
                    {item.category === "bishop-info" ? "Bishop Info" :
                     item.category === "ward-matter" ? "Ward Matter" :
                     item.category === "stake-church" ? "Stake/Church" :
                     item.category === "inspiration" ? "Inspiration" : item.category}
                  </span>
                )}
              </div>
              {item.raisedBy && (
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Raised by: {item.raisedBy}</div>
              )}
              {item.notes && (
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>{item.notes}</div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11 }}
            onClick={() => setEditing(e => !e)}>✎</button>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11, color: "var(--danger)" }}
            onClick={() => onDelete(item.id)}>✕</button>
        </div>
      </div>
    </div>
  );
}

function Section({ number, title, color, children }) {
  return (
    <div style={{
      background: "var(--surface2)", border: "1px solid var(--border)",
      borderLeft: `3px solid ${color || "var(--gold-dim)"}`,
      borderRadius: "var(--radius)", marginBottom: 12, overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 16px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 10, background: "var(--surface3)",
      }}>
        <span style={{
          minWidth: 22, height: 22, borderRadius: "50%",
          background: color || "var(--gold-dim)", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 11, color: "var(--bg)",
          fontWeight: 700, flexShrink: 0,
        }}>{number}</span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--text)" }}>{title}</span>
      </div>
      <div style={{ padding: "14px 16px" }}>{children}</div>
    </div>
  );
}

export default function BishopricAgendaBuilder({ api, week }) {
  const [agendas, setAgendas] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendLog, setSendLog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [inboxItems, setInboxItems] = useState([]);

  const [openingPrayer, setOpeningPrayer] = useState("");
  const [spiritualThought, setSpiritualThought] = useState("");
  const [minutesNotes, setMinutesNotes] = useState("");
  const [calendarNotes, setCalendarNotes] = useState("");
  const [closingPrayer, setClosingPrayer] = useState("");
  const [roundTableItems, setRoundTableItems] = useState([]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(() => {
    fetch(`${api}/api/bishopric/agendas`).then(r => r.json()).then(data => {
      setAgendas(data);
    }).catch(() => {});
    fetch(`${api}/api/bishopric/inbox`).then(r => r.json()).then(setInboxItems).catch(() => {});
  }, [api]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selected) return;
    const a = selected.agendaData || {};
    setOpeningPrayer(a.openingPrayer || "");
    setSpiritualThought(a.spiritualThought || "");
    setMinutesNotes(a.minutesNotes || "");
    setCalendarNotes(a.calendarNotes || "");
    setClosingPrayer(a.closingPrayer || "");
    setRoundTableItems(a.roundTableItems || []);
  }, [selected?.id]);

  const createNew = async () => {
    const newAgenda = {
      week: week || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      title: `Bishopric Meeting — ${week || ""}`,
      status: "draft",
      generatedAt: new Date().toISOString(),
      agendaData: { openingPrayer: "", spiritualThought: "", minutesNotes: "", calendarNotes: "", closingPrayer: "", roundTableItems: [] },
    };
    try {
      const res = await fetch(`${api}/api/bishopric/agendas/create`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAgenda),
      });
      const created = await res.json();
      load(); setSelected(created); showToast("New agenda created");
    } catch {
      const local = { ...newAgenda, id: Date.now().toString() };
      setAgendas(prev => [local, ...prev]); setSelected(local);
    }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const agendaData = { openingPrayer, spiritualThought, minutesNotes, calendarNotes, closingPrayer, roundTableItems };
    const updated = { ...selected, agendaData };
    try {
      await fetch(`${api}/api/bishopric/agendas/${selected.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      setSelected(updated);
      setAgendas(prev => prev.map(a => a.id === updated.id ? updated : a));
      showToast("Saved");
    } catch { showToast("Error saving"); }
    setSaving(false);
  };

  const sendAgenda = async () => {
    if (!selected) return;
    setSending(true);
    try {
      await save();
      const res = await fetch(`${api}/api/bishopric/agendas/${selected.id}/send`, { method: "POST" });
      const data = await res.json();
      setSendLog({ title: "Bishopric Agenda Send Log", results: data.results || [] });
      load();
    } catch { showToast("Error sending"); }
    setSending(false);
  };

  const deleteAgenda = async (id) => {
    await fetch(`${api}/api/bishopric/agendas/${id}`, { method: "DELETE" });
    setSelected(null); load();
  };

  const addRoundTableItem = () => {
    setRoundTableItems(prev => [...prev, { id: Date.now().toString(), title: "", raisedBy: "", category: "general", notes: "" }]);
  };

  const routeInboxItem = async (item) => {
    await fetch(`${api}/api/bishopric/inbox/${item.id}/route`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "bishopric" }),
    });
    setRoundTableItems(prev => [...prev, { id: Date.now().toString(), title: item.body, raisedBy: item.fromName, category: "ward-matter", notes: "" }]);
    showToast("Added to Round Table"); load();
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {toast && <div className="toast">{toast}</div>}
      {sendLog && <SendLogModal title={sendLog.title} results={sendLog.results} onClose={() => setSendLog(null)} />}

      {/* Left sidebar */}
      <div className="scroll" style={{ width: 260, borderRight: "1px solid var(--border)", padding: 16, flexShrink: 0, background: "var(--surface)" }}>
        <button className="btn btn-gold" style={{ width: "100%", marginBottom: 16 }} onClick={createNew}>
          + New Agenda
        </button>

        {inboxItems.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="label" style={{ marginBottom: 8 }}>SMS Inbox ({inboxItems.length})</div>
            {inboxItems.map(item => (
              <div key={item.id} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 10, marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: "var(--text)", marginBottom: 4, lineHeight: 1.5 }}>{item.body}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>From: {item.fromName} · {new Date(item.receivedAt).toLocaleDateString()}</div>
                <button className="btn btn-ghost" style={{ fontSize: 9, padding: "2px 6px", color: "var(--gold)" }} onClick={() => routeInboxItem(item)}>
                  + Add to Round Table
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="label" style={{ marginBottom: 8 }}>Agendas</div>
        {agendas.length === 0 && (
          <div className="empty-state" style={{ padding: "24px 0" }}>
            <span className="empty-state-icon" style={{ fontSize: 20 }}>◉</span>
            <p className="empty-state-text">No agendas yet</p>
          </div>
        )}
        {agendas.map(a => (
          <div key={a.id} onClick={() => setSelected(a)} style={{
            padding: "10px 12px",
            background: selected?.id === a.id ? "var(--surface3)" : "var(--surface2)",
            border: `1px solid ${selected?.id === a.id ? "var(--gold-dim)" : "var(--border)"}`,
            borderRadius: "var(--radius)", marginBottom: 6, cursor: "pointer",
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: selected?.id === a.id ? "var(--gold)" : "var(--text)" }}>{a.week}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{a.status || "draft"}</div>
          </div>
        ))}
      </div>

      {/* Right: editor */}
      {!selected ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="empty-state">
            <span className="empty-state-icon">◉</span>
            <p className="empty-state-text">Select or create a bishopric agenda</p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", flexShrink: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)" }}>{selected.title || selected.week}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" style={{ fontSize: 10, color: "var(--danger)" }} onClick={() => deleteAgenda(selected.id)}>Delete</button>
              <button className="btn btn-outline" onClick={save} disabled={saving}>{saving ? <><span className="spinner" /> Saving...</> : "Save"}</button>
              <button className="btn btn-gold" onClick={sendAgenda} disabled={sending}>{sending ? <><span className="spinner" /> Sending...</> : "◈ Send to Bishopric"}</button>
            </div>
          </div>

          <div className="scroll" style={{ flex: 1, padding: 24 }}>

            <Section number="1" title="Opening Prayer" color="var(--gold-dim)">
              <input className="input" placeholder="Who is giving the opening prayer?"
                value={openingPrayer} onChange={e => setOpeningPrayer(e.target.value)} />
            </Section>

            <Section number="2" title="Spiritual Thought" color="var(--gold-dim)">
              <input className="input" placeholder="Who is sharing the spiritual thought?"
                value={spiritualThought} onChange={e => setSpiritualThought(e.target.value)} />
            </Section>

            <Section number="3" title="Review Previous Minutes & Unresolved Items" color="var(--rs)">
              <textarea className="input" style={{ minHeight: 80 }}
                placeholder="Notes on previous minutes or unresolved action items..."
                value={minutesNotes} onChange={e => setMinutesNotes(e.target.value)} />
            </Section>

            <Section number="4" title="Review Sacrament Meeting Program" color="var(--eq)">
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10, lineHeight: 1.6 }}>
                Review the upcoming program in the Sacrament Program tab, or open the scheduling spreadsheet directly.
              </div>
              <a href={SHEETS_EDIT_URL} target="_blank" rel="noreferrer" style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11,
                color: "var(--eq)", textDecoration: "none", border: "1px solid var(--eq)",
                borderRadius: "var(--radius)", padding: "5px 12px",
              }}>
                ↗ Open Scheduling Spreadsheet
              </a>
            </Section>

            <Section number="5" title="Discuss Ward Calendar" color="var(--yw)">
              <textarea className="input" style={{ minHeight: 80 }}
                placeholder="Upcoming events, scheduling conflicts, calendar items to discuss..."
                value={calendarNotes} onChange={e => setCalendarNotes(e.target.value)} />
            </Section>

            <Section number="6" title="Round Table Discussion" color="var(--ss)">
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
                Top-of-mind issues from around the ward, stake, region, or church.
              </div>
              {roundTableItems.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, fontStyle: "italic" }}>No items yet.</div>
              )}
              {roundTableItems.map((item, idx) => (
                <RoundTableItem key={item.id} item={item} idx={idx}
                  onChange={u => setRoundTableItems(prev => prev.map(i => i.id === u.id ? u : i))}
                  onDelete={id => setRoundTableItems(prev => prev.filter(i => i.id !== id))} />
              ))}
              <button className="btn btn-outline" style={{ fontSize: 10, marginTop: 4 }} onClick={addRoundTableItem}>
                + Add Item
              </button>
            </Section>

            <Section number="7" title="Closing Prayer" color="var(--gold-dim)">
              <input className="input" placeholder="Who is giving the closing prayer?"
                value={closingPrayer} onChange={e => setClosingPrayer(e.target.value)} />
            </Section>

          </div>
        </div>
      )}
    </div>
  );
}
