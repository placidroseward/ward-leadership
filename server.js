import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import { randomUUID } from "crypto";
import { mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { getAll, insert, update, remove, getById, getWeekKey } from "./src/lib/storage.js";
import { sendPulse, parsePulseResponse, sendSMS } from "./src/lib/twilio.js";
import { generateAgenda, suggestGoals } from "./src/lib/claude.js";
import { ALL_MEMBERS } from "./src/data/council.js";
import { mkdirSync, existsSync, readFileSync, copyFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));



// Ensure data directory exists
const dataDir = join(__dirname, "data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

// If volume is empty, seed from repo's default db.json
const VOLUME_DB = join(__dirname, "data/db.json");
const REPO_DB = join(__dirname, "data/db.default.json");
if (existsSync(REPO_DB) && (!existsSync(VOLUME_DB) || JSON.parse(readFileSync(VOLUME_DB, "utf8")).councilMembers?.length === 0)) {
  copyFileSync(REPO_DB, VOLUME_DB);
  console.log("[INIT] Seeded db.json from default");
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── Serve built frontend in production ───────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  app.use(express.static(join(__dirname, "dist")));
}

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

// ─── DASHBOARD META API ────────────────────────────────────────────────────────
app.get("/api/members", (req, res) => res.json(ALL_MEMBERS));
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
