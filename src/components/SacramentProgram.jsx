import { useState, useEffect, useRef } from "react";

const SHEETS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdl23Rb1bXooszhKH3On8dHLgfG4Oqpz5V0my6ip4NupYOZr_SuEo8kGXBY-waCDPhMiZE__jw-ZfU/pub?gid=201628214&single=true&output=csv";

const SHEETS_EDIT_URL =
  "https://docs.google.com/spreadsheets/d/1MhtUPBuSjRuQ6Y3qcEYqVsnGq5rSfR-coFsy5dGHzqs/edit";

const TODAY = new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
const WARD = "Placid Rose Ward";
const STAKE = "Herriman Utah South Stake";

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
  // Strip all whitespace including non-breaking spaces and invisible chars
  const clean = str.replace(/[\s\u00a0\u200b\u200c\u200d\ufeff]+/g, "").trim();
  const parts = clean.split("-");
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

function toSundayKey(dateStr) {
  if (!dateStr) return null;
  const pad = n => String(n).padStart(2, "0");

  // Try our custom parser first (handles "14-Jun" format)
  const d1 = parseMeetingDate(dateStr);
  if (d1) {
    return `${d1.getFullYear()}-${pad(d1.getMonth()+1)}-${pad(d1.getDate())}`;
  }

  // Log char codes to help diagnose invisible character issues
  console.warn("[toSundayKey] parseMeetingDate failed for:", JSON.stringify(dateStr),
    "chars:", [...dateStr].map(c => c.charCodeAt(0)));

  // Fall back to native Date parsing
  const d2 = new Date(dateStr);
  if (!isNaN(d2.getTime())) {
    return `${d2.getFullYear()}-${pad(d2.getMonth()+1)}-${pad(d2.getDate())}`;
  }

  // Last resort: already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  return null;
}

// ─── Default blank releasing / sustaining records ────────────────────────────
function blankReleasing() {
  return { id: Date.now(), title: "Brother", name: "", calling: "", dateReleased: TODAY, dateVote: TODAY, dateChanged: "" };
}
function blankSustaining() {
  return { id: Date.now(), title: "Brother", name: "", calling: "", dateCalled: TODAY, dateSustained: TODAY, dateSetApart: "", dateChanged: "" };
}

// ─── Local storage ────────────────────────────────────────────────────────────
function loadEdits(dateKey) {
  try {
    const raw = localStorage.getItem(`sp_edits_${dateKey}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function saveEdits(dateKey, edits) {
  try { localStorage.setItem(`sp_edits_${dateKey}`, JSON.stringify(edits)); } catch (e) {}
}

// ─── Merge server + localStorage ─────────────────────────────────────────────
function mergeEdits(local, server) {
  if (!server) return local;
  return {
    announcements: server.announcements?.length ? server.announcements : (local.announcements || []),
    newMembers:    server.newMembers?.length    ? server.newMembers    : (local.newMembers || []),
    releasings:    server.releasings?.length    ? server.releasings    : (local.releasings || []),
    sustainings:   server.sustainings?.length   ? server.sustainings   : (local.sustainings || []),
    otherBusiness: server.otherBusiness         ? server.otherBusiness : (local.otherBusiness || ""),
    _fromServer: true,
    _lastUpdatedBy: server.lastUpdatedBy || null,
    _lastUpdated: server.lastUpdated || null,
  };
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
  .announcement-list { margin: 0; padding-left: 16pt; list-style: none; }
  .announcement-list li { font-size: 14pt; margin-bottom: 6pt; position: relative; padding-left: 4pt; }
  .announcement-list li::before { content: "•"; position: absolute; left: -13pt; color: #8B6914; }
  .notice { font-style: italic; color: #6B6760; font-size: 13pt; margin-bottom: 4pt; padding-left: 4pt; }
  .new-member-intro { font-size: 13pt; font-style: italic; color: #4a4540; margin-bottom: 6pt; line-height: 1.5; }
  .new-member-outro { font-size: 13pt; font-style: italic; color: #4a4540; margin-top: 6pt; line-height: 1.5; }
  .speaker-block { margin-bottom: 10pt; }
  .speaker-order { font-size: 10pt; letter-spacing: 0.15em; text-transform: uppercase; color: #8B6914; margin-bottom: 2pt; }
  .speaker-name { font-size: 14pt; font-weight: 500; }
  .speaker-topic { font-size: 12pt; font-style: italic; color: #4a4540; margin-top: 2pt; }
  .fast-notice { text-align: center; font-family: 'Cormorant Garamond', serif; font-size: 18pt; font-style: italic; color: #8B6914; padding: 0.2in 0; }
  .paperwork-ref { font-size: 12pt; font-style: italic; color: #6B6760; margin-bottom: 4pt; }
  .prog-footer { margin-top: 0.25in; border-top: 1pt solid #D4CFC6; padding-top: 0.12in; text-align: center; font-size: 11pt; color: #9A9590; letter-spacing: 0.08em; }
  @media print { @page { margin: 0.5in; } body { padding: 0; } }
`;

// ─── Ecclesiastical form CSS ──────────────────────────────────────────────────
const FORM_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'EB Garamond', Georgia, serif; font-size: 13pt; color: #1a1814; background: white; padding: 0.6in; }
  .form-page { page-break-after: always; margin-bottom: 0.5in; }
  .form-page:last-child { page-break-after: auto; }
  .form-header { text-align: center; margin-bottom: 0.3in; border-bottom: 1pt solid #8B6914; padding-bottom: 0.15in; }
  .form-title { font-family: 'Cormorant Garamond', serif; font-size: 18pt; font-weight: 600; color: #1a1814; margin-bottom: 4pt; }
  .form-ward { font-size: 12pt; color: #6B6760; }
  .form-body { line-height: 2; }
  .form-body p { margin-bottom: 8pt; }
  .blank { display: inline-block; border-bottom: 1pt solid #1a1814; min-width: 2in; vertical-align: bottom; }
  .blank-sm { display: inline-block; border-bottom: 1pt solid #1a1814; min-width: 0.8in; vertical-align: bottom; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.2in; margin-top: 0.25in; }
  .grid-item { border-bottom: 1pt solid #1a1814; padding-bottom: 2pt; }
  .grid-label { font-size: 10pt; color: #6B6760; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 2pt; }
  .grid-value { font-size: 13pt; min-height: 18pt; }
  @media print { @page { margin: 0.6in; } body { padding: 0; } }
`;

// ─── Build program HTML ───────────────────────────────────────────────────────
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
  const sp1 = parseNameTopic(row["Speaker1"]);
  const sp2 = parseNameTopic(row["Speaker2"]);
  const sp3 = parseNameTopic(row["Speaker 3"]);
  const sp4 = parseNameTopic(row["Speaker 4"]);

  const announcements = (edits.announcements || []).filter(a => a?.trim());
  const newMembers = (edits.newMembers || []).filter(a => a?.trim());
  const releasings = (edits.releasings || []).filter(r => r?.name?.trim());
  const sustainings = (edits.sustainings || []).filter(s => s?.name?.trim());
  const otherBusiness = (edits.otherBusiness || "").trim();
  const hasWardBusiness = newMembers.length || releasings.length || sustainings.length || otherBusiness;

  const line = (label, value, hymn) =>
    value ? `<div class="line"><span class="line-label">${label}</span><span class="line-value${hymn ? " hymn" : ""}">${value}</span></div>` : "";
  const lineOnly = (value) =>
    value ? `<div class="line-only">${value}</div>` : "";
  const notice = (value) =>
    value ? `<div class="notice">${value}</div>` : "";
  const hr = () => `<hr/>`;
  const sectionTitle = (t) => `<div class="section-title">${t}</div>`;

  const ordinals = ["First", "Second", "Third", "Fourth"];
  const speakerBlock = (sp, idx) => sp
    ? `<div class="speaker-block"><div class="speaker-order">${ordinals[idx]} Speaker</div><div class="speaker-name">${sp.name}</div>${sp.topic ? `<div class="speaker-topic">${sp.topic}</div>` : ""}</div>`
    : "";

  let body = "";

  body += sectionTitle("Presiding &amp; Conducting");
  body += line("Presiding", presiding);
  body += line("Conducting", conducting);
  body += hr();

  body += sectionTitle("Music");
  body += line("Organist", organ);
  body += line("Choir Director", conductingMusic);
  body += hr();

  if (announcements.length) {
    body += sectionTitle("Announcements");
    body += `<ul class="announcement-list">${announcements.map(a => `<li>${a}</li>`).join("")}</ul>`;
    body += hr();
  }

  body += sectionTitle("Opening");
  body += line("Opening Hymn", openingHymn, true);
  body += line("Opening Prayer", openingPrayer);
  body += hr();

  if (hasWardBusiness) {
    body += sectionTitle("Ward Business");
    if (newMembers.length) {
      body += `<div class="new-member-intro">We have received the records of the following new members in the ward and would invite them to stand and be recognized...</div>`;
      newMembers.forEach(m => { body += line("New Member", m); });
      body += `<div class="new-member-outro">All those who can join with me in welcoming these new members into our ward, please do so by the uplifted hand.</div>`;
    }
    if (releasings.length) {
      body += `<div class="paperwork-ref">Releasings — see accompanying paperwork</div>`;
    }
    if (sustainings.length) {
      body += `<div class="paperwork-ref">Sustainings — see accompanying paperwork</div>`;
    }
    if (otherBusiness) body += lineOnly(otherBusiness);
    body += hr();
  }

  body += sectionTitle("Sacrament");
  body += line("Sacrament Hymn", sacramentHymn, true);
  body += notice("Sacrament to be administered to the congregation by the Aaronic Priesthood");
  body += notice("Please reverence the sacrament and put away all distractions");
  body += hr();

  if (fast) {
    body += `<div class="fast-notice">Fast &amp; Testimony Meeting<br/>Sharing of Testimonies</div>`;
  } else {
    body += sectionTitle("Program");
    // Track speaker ordinal separately (special number doesn't count)
    let speakerIdx = 0;
    if (sp1) { body += speakerBlock(sp1, speakerIdx++); }
    if (sp2) { body += speakerBlock(sp2, speakerIdx++); }
    if (specialHymn) {
      body += `<div class="speaker-block"><div class="speaker-name" style="font-style:italic">${specialHymn}</div><div class="speaker-topic">Musical Number / Intermediate Hymn</div></div>`;
    }
    if (sp3) { body += speakerBlock(sp3, speakerIdx++); }
    if (sp4) { body += speakerBlock(sp4, speakerIdx++); }
  }
  body += hr();

  body += sectionTitle("Closing");
  body += line("Closing Hymn", closingHymn, true);
  body += line("Closing Prayer", benediction);

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Sacrament Meeting Program — ${date}</title>
<style>${PRINT_CSS}</style></head><body>
<div class="prog-header">
  <div class="prog-ward">${WARD}</div>
  <div class="prog-subtitle">Sacrament Meeting</div>
  <div class="prog-date">${date}</div>
  <div class="prog-time">9:00 AM</div>
</div>
${body}
<div class="prog-footer">The Church of Jesus Christ of Latter-day Saints &nbsp;·&nbsp; ${WARD} &nbsp;·&nbsp; ${STAKE}</div>
</body></html>`;
}

// ─── Build ecclesiastical forms HTML ─────────────────────────────────────────
function buildFormsHTML(releasings, sustainings) {
  let pages = "";

  releasings.filter(r => r.name?.trim()).forEach(r => {
    const him = r.title === "Sister" ? "her" : "his";
    const he = r.title === "Sister" ? "she" : "he";
    pages += `
    <div class="form-page">
      <div class="form-header">
        <div class="form-title">Ward Member Release</div>
        <div class="form-ward">${WARD}, ${STAKE}</div>
      </div>
      <div class="form-body">
        <p>The following individual has been extended a release:</p>
        <p>${r.title} <span class="blank">${r.name}</span> has been released as <span class="blank">${r.calling}</span></p>
        <p>and we propose that ${he} be given a vote of thanks for ${him} service. Those who wish to express their appreciation may manifest it by the uplifted hand.</p>
      </div>
      <div class="grid">
        <div class="grid-item"><div class="grid-label">Date Released</div><div class="grid-value">${r.dateReleased || ""}</div></div>
        <div class="grid-item"><div class="grid-label">By</div><div class="grid-value"></div></div>
        <div class="grid-item"><div class="grid-label">Date of Vote of Thanks</div><div class="grid-value">${r.dateVote || ""}</div></div>
        <div class="grid-item"><div class="grid-label">Leader Notified</div><div class="grid-value"></div></div>
        <div class="grid-item"><div class="grid-label">Date Changed in Records</div><div class="grid-value">${r.dateChanged || ""}</div></div>
        <div class="grid-item"></div>
      </div>
    </div>`;
  });

  sustainings.filter(s => s.name?.trim()).forEach(s => {
    const him = s.title === "Sister" ? "her" : "his";
    const he = s.title === "Sister" ? "she" : "he";
    pages += `
    <div class="form-page">
      <div class="form-header">
        <div class="form-title">Ward Member Calling, Sustaining and Setting Apart</div>
        <div class="form-ward">${WARD}, ${STAKE}</div>
      </div>
      <div class="form-body">
        <p>The following individual has been called to serve in the ward and we ask them to stand and remain standing for a sustaining vote:</p>
        <p>${s.title} <span class="blank">${s.name}</span> has been called as <span class="blank">${s.calling}</span></p>
        <p>and we propose that ${he} be sustained. Those in favor may manifest it by the uplifted hand.</p>
        <p>Those opposed, if any, may manifest it by the same sign.</p>
      </div>
      <div class="grid">
        <div class="grid-item"><div class="grid-label">Date Called</div><div class="grid-value">${s.dateCalled || ""}</div></div>
        <div class="grid-item"><div class="grid-label">By</div><div class="grid-value"></div></div>
        <div class="grid-item"><div class="grid-label">Date Sustained</div><div class="grid-value">${s.dateSustained || ""}</div></div>
        <div class="grid-item"><div class="grid-label">Leader Notified</div><div class="grid-value"></div></div>
        <div class="grid-item"><div class="grid-label">Date Set Apart</div><div class="grid-value">${s.dateSetApart || ""}</div></div>
        <div class="grid-item"><div class="grid-label">Date Changed in Records</div><div class="grid-value">${s.dateChanged || ""}</div></div>
      </div>
    </div>`;
  });

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Ecclesiastical Forms</title>
<style>${FORM_CSS}</style></head><body>${pages}</body></html>`;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function Divider() {
  return <div style={{ borderTop: "1px solid var(--border)", margin: "14px 0" }} />;
}

function SectionHeading({ children }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold-dim)", borderBottom: "1px solid var(--border)", paddingBottom: 4, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function ProgramLine({ label, value, hymn }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5, gap: 8 }}>
      {label && <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>}
      <span style={{ fontSize: 12, color: "var(--text)", textAlign: label ? "right" : "left", fontStyle: hymn ? "italic" : "normal", flex: 1 }}>{value}</span>
    </div>
  );
}

function Notice({ children }) {
  return <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--text-muted)", marginBottom: 5, paddingLeft: 4 }}>{children}</div>;
}

function AddButton({ label, onClick }) {
  return (
    <button className="btn btn-ghost" style={{ fontSize: 9, padding: "2px 8px", marginTop: 2, color: "var(--text-muted)" }} onClick={onClick}>
      + {label}
    </button>
  );
}

// ─── Releasing / Sustaining record form (inline editor) ───────────────────────
function RecordForm({ type, record, onChange, onRemove }) {
  const isReleasing = type === "releasing";
  const him = record.title === "Sister" ? "her" : "his";
  const he = record.title === "Sister" ? "she" : "he";
  const f = (key, val) => onChange({ ...record, [key]: val });

  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderLeft: `3px solid ${isReleasing ? "var(--rs)" : "var(--eq)"}`, borderRadius: "var(--radius)", padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: isReleasing ? "var(--rs)" : "var(--eq)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>
          {isReleasing ? "Releasing" : "Sustaining"}
        </span>
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 12 }}>✕</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 6, marginBottom: 6 }}>
        <select className="input" style={{ fontSize: 11, padding: "3px 6px" }} value={record.title} onChange={e => f("title", e.target.value)}>
          <option value="Brother">Brother</option>
          <option value="Sister">Sister</option>
        </select>
        <textarea className="input" rows={1} style={{ fontSize: 11, padding: "3px 8px", resize: "vertical", minHeight: 32 }} placeholder="Full name..." value={record.name} onChange={e => f("name", e.target.value)} />
      </div>
      <textarea className="input" rows={2} style={{ fontSize: 11, padding: "3px 8px", marginBottom: 6, resize: "vertical", minHeight: 38, width: "100%" }} placeholder={isReleasing ? "Released as..." : "Called as..."} value={record.calling} onChange={e => f("calling", e.target.value)} />

      <div style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 8, lineHeight: 1.5 }}>
        {isReleasing
          ? `...and we propose that ${he} be given a vote of thanks for ${him} service.`
          : `...and we propose that ${he} be sustained. Those in favor may manifest it by the uplifted hand. Those opposed, if any, may manifest it by the same sign.`}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {isReleasing ? (
          <>
            <div><label className="label" style={{ fontSize: 9 }}>Date Released</label><input className="input" style={{ fontSize: 11, padding: "2px 6px" }} value={record.dateReleased || TODAY} onChange={e => f("dateReleased", e.target.value)} /></div>
            <div><label className="label" style={{ fontSize: 9 }}>Date of Vote of Thanks</label><input className="input" style={{ fontSize: 11, padding: "2px 6px" }} value={record.dateVote || TODAY} onChange={e => f("dateVote", e.target.value)} /></div>
            <div><label className="label" style={{ fontSize: 9 }}>Date Changed in Records</label><input className="input" style={{ fontSize: 11, padding: "2px 6px" }} value={record.dateChanged || ""} onChange={e => f("dateChanged", e.target.value)} /></div>
          </>
        ) : (
          <>
            <div><label className="label" style={{ fontSize: 9 }}>Date Called</label><input className="input" style={{ fontSize: 11, padding: "2px 6px" }} value={record.dateCalled || TODAY} onChange={e => f("dateCalled", e.target.value)} /></div>
            <div><label className="label" style={{ fontSize: 9 }}>Date Sustained</label><input className="input" style={{ fontSize: 11, padding: "2px 6px" }} value={record.dateSustained || TODAY} onChange={e => f("dateSustained", e.target.value)} /></div>
            <div><label className="label" style={{ fontSize: 9 }}>Date Set Apart</label><input className="input" style={{ fontSize: 11, padding: "2px 6px" }} value={record.dateSetApart || ""} onChange={e => f("dateSetApart", e.target.value)} /></div>
            <div><label className="label" style={{ fontSize: 9 }}>Date Changed in Records</label><input className="input" style={{ fontSize: 11, padding: "2px 6px" }} value={record.dateChanged || ""} onChange={e => f("dateChanged", e.target.value)} /></div>
          </>
        )}
      </div>
    </div>
  );
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

  useEffect(() => {
    if (!selectedDate) return;
    const local = loadEdits(selectedDate);
    setEdits(local);
    const sundayKey = toSundayKey(selectedDate);
    if (api != null && sundayKey) {
      fetch(`${api}/api/sacrament/edits/${sundayKey}`)
        .then(r => r.json())
        .then(data => { setServerEdits(data); if (data) setEdits(mergeEdits(local, data)); })
        .catch(() => {});
    }
  }, [selectedDate, api]);

  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"

  const persistEdits = (next) => {
    setEdits(next);
    saveEdits(selectedDate, next);
    const sundayKey = toSundayKey(selectedDate);
    if (api != null && sundayKey) {
      fetch(`${api}/api/sacrament/edits/${sundayKey}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
    }
  };

  const [saveError, setSaveError] = useState(null);

  const handleSave = async () => {
    const sundayKey = toSundayKey(selectedDate);
    console.log("[SAVE] selectedDate:", selectedDate, "→ sundayKey:", sundayKey);
    if (api == null || !sundayKey) { setSaveStatus("error"); setSaveError(`Could not determine date key from: "${selectedDate}"`); return; }
    setSaveStatus("saving"); setSaveError(null);
    // Strip internal merge fields before sending
    const { _fromServer, _lastUpdatedBy, _lastUpdated, ...payload } = edits;
    try {
      const res = await fetch(`${api}/api/sacrament/edits/${sundayKey}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      saveEdits(selectedDate, edits);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (e) {
      console.error("[SAVE]", e.message);
      setSaveStatus("error");
      setSaveError(e.message);
      setTimeout(() => { setSaveStatus(null); setSaveError(null); }, 5000);
    }
  };

  const setEdit = (key, value) => persistEdits({ ...edits, [key]: value });
  const addListItem = (key, blank) => setEdit(key, [...(edits[key] || []), blank || ""]);
  const updateListItem = (key, idx, value) => { const next = [...(edits[key] || [])]; next[idx] = value; setEdit(key, next); };
  const removeListItem = (key, idx) => setEdit(key, (edits[key] || []).filter((_, i) => i !== idx));

  const selected = rows.find(r => r["__date"] === selectedDate);
  const fast = selected && isFastSunday(selected);
  const stake = selected && isStakeConference(selected);

  const sp1 = selected ? parseNameTopic(selected["Speaker1"]) : null;
  const sp2 = selected ? parseNameTopic(selected["Speaker2"]) : null;
  const sp3 = selected ? parseNameTopic(selected["Speaker 3"]) : null;
  const sp4 = selected ? parseNameTopic(selected["Speaker 4"]) : null;
  const specialHymn = selected ? hymnDisplay(selected["Special #/Rest Hymn"]) : null;
  const closingHymn = selected ? (hymnDisplay(selected["Closing Hymn "]) || hymnDisplay(selected["Closing Hymn"])) : null;

  const announcements = edits.announcements || [];
  const newMembers = edits.newMembers || [];
  const releasings = edits.releasings || [];
  const sustainings = edits.sustainings || [];
  const hasWardBusiness = newMembers.length || releasings.length || sustainings.length || (edits.otherBusiness || "").trim();

  const handlePrintProgram = () => {
    if (!selected) return;
    const html = buildPrintHTML(selected, edits);
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(html); win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  const handlePrintForms = () => {
    const rel = releasings.filter(r => r?.name?.trim());
    const sus = sustainings.filter(s => s?.name?.trim());
    if (!rel.length && !sus.length) return;
    const html = buildFormsHTML(rel, sus);
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(html); win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  const [drawerOpen, setDrawerOpen] = useState(true);
  const touchStartX = useRef(null);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) setDrawerOpen(false);  // swipe left → hide drawer, show program
    if (dx > 0) setDrawerOpen(true);   // swipe right → show drawer
    touchStartX.current = null;
  };

  const ordinals = ["First", "Second", "Third", "Fourth"];

  const grouped = rows.reduce((acc, r) => {
    const d = parseMeetingDate(r["__date"]);
    if (!d) return acc;
    const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}>

      {/* Left: date selector */}
      <div className="scroll" style={{
        width: drawerOpen ? 200 : 0,
        minWidth: drawerOpen ? 200 : 0,
        borderRight: drawerOpen ? "1px solid var(--border)" : "none",
        padding: drawerOpen ? 12 : 0,
        flexShrink: 0,
        background: "var(--surface)",
        overflow: drawerOpen ? "auto" : "hidden",
        transition: "width 0.2s ease, min-width 0.2s ease, padding 0.2s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div className="label" style={{ margin: 0 }}>Sundays</div>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn btn-ghost" style={{ fontSize: 9, padding: "2px 6px" }} onClick={fetchData} title="Refresh">↺</button>
            <button className="btn btn-ghost" style={{ fontSize: 9, padding: "2px 6px" }} onClick={() => setDrawerOpen(false)} title="Collapse">‹</button>
          </div>
        </div>
        <a href={SHEETS_EDIT_URL} target="_blank" rel="noreferrer"
          style={{ display: "block", fontSize: 9, color: "var(--gold)", textDecoration: "none", marginBottom: 10 }}>
          ↗ Edit Spreadsheet
        </a>
        {loading && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Loading...</div>}
        {error && <div style={{ fontSize: 11, color: "var(--danger)" }}>{error}</div>}
        {Object.entries(grouped).map(([month, monthRows]) => (
          <div key={month} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>{month}</div>
            {monthRows.map(r => {
              const isSelected = r["__date"] === selectedDate;
              return (
                <div key={r["__date"]} onClick={() => setSelectedDate(r["__date"])} style={{
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
          <div className="empty-state"><span className="empty-state-icon">◎</span><p className="empty-state-text">Select a Sunday to view the program</p></div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Toolbar */}
          <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {!drawerOpen && (
                <button className="btn btn-ghost" style={{ fontSize: 14, padding: "2px 8px" }} onClick={() => setDrawerOpen(true)} title="Show date list">›</button>
              )}
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)" }}>{formatDate(selected["__date"])}</div>
                {fast && <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 2 }}>Fast &amp; Testimony Meeting</div>}
                {stake && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Stake Conference</div>}
                {serverEdits && <div style={{ fontSize: 10, color: "var(--gold-dim)", marginTop: 2 }}>◈ GroupMe edits applied{serverEdits.lastUpdatedBy ? ` · ${serverEdits.lastUpdatedBy}` : ""}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {saveStatus && (
                <span style={{ fontSize: 11, color: saveStatus === "saved" ? "var(--success)" : saveStatus === "error" ? "var(--danger)" : "var(--text-muted)" }}>
                  {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "✓ Saved" : `✕ ${saveError || "Save failed"}`}
                </span>
              )}
              <button className="btn btn-outline" onClick={handleSave} disabled={saveStatus === "saving"}>
                💾 Save
              </button>
              {(releasings.filter(r => r?.name?.trim()).length > 0 || sustainings.filter(s => s?.name?.trim()).length > 0) && (
                <button className="btn btn-outline" onClick={handlePrintForms}>⎙ Print Forms</button>
              )}
              <button className="btn btn-gold" onClick={handlePrintProgram}>⎙ Print Program</button>
            </div>
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
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold)" }}>{WARD}</div>
                  <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 2 }}>Sacrament Meeting</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontStyle: "italic", color: "var(--text)", marginTop: 6 }}>{formatDate(selected["__date"])}</div>
                </div>

                <SectionHeading>Presiding &amp; Conducting</SectionHeading>
                <ProgramLine label="Presiding" value={selected["Presiding"]} />
                <ProgramLine label="Conducting" value={selected["Conducting"]} />
                <Divider />

                <SectionHeading>Music</SectionHeading>
                <ProgramLine label="Organist" value={selected["Organ"]} />
                <ProgramLine label="Choir Director" value={selected["Conducting Music"]} />
                <Divider />

                <SectionHeading>Announcements</SectionHeading>
                {announcements.map((a, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    <textarea className="input" rows={2} style={{ fontSize: 11, padding: "3px 8px", flex: 1, resize: "vertical", minHeight: 38 }} placeholder="Announcement..." value={a} onChange={e => updateListItem("announcements", i, e.target.value)} />
                    <button onClick={() => removeListItem("announcements", i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 12 }}>✕</button>
                  </div>
                ))}
                <AddButton label="Add announcement" onClick={() => addListItem("announcements")} />
                <Divider />

                <SectionHeading>Opening</SectionHeading>
                <ProgramLine label="Opening Hymn" value={hymnDisplay(selected["Opening Hymn"])} hymn />
                <ProgramLine label="Opening Prayer" value={selected["Opening Prayer"]} />
                <Divider />

                <SectionHeading>Ward Business</SectionHeading>
                {newMembers.map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0, minWidth: 80 }}>New Member</span>
                    <textarea className="input" rows={1} style={{ fontSize: 11, padding: "3px 8px", flex: 1, resize: "vertical", minHeight: 32 }} placeholder="Name..." value={m} onChange={e => updateListItem("newMembers", i, e.target.value)} />
                    <button onClick={() => removeListItem("newMembers", i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 12 }}>✕</button>
                  </div>
                ))}
                <AddButton label="New member" onClick={() => addListItem("newMembers")} />

                {/* Releasings */}
                <div style={{ marginTop: 10 }}>
                  {releasings.map((r, i) => (
                    <RecordForm key={r.id || i} type="releasing" record={r}
                      onChange={v => updateListItem("releasings", i, v)}
                      onRemove={() => removeListItem("releasings", i)} />
                  ))}
                  <AddButton label="Add releasing" onClick={() => addListItem("releasings", blankReleasing())} />
                </div>

                {/* Sustainings */}
                <div style={{ marginTop: 10 }}>
                  {sustainings.map((s, i) => (
                    <RecordForm key={s.id || i} type="sustaining" record={s}
                      onChange={v => updateListItem("sustainings", i, v)}
                      onRemove={() => removeListItem("sustainings", i)} />
                  ))}
                  <AddButton label="Add sustaining" onClick={() => addListItem("sustainings", blankSustaining())} />
                </div>

                <div style={{ marginTop: 8 }}>
                  <textarea className="input" rows={2} style={{ fontSize: 11, padding: "3px 8px", width: "100%", resize: "vertical", minHeight: 38 }} placeholder="Other business..." value={edits.otherBusiness || ""} onChange={e => setEdit("otherBusiness", e.target.value)} />
                </div>
                <Divider />

                <SectionHeading>Sacrament</SectionHeading>
                <ProgramLine label="Sacrament Hymn" value={hymnDisplay(selected["Sacrament Hymn"])} hymn />
                <Notice>Sacrament to be administered to the congregation by the Aaronic Priesthood</Notice>
                <Notice>Invite congregation to reverence the sacrament and put away all distractions</Notice>
                <Divider />

                <SectionHeading>Program</SectionHeading>
                {fast ? (
                  <div style={{ fontStyle: "italic", color: "var(--gold)", fontSize: 13, padding: "8px 0" }}>Sharing of Testimonies</div>
                ) : (
                  <>
                    {[sp1, sp2, null, sp3, sp4].reduce((acc, sp, rawIdx) => {
                      if (rawIdx === 2) {
                        // Special hymn slot
                        if (specialHymn) acc.push(
                          <div key="special" style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--text)" }}>{specialHymn}</div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Musical Number / Intermediate Hymn</div>
                          </div>
                        );
                      } else if (sp) {
                        const speakerNum = [sp1, sp2, sp3, sp4].filter(Boolean).indexOf(sp);
                        acc.push(
                          <div key={rawIdx} style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gold-dim)", marginBottom: 2 }}>{ordinals[speakerNum]} Speaker</div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{sp.name}</div>
                            {sp.topic && <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--text-dim)", marginTop: 1 }}>{sp.topic}</div>}
                          </div>
                        );
                      }
                      return acc;
                    }, [])}
                    {!sp1 && !sp2 && !sp3 && !sp4 && !specialHymn && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>No speakers listed in spreadsheet</div>
                    )}
                  </>
                )}
                <Divider />

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
