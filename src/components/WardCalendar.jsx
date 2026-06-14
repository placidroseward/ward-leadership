import { useState, useEffect, useCallback, useRef } from "react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const EVENT_COLORS = [
  "#C9A84C", "#5B7FA6", "#7C9E87", "#A07CB5",
  "#C97B5A", "#6B9E9E", "#9E7B6B", "#A05A5A",
];

// Convert whatever date format Google Calendar or our DB returns into
// a datetime-local string (YYYY-MM-DDTHH:MM)
function toLocalInput(val) {
  if (!val) return "";
  // Google Calendar returns { dateTime: "..." } or { date: "..." }
  const raw = typeof val === "object" ? (val.dateTime || val.date || "") : val;
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  // Format as YYYY-MM-DDTHH:MM in local time
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Get a plain JS Date from an event's start field (handles Google or local format)
function eventStartDate(ev) {
  if (!ev?.start) return null;
  const raw = typeof ev.start === "object" ? (ev.start.dateTime || ev.start.date || "") : ev.start;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function EventModal({ event, onSave, onDelete, onClose }) {
  const isNew = !event.id;
  const [form, setForm] = useState({
    title: event.title || event.summary || "",
    start: toLocalInput(event.start),
    end: toLocalInput(event.end),
    location: event.location || "",
    description: event.description || "",
    color: event.color || EVENT_COLORS[0],
  });
  const [saving, setSaving] = useState(false);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title || !form.start) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200,
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
            {isNew ? "New Event" : "Edit Event"}
          </span>
          <button className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          <div className="field">
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={e => f("title", e.target.value)} placeholder="Event title" autoFocus />
          </div>
          <div className="two-col" style={{ marginBottom: 16 }}>
            <div>
              <label className="label">Start *</label>
              <input className="input" type="datetime-local" value={form.start} onChange={e => f("start", e.target.value)} />
            </div>
            <div>
              <label className="label">End</label>
              <input className="input" type="datetime-local" value={form.end} onChange={e => f("end", e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="label">Location</label>
            <input className="input" value={form.location} onChange={e => f("location", e.target.value)} placeholder="Optional location" />
          </div>
          <div className="field">
            <label className="label">Description</label>
            <textarea className="input" value={form.description} onChange={e => f("description", e.target.value)} placeholder="Optional description" />
          </div>
          <div className="field">
            <label className="label">Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {EVENT_COLORS.map(c => (
                <button key={c} onClick={() => f("color", c)} style={{
                  width: 24, height: 24, borderRadius: "50%", background: c,
                  border: form.color === c ? "3px solid var(--text)" : "2px solid transparent",
                  cursor: "pointer", transition: "border 0.15s",
                }} />
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 8 }}>
            {!isNew ? (
              <button className="btn btn-ghost" style={{ color: "var(--danger)", fontSize: 11 }}
                onClick={() => onDelete(event.id)}>
                Delete Event
              </button>
            ) : <div />}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-gold" onClick={handleSave} disabled={saving || !form.title || !form.start}>
                {saving ? <><span className="spinner" /> Saving...</> : (isNew ? "Create Event" : "Save Changes")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarDay({ day, events, isToday, isCurrentMonth, onDayClick, onEventClick, onEventDrop }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const eventId = e.dataTransfer.getData("eventId");
    if (eventId) onEventDrop(eventId, day);
  };

  return (
    <div
      onClick={() => onDayClick(day)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        minHeight: 90, padding: "6px 8px",
        background: dragOver
          ? "var(--gold-glow)"
          : isToday ? "var(--gold-glow)" : isCurrentMonth ? "var(--surface2)" : "var(--surface)",
        border: `1px solid ${dragOver ? "var(--gold)" : isToday ? "var(--gold-dim)" : "var(--border)"}`,
        cursor: "pointer", transition: "background 0.1s, border 0.1s",
        overflow: "hidden",
      }}
    >
      <div style={{
        fontSize: 12, fontWeight: isToday ? 600 : 400,
        color: isToday ? "var(--gold)" : isCurrentMonth ? "var(--text)" : "var(--text-muted)",
        marginBottom: 4,
      }}>{day.getDate()}</div>
      {events.slice(0, 3).map(ev => (
        <div
          key={ev.id}
          draggable
          onDragStart={e => {
            e.stopPropagation();
            e.dataTransfer.setData("eventId", ev.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={e => { e.stopPropagation(); onEventClick(ev); }}
          style={{
            fontSize: 10, padding: "2px 5px", borderRadius: 2,
            background: (ev.color || EVENT_COLORS[0]) + "30",
            color: ev.color || EVENT_COLORS[0],
            border: `1px solid ${(ev.color || EVENT_COLORS[0]) + "60"}`,
            marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            cursor: "grab",
          }}
        >
          {ev.title || ev.summary}
        </div>
      ))}
      {events.length > 3 && (
        <div style={{ fontSize: 9, color: "var(--text-muted)" }}>+{events.length - 3} more</div>
      )}
    </div>
  );
}

export default function WardCalendar({ api }) {
  const [events, setEvents] = useState([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [modalEvent, setModalEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${api}/api/calendar/events`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : (data.events || []));
    } catch (e) { setEvents([]); }
    setLoading(false);
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const saveEvent = async (form) => {
    try {
      const method = modalEvent?.id ? "PUT" : "POST";
      const url = modalEvent?.id ? `${api}/api/calendar/events/${modalEvent.id}` : `${api}/api/calendar/events`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast(modalEvent?.id ? "Event updated" : "Event created");
      setModalEvent(null);
      load();
    } catch (e) { showToast("Error: " + e.message); }
  };

  const deleteEvent = async (id) => {
    try {
      await fetch(`${api}/api/calendar/events/${id}`, { method: "DELETE" });
      showToast("Event deleted");
      setModalEvent(null);
      load();
    } catch (e) { showToast("Error deleting event"); }
  };

  // Drag-and-drop: move event to a new day, preserving the time
  const handleEventDrop = async (eventId, newDay) => {
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;
    const oldStart = eventStartDate(ev);
    if (!oldStart) return;

    // Compute duration so end moves with start
    const oldEnd = eventStartDate({ start: ev.end });
    const durationMs = oldEnd ? (oldEnd - oldStart) : 3600000;

    const newStart = new Date(newDay);
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);

    const pad = n => String(n).padStart(2, "0");
    const toInput = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    const form = {
      title: ev.title || ev.summary || "",
      start: toInput(newStart),
      end: toInput(newEnd),
      location: ev.location || "",
      description: ev.description || "",
      color: ev.color || EVENT_COLORS[0],
    };

    try {
      const res = await fetch(`${api}/api/calendar/events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Event moved");
      load();
    } catch (e) { showToast("Error moving event: " + e.message); }
  };

  // Build calendar grid
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const days = [];

  for (let i = startPad - 1; i >= 0; i--) days.push(new Date(year, month, -i));
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  const endPad = 42 - days.length;
  for (let i = 1; i <= endPad; i++) days.push(new Date(year, month + 1, i));

  const today = new Date();

  const getEventsForDay = (day) => {
    return events.filter(ev => {
      const d = eventStartDate(ev);
      return d && d.getFullYear() === day.getFullYear()
               && d.getMonth() === day.getMonth()
               && d.getDate() === day.getDate();
    });
  };

  const handleDayClick = (day) => {
    const pad = n => String(n).padStart(2, "0");
    const dateStr = `${day.getFullYear()}-${pad(day.getMonth()+1)}-${pad(day.getDate())}T09:00`;
    setModalEvent({ start: dateStr, end: "", title: "", location: "", description: "", color: EVENT_COLORS[0] });
  };

  const handleEventClick = (ev) => {
    // Normalize to a flat object with datetime-local-friendly strings
    setModalEvent({
      id: ev.id,
      title: ev.title || ev.summary || "",
      start: toLocalInput(ev.start),
      end: toLocalInput(ev.end),
      location: ev.location || "",
      description: ev.description || "",
      color: ev.color || EVENT_COLORS[0],
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {toast && <div className="toast">{toast}</div>}
      {modalEvent !== null && (
        <EventModal
          event={modalEvent}
          onSave={saveEvent}
          onDelete={deleteEvent}
          onClose={() => setModalEvent(null)}
        />
      )}

      {/* Calendar header */}
      <div style={{
        padding: "12px 24px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--surface)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => setViewDate(new Date(year, month - 1, 1))}>‹</button>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)", minWidth: 200, textAlign: "center" }}>
            {MONTHS[month]} {year}
          </span>
          <button className="btn btn-ghost" onClick={() => setViewDate(new Date(year, month + 1, 1))}>›</button>
          <button className="btn btn-outline" style={{ fontSize: 10 }} onClick={() => setViewDate(new Date())}>Today</button>
        </div>
        <button className="btn btn-gold" onClick={() => setModalEvent({ start: "", end: "", title: "", location: "", description: "", color: EVENT_COLORS[0] })}>
          + New Event
        </button>
      </div>

      {/* Day headers */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        {DAYS.map(d => (
          <div key={d} style={{
            padding: "8px", textAlign: "center",
            fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em",
            textTransform: "uppercase", fontFamily: "var(--font-mono)",
          }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="spinner" style={{ width: 20, height: 20 }} />
        </div>
      ) : (
        <div className="scroll" style={{ flex: 1, overflow: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {days.map((day, i) => (
              <CalendarDay
                key={i} day={day}
                events={getEventsForDay(day)}
                isToday={day.toDateString() === today.toDateString()}
                isCurrentMonth={day.getMonth() === month}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
                onEventDrop={handleEventDrop}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
