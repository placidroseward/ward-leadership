import { useState, useEffect, useRef } from "react";

const SHEETS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdl23Rb1bXooszhKH3On8dHLgfG4Oqpz5V0my6ip4NupYOZr_SuEo8kGXBY-waCDPhMiZE__jw-ZfU/pub?gid=201628214&single=true&output=csv";

// ─── CSV Parser ──────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] || "").trim(); });
    // The date is the first column (no header on it in some exports); capture it
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

// Parse "4-Jan" style dates into something sortable
function parseMeetingDate(str) {
  if (!str) return null;
  const parts = str.split("-");
  if (parts.length < 2) return null;
  const day = parseInt(parts[0], 10);
  const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  const month = months[parts[1]];
  if (isNaN(day) || month === undefined) return null;
  const year = new Date().getFullYear();
  return new Date(year, month, day);
}

function formatDate(str) {
  const d = parseMeetingDate(str);
  if (!d) return str;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// Find the next upcoming Sunday from today
function findUpcomingSunday(rows) {
  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = rows
    .map(r => ({ row: r, date: parseMeetingDate(r["__date"]) }))
    .filter(x => x.date && x.date >= today)
    .sort((a, b) => a.date - b.date);
  return upcoming.length > 0 ? upcoming[0].row["__date"] : (rows[0]?.["__date"] || null);
}

// ─── Program Row helpers ─────────────────────────────────────────────────────
function isFastSunday(row) {
  return (row["Speaker1"] || "").toUpperCase() === "N/A" ||
         (row["Topic"] || "").toLowerCase().includes("fast sunday");
}

function isStakeConference(row) {
  return (row["Topic"] || "").toLowerCase().includes("stake conference") ||
    Object.values(row).every(v => !v || v === row["__date"] || v === "N/A");
}

function parseNameTopic(val) {
  if (!val || val.trim() === "" || val.toUpperCase() === "N/A") return null;
  // Split on dash or colon
  const m = val.match(/^([^:\-–]+)[\-–:]\s*(.+)$/);
  if (m) return { name: m[1].trim(), topic: m[2].trim() };
  return { name: val.trim(), topic: null };
}

function hymnDisplay(val) {
  if (!val || val.toUpperCase() === "N/A" || val.trim() === "") return null;
  return val.trim();
}

// ─── Print styles (injected into a new window) ───────────────────────────────
const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'EB Garamond', Georgia, serif; font-size: 11pt; color: #1a1814; background: white; width: 7.5in; margin: 0 auto; padding: 0.5in; }

  .program-outer { width: 100%; }

  /* Header */
  .prog-header { text-align: center; margin-bottom: 0.35in; border-bottom: 1.5pt solid #8B6914; padding-bottom: 0.2in; }
  .prog-ward { font-family: 'Cormorant Garamond', serif; font-size: 22pt; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #1a1814; }
  .prog-subtitle { font-size: 10pt; letter-spacing: 0.18em; text-transform: uppercase; color: #6B6760; margin-top: 2pt; }
  .prog-date { font-family: 'Cormorant Garamond', serif; font-size: 16pt; font-weight: 400; font-style: italic; color: #8B6914; margin-top: 6pt; }
  .prog-time { font-size: 9.5pt; color: #6B6760; letter-spacing: 0.1em; margin-top: 2pt; }

  /* Two-column layout */
  .prog-body { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3in; }

  /* Sections */
  .prog-section { margin-bottom: 0.18in; }
  .prog-section-title { font-family: 'Cormorant Garamond', serif; font-size: 8pt; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #8B6914; border-bottom: 0.5pt solid #D4CFC6; padding-bottom: 2pt; margin-bottom: 5pt; }
  .prog-line { display: flex; justify-content: space-between; align-items: baseline; font-size: 10.5pt; margin-bottom: 3pt; gap: 8pt; }
  .prog-label { color: #6B6760; font-size: 9.5pt; flex-shrink: 0; }
  .prog-value { text-align: right; flex: 1; }
  .prog-value.hymn { font-style: italic; }

  /* Full-width speaker section */
  .prog-speakers { grid-column: 1 / -1; }
  .speaker-entry { margin-bottom: 8pt; padding-bottom: 8pt; border-bottom: 0.5pt solid #EAE6DF; }
  .speaker-entry:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .speaker-name { font-size: 11pt; font-weight: 500; }
  .speaker-topic { font-size: 9.5pt; font-style: italic; color: #4a4540; margin-top: 1pt; }

  /* Special number */
  .prog-special { font-style: italic; }

  /* Fast Sunday / Stake Conference notice */
  .prog-notice { grid-column: 1 / -1; text-align: center; font-family: 'Cormorant Garamond', serif; font-size: 14pt; font-style: italic; color: #8B6914; padding: 0.3in 0; }

  /* Footer */
  .prog-footer { margin-top: 0.3in; border-top: 1pt solid #D4CFC6; padding-top: 0.15in; text-align: center; font-size: 8.5pt; color: #9A9590; letter-spacing: 0.08em; }

  @media print {
    @page { margin: 0.5in; }
    body { padding: 0; }
  }
`;

function buildPrintHTML(row, wardName) {
  const date = formatDate(row["__date"]);
  const fast = isFastSunday(row);
  const stake = isStakeConference(row);

  const conducting = row["Conducting"] || "";
  const presiding = row["Presiding"] || "";
  const organ = row["Organ"] || "";
  const conductingMusic = row["Conducting Music"] || "";
  const prelude = row["Prelude"] || conducting;
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

  let bodyHTML = "";

  if (stake) {
    bodyHTML = `<div class="prog-notice">Stake Conference — No Sacrament Meeting</div>`;
  } else if (fast) {
    bodyHTML = `
      <div class="prog-section">
        <div class="prog-section-title">Presiding & Conducting</div>
        ${conducting ? `<div class="prog-line"><span class="prog-label">Conducting</span><span class="prog-value">${conducting}</span></div>` : ""}
        ${presiding ? `<div class="prog-line"><span class="prog-label">Presiding</span><span class="prog-value">${presiding}</span></div>` : ""}
      </div>
      <div class="prog-section">
        <div class="prog-section-title">Music</div>
        ${organ ? `<div class="prog-line"><span class="prog-label">Organist</span><span class="prog-value">${organ}</span></div>` : ""}
        ${conductingMusic ? `<div class="prog-line"><span class="prog-label">Conducting</span><span class="prog-value">${conductingMusic}</span></div>` : ""}
      </div>
      <div class="prog-section">
        <div class="prog-section-title">Order of Service</div>
        ${openingHymn ? `<div class="prog-line"><span class="prog-label">Opening Hymn</span><span class="prog-value hymn">${openingHymn}</span></div>` : ""}
        ${openingPrayer ? `<div class="prog-line"><span class="prog-label">Opening Prayer</span><span class="prog-value">${openingPrayer}</span></div>` : ""}
        ${sacramentHymn ? `<div class="prog-line"><span class="prog-label">Sacrament Hymn</span><span class="prog-value hymn">${sacramentHymn}</span></div>` : ""}
      </div>
      <div class="prog-notice" style="grid-column:1/-1;font-size:12pt;padding:0.1in 0;">Fast & Testimony Meeting</div>
      <div class="prog-section">
        <div class="prog-section-title">Closing</div>
        ${closingHymn ? `<div class="prog-line"><span class="prog-label">Closing Hymn</span><span class="prog-value hymn">${closingHymn}</span></div>` : ""}
        ${benediction ? `<div class="prog-line"><span class="prog-label">Benediction</span><span class="prog-value">${benediction}</span></div>` : ""}
      </div>
    `;
  } else {
    bodyHTML = `
      <div class="prog-section">
        <div class="prog-section-title">Presiding & Conducting</div>
        ${conducting ? `<div class="prog-line"><span class="prog-label">Conducting</span><span class="prog-value">${conducting}</span></div>` : ""}
        ${presiding ? `<div class="prog-line"><span class="prog-label">Presiding</span><span class="prog-value">${presiding}</span></div>` : ""}
      </div>
      <div class="prog-section">
        <div class="prog-section-title">Music</div>
        ${organ ? `<div class="prog-line"><span class="prog-label">Organist</span><span class="prog-value">${organ}</span></div>` : ""}
        ${conductingMusic ? `<div class="prog-line"><span class="prog-label">Conducting</span><span class="prog-value">${conductingMusic}</span></div>` : ""}
        ${prelude && prelude !== organ ? `<div class="prog-line"><span class="prog-label">Prelude</span><span class="prog-value">${prelude}</span></div>` : ""}
      </div>
      <div class="prog-section">
        <div class="prog-section-title">Opening</div>
        ${openingHymn ? `<div class="prog-line"><span class="prog-label">Hymn</span><span class="prog-value hymn">${openingHymn}</span></div>` : ""}
        ${openingPrayer ? `<div class="prog-line"><span class="prog-label">Prayer</span><span class="prog-value">${openingPrayer}</span></div>` : ""}
        ${sacramentHymn ? `<div class="prog-line"><span class="prog-label">Sacrament Hymn</span><span class="prog-value hymn">${sacramentHymn}</span></div>` : ""}
      </div>
      <div class="prog-section">
        <div class="prog-section-title">Closing</div>
        ${closingHymn ? `<div class="prog-line"><span class="prog-label">Hymn</span><span class="prog-value hymn">${closingHymn}</span></div>` : ""}
        ${benediction ? `<div class="prog-line"><span class="prog-label">Benediction</span><span class="prog-value">${benediction}</span></div>` : ""}
      </div>
      ${speakers.length > 0 ? `
        <div class="prog-section prog-speakers">
          <div class="prog-section-title">Speakers</div>
          ${speakers.map(s => `
            <div class="speaker-entry">
              <div class="speaker-name">${s.name}</div>
              ${s.topic ? `<div class="speaker-topic">${s.topic}</div>` : ""}
            </div>
          `).join("")}
          ${specialHymn ? `
            <div class="speaker-entry">
              <div class="speaker-name prog-special">${specialHymn}</div>
              <div class="speaker-topic">Musical Number</div>
            </div>
          ` : ""}
        </div>
      ` : ""}
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Sacrament Meeting Program — ${date}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
<div class="program-outer">
  <div class="prog-header">
    <div class="prog-ward">${wardName}</div>
    <div class="prog-subtitle">Sacrament Meeting</div>
    <div class="prog-date">${date}</div>
    <div class="prog-time">9:00 AM</div>
  </div>
  <div class="prog-body">
    ${bodyHTML}
  </div>
  <div class="prog-footer">
    The Church of Jesus Christ of Latter-day Saints &nbsp;·&nbsp; Placid Rose Ward &nbsp;·&nbsp; West Jordan Utah Stake
  </div>
</div>
</body>
</html>`;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SacramentProgram() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const printRef = useRef(null);

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
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const selected = rows.find(r => r["__date"] === selectedDate);

  const handlePrint = () => {
    if (!selected) return;
    const html = buildPrintHTML(selected, "Placid Rose Ward");
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  // Group rows by month for the selector
  const grouped = rows.reduce((acc, r) => {
    const d = parseMeetingDate(r["__date"]);
    if (!d) return acc;
    const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const fast = selected && isFastSunday(selected);
  const stake = selected && isStakeConference(selected);

  const speakers = selected ? [
    parseNameTopic(selected["Speaker1"]),
    parseNameTopic(selected["Speaker2"]),
    parseNameTopic(selected["Speaker 3"]),
    parseNameTopic(selected["Speaker 4"]),
  ].filter(Boolean) : [];

  const specialHymn = selected ? hymnDisplay(selected["Special #/Rest Hymn"]) : null;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* Left: date selector */}
      <div className="scroll" style={{ width: 200, borderRight: "1px solid var(--border)", padding: 12, flexShrink: 0, background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="label" style={{ margin: 0 }}>Sundays</div>
          <button className="btn btn-ghost" style={{ fontSize: 9, padding: "2px 6px" }} onClick={fetchData} title="Refresh from spreadsheet">↺</button>
        </div>
        {loading && <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "8px 0" }}>Loading...</div>}
        {error && <div style={{ fontSize: 11, color: "var(--danger)", padding: "8px 0" }}>{error}</div>}
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
                  color: isSelected ? "var(--gold)" : "var(--text-dim)",
                  fontSize: 12,
                }}>
                  {r["__date"]}
                  {isFast && <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 4 }}>F&T</span>}
                  {isStake && <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 4 }}>SC</span>}
                </div>
              );
            })}
          </div>
        ))}
        {lastFetched && (
          <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.4 }}>
            Updated {lastFetched.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Right: program view */}
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
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)" }}>
                {formatDate(selected["__date"])}
              </div>
              {fast && <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 2 }}>Fast & Testimony Meeting</div>}
              {stake && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Stake Conference</div>}
            </div>
            <button className="btn btn-gold" onClick={handlePrint}>
              ⎙ Print Program
            </button>
          </div>

          {/* Program preview */}
          <div className="scroll" style={{ flex: 1, padding: 24 }} ref={printRef}>
            {stake ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 8 }}>Stake Conference</div>
                <div style={{ fontSize: 12 }}>No sacrament meeting this week.</div>
              </div>
            ) : (
              <div style={{ maxWidth: 680, margin: "0 auto" }}>

                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 28, paddingBottom: 16, borderBottom: "1px solid var(--border2)" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold)" }}>Placid Rose Ward</div>
                  <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 2 }}>Sacrament Meeting</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontStyle: "italic", color: "var(--text)", marginTop: 6 }}>{formatDate(selected["__date"])}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

                  {/* Presiding & Conducting */}
                  <ProgramSection title="Presiding & Conducting">
                    {selected["Conducting"] && <ProgramLine label="Conducting" value={selected["Conducting"]} />}
                    {selected["Presiding"] && <ProgramLine label="Presiding" value={selected["Presiding"]} />}
                  </ProgramSection>

                  {/* Music */}
                  <ProgramSection title="Music">
                    {selected["Organ"] && <ProgramLine label="Organist" value={selected["Organ"]} />}
                    {selected["Conducting Music"] && <ProgramLine label="Conducting" value={selected["Conducting Music"]} />}
                    {selected["Prelude"] && selected["Prelude"] !== selected["Organ"] && (
                      <ProgramLine label="Prelude" value={selected["Prelude"]} />
                    )}
                  </ProgramSection>

                  {/* Opening */}
                  <ProgramSection title="Opening">
                    {hymnDisplay(selected["Opening Hymn"]) && <ProgramLine label="Hymn" value={hymnDisplay(selected["Opening Hymn"])} hymn />}
                    {selected["Opening Prayer"] && <ProgramLine label="Prayer" value={selected["Opening Prayer"]} />}
                    {hymnDisplay(selected["Sacrament Hymn"]) && <ProgramLine label="Sacrament Hymn" value={hymnDisplay(selected["Sacrament Hymn"])} hymn />}
                  </ProgramSection>

                  {/* Closing */}
                  <ProgramSection title="Closing">
                    {(hymnDisplay(selected["Closing Hymn "]) || hymnDisplay(selected["Closing Hymn"])) && (
                      <ProgramLine label="Hymn" value={hymnDisplay(selected["Closing Hymn "]) || hymnDisplay(selected["Closing Hymn"])} hymn />
                    )}
                    {selected["Benediction"] && <ProgramLine label="Benediction" value={selected["Benediction"]} />}
                  </ProgramSection>

                  {/* Speakers — full width */}
                  {!fast && speakers.length > 0 && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <ProgramSection title="Speakers">
                        {speakers.map((s, i) => (
                          <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < speakers.length - 1 ? "1px solid var(--border)" : "none" }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{s.name}</div>
                            {s.topic && <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--text-dim)", marginTop: 2 }}>{s.topic}</div>}
                          </div>
                        ))}
                        {specialHymn && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontStyle: "italic", color: "var(--text)" }}>{specialHymn}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Musical Number</div>
                          </div>
                        )}
                      </ProgramSection>
                    </div>
                  )}

                  {fast && (
                    <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "16px 0", fontFamily: "var(--font-display)", fontSize: 15, fontStyle: "italic", color: "var(--gold)" }}>
                      Fast & Testimony Meeting — Open Mic
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgramSection({ title, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold-dim)", borderBottom: "1px solid var(--border)", paddingBottom: 4, marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ProgramLine({ label, value, hymn }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5, gap: 8 }}>
      <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--text)", textAlign: "right", fontStyle: hymn ? "italic" : "normal" }}>{value}</span>
    </div>
  );
}
