import { useState, useEffect, useRef } from "react";

const SHEETS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdl23Rb1bXooszhKH3On8dHLgfG4Oqpz5V0my6ip4NupYOZr_SuEo8kGXBY-waCDPhMiZE__jw-ZfU/pub?gid=201628214&single=true&output=csv";

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

function parseNameTopic(val) {
  if (!val || val.trim() === "" || val.toUpperCase() === "N/A") return null;
  const m = val.match(/^([^:\-–]+)[\-–:]\s*(.+)$/);
  if (m) return { name: m[1].trim(), topic: m[2].trim() };
  return { name: val.trim(), topic: null };
}

function hymnDisplay(val) {
  if (!val || val.toUpperCase() === "N/A" || val.trim() === "") return null;
  return val.trim();
}

// ─── Local storage helpers for editable fields ────────────────────────────────
function loadExtras(dateKey) {
  try {
    const raw = localStorage.getItem(`sp_extras_${dateKey}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveExtras(dateKey, data) {
  localStorage.setItem(`sp_extras_${dateKey}`, JSON.stringify(data));
}

const EMPTY_EXTRAS = {
  announcements: "",
  newMembers: [],       // array of strings
  releasings: [],
  sustainings: [],
  otherBusiness: "",
};

// ─── Print CSS ────────────────────────────────────────────────────────────────
const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'EB Garamond', Georgia, serif; font-size: 11pt; color: #1a1814; background: white; width: 7.5in; margin: 0 auto; padding: 0.5in; }
  .prog-header { text-align: center; margin-bottom: 0.3in; border-bottom: 1.5pt solid #8B6914; padding-bottom: 0.2in; }
  .prog-ward { font-family: 'Cormorant Garamond', serif; font-size: 22pt; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #1a1814; }
  .prog-subtitle { font-size: 10pt; letter-spacing: 0.18em; text-transform: uppercase; color: #6B6760; margin-top: 2pt; }
  .prog-date { font-family: 'Cormorant Garamond', serif; font-size: 16pt; font-weight: 400; font-style: italic; color: #8B6914; margin-top: 6pt; }
  .prog-time { font-size: 9.5pt; color: #6B6760; letter-spacing: 0.1em; margin-top: 2pt; }
  .divider { border: none; border-top: 0.5pt solid #D4CFC6; margin: 10pt 0; }
  .section { margin-bottom: 10pt; }
  .section-title { font-family: 'Cormorant Garamond', serif; font-size: 8pt; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #8B6914; margin-bottom: 4pt; }
  .line { display: flex; justify-content: space-between; align-items: baseline; font-size: 10.5pt; margin-bottom: 2pt; gap: 8pt; }
  .label { color: #6B6760; font-size: 9.5pt; flex-shrink: 0; }
  .value { text-align: right; flex: 1; }
  .value.hymn { font-style: italic; }
  .notice { text-align: center; font-family: 'Cormorant Garamond', serif; font-size: 13pt; font-style: italic; color: #8B6914; padding: 10pt 0; }
  .sacrament-note { font-size: 9pt; font-style: italic; color: #6B6760; margin-top: 3pt; }
  .prog-footer { margin-top: 0.25in; border-top: 1pt solid #D4CFC6; padding-top: 0.1in; text-align: center; font-size: 8.5pt; color: #9A9590; letter-spacing: 0.08em; }
  @media print { @page { margin: 0.5in; } body { padding: 0; } }
`;

function buildPrintHTML(row, extras) {
  const date = formatDate(row["__date"]);
  const fast = isFastSunday(row);
  const stake = isStakeConference(row);

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
    parseNameTopic(row["Speaker 3"]),
    parseNameTopic(row["Speaker 4"]),
  ].filter(Boolean);

  const ex = extras || EMPTY_EXTRAS;
  const hasWardBusiness = ex.newMembers?.length > 0 || ex.releasings?.length > 0 ||
    ex.sustainings?.length > 0 || ex.otherBusiness;

  const line = (label, value, hymn = false) =>
    value ? `<div class="line"><span class="label">${label}</span><span class="value${hymn ? " hymn" : ""}">${value}</span></div>` : "";

  const divider = `<hr class="divider">`;

  let body = "";

  if (stake) {
    body = `<div class="notice">Stake Conference — No Sacrament Meeting</div>`;
  } else {
    // Presiding & Conducting
    body += `<div class="section">${line("Conducting", conducting)}${line("Presiding", presiding)}</div>${divider}`;

    // Music
    body += `<div class="section">${line("Organist", organ)}${line("Choirmaster", conductingMusic)}</div>${divider}`;

    // Announcements
    if (ex.announcements) {
      body += `<div class="section"><div class="section-title">Announcements</div><div style="font-size:10pt">${ex.announcements}</div></div>${divider}`;
    }

    // Opening Hymn & Prayer
    body += `<div class="section">${line("Opening Hymn", openingHymn, true)}${line("Opening Prayer", openingPrayer)}</div>${divider}`;

    // Ward Business
    if (hasWardBusiness) {
      let biz = `<div class="section"><div class="section-title">Ward Business</div>`;
      if (ex.newMembers?.length > 0)
        ex.newMembers.forEach(m => { biz += line("New Member", m); });
      if (ex.releasings?.length > 0)
        ex.releasings.forEach(m => { biz += line("Released", m); });
      if (ex.sustainings?.length > 0)
        ex.sustainings.forEach(m => { biz += line("Sustained", m); });
      if (ex.otherBusiness)
        biz += `<div style="font-size:10pt;margin-top:3pt">${ex.otherBusiness}</div>`;
      biz += `</div>${divider}`;
      body += biz;
    }

    // Sacrament Hymn
    body += `<div class="section">${line("Sacrament Hymn", sacramentHymn, true)}
      <div class="sacrament-note">The sacrament will be administered to the congregation by the Aaronic Priesthood.</div>
      <div class="sacrament-note">We invite the congregation to reverently participate and put away all distractions.</div>
    </div>${divider}`;

    // Program
    if (fast) {
      body += `<div class="notice">Sharing of Testimonies</div>${divider}`;
    } else {
      let prog = `<div class="section">`;
      speakers.forEach((s, i) => {
        prog += `<div style="margin-bottom:6pt"><div class="line"><span class="label">Speaker</span><span class="value">${s.name}</span></div>`;
        if (s.topic) prog += `<div style="font-size:9pt;font-style:italic;color:#4a4540;text-align:right">${s.topic}</div>`;
        prog += `</div>`;
        // Insert special hymn between speaker 2 and 3 if present
        if (i === 1 && specialHymn) {
          prog += `<div class="line"><span class="label">Musical Number</span><span class="value hymn">${specialHymn}</span></div>`;
        }
      });
      if (speakers.length === 0 && specialHymn) {
        prog += `<div class="line"><span class="label">Musical Number</span><span class="value hymn">${specialHymn}</span></div>`;
      }
      prog += `</div>${divider}`;
      body += prog;
    }

    // Closing
    body += `<div class="section">${line("Closing Hymn", closingHymn, true)}${line("Closing Prayer", benediction)}</div>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Sacrament Program — ${date}</title>
<style>${PRINT_CSS}</style></head><body>
<div class="prog-header">
  <div class="prog-ward">Placid Rose Ward</div>
  <div class="prog-subtitle">Sacrament Meeting</div>
  <div class="prog-date">${date}</div>
  <div class="prog-time">9:00 AM</div>
</div>
${body}
<div class="prog-footer">The Church of Jesus Christ of Latter-day Saints &nbsp;·&nbsp; Placid Rose Ward &nbsp;·&nbsp; West Jordan Utah Stake</div>
</body></html>`;
}

// ─── Editable list field ──────────────────────────────────────────────────────
function EditableList({ label, items, onChange, placeholder }) {
  const add = () => onChange([...items, ""]);
  const update = (i, val) => { const n = [...items]; n[i] = val; onChange(n); };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span className="label" style={{ margin: 0 }}>{label}</span>
        <button className="btn btn-ghost" style={{ fontSize: 9, padding: "1px 6px" }} onClick={add}>+ Add</button>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
          <input className="input" style={{ fontSize: 11, padding: "4px 8px" }}
            value={item} placeholder={placeholder}
            onChange={e => update(i, e.target.value)} />
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 6px", color: "var(--danger)", flexShrink: 0 }}
            onClick={() => remove(i)}>✕</button>
        </div>
      ))}
      {items.length === 0 && (
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>None — won't appear in print</div>
      )}
    </div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider() {
  return <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "14px 0" }} />;
}

// ─── Program row ──────────────────────────────────────────────────────────────
function ProgramRow({ label, value, hymn, note }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 13, color: "var(--text)", textAlign: "right", fontStyle: hymn ? "italic" : "normal", fontFamily: hymn ? "var(--font-display)" : "inherit" }}>{value}</span>
      </div>
      {note && <div style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic", marginTop: 2 }}>{note}</div>}
    </div>
  );
}

function ProgramSection({ title, children }) {
  return (
    <div style={{ marginBottom: 2 }}>
      {title && (
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--gold-dim)", marginBottom: 8 }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SacramentProgram() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [extras, setExtras] = useState(EMPTY_EXTRAS);
  const [editMode, setEditMode] = useState(false);

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(SHEETS_CSV_URL + "&cachebust=" + Date.now());
      if (!res.ok) throw new Error("Failed to fetch spreadsheet");
      const text = await res.text();
      const parsed = parseCSV(text);
      setRows(parsed);
      setLastFetched(new Date());
      if (!selectedDate) {
        const next = findUpcomingSunday(parsed);
        setSelectedDate(next);
        if (next) setExtras({ ...EMPTY_EXTRAS, ...loadExtras(next) });
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSelectDate = (dateKey) => {
    setSelectedDate(dateKey);
    setExtras({ ...EMPTY_EXTRAS, ...loadExtras(dateKey) });
    setEditMode(false);
  };

  const updateExtras = (patch) => {
    const next = { ...extras, ...patch };
    setExtras(next);
    if (selectedDate) saveExtras(selectedDate, next);
  };

  const selected = rows.find(r => r["__date"] === selectedDate);
  const fast = selected && isFastSunday(selected);
  const stake = selected && isStakeConference(selected);

  const speakers = selected ? [
    parseNameTopic(selected["Speaker1"]),
    parseNameTopic(selected["Speaker2"]),
    parseNameTopic(selected["Speaker 3"]),
    parseNameTopic(selected["Speaker 4"]),
  ].filter(Boolean) : [];

  const specialHymn = selected ? hymnDisplay(selected["Special #/Rest Hymn"]) : null;
  const closingHymn = selected ? (hymnDisplay(selected["Closing Hymn "]) || hymnDisplay(selected["Closing Hymn"])) : null;

  const hasWardBusiness = extras.newMembers?.length > 0 || extras.releasings?.length > 0 ||
    extras.sustainings?.length > 0 || extras.otherBusiness;

  const handlePrint = () => {
    if (!selected) return;
    const html = buildPrintHTML(selected, extras);
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  // Group rows by month for selector
  const grouped = rows.reduce((acc, r) => {
    const d = parseMeetingDate(r["__date"]);
    if (!d) return acc;
    const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* Left: date selector */}
      <div className="scroll" style={{ width: 200, borderRight: "1px solid var(--border)", padding: 12, flexShrink: 0, background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="label" style={{ margin: 0 }}>Sundays</div>
          <button className="btn btn-ghost" style={{ fontSize: 9, padding: "2px 6px" }} onClick={fetchData} title="Refresh">↺</button>
        </div>
        {loading && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Loading...</div>}
        {error && <div style={{ fontSize: 11, color: "var(--danger)" }}>{error}</div>}
        {Object.entries(grouped).map(([month, monthRows]) => (
          <div key={month} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>{month}</div>
            {monthRows.map(r => {
              const isSelected = r["__date"] === selectedDate;
              return (
                <div key={r["__date"]} onClick={() => handleSelectDate(r["__date"])} style={{
                  padding: "6px 10px", borderRadius: "var(--radius)", cursor: "pointer", marginBottom: 2,
                  background: isSelected ? "var(--surface3)" : "transparent",
                  border: `1px solid ${isSelected ? "var(--gold-dim)" : "transparent"}`,
                  color: isSelected ? "var(--gold)" : "var(--text-dim)", fontSize: 12,
                }}>
                  {r["__date"]}
                  {isFastSunday(r) && <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 4 }}>F&T</span>}
                  {isStakeConference(r) && <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 4 }}>SC</span>}
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
              {fast && <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 2 }}>Fast & Testimony Meeting</div>}
              {stake && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Stake Conference</div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setEditMode(e => !e)}>
                {editMode ? "◎ View" : "✎ Edit"}
              </button>
              <button className="btn btn-gold" onClick={handlePrint}>⎙ Print Program</button>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* Program preview — always visible */}
            <div className="scroll" style={{ flex: 1, padding: "24px 32px" }}>
              {stake ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 8 }}>Stake Conference</div>
                  <div style={{ fontSize: 12 }}>No sacrament meeting this week.</div>
                </div>
              ) : (
                <div style={{ maxWidth: 520, margin: "0 auto" }}>

                  {/* Header */}
                  <div style={{ textAlign: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border2)" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold)" }}>Placid Rose Ward</div>
                    <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 2 }}>Sacrament Meeting</div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontStyle: "italic", color: "var(--text)", marginTop: 4 }}>{formatDate(selected["__date"])}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, letterSpacing: "0.1em" }}>9:00 AM</div>
                  </div>

                  {/* Presiding & Conducting */}
                  <ProgramSection title="Presiding & Conducting">
                    <ProgramRow label="Conducting" value={selected["Conducting"]} />
                    <ProgramRow label="Presiding" value={selected["Presiding"]} />
                  </ProgramSection>
                  <Divider />

                  {/* Music */}
                  <ProgramSection title="Music">
                    <ProgramRow label="Organist" value={selected["Organ"]} />
                    <ProgramRow label="Choirmaster" value={selected["Conducting Music"]} />
                  </ProgramSection>
                  <Divider />

                  {/* Announcements */}
                  {extras.announcements && (
                    <>
                      <ProgramSection title="Announcements">
                        <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.6 }}>{extras.announcements}</div>
                      </ProgramSection>
                      <Divider />
                    </>
                  )}

                  {/* Opening Hymn & Prayer */}
                  <ProgramSection>
                    <ProgramRow label="Opening Hymn" value={hymnDisplay(selected["Opening Hymn"])} hymn />
                    <ProgramRow label="Opening Prayer" value={selected["Opening Prayer"]} />
                  </ProgramSection>
                  <Divider />

                  {/* Ward Business */}
                  {hasWardBusiness && (
                    <>
                      <ProgramSection title="Ward Business">
                        {extras.newMembers?.map((m, i) => m && <ProgramRow key={i} label="New Member" value={m} />)}
                        {extras.releasings?.map((m, i) => m && <ProgramRow key={i} label="Released" value={m} />)}
                        {extras.sustainings?.map((m, i) => m && <ProgramRow key={i} label="Sustained" value={m} />)}
                        {extras.otherBusiness && <div style={{ fontSize: 12, color: "var(--text)", marginTop: 4 }}>{extras.otherBusiness}</div>}
                      </ProgramSection>
                      <Divider />
                    </>
                  )}

                  {/* Sacrament Hymn */}
                  <ProgramSection>
                    <ProgramRow label="Sacrament Hymn" value={hymnDisplay(selected["Sacrament Hymn"])} hymn />
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic", marginTop: 4, lineHeight: 1.5 }}>
                      The sacrament will be administered to the congregation by the Aaronic Priesthood.
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic", marginTop: 2, lineHeight: 1.5 }}>
                      We invite the congregation to reverently participate and put away all distractions.
                    </div>
                  </ProgramSection>
                  <Divider />

                  {/* Program */}
                  {fast ? (
                    <>
                      <ProgramSection>
                        <div style={{ textAlign: "center", fontFamily: "var(--font-display)", fontSize: 15, fontStyle: "italic", color: "var(--gold)", padding: "8px 0" }}>
                          Sharing of Testimonies
                        </div>
                      </ProgramSection>
                      <Divider />
                    </>
                  ) : (
                    <>
                      <ProgramSection title="Program">
                        {speakers.map((s, i) => (
                          <div key={i} style={{ marginBottom: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                              <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>Speaker</span>
                              <span style={{ fontSize: 13, color: "var(--text)", textAlign: "right" }}>{s.name}</span>
                            </div>
                            {s.topic && <div style={{ fontSize: 10, fontStyle: "italic", color: "var(--text-dim)", textAlign: "right" }}>{s.topic}</div>}
                            {i === 1 && specialHymn && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                  <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>Musical Number</span>
                                  <span style={{ fontSize: 13, fontStyle: "italic", fontFamily: "var(--font-display)", color: "var(--text)", textAlign: "right" }}>{specialHymn}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {speakers.length === 0 && specialHymn && (
                          <ProgramRow label="Musical Number" value={specialHymn} hymn />
                        )}
                      </ProgramSection>
                      <Divider />
                    </>
                  )}

                  {/* Closing */}
                  <ProgramSection>
                    <ProgramRow label="Closing Hymn" value={closingHymn} hymn />
                    <ProgramRow label="Closing Prayer" value={selected["Benediction"]} />
                  </ProgramSection>

                </div>
              )}
            </div>

            {/* Edit panel — slides in when editMode */}
            {editMode && (
              <div className="scroll" style={{ width: 300, borderLeft: "1px solid var(--border)", padding: 20, flexShrink: 0, background: "var(--surface2)" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--text)", marginBottom: 16 }}>Edit Program Details</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
                  These fields are saved locally per Sunday. Only filled sections appear in print.
                </div>

                <div className="field">
                  <label className="label">Announcements</label>
                  <textarea className="input" style={{ minHeight: 60, fontSize: 11 }}
                    placeholder="Any announcements to include..."
                    value={extras.announcements}
                    onChange={e => updateExtras({ announcements: e.target.value })} />
                </div>

                <Divider />

                <EditableList
                  label="New Members"
                  items={extras.newMembers || []}
                  onChange={v => updateExtras({ newMembers: v })}
                  placeholder="Name"
                />
                <EditableList
                  label="Releasings"
                  items={extras.releasings || []}
                  onChange={v => updateExtras({ releasings: v })}
                  placeholder="Name — Calling"
                />
                <EditableList
                  label="Sustainings"
                  items={extras.sustainings || []}
                  onChange={v => updateExtras({ sustainings: v })}
                  placeholder="Name — Calling"
                />

                <div className="field">
                  <label className="label">Other Business</label>
                  <textarea className="input" style={{ minHeight: 50, fontSize: 11 }}
                    placeholder="Any other ward business..."
                    value={extras.otherBusiness}
                    onChange={e => updateExtras({ otherBusiness: e.target.value })} />
                </div>

                <Divider />

                <button className="btn btn-ghost" style={{ fontSize: 10, color: "var(--danger)", width: "100%" }}
                  onClick={() => { updateExtras({ ...EMPTY_EXTRAS }); }}>
                  ✕ Clear all edits for this Sunday
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
