import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import { randomUUID, createHash } from "crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { getAll, insert, update, remove, getById, getWeekKey } from "./src/lib/storage.js";
import { sendPulse, sendBishopricPulse, sendToWardCouncil, sendToBishopric, parsePulseResponse, matchMember } from "./groupme.js";
import { generateAgenda, suggestGoals, suggestMissionActions, generateBishopricAgenda, routeSMS } from "./src/lib/claude.js";
import { ALL_MEMBERS, ORG_CATALOG } from "./src/data/council.js";

// Resolve an orgKey to its canonical { orgKey, org, orgColor } tuple.
// Falls back to empty strings if the key isn't in the catalog.
function resolveOrg(orgKey) {
  const hit = ORG_CATALOG.find(o => o.key === orgKey);
  if (!hit) return { orgKey: "", org: "", orgColor: "" };
  return { orgKey: hit.key, org: hit.name, orgColor: hit.color };
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists
const dataDir = join(__dirname, "data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

// One-shot migration: consolidate the legacy councilMembers collection into
// the users collection. Matches by phone; creates a placeholder user for any
// council member that has no matching user account. Runs on every startup
// but is idempotent — once councilMembers is empty, it does nothing.
try {
  const dbPath = join(__dirname, "data/db.json");
  let db = { pulseResponses: [], agendas: [], goals: [], sentPulses: [], councilMembers: [], minutes: [], users: [], missionPlan: [], bishopricAgendas: [], bishopricPulse: [], bishopricNotes: [], bishopricInbox: [], bishopricGoals: [], calendarEvents: [] };
  if (existsSync(dbPath)) {
    db = JSON.parse(readFileSync(dbPath, "utf8"));
  }
  if (!Array.isArray(db.users)) db.users = [];

  const legacy = Array.isArray(db.councilMembers) ? db.councilMembers : [];
  if (legacy.length > 0) {
    let merged = 0, created = 0;
    for (const m of legacy) {
      const orgInfo = resolveOrg(m.orgKey);
      const parts = (m.name || "").trim().split(/\s+/);
      const first = parts[0] || "Member";
      const last  = parts.slice(1).join(" ");

      // Match existing user by phone (canonical), then fall back to name.
      let user = m.phone ? db.users.find(u => u.phone && u.phone === m.phone) : null;
      if (!user) {
        user = db.users.find(u => {
          const full = [u.firstName, u.lastName].filter(Boolean).join(" ").toLowerCase();
          return full && full === (m.name || "").toLowerCase();
        });
      }

      if (user) {
        Object.assign(user, {
          phone: user.phone || m.phone || "",
          carrier: user.carrier || m.carrier || "",
          calling: user.calling || m.role || "",
          isWardCouncil: true,
          orgKey: orgInfo.orgKey, org: orgInfo.org, orgColor: orgInfo.orgColor,
        });
        merged++;
      } else {
        db.users.push({
          id: randomUUID(),
          firstName: first, lastName: last,
          // Placeholder email — admin can update in User Management before login.
          email: `placeholder-${(m.id || randomUUID()).toString().toLowerCase()}@placid-rose.local`,
          calling: m.role || "",
          phone: m.phone || "", carrier: m.carrier || "",
          role: "user",
          isWardCouncil: true,
          orgKey: orgInfo.orgKey, org: orgInfo.org, orgColor: orgInfo.orgColor,
          passwordHash: null, stayLoggedIn: false,
          createdAt: new Date().toISOString(),
        });
        created++;
      }
    }
    db.councilMembers = [];
    writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log(`[MIGRATE] Consolidated councilMembers → users (${merged} merged, ${created} created). councilMembers cleared.`);
  }
} catch (err) {
  console.error("[MIGRATE] Error:", err.message);
}

// Ward-council members are users where isWardCouncil === true. This is the
// single source of truth used by pulse routing, agenda generation, and the
// manual-pulse dropdown. Returned in the legacy member shape so callers that
// expect id/name/org/orgKey/orgColor/phone/carrier keep working unchanged.
function getMembers() {
  return getAll("users")
    .filter(u => u.isWardCouncil)
    .map(u => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email,
      role: u.calling || "",
      phone: u.phone || "",
      carrier: u.carrier || "",
      orgKey: u.orgKey || "",
      org: u.org || "",
      orgColor: u.orgColor || "#888",
    }));
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

// ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
function hashPassword(pw) {
  return createHash("sha256").update(pw + "wc-salt-2026").digest("hex");
}

function safeUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// Seed initial admin user (Executive Secretary) if no users exist.
// The seeded admin is also flagged as a Ward Council member so they land on
// the pulse/agenda roster by default.
try {
  const existing = getAll("users");
  if (existing.length === 0) {
    const adminOrg = resolveOrg("exec_secretary");
    insert("users", {
      id: "admin-es",
      firstName: "Tyler",
      lastName: "Peterson",
      email: "tyler@placidrose.org",
      calling: "Executive Secretary",
      phone: "+18013802475",
      role: "admin",
      isWardCouncil: true,
      orgKey: adminOrg.orgKey, org: adminOrg.org, orgColor: adminOrg.orgColor,
      passwordHash: null,
      stayLoggedIn: false,
      createdAt: new Date().toISOString(),
    });
    console.log("[INIT] Created initial admin user — update email in User Management");
  }
} catch (err) {
  console.error("[INIT] User seeding error:", err.message);
}

// Idempotent upgrade: ensure the Executive Secretary account (matched by the
// seeded phone number) is an admin and a Ward Council member, in case an
// older deploy created the record before these fields existed. Matches by
// phone so it works regardless of which email was used to sign up.
try {
  const EXEC_PHONE = "+18013802475";
  const existing = getAll("users").find(u => u.phone === EXEC_PHONE);
  if (existing) {
    const needsUpgrade =
      existing.role !== "admin" ||
      !existing.isWardCouncil ||
      existing.orgKey !== "exec_secretary";
    if (needsUpgrade) {
      const execOrg = resolveOrg("exec_secretary");
      update("users", existing.id, {
        role: "admin",
        isWardCouncil: true,
        orgKey: execOrg.orgKey, org: execOrg.org, orgColor: execOrg.orgColor,
      });
      console.log(`[INIT] Restored admin + ward-council rights for ${existing.email}`);
    }
  }
} catch (err) {
  console.error("[INIT] Admin restore error:", err.message);
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post("/api/auth/check", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  const users = getAll("users");
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(404).json({ error: "No account found for that email. Contact the Executive Secretary to be added." });
  res.json({
    user: safeUser(user),
    hasPassword: !!user.passwordHash,
    stayLoggedIn: user.stayLoggedIn,
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password, stayLoggedIn } = req.body;
  const users = getAll("users");
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(404).json({ error: "Account not found" });
  if (user.passwordHash !== hashPassword(password)) return res.status(401).json({ error: "Incorrect password" });
  const updated = update("users", user.id, { stayLoggedIn: !!stayLoggedIn });
  res.json({ user: safeUser(updated) });
});

app.post("/api/auth/set-password", (req, res) => {
  const { email, password, stayLoggedIn } = req.body;
  if (!password) return res.status(400).json({ error: "Password required" });
  const users = getAll("users");
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(404).json({ error: "Account not found" });
  if (user.passwordHash) return res.status(400).json({ error: "Password already set — use login" });
  const updated = update("users", user.id, { passwordHash: hashPassword(password), stayLoggedIn: !!stayLoggedIn });
  res.json({ user: safeUser(updated) });
});

// ─── USER MANAGEMENT API ──────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const userId = req.headers["x-user-id"];
  const users = getAll("users");
  const user = users.find(u => u.id === userId);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
}

app.get("/api/users", requireAdmin, (req, res) => {
  res.json(getAll("users").map(safeUser));
});

// Canonical list of ward-council organizations (for the User Management dropdown).
app.get("/api/orgs", (req, res) => {
  res.json(ORG_CATALOG);
});

app.post("/api/users", requireAdmin, (req, res) => {
  const { firstName, lastName, email, calling, phone, role, carrier,
          isWardCouncil, orgKey } = req.body;
  if (!email || !firstName) return res.status(400).json({ error: "First name and email required" });
  const existing = getAll("users").find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) return res.status(409).json({ error: "A user with that email already exists" });
  const orgInfo = isWardCouncil ? resolveOrg(orgKey) : { orgKey: "", org: "", orgColor: "" };
  const user = insert("users", {
    id: randomUUID(),
    firstName, lastName: lastName || "", email: email.toLowerCase(),
    calling: calling || "", phone: phone || "", carrier: carrier || "",
    role: ["admin", "bishopric"].includes(role) ? role : "user",
    isWardCouncil: !!isWardCouncil,
    orgKey: orgInfo.orgKey, org: orgInfo.org, orgColor: orgInfo.orgColor,
    passwordHash: null, stayLoggedIn: false,
    createdAt: new Date().toISOString(),
  });
  res.json(safeUser(user));
});

// NOTE: The legacy councilMembers↔users sync helpers were removed when the
// two collections were consolidated. The user record is now the single source
// of truth for ward-council membership (see getMembers above).

app.put("/api/users/:id", (req, res) => {
  const existing = getById("users", req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  const { passwordHash, ...allowed } = req.body;
  // When ward-council membership or org changes, derive org/orgColor from the
  // canonical catalog so UI-supplied values stay consistent.
  if ("isWardCouncil" in allowed || "orgKey" in allowed) {
    const willBeOnCouncil = "isWardCouncil" in allowed ? !!allowed.isWardCouncil : !!existing.isWardCouncil;
    const keyToResolve   = "orgKey" in allowed ? allowed.orgKey : existing.orgKey;
    const orgInfo = willBeOnCouncil ? resolveOrg(keyToResolve) : { orgKey: "", org: "", orgColor: "" };
    allowed.isWardCouncil = willBeOnCouncil;
    allowed.orgKey   = orgInfo.orgKey;
    allowed.org      = orgInfo.org;
    allowed.orgColor = orgInfo.orgColor;
  }
  const updated = update("users", req.params.id, allowed);
  res.json(safeUser(updated));
});

app.put("/api/users/:id/password", (req, res) => {
  const { current, next } = req.body;
  const user = getById("users", req.params.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  if (user.passwordHash && user.passwordHash !== hashPassword(current)) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  if (!next) return res.status(400).json({ error: "New password required" });
  update("users", user.id, { passwordHash: hashPassword(next) });
  res.json({ ok: true });
});

app.post("/api/users/:id/reset-password", requireAdmin, (req, res) => {
  const user = getById("users", req.params.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  update("users", user.id, { passwordHash: null });
  res.json({ ok: true });
});

app.delete("/api/users/:id", requireAdmin, (req, res) => {
  remove("users", req.params.id);
  res.json({ ok: true });
});

// ─── TWILIO WEBHOOK ───────────────────────────────────────────────────────────
// ─── GROUPME WEBHOOKS ─────────────────────────────────────────────────────────
// GroupMe calls these URLs when anyone posts in the group

app.post("/webhook/groupme/wardcouncil", async (req, res) => {
  res.sendStatus(200); // Respond immediately
  const { name, text, sender_type } = req.body;
  if (!text || sender_type === "bot") return; // Ignore bot's own messages

  const memberList = getMembers();
  const member = matchMember(name, memberList);
  const week = getWeekKey();
  const parsed = parsePulseResponse(text.trim());

  const existing = getAll("pulseResponses").find(
    r => r.memberId === (member?.id || name) && r.week === week
  );

  if (existing) {
    update("pulseResponses", existing.id, {
      q1: existing.q1 || parsed.q1,
      q2: existing.q2 || parsed.q2,
      q3: existing.q3 || parsed.q3,
      raw: existing.raw + "\n---\n" + text.trim(),
      updatedAt: new Date().toISOString(),
    });
  } else {
    insert("pulseResponses", {
      id: randomUUID(),
      memberId: member?.id || name,
      memberName: member?.name || name,
      org: member?.org || "Unknown",
      orgKey: member?.orgKey || "unknown",
      orgColor: member?.orgColor || "#888",
      week, q1: parsed.q1, q2: parsed.q2, q3: parsed.q3,
      raw: text.trim(), receivedAt: new Date().toISOString(),
    });
  }
  console.log(`[GROUPME] Ward Council response from ${member?.name || name}`);
});

app.post("/webhook/groupme/bishopric", async (req, res) => {
  res.sendStatus(200);
  const { name, text, sender_type } = req.body;
  if (!text || sender_type === "bot") return;

  const memberList = getMembers();
  const member = matchMember(name, memberList);
  const week = getWeekKey();

  // AI route bishopric messages
  try {
    const routingResult = await routeSMS({ body: text.trim(), fromName: member?.name || name, currentWeek: week });
    insert("bishopricInbox", {
      id: randomUUID(), body: text.trim(),
      fromName: member?.name || name,
      targetWeek: routingResult.targetWeek || week,
      receivedAt: new Date().toISOString(),
      routed: false,
      suggestedTarget: routingResult.destination,
    });
    console.log(`[GROUPME] Bishopric message from ${member?.name || name} routed to ${routingResult.destination}`);
  } catch (err) {
    console.error("[GROUPME ROUTING]", err.message);
    // Store unrouted so it shows in inbox
    insert("bishopricInbox", {
      id: randomUUID(), body: text.trim(),
      fromName: member?.name || name,
      targetWeek: week,
      receivedAt: new Date().toISOString(),
      routed: false,
    });
  }
});


// ─── PULSE API ─────────────────────────────────────────────────────────────────
app.get("/api/pulse", (req, res) => {
  const { week } = req.query;
  const all = getAll("pulseResponses");
  const responses = week ? all.filter((r) => r.week === week) : all;
  res.json(responses);
});

app.post("/api/pulse/send", async (req, res) => {
  const week = getWeekKey();
  try {
    await sendPulse();
    insert("sentPulses", {
      id: randomUUID(), week, sentAt: new Date().toISOString(), via: "groupme",
    });
    res.json({ sent: 1, total: 1, results: [{ memberName: "Ward Council Group", success: true, gatewayEmail: "GroupMe" }] });
  } catch (err) {
    console.error(`[GROUPME ERROR] ${err.message}`);
    res.json({ sent: 0, total: 1, results: [{ memberName: "Ward Council Group", success: false, error: err.message, gatewayEmail: "GroupMe" }] });
  }
});

app.post("/api/pulse/manual", (req, res) => {
  const { memberId, q1, q2, q3, raw } = req.body;
  const memberList = getMembers();
  const member = memberList.find((m) => m.id === memberId);
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
  const members = getMembers();

  // Fetch minutes if a URL or text was provided
  let minutesText = "";
  const minutesEntries = getAll("minutes").filter(m => m.week === week);
  if (minutesEntries.length > 0) {
    const latest = minutesEntries[minutesEntries.length - 1];
    if (latest.text) {
      minutesText = latest.text;
    } else if (latest.url) {
      try {
        const r = await fetch(latest.url);
        minutesText = await r.text();
        // Strip HTML tags if it came back as HTML
        minutesText = minutesText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000);
      } catch (err) {
        console.error("[MINUTES] Failed to fetch URL:", err.message);
        minutesText = `[Minutes URL provided but could not be fetched: ${latest.url}]`;
      }
    }
  }

  try {
    const agenda = await generateAgenda({ pulseResponses, goals, weekKey: week, members, minutesText });
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

  const a = agenda.assignments || {};
  const itemLines = (agenda.items || []).map(i => `${i.order}. ${i.title} (${i.duration} min) — ${i.owner}`);
  const msg = [
    `📋 Ward Council ${agenda.week}`,
    ``,
    a.openingPrayer    ? `Opening Prayer: ${a.openingPrayer}`    : null,
    a.spiritualThought ? `Spiritual Thought: ${a.spiritualThought}` : null,
    a.closingPrayer    ? `Closing Prayer: ${a.closingPrayer}`    : null,
    ``,
    ...itemLines,
  ].filter(s => s !== null).join("\n");

  try {
    await sendToWardCouncil(msg);
    update("agendas", agenda.id, { status: "sent", sentAt: new Date().toISOString() });
    res.json({ sent: 1, total: 1, results: [{ memberName: "Ward Council Group", success: true, gatewayEmail: "GroupMe" }] });
  } catch (err) {
    console.error(`[GROUPME ERROR] ${err.message}`);
    res.json({ sent: 0, total: 1, results: [{ memberName: "Ward Council Group", success: false, error: err.message, gatewayEmail: "GroupMe" }] });
  }
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

// ─── COUNCIL MEMBERS (read-only alias) ────────────────────────────────────────
// Ward council members are now managed entirely through the Users API — this
// endpoint stays for existing consumers (e.g., the manual-pulse dropdown) that
// just need to read the current roster.
app.get("/api/members", (req, res) => {
  res.json(getMembers());
});

// ─── BISHOPRIC API ────────────────────────────────────────────────────────────
// Bishopric participants for agenda assignments are drawn from users whose
// role === "bishopric". Returned in the {id, name} shape the agenda generator
// expects.
function getBishopricMembers() {
  return getAll("users")
    .filter(u => u.role === "bishopric")
    .map(u => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email,
    }));
}

app.get("/api/bishopric/agendas", (req, res) => {
  res.json(getAll("bishopricAgendas").sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt)));
});

app.post("/api/bishopric/agendas/generate", async (req, res) => {
  const week = req.body.week || getWeekKey();
  const bishopricMembers = getBishopricMembers();
  const pulseResponses = getAll("bishopricPulse").filter(r => r.week === week);
  const goals = getAll("bishopricGoals");
  const inboxItems = getAll("bishopricInbox").filter(i => !i.routed && (i.targetWeek === week || !i.targetWeek));

  // Fetch notes
  let notesText = "";
  const notes = getAll("bishopricNotes").filter(n => n.week === week);
  if (notes.length > 0) {
    const latest = notes[notes.length - 1];
    if (latest.text) notesText = latest.text;
    else if (latest.url) {
      try {
        const r = await fetch(latest.url);
        notesText = (await r.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000);
      } catch { notesText = `[Notes URL provided but could not be fetched]`; }
    }
  }

  try {
    const agenda = await generateBishopricAgenda({ pulseResponses, goals, weekKey: week, members: bishopricMembers, notesText, inboxItems });
    const saved = insert("bishopricAgendas", {
      id: randomUUID(), week, ...agenda,
      generatedAt: new Date().toISOString(), status: "draft",
    });
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/bishopric/agendas/:id", (req, res) => {
  const updated = update("bishopricAgendas", req.params.id, { ...req.body, editedAt: new Date().toISOString() });
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

app.post("/api/bishopric/agendas/:id/send", async (req, res) => {
  const agenda = getById("bishopricAgendas", req.params.id);
  if (!agenda) return res.status(404).json({ error: "Not found" });

  const a = agenda.assignments || {};
  const itemLines = (agenda.items || []).map(i => `${i.order}. ${i.title} (${i.duration} min) — ${i.owner}`);
  const msg = [
    `📋 Bishopric Meeting ${agenda.week}`,
    ``,
    a.openingPrayer    ? `Opening Prayer: ${a.openingPrayer}`    : null,
    a.spiritualThought ? `Spiritual Thought: ${a.spiritualThought}` : null,
    a.closingPrayer    ? `Closing Prayer: ${a.closingPrayer}`    : null,
    ``,
    ...itemLines,
  ].filter(s => s !== null).join("\n");

  try {
    await sendToBishopric(msg);
    update("bishopricAgendas", agenda.id, { status: "sent", sentAt: new Date().toISOString() });
    res.json({ sent: 1, total: 1, results: [{ memberName: "Bishopric Group", success: true, gatewayEmail: "GroupMe" }] });
  } catch (err) {
    console.error(`[GROUPME ERROR] ${err.message}`);
    res.json({ sent: 0, total: 1, results: [{ memberName: "Bishopric Group", success: false, error: err.message, gatewayEmail: "GroupMe" }] });
  }
});

app.delete("/api/bishopric/agendas/:id", (req, res) => {
  remove("bishopricAgendas", req.params.id);
  res.json({ ok: true });
});

// Bishopric notes
app.get("/api/bishopric/notes", (req, res) => {
  const { week } = req.query;
  const all = getAll("bishopricNotes");
  res.json(week ? all.filter(n => n.week === week) : all);
});

app.post("/api/bishopric/notes", (req, res) => {
  const { week, url, text } = req.body;
  if (!week || (!url && !text)) return res.status(400).json({ error: "week and url or text required" });
  const existing = getAll("bishopricNotes").find(n => n.week === week);
  if (existing) return res.json(update("bishopricNotes", existing.id, { url: url || null, text: text || null, updatedAt: new Date().toISOString() }));
  res.json(insert("bishopricNotes", { id: randomUUID(), week, url: url || null, text: text || null, addedAt: new Date().toISOString() }));
});

// Bishopric pulse
app.get("/api/bishopric/pulse", (req, res) => {
  const { week } = req.query;
  const all = getAll("bishopricPulse");
  res.json(week ? all.filter(r => r.week === week) : all);
});

// Bishopric inbox (routed SMS items)
app.get("/api/bishopric/inbox", (req, res) => {
  res.json(getAll("bishopricInbox").filter(i => !i.routed));
});

app.post("/api/bishopric/inbox/:id/route", (req, res) => {
  const { target } = req.body;
  const item = getById("bishopricInbox", req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  update("bishopricInbox", item.id, { routed: true, routedTo: target, routedAt: new Date().toISOString() });

  // Add as agenda item to target
  if (target === "bishopric") {
    const week = item.targetWeek || getWeekKey();
    const agendas = getAll("bishopricAgendas").filter(a => a.week === week);
    if (agendas.length > 0) {
      const agenda = agendas[0];
      const maxOrder = Math.max(0, ...(agenda.items || []).map(i => i.order));
      const items = [...(agenda.items || []), { order: maxOrder + 1, title: item.body.slice(0, 60), duration: 5, type: "discussion", owner: item.fromName, notes: item.body, fromText: true, collaborationFlag: false }];
      update("bishopricAgendas", agenda.id, { items });
    }
  } else if (target === "wardcouncil") {
    const week = getWeekKey();
    const agendas = getAll("agendas").filter(a => a.week === week);
    if (agendas.length > 0) {
      const agenda = agendas[0];
      const maxOrder = Math.max(0, ...(agenda.items || []).map(i => i.order));
      const items = [...(agenda.items || []), { order: maxOrder + 1, title: item.body.slice(0, 60), duration: 5, type: "discussion", owner: item.fromName, notes: item.body, fromText: true, collaborationFlag: false }];
      update("agendas", agenda.id, { items });
    }
  }
  res.json({ ok: true });
});

// ─── CALENDAR API ─────────────────────────────────────────────────────────────
app.get("/api/calendar/debug", async (req, res) => {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const serviceKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!calendarId) return res.json({ error: "GOOGLE_CALENDAR_ID not set" });
  if (!serviceKey) return res.json({ error: "GOOGLE_SERVICE_ACCOUNT_KEY not set" });
  try {
    const key = JSON.parse(serviceKey);
    res.json({ calendarId, serviceAccountEmail: key.client_email, keyType: key.type, ok: true });
  } catch (err) {
    res.json({ error: "Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY: " + err.message });
  }
});

app.get("/api/calendar/events", async (req, res) => {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const serviceKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!calendarId || !serviceKey) {
    return res.json(getAll("calendarEvents"));
  }

  try {
    const { google } = await import("googleapis");
    const key = JSON.parse(serviceKey);
    const auth = new google.auth.GoogleAuth({ credentials: key, scopes: ["https://www.googleapis.com/auth/calendar"] });
    const calendar = google.calendar({ version: "v3", auth });
    const now = new Date();
    const response = await calendar.events.list({
      calendarId,
      timeMin: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      timeMax: new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 500,
    });
    const events = (response.data.items || []).map(ev => ({
      id: ev.id,
      title: ev.summary || "Untitled",
      start: ev.start?.dateTime || ev.start?.date,
      end: ev.end?.dateTime || ev.end?.date,
      location: ev.location || "",
      description: ev.description || "",
      color: "#C9A84C",
    }));
    res.json(events);
  } catch (err) {
    console.error("[CALENDAR]", err.message);
    res.json({ error: err.message, events: [] });
  }
});

app.post("/api/calendar/events", async (req, res) => {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const serviceKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!calendarId || !serviceKey) {
    const ev = insert("calendarEvents", { id: randomUUID(), ...req.body, createdAt: new Date().toISOString() });
    return res.json(ev);
  }

  try {
    const { google } = await import("googleapis");
    const key = JSON.parse(serviceKey);
    const auth = new google.auth.GoogleAuth({ credentials: key, scopes: ["https://www.googleapis.com/auth/calendar"] });
    const calendar = google.calendar({ version: "v3", auth });
    const { title, start, end, location, description } = req.body;
    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: title,
        location, description,
        start: { dateTime: start },
        end: { dateTime: end || start },
      },
    });
    res.json({ id: response.data.id, title, start, end, location, description });
  } catch (err) {
    console.error("[CALENDAR]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/calendar/events/:id", async (req, res) => {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const serviceKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!calendarId || !serviceKey) {
    const updated = update("calendarEvents", req.params.id, req.body);
    return res.json(updated);
  }

  try {
    const { google } = await import("googleapis");
    const key = JSON.parse(serviceKey);
    const auth = new google.auth.GoogleAuth({ credentials: key, scopes: ["https://www.googleapis.com/auth/calendar"] });
    const calendar = google.calendar({ version: "v3", auth });
    const { title, start, end, location, description } = req.body;
    await calendar.events.update({
      calendarId, eventId: req.params.id,
      requestBody: {
        summary: title, location, description,
        start: { dateTime: start },
        end: { dateTime: end || start },
      },
    });
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
    console.error("[CALENDAR]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/calendar/events/:id", async (req, res) => {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const serviceKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!calendarId || !serviceKey) {
    remove("calendarEvents", req.params.id);
    return res.json({ ok: true });
  }

  try {
    const { google } = await import("googleapis");
    const key = JSON.parse(serviceKey);
    const auth = new google.auth.GoogleAuth({ credentials: key, scopes: ["https://www.googleapis.com/auth/calendar"] });
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.delete({ calendarId, eventId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error("[CALENDAR]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── MISSION PLAN API ─────────────────────────────────────────────────────────
app.get("/api/mission-plan", (req, res) => {
  const plans = getAll("missionPlan");
  res.json(plans.length > 0 ? plans[0] : {});
});

app.put("/api/mission-plan", (req, res) => {
  const plans = getAll("missionPlan");
  if (plans.length > 0) {
    const updated = update("missionPlan", plans[0].id, { ...req.body, updatedAt: new Date().toISOString() });
    return res.json(updated);
  }
  const created = insert("missionPlan", { ...req.body, id: randomUUID(), createdAt: new Date().toISOString() });
  res.json(created);
});

app.post("/api/mission-plan/suggest", async (req, res) => {
  const { type, id, plan } = req.body;
  try {
    const suggestions = await suggestMissionActions({ type, id, plan, pulseResponses: getAll("pulseResponses"), goals: getAll("goals") });
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MINUTES API ──────────────────────────────────────────────────────────────
app.get("/api/minutes", (req, res) => {
  const { week } = req.query;
  const all = getAll("minutes");
  res.json(week ? all.filter(m => m.week === week) : all);
});

app.post("/api/minutes", (req, res) => {
  const { week, url, text } = req.body;
  if (!week || (!url && !text)) return res.status(400).json({ error: "week and either url or text required" });
  // Replace any existing entry for this week
  const existing = getAll("minutes").find(m => m.week === week);
  if (existing) {
    const updated = update("minutes", existing.id, { url: url || null, text: text || null, updatedAt: new Date().toISOString() });
    return res.json(updated);
  }
  const entry = insert("minutes", {
    id: randomUUID(),
    week,
    url: url || null,
    text: text || null,
    addedAt: new Date().toISOString(),
  });
  res.json(entry);
});

app.delete("/api/minutes/:id", (req, res) => {
  remove("minutes", req.params.id);
  res.json({ ok: true });
});

// ─── DASHBOARD META API ────────────────────────────────────────────────────────
app.get("/api/week", (req, res) => res.json({ week: getWeekKey() }));
app.get("/api/sent-pulses", (req, res) => res.json(getAll("sentPulses")));

// ─── CRON: Send weekly pulse every Wednesday at 9am ───────────────────────────
cron.schedule("0 9 * * 3", async () => {
  console.log("[CRON] Sending weekly pulse to Ward Council group...");
  try {
    await sendPulse();
    insert("sentPulses", {
      id: randomUUID(), week: getWeekKey(),
      sentAt: new Date().toISOString(), via: "groupme", auto: true,
    });
    console.log("[CRON] Ward Council pulse sent");
  } catch (err) {
    console.error(`[CRON] Pulse failed: ${err.message}`);
  }
}, { timezone: "America/Denver" });

// ─── CRON: Bishopric pulse every Thursday at 9am ──────────────────────────────
cron.schedule("0 9 * * 4", async () => {
  console.log("[CRON] Sending bishopric pulse...");
  try {
    await sendBishopricPulse();
    console.log("[CRON] Bishopric pulse sent");
  } catch (err) {
    console.error(`[CRON] Bishopric pulse failed: ${err.message}`);
  }
}, { timezone: "America/Denver" });

// ─── CRON: Send bishopric agenda every Saturday at 8am ───────────────────────
cron.schedule("0 8 * * 6", async () => {
  console.log("[CRON] Sending bishopric agenda...");
  const week = getWeekKey();
  const agendas = getAll("bishopricAgendas").filter(a => a.week === week && a.status === "draft");
  if (agendas.length === 0) { console.log("[CRON] No draft bishopric agenda for this week"); return; }
  const agenda = agendas[0];
  const a = agenda.assignments || {};
  const itemLines = (agenda.items || []).map(i => `${i.order}. ${i.title} (${i.duration} min) — ${i.owner}`);
  const msg = [
    `📋 Bishopric Meeting ${agenda.week}`,
    ``,
    a.openingPrayer    ? `Opening Prayer: ${a.openingPrayer}`    : null,
    a.spiritualThought ? `Spiritual Thought: ${a.spiritualThought}` : null,
    a.closingPrayer    ? `Closing Prayer: ${a.closingPrayer}`    : null,
    ``,
    ...itemLines,
  ].filter(s => s !== null).join("\n");
  try {
    await sendToBishopric(msg);
    update("bishopricAgendas", agenda.id, { status: "sent", sentAt: new Date().toISOString() });
    console.log("[CRON] Bishopric agenda sent");
  } catch (err) {
    console.error(`[CRON] Bishopric agenda failed: ${err.message}`);
  }
}, { timezone: "America/Denver" });

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Ward Council server running on port ${PORT}`));
