import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import { randomUUID } from "crypto";
import { mkdirSync, existsSync, readFileSync, copyFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { getAll, insert, update, remove, getById, getWeekKey } from "./src/lib/storage.js";
import { sendPulse, parsePulseResponse, sendSMS } from "./src/lib/twilio.js";
import { generateAgenda, suggestGoals } from "./src/lib/claude.js";
import { ALL_MEMBERS } from "./src/data/council.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists
const dataDir = join(__dirname, "data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

// Seed council members directly from council.js if DB is empty
try {
  const dbPath = join(__dirname, "data/db.json");
  let db = { pulseResponses: [], agendas: [], goals: [], sentPulses: [], councilMembers: [] };
  if (existsSync(dbPath)) {
    db = JSON.parse(readFileSync(dbPath, "utf8"));
  }
  if (!db.councilMembers || db.councilMembers.length === 0) {
    db.councilMembers = ALL_MEMBERS;
    writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log(`[INIT] Seeded ${ALL_MEMBERS.length} council members from council.js`);
  } else {
    console.log(`[INIT] DB already has ${db.councilMembers.length} council members`);
  }
} catch (err) {
  console.error("[INIT] Seeding error:", err.message);
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── Serve built frontend in production ───────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  app.use(express.static(join(__dirname, "dist")));
}

// ─── Privacy Policy ────────────────────────────────────────────────────────────
app.get("/privacy", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Privacy Policy - Placid Rose Ward Council</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }
        h1 { color: #C9A84C; }
      </style>
    </head>
    <body>
      <h1>Privacy Policy</h1>
      <p><strong>Placid Rose Ward Council Communication System</strong></p>
      <p><strong>Last updated: March 2026</strong></p>

      <h2>Overview</h2>
      <p>This application is a private internal communication tool used exclusively by volunteer leaders of the Placid Rose Ward of The Church of Jesus Christ of Latter-day Saints.</p>

      <h2>Information We Collect</h2>
      <p>We collect phone numbers and text message responses voluntarily provided by ward council members for the purpose of coordinating council meetings and welfare efforts.</p>

      <h2>How We Use Your Information</h2>
      <p>Phone numbers and responses are used solely for internal ward council coordination. Information is never sold, shared, or used for any commercial purpose.</p>

      <h2>Who Has Access</h2>
      <p>Only the Ward Executive Secretary and Bishopric have access to this system and its data.</p>

      <h2>Opt Out</h2>
      <p>Council members may opt out at any time by contacting the Executive Secretary directly.</p>

      <h2>Contact</h2>
      <p>For questions about this privacy policy, contact the Ward Executive Secretary.</p>
    </body>
    </html>
  `);
});

// ─── Terms and Conditions ──────────────────────────────────────────────────────
app.get("/terms", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Terms and Conditions - Placid Rose Ward Council</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }
        h1 { color: #C9A84C; }
      </style>
    </head>
    <body>
      <h1>Terms and Conditions</h1>
      <p><strong>Placid Rose Ward Council Communication System</strong></p>
      <p><strong>Last updated: March 2026</strong></p>

      <h2>Acceptance of Terms</h2>
      <p>By providing your phone number and participating in this communication system, you agree to these terms. This system is for the exclusive use of volunteer leaders of the Placid Rose Ward of The Church of Jesus Christ of Latter-day Saints.</p>

      <h2>Purpose of Service</h2>
      <p>This service is used solely for internal ward council coordination, including weekly check-ins, meeting agenda preparation, and welfare efforts on behalf of ward members.</p>

      <h2>Message Frequency</h2>
      <p>Participants will receive approximately 1-2 automated SMS messages per week. Additional messages may be sent as needed for council coordination purposes.</p>

      <h2>Message and Data Rates</h2>
      <p>Message and data rates may apply depending on your mobile carrier and plan. This service does not charge participants for messages sent or received.</p>

      <h2>Opt Out</h2>
      <p>You may opt out of receiving messages at any time by replying STOP to any message or by contacting the Executive Secretary directly. After opting out you will receive one final confirmation message.</p>

      <h2>Opt In</h2>
      <p>To re-subscribe after opting out, reply START to any message from this service or contact the Executive Secretary directly.</p>

      <h2>Help</h2>
      <p>For help or questions about this service, reply HELP to any message or contact the Executive Secretary directly.</p>

      <h2>Privacy</h2>
      <p>Your privacy is important to us. Please review our <a href="/privacy">Privacy Policy</a> for details on how your information is handled.</p>

      <h2>Limitation of Liability</h2>
      <p>This service is provided as-is for internal church coordination purposes. We are not liable for any delays or failures in message delivery caused by mobile carriers or other third parties.</p>

      <h2>Changes to Terms</h2>
      <p>These terms may be updated at any time. Continued participation in the service constitutes acceptance of any updated terms.</p>

      <h2>Contact</h2>
      <p>For questions about these terms, contact the Ward Executive Secretary.</p>
    </body>
    </html>
  `);
});

// ─── TWILIO WEBHOOK ───────────────────────────────────────────────────────────
// Configure your Twilio number's inbound webhook to POST to: https://yourdomain.com/webhook/sms
app.post("/webhook/sms", async (req, res) => {
  const { From, Body } = req.body;
  if (!From || !Body) return res.sendStatus(200);

  // Find the member by phone number
  const member = ALL_MEMBERS.find((m) => m.phone === From);
  const week = getWeekKey();

  const parsed = parsePulseResponse(Body.trim());

  // Check if they already have a response this week — if so, append
  const existing = getAll("pulseResponses").find(
    (r) => r.memberId === (member?.id || From) && r.week === week
  );

  if (existing) {
    // Merge new info into existing response
    update("pulseResponses", existing.id, {
      q1: existing.q1 || parsed.q1,
      q2: existing.q2 || parsed.q2,
      q3: existing.q3 || parsed.q3,
      raw: existing.raw + "\n---\n" + Body.trim(),
      updatedAt: new Date().toISOString(),
    });
  } else {
    insert("pulseResponses", {
      id: randomUUID(),
      memberId: member?.id || From,
      memberName: member?.name || From,
      org: member?.org || "Unknown",
      orgKey: member?.orgKey || "unknown",
      orgColor: member?.orgColor || "#888",
      week,
      q1: parsed.q1,
      q2: parsed.q2,
      q3: parsed.q3,
      raw: Body.trim(),
      receivedAt: new Date().toISOString(),
    });
  }

  // Auto-reply acknowledgment
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>Thanks! Your response has been recorded for this week's Ward Council. 🙏</Message></Response>`;
  res.type("text/xml").send(twiml);
});

// ─── PULSE API ─────────────────────────────────────────────────────────────────
app.get("/api/pulse", (req, res) => {
  const { week } = req.query;
  const all = getAll("pulseResponses");
  const responses = week ? all.filter((r) => r.week === week) : all;
  res.json(responses);
});

app.post("/api/pulse/send", async (req, res) => {
  // Manually trigger sending pulse to all or specific members
  const { memberIds } = req.body; // optional — if empty, send to all
  const targets = memberIds
    ? ALL_MEMBERS.filter((m) => memberIds.includes(m.id))
    : ALL_MEMBERS.filter((m) => m.id !== "es"); // exclude exec secretary

  const week = getWeekKey();
  const results = [];

  for (const member of targets) {
    try {
      await sendPulse(member);
      results.push({ memberId: member.id, success: true });
    } catch (err) {
      results.push({ memberId: member.id, success: false, error: err.message });
    }
  }

  insert("sentPulses", { id: randomUUID(), week, sentAt: new Date().toISOString(), memberIds: targets.map((m) => m.id) });
  res.json({ sent: results.length, results });
});

app.post("/api/pulse/manual", (req, res) => {
  // Manually add a pulse response (for members who texted you directly)
  const { memberId, q1, q2, q3, raw } = req.body;
  const member = ALL_MEMBERS.find((m) => m.id === memberId);
  if (!member) return res.status(404).json({ error: "Member not found" });

  const week = getWeekKey();
  const entry = insert("pulseResponses", {
    id: randomUUID(),
    memberId: member.id,
    memberName: member.name,
    org: member.org,
    orgKey: member.orgKey,
    orgColor: member.orgColor,
    week,
    q1: q1 || null,
    q2: q2 || null,
    q3: q3 || null,
    raw: raw || [q1, q2, q3].filter(Boolean).join("\n"),
    receivedAt: new Date().toISOString(),
    manual: true,
  });
  res.json(entry);
});

app.delete("/api/pulse/:id", (req, res) => {
  remove("pulseResponses", req.params.id);
  res.json({ ok: true });
});

// ─── AGENDA API ────────────────────────────────────────────────────────────────
app.get("/api/agendas", (req, res) => {
  res.json(getAll("agendas").sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt)));
});

app.post("/api/agendas/generate", async (req, res) => {
  const week = req.body.week || getWeekKey();
  const pulseResponses = getAll("pulseResponses").filter((r) => r.week === week);
  const goals = getAll("goals");

  try {
    const agenda = await generateAgenda({ pulseResponses, goals, weekKey: week });
    const saved = insert("agendas", {
      id: randomUUID(),
      week,
      ...agenda,
      generatedAt: new Date().toISOString(),
      status: "draft",
    });
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/agendas/:id", (req, res) => {
  const updated = update("agendas", req.params.id, { ...req.body, editedAt: new Date().toISOString() });
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

app.post("/api/agendas/:id/send", async (req, res) => {
  const agenda = getById("agendas", req.params.id);
  if (!agenda) return res.status(404).json({ error: "Not found" });

  const text = agenda.items
    .map((item) => `${item.order}. ${item.title} (${item.duration} min) — ${item.owner}`)
    .join("\n");

  const targets = ALL_MEMBERS.filter((m) => m.id !== "es");
  const results = [];
  for (const member of targets) {
    try {
      await sendSMS(member.phone, `📋 Ward Council Agenda — ${agenda.week}\n\n${text}\n\nSee you Sunday! 🙏`);
      results.push({ memberId: member.id, success: true });
    } catch (err) {
      results.push({ memberId: member.id, success: false, error: err.message });
    }
  }

  update("agendas", agenda.id, { status: "sent", sentAt: new Date().toISOString() });
  res.json({ sent: results.length, results });
});

app.delete("/api/agendas/:id", (req, res) => {
  remove("agendas", req.params.id);
  res.json({ ok: true });
});

// ─── GOALS API ─────────────────────────────────────────────────────────────────
app.get("/api/goals", (req, res) => {
  res.json(getAll("goals").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post("/api/goals", (req, res) => {
  const goal = insert("goals", {
    id: randomUUID(),
    title: req.body.title,
    description: req.body.description || "",
    orgs: req.body.orgs || [],
    status: "active",
    progress: req.body.progress || "Not started",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: [],
  });
  res.json(goal);
});

app.put("/api/goals/:id", (req, res) => {
  const updated = update("goals", req.params.id, { ...req.body, updatedAt: new Date().toISOString() });
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

app.post("/api/goals/:id/notes", (req, res) => {
  const goal = getById("goals", req.params.id);
  if (!goal) return res.status(404).json({ error: "Not found" });
  const note = { id: randomUUID(), text: req.body.text, addedAt: new Date().toISOString() };
  const updated = update("goals", goal.id, { notes: [...(goal.notes || []), note], updatedAt: new Date().toISOString() });
  res.json(updated);
});

app.delete("/api/goals/:id", (req, res) => {
  remove("goals", req.params.id);
  res.json({ ok: true });
});

app.post("/api/goals/suggest", async (req, res) => {
  const pulseResponses = getAll("pulseResponses");
  const existingGoals = getAll("goals");
  try {
    const suggestions = await suggestGoals({ pulseResponses, existingGoals });
    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── COUNCIL MEMBERS API ───────────────────────────────────────────────────────
app.get("/api/members", (req, res) => {
  const dbMembers = getAll("councilMembers");
  if (dbMembers.length > 0) return res.json(dbMembers);
  // Seed DB from static council.js on first run
  for (const m of ALL_MEMBERS) {
    insert("councilMembers", m);
  }
  res.json(ALL_MEMBERS);
});

app.post("/api/members", (req, res) => {
  const { name, role, phone, orgKey, org, orgColor } = req.body;
  if (!name || !orgKey) return res.status(400).json({ error: "name and orgKey required" });
  const member = insert("councilMembers", {
    id: randomUUID(),
    name, role, phone, orgKey,
    org: org || orgKey,
    orgColor: orgColor || "#888",
  });
  res.json(member);
});

app.put("/api/members/:id", (req, res) => {
  const updated = update("councilMembers", req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

app.delete("/api/members/:id", (req, res) => {
  remove("councilMembers", req.params.id);
  res.json({ ok: true });
});

// ─── DASHBOARD META API ────────────────────────────────────────────────────────
app.get("/api/week", (req, res) => res.json({ week: getWeekKey() }));
app.get("/api/sent-pulses", (req, res) => res.json(getAll("sentPulses")));

// ─── CRON: Send weekly pulse every Wednesday at 9am ───────────────────────────
cron.schedule("0 9 * * 3", async () => {
  console.log("[CRON] Sending weekly pulse...");
  const targets = ALL_MEMBERS.filter((m) => m.id !== "es");
  for (const member of targets) {
    try {
      await sendPulse(member);
      console.log(`  ✓ Sent to ${member.name}`);
    } catch (err) {
      console.error(`  ✗ Failed for ${member.name}: ${err.message}`);
    }
  }
  insert("sentPulses", {
    id: randomUUID(),
    week: getWeekKey(),
    sentAt: new Date().toISOString(),
    memberIds: targets.map((m) => m.id),
    auto: true,
  });
}, { timezone: "America/Denver" }); // Change to your timezone

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Ward Council server running on port ${PORT}`));
