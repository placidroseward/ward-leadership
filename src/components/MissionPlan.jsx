import { useState, useEffect, useCallback } from "react";

const STATUS_CONFIG = {
  not_started: { label: "Not Started", color: "#A05A5A", bg: "rgba(160,90,90,0.15)",  dot: "#A05A5A" },
  on_track:    { label: "On Track",   color: "#C9A84C", bg: "rgba(201,168,76,0.15)", dot: "#C9A84C" },
  complete:    { label: "Complete",   color: "#5A8A6E", bg: "rgba(90,138,110,0.15)", dot: "#5A8A6E" },
};

const PERSON_STATUS_CONFIG = {
  not_started: { label: "Not Active",  color: "#A05A5A", bg: "rgba(160,90,90,0.15)" },
  on_track:    { label: "Progressing", color: "#C9A84C", bg: "rgba(201,168,76,0.15)" },
  complete:    { label: "Complete",    color: "#5A8A6E", bg: "rgba(90,138,110,0.15)" },
};

function StatusBadge({ value, onChange, config = STATUS_CONFIG }) {
  const cfg = config[value] || config.not_started;
  const keys = Object.keys(config);
  const cycle = () => {
    const next = keys[(keys.indexOf(value) + 1) % keys.length];
    onChange(next);
  };
  return (
    <button onClick={cycle} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 3, cursor: "pointer",
      background: cfg.bg, border: `1px solid ${cfg.color}`,
      color: cfg.color, fontSize: 10, letterSpacing: "0.1em",
      textTransform: "uppercase", fontFamily: "var(--font-mono)",
      transition: "all 0.15s",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </button>
  );
}

function EditableText({ value, onChange, placeholder, multiline, style = {} }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    return multiline ? (
      <div>
        <textarea className="input" value={draft} autoFocus
          onChange={e => setDraft(e.target.value)}
          style={{ marginBottom: 6, ...style }} />
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-gold" style={{ fontSize: 10, padding: "3px 10px" }} onClick={commit}>Save</button>
          <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 10px" }} onClick={cancel}>Cancel</button>
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input className="input" value={draft} autoFocus
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
          style={style} />
        <button className="btn btn-gold" style={{ fontSize: 10, padding: "3px 10px" }} onClick={commit}>✓</button>
        <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 10px" }} onClick={cancel}>✕</button>
      </div>
    );
  }
  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit"
      style={{ cursor: "text", borderBottom: "1px dashed var(--border2)", ...style }}
    >
      {value || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>{placeholder || "Click to edit"}</span>}
    </span>
  );
}

function AISuggestButton({ onSuggest, loading }) {
  return (
    <button className="btn btn-outline" style={{ fontSize: 10, padding: "4px 10px" }}
      onClick={onSuggest} disabled={loading}>
      {loading ? <><span className="spinner" /> Thinking...</> : "✦ AI Suggest"}
    </button>
  );
}

function SuggestionPanel({ suggestions, onApprove, onDismiss }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div style={{
      background: "var(--gold-glow)", border: "1px solid var(--gold-dim)",
      borderRadius: "var(--radius)", padding: 14, marginTop: 10,
    }}>
      <div style={{ fontSize: 11, color: "var(--gold)", fontFamily: "var(--font-display)", marginBottom: 8 }}>
        ✦ AI Suggestions — approve to add to plan
      </div>
      {suggestions.map((s, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "8px 0", borderBottom: i < suggestions.length - 1 ? "1px solid rgba(201,168,76,0.2)" : "none",
        }}>
          <div style={{ flex: 1, fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>{s}</div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button className="btn btn-gold" style={{ fontSize: 10, padding: "3px 8px" }} onClick={() => onApprove(s, i)}>
              ✓ Add
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 8px" }} onClick={() => onDismiss(i)}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SECTION: Key Goals ───────────────────────────────────────────────────────
function KeyGoalsSection({ goals, onUpdate, onAdd, onRemove, onAISuggest }) {
  const [suggesting, setSuggesting] = useState(null);
  const [suggestions, setSuggestions] = useState({});

  const suggest = async (goalId) => {
    setSuggesting(goalId);
    const result = await onAISuggest("goal", goalId);
    setSuggestions(p => ({ ...p, [goalId]: result }));
    setSuggesting(null);
  };

  const approveAction = (goalId, text, idx) => {
    const goal = goals.find(g => g.id === goalId);
    onUpdate(goalId, { actions: [...(goal.actions || []), { id: Date.now() + idx, text, status: "not_started" }] });
    setSuggestions(p => ({ ...p, [goalId]: p[goalId].filter((_, i) => i !== idx) }));
  };

  const dismissSuggestion = (goalId, idx) => {
    setSuggestions(p => ({ ...p, [goalId]: p[goalId].filter((_, i) => i !== idx) }));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)" }}>Key Goals</div>
        <button className="btn btn-outline" style={{ fontSize: 10 }} onClick={onAdd}>+ Add Goal</button>
      </div>
      {goals.map(goal => (
        <div key={goal.id} style={{
          background: "var(--surface2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: 16, marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
                <EditableText value={goal.title} onChange={v => onUpdate(goal.id, { title: v })} placeholder="Goal title" />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
                <EditableText value={goal.description} onChange={v => onUpdate(goal.id, { description: v })}
                  placeholder="Description" multiline />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <StatusBadge value={goal.status || "not_started"} onChange={v => onUpdate(goal.id, { status: v })} />
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 8px", color: "var(--danger)" }}
                onClick={() => onRemove(goal.id)}>✕</button>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 10 }}>
            <div className="label" style={{ marginBottom: 4 }}>Progress Notes</div>
            <EditableText value={goal.notes || ""} onChange={v => onUpdate(goal.id, { notes: v })}
              placeholder="Add progress notes..." multiline
              style={{ fontSize: 11, color: "var(--text-dim)" }} />
          </div>

          {/* Action items */}
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Action Items</div>
            {(goal.actions || []).map((action, idx) => (
              <div key={action.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 0", borderBottom: "1px solid var(--border)",
              }}>
                <StatusBadge value={action.status || "not_started"} onChange={v => {
                  const updated = [...(goal.actions || [])];
                  updated[idx] = { ...action, status: v };
                  onUpdate(goal.id, { actions: updated });
                }} />
                <div style={{ flex: 1, fontSize: 12, color: "var(--text-dim)" }}>
                  <EditableText value={action.text} onChange={v => {
                    const updated = [...(goal.actions || [])];
                    updated[idx] = { ...action, text: v };
                    onUpdate(goal.id, { actions: updated });
                  }} />
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px", color: "var(--danger)" }}
                  onClick={() => onUpdate(goal.id, { actions: goal.actions.filter((_, i) => i !== idx) })}>✕</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => {
                onUpdate(goal.id, { actions: [...(goal.actions || []), { id: Date.now(), text: "New action item", status: "not_started" }] });
              }}>+ Add Action</button>
              <AISuggestButton loading={suggesting === goal.id} onSuggest={() => suggest(goal.id)} />
            </div>
            <SuggestionPanel suggestions={suggestions[goal.id]}
              onApprove={(text, idx) => approveAction(goal.id, text, idx)}
              onDismiss={(idx) => dismissSuggestion(goal.id, idx)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SECTION: Org Plans ───────────────────────────────────────────────────────
function OrgPlansSection({ orgs, onUpdate, onAddOrg, onRemoveOrg, onAISuggest }) {
  const [suggesting, setSuggesting] = useState(null);
  const [suggestions, setSuggestions] = useState({});

  const suggest = async (orgId) => {
    setSuggesting(orgId);
    const result = await onAISuggest("org", orgId);
    setSuggestions(p => ({ ...p, [orgId]: result }));
    setSuggesting(null);
  };

  const approveAction = (orgId, text, idx) => {
    const org = orgs.find(o => o.id === orgId);
    onUpdate(orgId, { actions: [...(org.actions || []), { id: Date.now() + idx, text, status: "not_started" }] });
    setSuggestions(p => ({ ...p, [orgId]: p[orgId].filter((_, i) => i !== idx) }));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)" }}>Organization Plans</div>
        <button className="btn btn-outline" style={{ fontSize: 10 }} onClick={onAddOrg}>+ Add Organization</button>
      </div>
      {orgs.map(org => (
        <div key={org.id} style={{
          background: "var(--surface2)", border: "1px solid var(--border)",
          borderLeft: `3px solid ${org.color || "var(--gold)"}`,
          borderRadius: "var(--radius-lg)", padding: 16, marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 15, color: "var(--text)" }}>
              <EditableText value={org.name} onChange={v => onUpdate(org.id, { name: v })} />
            </div>
            <StatusBadge value={org.status || "not_started"} onChange={v => onUpdate(org.id, { status: v })} />
            <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 8px", color: "var(--danger)" }}
              onClick={() => onRemoveOrg(org.id)}>✕</button>
          </div>

          {/* Objective */}
          <div style={{ marginBottom: 12 }}>
            <div className="label" style={{ marginBottom: 4 }}>Objective</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
              <EditableText value={org.objective || ""} onChange={v => onUpdate(org.id, { objective: v })}
                placeholder="Organization objective..." multiline />
            </div>
          </div>

          {/* Action items */}
          <div style={{ marginBottom: 12 }}>
            <div className="label" style={{ marginBottom: 6 }}>Action Items</div>
            {(org.actions || []).map((action, idx) => (
              <div key={action.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 0", borderBottom: "1px solid var(--border)",
              }}>
                <StatusBadge value={action.status || "not_started"} onChange={v => {
                  const updated = [...(org.actions || [])];
                  updated[idx] = { ...action, status: v };
                  onUpdate(org.id, { actions: updated });
                }} />
                <div style={{ flex: 1, fontSize: 12, color: "var(--text-dim)" }}>
                  <EditableText value={action.text} onChange={v => {
                    const updated = [...(org.actions || [])];
                    updated[idx] = { ...action, text: v };
                    onUpdate(org.id, { actions: updated });
                  }} />
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px", color: "var(--danger)" }}
                  onClick={() => onUpdate(org.id, { actions: org.actions.filter((_, i) => i !== idx) })}>✕</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => {
                onUpdate(org.id, { actions: [...(org.actions || []), { id: Date.now(), text: "New action item", status: "not_started" }] });
              }}>+ Add Action</button>
              <AISuggestButton loading={suggesting === org.id} onSuggest={() => suggest(org.id)} />
            </div>
            <SuggestionPanel suggestions={suggestions[org.id]}
              onApprove={(text, idx) => approveAction(org.id, text, idx)}
              onDismiss={(idx) => setSuggestions(p => ({ ...p, [org.id]: p[org.id].filter((_, i) => i !== idx) }))} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SECTION: People of Focus ─────────────────────────────────────────────────
function PeopleSection({ people, orgs, onUpdate, onAdd, onRemove }) {
  const orgNames = orgs.map(o => o.name);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)" }}>People of Focus</div>
        <button className="btn btn-outline" style={{ fontSize: 10 }} onClick={onAdd}>+ Add Person</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
        {people.map(person => (
          <div key={person.id} style={{
            background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: 14,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", flex: 1 }}>
                <EditableText value={person.name} onChange={v => onUpdate(person.id, { name: v })}
                  placeholder="Person's name" />
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px", color: "var(--danger)" }}
                onClick={() => onRemove(person.id)}>✕</button>
            </div>

            <div style={{ marginBottom: 8 }}>
              <StatusBadge value={person.status || "not_started"} onChange={v => onUpdate(person.id, { status: v })}
                config={PERSON_STATUS_CONFIG} />
            </div>

            <div style={{ marginBottom: 8 }}>
              <div className="label" style={{ marginBottom: 4 }}>Assigned Org / Contact</div>
              <select className="input" style={{ fontSize: 11 }}
                value={person.org || ""} onChange={e => onUpdate(person.id, { org: e.target.value })}>
                <option value="">— Select org —</option>
                {orgNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div>
              <div className="label" style={{ marginBottom: 4 }}>Notes</div>
              <EditableText value={person.notes || ""} onChange={v => onUpdate(person.id, { notes: v })}
                placeholder="Notes on progress..." multiline
                style={{ fontSize: 11, color: "var(--text-dim)" }} />
            </div>
          </div>
        ))}
        {people.length === 0 && (
          <div className="empty-state" style={{ gridColumn: "1/-1", padding: "32px 24px" }}>
            <span className="empty-state-icon" style={{ fontSize: 24 }}>◎</span>
            <p className="empty-state-text">No people added yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SECTION: Annual Objectives ───────────────────────────────────────────────
function ObjectivesSection({ objectives, onUpdate, onAdd, onRemove }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)" }}>Annual Objectives</div>
        <button className="btn btn-outline" style={{ fontSize: 10 }} onClick={onAdd}>+ Add Objective</button>
      </div>
      {objectives.map(obj => (
        <div key={obj.id} style={{
          background: "var(--surface2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "12px 16px", marginBottom: 8,
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <StatusBadge value={obj.status || "not_started"} onChange={v => onUpdate(obj.id, { status: v })} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
              <EditableText value={obj.title} onChange={v => onUpdate(obj.id, { title: v })} placeholder="Objective title" />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
              <EditableText value={obj.description || ""} onChange={v => onUpdate(obj.id, { description: v })}
                placeholder="Description..." multiline />
            </div>
            {obj.notes !== undefined && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                <EditableText value={obj.notes || ""} onChange={v => onUpdate(obj.id, { notes: v })}
                  placeholder="Progress notes..." multiline />
              </div>
            )}
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 8px", color: "var(--danger)" }}
            onClick={() => onRemove(obj.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "goals", label: "Key Goals" },
  { id: "objectives", label: "Annual Objectives" },
  { id: "orgs", label: "Org Plans" },
  { id: "people", label: "People of Focus" },
];

const DEFAULT_PLAN = {
  id: "mission-2026",
  year: 2026,
  primaryGoal: "To bring members and non-members closer to Jesus Christ.",
  overview: "The Placid Rose Ward will focus on a unified mission plan that involves all ward organizations working together to foster love, sharing, and inviting others to come unto Christ.",
  goals: [
    { id: "g1", title: "Bring People to Christ", description: "Help members and non-members come closer to Jesus Christ.", status: "not_started", notes: "", actions: [] },
    { id: "g2", title: "Conversion and Baptism", description: "Help non-members recognize the truth of the Church and encourage them to be baptized.", status: "not_started", notes: "", actions: [] },
    { id: "g3", title: "Love Others", description: "Show love to all.", status: "not_started", notes: "", actions: [] },
    { id: "g4", title: "Share the Gospel", description: "Find ways to share the Gospel with others.", status: "not_started", notes: "", actions: [] },
    { id: "g5", title: "Invite to Christ", description: "Encourage others to come unto Christ.", status: "not_started", notes: "", actions: [] },
  ],
  objectives: [
    { id: "o1", title: "Increase Engagement", description: "Use ward activities like Trunk or Treat and BBQ to engage neighbors and less-active members.", status: "not_started", notes: "" },
    { id: "o2", title: "Outreach and Fellowship", description: "Maintain and update a list of less-active members and prospective members.", status: "not_started", notes: "" },
    { id: "o3", title: "Neighborhood Focus", description: "Organize neighborhood activities and service projects.", status: "not_started", notes: "" },
    { id: "o4", title: "Organizational Collaboration", description: "Ensure each organization within the ward participates and contributes.", status: "not_started", notes: "" },
  ],
  orgs: [
    { id: "org-bishopric", name: "Bishopric", color: "#C9A84C", status: "not_started", objective: "Provide overall leadership and support for the mission plan.", actions: [
      { id: "a1", text: "Regularly review and update the mission plan.", status: "not_started" },
      { id: "a2", text: "Coordinate with all organizations to ensure alignment with the plan.", status: "not_started" },
      { id: "a3", text: "Lead by example in missionary efforts and outreach.", status: "not_started" },
    ]},
    { id: "org-rs", name: "Relief Society", color: "#7C9E87", status: "not_started", objective: "Foster relationships and engage non-members and less-active members.", actions: [
      { id: "a4", text: "Invite non-members and less-active members to all activities.", status: "not_started" },
      { id: "a5", text: "Plan and execute four major activities annually, inviting non-member friends.", status: "not_started" },
      { id: "a6", text: "Partner with full-time missionaries for outreach and visits.", status: "not_started" },
    ]},
    { id: "org-eq", name: "Elders Quorum", color: "#5B7FA6", status: "not_started", objective: "Support new converts and engage prospective elders.", actions: [
      { id: "a7", text: "Monitor the new convert list and assist new members along the covenant path.", status: "not_started" },
      { id: "a8", text: "Plan and execute regular activities inviting non-members.", status: "not_started" },
      { id: "a9", text: "Focus on engaging prospective elders.", status: "not_started" },
    ]},
    { id: "org-primary", name: "Primary", color: "#C97B5A", status: "not_started", objective: "Create a positive relationship and environment for children to participate in gospel learning so they feel welcomed, loved, and important.", actions: [
      { id: "a10", text: "Conduct birthday visits for less-active Primary children.", status: "not_started" },
      { id: "a11", text: "Visit children six weeks before their baptism date to provide support.", status: "not_started" },
      { id: "a12", text: "Invite families to take an active role in baptism planning.", status: "not_started" },
      { id: "a13", text: "Encourage attendance from less-active and non-members in Valiant Activity Days.", status: "not_started" },
    ]},
    { id: "org-ymyw", name: "Young Men & Young Women", color: "#A07CB5", status: "not_started", objective: "Involve youth in missionary work and community building.", actions: [
      { id: "a14", text: "Encourage youth to invite friends to activities.", status: "not_started" },
      { id: "a15", text: "Partner with full-time missionaries for youth-led outreach.", status: "not_started" },
      { id: "a16", text: "Plan joint YM/YW activities inclusive of non-members and less-active youth.", status: "not_started" },
      { id: "a17", text: "Youth pray individually by name for each other.", status: "not_started" },
      { id: "a18", text: "Youth presidency reach out individually to people in their classes.", status: "not_started" },
    ]},
    { id: "org-ss", name: "Sunday School", color: "#6B9E9E", status: "not_started", objective: "Enhance gospel learning and sharing.", actions: [
      { id: "a19", text: "Encourage class members to share gospel experiences.", status: "not_started" },
      { id: "a20", text: "Support the ward's outreach activities through lesson integration.", status: "not_started" },
    ]},
  ],
  people: [],
};

export default function MissionPlan({ api }) {
  const [plan, setPlan] = useState(null);
  const [activeSection, setActiveSection] = useState("goals");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [saveTimeout, setSaveTimeout] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${api}/api/mission-plan`);
      const data = await res.json();
      setPlan(data.id ? data : DEFAULT_PLAN);
    } catch { setPlan(DEFAULT_PLAN); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  // Auto-save with debounce
  const savePlan = useCallback(async (updated) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`${api}/api/mission-plan`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
      } catch {}
      setSaving(false);
    }, 800);
    setSaveTimeout(t);
  }, [api, saveTimeout]);

  const update = (updater) => {
    setPlan(prev => {
      const next = updater(prev);
      savePlan(next);
      return next;
    });
  };

  // AI suggest handler
  const handleAISuggest = async (type, id) => {
    try {
      const res = await fetch(`${api}/api/mission-plan/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, plan }),
      });
      const data = await res.json();
      return data.suggestions || [];
    } catch { return []; }
  };

  if (!plan) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <span className="spinner" style={{ width: 20, height: 20 }} />
    </div>
  );

  // Section update helpers
  const updateGoal = (goalId, changes) => update(p => ({ ...p, goals: p.goals.map(g => g.id === goalId ? { ...g, ...changes } : g) }));
  const addGoal = () => update(p => ({ ...p, goals: [...p.goals, { id: "g" + Date.now(), title: "New Goal", description: "", status: "not_started", notes: "", actions: [] }] }));
  const removeGoal = (id) => update(p => ({ ...p, goals: p.goals.filter(g => g.id !== id) }));

  const updateObjective = (id, changes) => update(p => ({ ...p, objectives: p.objectives.map(o => o.id === id ? { ...o, ...changes } : o) }));
  const addObjective = () => update(p => ({ ...p, objectives: [...p.objectives, { id: "o" + Date.now(), title: "New Objective", description: "", status: "not_started", notes: "" }] }));
  const removeObjective = (id) => update(p => ({ ...p, objectives: p.objectives.filter(o => o.id !== id) }));

  const updateOrg = (id, changes) => update(p => ({ ...p, orgs: p.orgs.map(o => o.id === id ? { ...o, ...changes } : o) }));
  const addOrg = () => update(p => ({ ...p, orgs: [...p.orgs, { id: "org" + Date.now(), name: "New Organization", color: "#888", status: "not_started", objective: "", actions: [] }] }));
  const removeOrg = (id) => update(p => ({ ...p, orgs: p.orgs.filter(o => o.id !== id) }));

  const updatePerson = (id, changes) => update(p => ({ ...p, people: p.people.map(x => x.id === id ? { ...x, ...changes } : x) }));
  const addPerson = () => update(p => ({ ...p, people: [...p.people, { id: "p" + Date.now(), name: "New Person", status: "not_started", org: "", notes: "" }] }));
  const removePerson = (id) => update(p => ({ ...p, people: p.people.filter(x => x.id !== id) }));

  // Progress summary
  const allItems = [
    ...plan.goals, ...plan.objectives,
    ...(plan.orgs.flatMap(o => o.actions || [])),
  ];
  const counts = { not_started: 0, on_track: 0, complete: 0 };
  allItems.forEach(i => { counts[i.status || "not_started"]++; });
  const total = allItems.length || 1;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {toast && <div className="toast">{toast}</div>}

      {/* Left sidebar */}
      <div className="scroll" style={{
        width: 240, borderRight: "1px solid var(--border)",
        padding: 16, flexShrink: 0, background: "var(--surface)",
      }}>
        {/* Plan header */}
        <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--gold)", marginBottom: 4 }}>
            Ward Mission Plan
          </div>
          <EditableText value={String(plan.year || 2026)}
            onChange={v => update(p => ({ ...p, year: v }))}
            style={{ fontSize: 11, color: "var(--text-muted)" }} />
          {saving && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>Saving...</div>}
        </div>

        {/* Progress summary */}
        <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
          <div className="label" style={{ marginBottom: 8 }}>Overall Progress</div>
          <div style={{ height: 6, background: "var(--surface3)", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
            <div style={{
              height: "100%", borderRadius: 3,
              background: `linear-gradient(90deg, #A05A5A ${counts.not_started / total * 100}%, #C9A84C ${counts.not_started / total * 100}% ${(counts.not_started + counts.on_track) / total * 100}%, #5A8A6E ${(counts.not_started + counts.on_track) / total * 100}%)`,
              width: "100%",
            }} />
          </div>
          {[
            { key: "complete", label: "Complete", color: "#5A8A6E" },
            { key: "on_track", label: "On Track", color: "#C9A84C" },
            { key: "not_started", label: "Not Started",   color: "#A05A5A" },
          ].map(s => (
            <div key={s.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", marginBottom: 3 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                {s.label}
              </span>
              <span style={{ color: s.color }}>{counts[s.key]}</span>
            </div>
          ))}
        </div>

        {/* Section nav */}
        <div className="label" style={{ marginBottom: 8 }}>Sections</div>
        {SECTIONS.map(s => (
          <button key={s.id} className="nav-btn" style={{
            width: "100%", justifyContent: "flex-start", padding: "8px 12px",
            background: activeSection === s.id ? "var(--surface3)" : "transparent",
            color: activeSection === s.id ? "var(--gold)" : "var(--text-muted)",
            borderRadius: "var(--radius)", marginBottom: 2, fontSize: 11,
          }} onClick={() => setActiveSection(s.id)}>
            {s.label}
          </button>
        ))}

        {/* Primary goal */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <div className="label" style={{ marginBottom: 6 }}>Primary Goal</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
            <EditableText value={plan.primaryGoal || ""} onChange={v => update(p => ({ ...p, primaryGoal: v }))}
              placeholder="Primary goal..." multiline />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="scroll" style={{ flex: 1, padding: 24 }}>
        {activeSection === "goals" && (
          <KeyGoalsSection goals={plan.goals || []}
            onUpdate={updateGoal} onAdd={addGoal} onRemove={removeGoal}
            onAISuggest={handleAISuggest} />
        )}
        {activeSection === "objectives" && (
          <ObjectivesSection objectives={plan.objectives || []}
            onUpdate={updateObjective} onAdd={addObjective} onRemove={removeObjective} />
        )}
        {activeSection === "orgs" && (
          <OrgPlansSection orgs={plan.orgs || []}
            onUpdate={updateOrg} onAddOrg={addOrg} onRemoveOrg={removeOrg}
            onAISuggest={handleAISuggest} />
        )}
        {activeSection === "people" && (
          <PeopleSection people={plan.people || []}
            orgs={plan.orgs || []}
            onUpdate={updatePerson} onAdd={addPerson} onRemove={removePerson} />
        )}
      </div>
    </div>
  );
}
