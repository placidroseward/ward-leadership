import { useState, useEffect, useRef } from "react";

const SHEETS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdl23Rb1bXooszhKH3On8dHLgfG4Oqpz5V0my6ip4NupYOZr_SuEo8kGXBY-waCDPhMiZE__jw-ZfU/pub?gid=201628214&single=true&output=csv";

const SHEETS_EDIT_URL =
  "https://docs.google.com/spreadsheets/d/1MhtUPBuSjRuQ6Y3qcEYqVsnGq5rSfR-coFsy5dGHzqs/edit";

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] || "").trim(); });
    row["__date"] = vals[0]?.trim() || "";
    return row;
  }).filter(r => r["__date"]);
}

function parseCSVLine(line) {
  const result = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(cur); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

function parseMeetingDate(str) {
  if (!str) return null;
  const parts = str.split("-");
  if (parts.length < 2) return null;
  const day = parseInt(parts[0], 10);
  const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  const month = months[parts[1]];
  if (isNaN(day) || month === undefined) return null;
  return new Date(new Date().getFullYear(), month, day);
}

function formatDate(str) {
  const d = parseMeetingDate(str);
  if (!d) return str;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function findUpcomingSunday(rows) {
  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = rows
    .map(r => ({ row: r, date: parseMeetingDate(r["__date"]) }))
    .filter(x => x.date && x.date >= today)
    .sort((a, b) => a.date - b.date);
  return upcoming.length > 0 ? upcoming[0].row["__date"] : (rows[0]?.["__date"] || null);
}

function isFastSunday(row) {
  return (row["Topic"] || "").toLowerCase().includes("fast sunday") ||
         (row["Speaker1"] || "").toUpperCase() === "N/A";
}

function isStakeConference(row) {
  return (row["Topic"] || "").toLowerCase().includes("stake conference");
}

function hymnDisplay(val) {
  if (!val || val.toUpperCase() === "N/A" || val.trim() === "") return null;
  return val.trim();
}

function parseNameTopic(val) {
  if (!val || val.trim() === "" || val.toUpperCase() === "N/A") return null;
  const m = val.match(/^([^:\-–]+)[\-–:]\s*(.+)$/);
  if (m) return { name: m[1].trim(), topic: m[2].trim() };
  return { name: val.trim(), topic: null };
}

// Convert "4-Jan" date string to YYYY-MM-DD for server key
function toSundayKey(dateStr) {
  const d = parseMeetingDate(dateStr);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

// Merge localStorage edits with server edits — server values take precedence
// for fields that are non-empty on the server side.
function mergeEdits(local, server) {
  if (!server) return local;
  return {
    announcements: server.announcements?.length ? server.announcements : (local.announcements || []),
    newMembers:    server.newMembers?.length    ? server.newMembers    : (local.newMembers || []),
    releasings:    server.releasings?.length    ? server.releasings    : (local.releasings || []),
    sustainings:   server.sustainings?.length   ? server.sustainings   : (local.sustainings || []),
    otherBusiness: server.otherBusiness         ? server.otherBusiness : (local.otherBusiness || ""),
    conducting:    server.conducting            ? server.conducting    : (local.conducting || ""),
    _fromServer: true,
    _lastUpdatedBy: server.lastUpdatedBy || null,
    _lastUpdated: server.lastUpdated || null,
  };
}
  try {
    const raw = localStorage.getItem(`sp_edits_${dateKey}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveEdits(dateKey, edits) {
  try { localStorage.setItem(`sp_edits_${dateKey}`, JSON.stringify(edits)); } catch {}
}

// ─── Section divider ─────────────────────────────────────────────────────────
function Divider() {
  return <div style={{ borderTop: "1px solid var(--border)", margin: "14px 0" }} />;
}

// ─── Section heading ─────────────────────────────────────────────────────────
function SectionHeading({ children }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 600, letterSpacing: "0.2em",
      textTransform: "uppercase", color: "var(--gold-dim)",
      borderBottom: "1px solid var(--border)", paddingBottom: 4, marginBottom: 10,
    }}>{children}</div>
  );
}

// ─── Read-only program line ───────────────────────────────────────────────────
function ProgramLine({ label, value, hymn, indent }) {
  if (!value) return null;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      marginBottom: 5, gap: 8, paddingLeft: indent ? 12 : 0,
    }}>
      {label && <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>}
      <span style={{ fontSize: 12, color: "var(--text)", textAlign: label ? "right" : "left", fontStyle: hymn ? "italic" : "normal", flex: 1 }}>{value}</span>
    </div>
  );
}

// ─── Editable text field inline ───────────────────────────────────────────────
function EditableLine({ label, placeholder, value, onChange, onRemove, indent }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, paddingLeft: indent ? 12 : 0 }}>
      {label && <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0, minWidth: 90 }}>{label}</span>}
      <input
        className="input"
        style={{ fontSize: 11, padding: "3px 8px", flex: 1 }}
        placeholder={placeholder || ""}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {onRemove && (
        <button onClick={onRemove} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--danger)", fontSize: 12, padding: "0 2px", flexShrink: 0,
        }}>✕</button>
      )}
    </div>
  );
}

// ─── Add item button ─────────────────────────────────────────────────────────
function AddButton({ label, onClick }) {
  return (
    <button className="btn btn-ghost" style={{ fontSize: 9, padding: "2px 8px", marginTop: 2, color: "var(--text-muted)" }}
      onClick={onClick}>
      + {label}
    </button>
  );
}

// ─── Italic notice line ───────────────────────────────────────────────────────
function Notice({ children }) {
  return (
    <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--text-muted)", marginBottom: 5, paddingLeft: 4 }}>
      {children}
    </div>
  );
}

// ─── Print CSS ────────────────────────────────────────────────────────────────
const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'EB Garamond', Georgia, serif; font-size: 14pt; color: #1a1814; background: white; width: 7.5in; margin: 0 auto; padding: 0.5in; }
  .prog-header { text-align: center; margin-bottom: 0.3in; border-bottom: 1.5pt solid #8B6914; padding-bottom: 0.18in; }
  .prog-ward { font-family: 'Cormorant Garamond', serif; font-size: 28pt; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #1a1814; }
  .prog-subtitle { font-size: 13pt; letter-spacing: 0.18em; text-transform: uppercase; color: #6B6760; margin-top: 2pt; }
  .prog-date { font-family: 'Cormorant Garamond', serif; font-size: 20pt; font-weight: 400; font-style: italic; color: #8B6914; margin-top: 6pt; }
  .prog-time { font-size: 12pt; color: #6B6760; letter-spacing: 0.1em; margin-top: 2pt; }
  hr { border: none; border-top: 0.5pt solid #D4CFC6; margin: 12pt 0; }
  .section-title { font-family: 'Cormorant Garamond', serif; font-size: 11pt; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #8B6914; margin-bottom: 6pt; }
  .line { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4pt; gap: 8pt; }
  .line-label { color: #6B6760; font-size: 12pt; flex-shrink: 0; }
  .line-value { text-align: right; flex: 1; font-size: 14pt; }
  .line-value.hymn { font-style: italic; }
  .line-only { font-size: 14pt; margin-bottom: 4pt; }
  .line-indent { padding-left: 14pt; }
  .notice { font-style: italic; color: #6B6760; font-size: 13pt; margin-bottom: 4pt; padding-left: 4pt; }
  .new-member-intro { font-size: 13pt; font-style: italic; color: #4a4540; margin-bottom: 6pt; line-height: 1.5; }
  .new-member-outro { font-size: 13pt; font-style: italic; color: #4a4540; margin-top: 6pt; line-height: 1.5; }
  .speaker-block { margin-bottom: 8pt; }
  .speaker-name { font-size: 14pt; font-weight: 500; }
  .speaker-topic { font-size: 12pt; font-style: italic; color: #4a4540; margin-top: 2pt; }
  .fast-notice { text-align: center; font-family: 'Cormorant Garamond', serif; font-size: 18pt; font-style: italic; color: #8B6914; padding: 0.2in 0; }
  .prog-footer { margin-top: 0.25in; border-top: 1pt solid #D4CFC6; padding-top: 0.12in; text-align: center; font-size: 11pt; color: #9A9590; letter-spacing: 0.08em; }
  @media print { @page { margin: 0.5in; } body { padding: 0; } }
`;

function buildPrintHTML(row, edits) {
  const date = formatDate(row["__date"]);
  const fast = isFastSunday(row);
  const conducting = row["Conducting"] || "";
  const presiding = row["Presiding"] || "";
  const organ = row["Organ"] || "";
  const conductingMusic = row["Conducting Music"] || "";
  const openingHymn = hymnDisplay(row["Opening Hymn"]);
  const openingPrayer = row["Opening Prayer"] || "";
  const sacramentHymn = hymnDisplay(row["Sacrament Hymn"]);
  const closingHymn = hymnDisplay(row["Closing Hymn "]) || hymnDisplay(row["Closing Hymn"]);
  const benediction = row["Benediction"] || "";
  const specialHymn = hymnDisplay(row["Special #/Rest Hymn"]);
  const speakers = [
    parseNameTopic(row["Speaker1"]),
    parseNameTopic(row["Speaker2"]),
    parseNameTopic(row["Special #/Rest Hymn"] && !fast ? null : null), // placeholder
    parseNameTopic(row["Speaker 3"]),
    parseNameTopic(row["Speaker 4"]),
  ].filter(Boolean);
  // Rebuild speakers in order with special hymn interleaved
  const sp1 = parseNameTopic(row["Speaker1"]);
  const sp2 = parseNameTopic(row["Speaker2"]);
  const sp3 = parseNameTopic(row["Speaker 3"]);
  const sp4 = parseNameTopic(row["Speaker 4"]);

  const announcements = (edits.announcements || []).filter(a => a.trim());
  const newMembers = (edits.newMembers || []).filter(a => a.trim());
  const releasings = (edits.releasings || []).filter(a => a.trim());
  const sustainings = (edits.sustainings || []).filter(a => a.trim());
  const otherBusiness = (edits.otherBusiness || "").trim();
  const hasWardBusiness = newMembers.length || releasings.length || sustainings.length || otherBusiness;

  const line = (label, value, hymn, indent) =>
    value ? `<div class="line${indent ? " line-indent" : ""}"><span class="line-label">${label}</span><span class="line-value${hymn ? " hymn" : ""}">${value}</span></div>` : "";
  const lineOnly = (value, indent) =>
    value ? `<div class="line-only${indent ? " line-indent" : ""}">${value}</div>` : "";
  const notice = (value) =>
    value ? `<div class="notice">${value}</div>` : "";
  const hr = () => `<hr/>`;
  const sectionTitle = (t) => `<div class="section-title">${t}</div>`;

  let body = "";

  // Presiding & Conducting
  body += sectionTitle("Presiding &amp; Conducting");
  body += line("Presiding", presiding);
  body += line("Conducting", conducting);
  body += hr();

  // Music
  body += sectionTitle("Music");
  body += line("Organist", organ);
  body += line("Choir Director", conductingMusic);
  body += hr();

  // Announcements
  if (announcements.length) {
    body += sectionTitle("Announcements");
    announcements.forEach(a => { body += lineOnly(a); });
    body += hr();
  }

  // Opening Hymn & Prayer
  body += sectionTitle("Opening");
  body += line("Opening Hymn", openingHymn, true);
  body += line("Opening Prayer", openingPrayer);
  body += hr();

  // Ward Business
  if (hasWardBusiness) {
    body += sectionTitle("Ward Business");
    if (newMembers.length) {
      body += `<div class="new-member-intro">We have received the records of the following new members in the ward and would invite them to stand and be recognized...</div>`;
      newMembers.forEach(m => { body += line("New Member", m); });
      body += `<div class="new-member-outro">All those who can join with me in welcoming these new members into our ward, please do so by the uplifted hand.</div>`;
    }
    releasings.forEach(r => { body += line("Released", r); });
    sustainings.forEach(s => { body += line("Sustained", s); });
    if (otherBusiness) body += lineOnly(otherBusiness);
    body += hr();
  }

  // Sacrament
  body += sectionTitle("Sacrament");
  body += line("Sacrament Hymn", sacramentHymn, true);
  body += notice("Sacrament to be administered to the congregation by the Aaronic Priesthood");
  body += notice("Please reverence the sacrament and put away all distractions");
  body += hr();

  // Program
  if (fast) {
    body += `<div class="fast-notice">Fast &amp; Testimony Meeting<br/>Sharing of Testimonies</div>`;
  } else {
    body += sectionTitle("Program");
    if (sp1) {
      body += `<div class="speaker-block"><div class="speaker-name">${sp1.name}</div>${sp1.topic ? `<div class="speaker-topic">${sp1.topic}</div>` : ""}</div>`;
    }
    if (sp2) {
      body += `<div class="speaker-block"><div class="speaker-name">${sp2.name}</div>${sp2.topic ? `<div class="speaker-topic">${sp2.topic}</div>` : ""}</div>`;
    }
    if (specialHymn) {
      body += `<div class="speaker-block"><div class="speaker-name" style="font-style:italic">${specialHymn}</div><div class="speaker-topic">Musical Number / Intermediate Hymn</div></div>`;
    }
    if (sp3) {
      body += `<div class="speaker-block"><div class="speaker-name">${sp3.name}</div>${sp3.topic ? `<div class="speaker-topic">${sp3.topic}</div>` : ""}</div>`;
    }
    if (sp4) {
      body += `<div class="speaker-block"><div class="speaker-name">${sp4.name}</div>${sp4.topic ? `<div class="speaker-topic">${sp4.topic}</div>` : ""}</div>`;
    }
  }
  body += hr();

  // Closing
  body += sectionTitle("Closing");
  body += line("Closing Hymn", closingHymn, true);
  body += line("Closing Prayer", benediction);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Sacrament Meeting Program — ${date}</title>
<style>${PRINT_CSS}</style>
</head><body>
<div class="prog-header">
  <div class="prog-ward">Placid Rose Ward</div>
  <div class="prog-subtitle">Sacrament Meeting</div>
  <div class="prog-date">${date}</div>
  <div class="prog-time">9:00 AM</div>
</div>
${body}
<div class="prog-footer">The Church of Jesus Christ of Latter-day Saints &nbsp;·&nbsp; Placid Rose Ward &nbsp;·&nbsp; Herriman Utah South Stake</div>
</body></html>`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SacramentProgram({ api }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [edits, setEdits] = useState({});
  const [serverEdits, setServerEdits] = useState(null);

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(SHEETS_CSV_URL + "&cachebust=" + Date.now());
      if (!res.ok) throw new Error("Failed to fetch spreadsheet");
      const text = await res.text();
      const parsed = parseCSV(text);
      setRows(parsed);
      setLastFetched(new Date());
      if (!selectedDate) setSelectedDate(findUpcomingSunday(parsed));
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Load localStorage + server edits when date changes
  useEffect(() => {
    if (!selectedDate) return;
    const local = loadEdits(selectedDate);
    setEdits(local);
    const sundayKey = toSundayKey(selectedDate);
    if (api && sundayKey) {
      fetch(`${api}/api/sacrament/edits/${sundayKey}`)
        .then(r => r.json())
        .then(data => {
          setServerEdits(data);
          if (data) setEdits(mergeEdits(local, data));
        })
        .catch(() => {});
    }
  }, [selectedDate, api]);

  const setEdit = (key, value) => {
    const next = { ...edits, [key]: value };
    setEdits(next);
    saveEdits(selectedDate, next);
    // Also persist to server
    const sundayKey = toSundayKey(selectedDate);
    if (api && sundayKey) {
      fetch(`${api}/api/sacrament/edits/${sundayKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
    }
  };

  const addListItem = (key) => {
    const next = [...(edits[key] || []), ""];
    setEdit(key, next);
  };

  const updateListItem = (key, idx, value) => {
    const next = [...(edits[key] || [])];
    next[idx] = value;
    setEdit(key, next);
  };

  const removeListItem = (key, idx) => {
    const next = (edits[key] || []).filter((_, i) => i !== idx);
    setEdit(key, next);
  };

  const selected = rows.find(r => r["__date"] === selectedDate);
  const fast = selected && isFastSunday(selected);
  const stake = selected && isStakeConference(selected);

  const handlePrint = () => {
    if (!selected) return;
    const html = buildPrintHTML(selected, edits);
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  const grouped = rows.reduce((acc, r) => {
    const d = parseMeetingDate(r["__date"]);
    if (!d) return acc;
    const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const sp1 = selected ? parseNameTopic(selected["Speaker1"]) : null;
  const sp2 = selected ? parseNameTopic(selected["Speaker2"]) : null;
  const sp3 = selected ? parseNameTopic(selected["Speaker 3"]) : null;
  const sp4 = selected ? parseNameTopic(selected["Speaker 4"]) : null;
  const specialHymn = selected ? hymnDisplay(selected["Special #/Rest Hymn"]) : null;
  const closingHymn = selected
    ? (hymnDisplay(selected["Closing Hymn "]) || hymnDisplay(selected["Closing Hymn"]))
    : null;

  const announcements = edits.announcements || [];
  const newMembers = edits.newMembers || [];
  const releasings = edits.releasings || [];
  const sustainings = edits.sustainings || [];
  const hasWardBusiness = newMembers.length || releasings.length || sustainings.length || (edits.otherBusiness || "").trim();

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* Left: date selector */}
      <div className="scroll" style={{ width: 200, borderRight: "1px solid var(--border)", padding: 12, flexShrink: 0, background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="label" style={{ margin: 0 }}>Sundays</div>
          <button className="btn btn-ghost" style={{ fontSize: 9, padding: "2px 6px" }} onClick={fetchData} title="Refresh">↺</button>
        </div>
        <a href={SHEETS_EDIT_URL} target="_blank" rel="noreferrer"
          style={{ display: "block", fontSize: 9, color: "var(--gold)", textDecoration: "none", marginBottom: 10, letterSpacing: "0.08em" }}>
          ↗ Edit Spreadsheet
        </a>
        {loading && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Loading...</div>}
        {error && <div style={{ fontSize: 11, color: "var(--danger)" }}>{error}</div>}
        {Object.entries(grouped).map(([month, monthRows]) => (
          <div key={month} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>{month}</div>
            {monthRows.map(r => {
              const isSelected = r["__date"] === selectedDate;
              const isFast = isFastSunday(r);
              const isStake = isStakeConference(r);
              return (
                <div key={r["__date"]} onClick={() => setSelectedDate(r["__date"])} style={{
                  padding: "6px 10px", borderRadius: "var(--radius)", cursor: "pointer", marginBottom: 2,
                  background: isSelected ? "var(--surface3)" : "transparent",
                  border: `1px solid ${isSelected ? "var(--gold-dim)" : "transparent"}`,
                  color: isSelected ? "var(--gold)" : "var(--text-dim)", fontSize: 12,
                }}>
                  {r["__date"]}
                  {isFast && <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 4 }}>F&T</span>}
                  {isStake && <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 4 }}>SC</span>}
                </div>
              );
            })}
          </div>
        ))}
        {lastFetched && <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 8 }}>Updated {lastFetched.toLocaleTimeString()}</div>}
      </div>

      {/* Right: program */}
      {!selected ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="empty-state">
            <span className="empty-state-icon">◎</span>
            <p className="empty-state-text">Select a Sunday to view the program</p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Toolbar */}
          <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", flexShrink: 0 }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)" }}>{formatDate(selected["__date"])}</div>
              {fast && <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 2 }}>Fast &amp; Testimony Meeting</div>}
              {stake && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Stake Conference</div>}
              {serverEdits && (
                <div style={{ fontSize: 10, color: "var(--gold-dim)", marginTop: 2 }}>
                  ◈ GroupMe edits applied{serverEdits.lastUpdatedBy ? ` · from ${serverEdits.lastUpdatedBy}` : ""}
                  {serverEdits.lastUpdated ? ` · ${new Date(serverEdits.lastUpdated).toLocaleString()}` : ""}
                </div>
              )}
            </div>
            <button className="btn btn-gold" onClick={handlePrint}>⎙ Print Program</button>
          </div>

          <div className="scroll" style={{ flex: 1, padding: 24 }}>
            {stake ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 8 }}>Stake Conference</div>
                <div style={{ fontSize: 12 }}>No sacrament meeting this week.</div>
              </div>
            ) : (
              <div style={{ maxWidth: 560, margin: "0 auto" }}>

                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid var(--border2)" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold)" }}>Placid Rose Ward</div>
                  <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 2 }}>Sacrament Meeting</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontStyle: "italic", color: "var(--text)", marginTop: 6 }}>{formatDate(selected["__date"])}</div>
                </div>

                {/* Presiding & Conducting */}
                <SectionHeading>Presiding &amp; Conducting</SectionHeading>
                <ProgramLine label="Presiding" value={selected["Presiding"]} />
                <ProgramLine label="Conducting" value={selected["Conducting"]} />
                <Divider />

                {/* Music */}
                <SectionHeading>Music</SectionHeading>
                <ProgramLine label="Organist" value={selected["Organ"]} />
                <ProgramLine label="Choir Director" value={selected["Conducting Music"]} />
                <Divider />

                {/* Announcements — editable */}
                <SectionHeading>Announcements</SectionHeading>
                {announcements.map((a, i) => (
                  <EditableLine key={i} placeholder="Announcement..." value={a}
                    onChange={v => updateListItem("announcements", i, v)}
                    onRemove={() => removeListItem("announcements", i)} />
                ))}
                <AddButton label="Add announcement" onClick={() => addListItem("announcements")} />
                <Divider />

                {/* Opening Hymn & Prayer */}
                <SectionHeading>Opening</SectionHeading>
                <ProgramLine label="Opening Hymn" value={hymnDisplay(selected["Opening Hymn"])} hymn />
                <ProgramLine label="Opening Prayer" value={selected["Opening Prayer"]} />
                <Divider />

                {/* Ward Business — editable */}
                <SectionHeading>Ward Business</SectionHeading>
                {newMembers.map((m, i) => (
                  <EditableLine key={i} label="New Member" placeholder="Name..." value={m}
                    onChange={v => updateListItem("newMembers", i, v)}
                    onRemove={() => removeListItem("newMembers", i)} indent />
                ))}
                <AddButton label="New member" onClick={() => addListItem("newMembers")} />
                {releasings.map((r, i) => (
                  <EditableLine key={i} label="Released" placeholder="Name & calling..." value={r}
                    onChange={v => updateListItem("releasings", i, v)}
                    onRemove={() => removeListItem("releasings", i)} indent />
                ))}
                <AddButton label="Releasing" onClick={() => addListItem("releasings")} />
                {sustainings.map((s, i) => (
                  <EditableLine key={i} label="Sustained" placeholder="Name & calling..." value={s}
                    onChange={v => updateListItem("sustainings", i, v)}
                    onRemove={() => removeListItem("sustainings", i)} indent />
                ))}
                <AddButton label="Sustaining" onClick={() => addListItem("sustainings")} />
                <div style={{ marginTop: 6 }}>
                  <EditableLine placeholder="Other business..." value={edits.otherBusiness || ""}
                    onChange={v => setEdit("otherBusiness", v)} />
                </div>
                <Divider />

                {/* Sacrament */}
                <SectionHeading>Sacrament</SectionHeading>
                <ProgramLine label="Sacrament Hymn" value={hymnDisplay(selected["Sacrament Hymn"])} hymn />
                <Notice>Sacrament to be administered to the congregation by the Aaronic Priesthood</Notice>
                <Notice>Invite congregation to reverence the sacrament and put away all distractions</Notice>
                <Divider />

                {/* Program */}
                <SectionHeading>Program</SectionHeading>
                {fast ? (
                  <div style={{ fontStyle: "italic", color: "var(--gold)", fontSize: 13, padding: "8px 0" }}>
                    Sharing of Testimonies
                  </div>
                ) : (
                  <>
                    {sp1 && <SpeakerBlock speaker={sp1} />}
                    {sp2 && <SpeakerBlock speaker={sp2} />}
                    {specialHymn && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--text)" }}>{specialHymn}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Musical Number / Intermediate Hymn</div>
                      </div>
                    )}
                    {sp3 && <SpeakerBlock speaker={sp3} />}
                    {sp4 && <SpeakerBlock speaker={sp4} />}
                    {!sp1 && !sp2 && !sp3 && !sp4 && !specialHymn && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>No speakers listed in spreadsheet</div>
                    )}
                  </>
                )}
                <Divider />

                {/* Closing */}
                <SectionHeading>Closing</SectionHeading>
                <ProgramLine label="Closing Hymn" value={closingHymn} hymn />
                <ProgramLine label="Closing Prayer" value={selected["Benediction"]} />

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SpeakerBlock({ speaker }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{speaker.name}</div>
      {speaker.topic && <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--text-dim)", marginTop: 1 }}>{speaker.topic}</div>}
    </div>
  );
}
