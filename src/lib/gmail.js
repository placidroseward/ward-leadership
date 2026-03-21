import { google } from "googleapis";
import { PULSE_QUESTIONS } from "../data/council.js";

// SMS gateway addresses by carrier
const CARRIER_GATEWAYS = {
  "verizon":   (n) => `${n}@vtext.com`,
  "att":       (n) => `${n}@txt.att.net`,
  "tmobile":   (n) => `${n}@tmomail.net`,
  "t-mobile":  (n) => `${n}@tmomail.net`,
  "sprint":    (n) => `${n}@messaging.sprintpcs.com`,
  "xfinity":   (n) => `${n}@vtext.com`,
  "boost":     (n) => `${n}@sms.myboostmobile.com`,
  "cricket":   (n) => `${n}@mms.cricketwireless.net`,
  "metro":     (n) => `${n}@mymetropcs.com`,
  "uscellular":(n) => `${n}@email.uscc.net`,
  "straighttalk":(n) => `${n}@vtext.com`,
};

export function getGatewayEmail(phone, carrier) {
  if (!phone || !carrier) return null;
  const digits = phone.replace(/\D/g, "").slice(-10);
  const key = carrier.toLowerCase().replace(/\s+/g, "");
  const fn = CARRIER_GATEWAYS[key];
  return fn ? fn(digits) : null;
}

let gmailClient = null;

function getGmailClient() {
  if (gmailClient) return gmailClient;
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  gmailClient = google.gmail({ version: "v1", auth: oauth2Client });
  return gmailClient;
}

function buildRawEmail(to, subject, body) {
  const from = process.env.GMAIL_ADDRESS;
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
  ].join("\n");
  return Buffer.from(message).toString("base64url");
}

export async function sendSMS(gatewayEmail, body, subject = "Ward Message") {
  if (!gatewayEmail) throw new Error("No gateway email address — check carrier setting for this member");
  const gmail = getGmailClient();
  const raw = buildRawEmail(gatewayEmail, subject, body);
  return gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}

export async function sendSMSChunked(gatewayEmail, body, subject = "Ward Message", chunkSize = 300) {
  if (!gatewayEmail) throw new Error("No gateway email address — check carrier setting for this member");

  // Split into lines, then group into chunks under chunkSize characters
  const lines = body.split("\n");
  const chunks = [];
  let current = "";

  for (const line of lines) {
    const candidate = current ? current + "\n" + line : line;
    if (candidate.length > chunkSize && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  const gmail = getGmailClient();
  for (let i = 0; i < chunks.length; i++) {
    const partLabel = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : "";
    const raw = buildRawEmail(gatewayEmail, subject + partLabel, chunks[i]);
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    // Small delay between messages to avoid rate limiting
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 500));
  }
}

export async function sendPulse(member) {
  const gatewayEmail = getGatewayEmail(member.phone, member.carrier);
  if (!gatewayEmail) {
    console.warn(`[GMAIL] No gateway for ${member.name} — missing carrier`);
    return;
  }
  const greeting = `Hi ${member.name.split(" ")[0]}! It's time for your weekly Ward Council check-in (reply back to this number):\n\n`;
  const questions = PULSE_QUESTIONS.join("\n\n");
  const footer = `\n\nYou can reply all at once or separately. Thank you! 🙏`;
  return sendSMS(gatewayEmail, greeting + questions + footer, "Ward Council Pulse");
}

export async function sendBishopricPulse(member) {
  const gatewayEmail = getGatewayEmail(member.phone, member.carrier);
  if (!gatewayEmail) {
    console.warn(`[GMAIL] No gateway for ${member.name} — missing carrier`);
    return;
  }
  const msg = `Hi ${member.name.split(" ")[0]}! Bishopric meeting is this Sunday. Please reply with any items you'd like added to the agenda.\n\nYou can also specify a future week, e.g. "Add to agenda in 2 weeks: [topic]"`;
  return sendSMS(gatewayEmail, msg, "Bishopric Agenda Items");
}

// Poll Gmail inbox for replies from council members
export async function pollInbox(sinceTimestamp) {
  const gmail = getGmailClient();
  const since = sinceTimestamp ? Math.floor(sinceTimestamp / 1000) : Math.floor(Date.now() / 1000) - 3600;

  const res = await gmail.users.messages.list({
    userId: "me",
    q: `after:${since} in:inbox`,
    maxResults: 50,
  });

  const messages = res.data.messages || [];
  const results = [];

  for (const msg of messages) {
    try {
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" });
      const headers = full.data.payload?.headers || [];
      const from = headers.find(h => h.name === "From")?.value || "";
      const subject = headers.find(h => h.name === "Subject")?.value || "";
      const date = headers.find(h => h.name === "Date")?.value || "";

      // Extract body
      let body = "";
      const parts = full.data.payload?.parts || [];
      if (parts.length > 0) {
        const textPart = parts.find(p => p.mimeType === "text/plain");
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, "base64").toString("utf8");
        }
      } else if (full.data.payload?.body?.data) {
        body = Buffer.from(full.data.payload.body.data, "base64").toString("utf8");
      }

      // Strip carrier reply footers and quoted text
      body = body.split(/^>|^On .+ wrote:/m)[0].trim();

      // Extract phone number from carrier gateway email
      const fromEmail = from.match(/[\w.+-]+@[\w.-]+/)?.[0] || "";
      const phoneMatch = fromEmail.match(/^(\d{10})@/);
      const phone = phoneMatch ? `+1${phoneMatch[1]}` : null;

      results.push({
        gmailId: msg.id,
        from: fromEmail,
        phone,
        subject,
        body,
        date: new Date(date).toISOString(),
      });
    } catch (err) {
      console.error("[GMAIL] Error reading message:", err.message);
    }
  }

  return results;
}

// Parse an inbound message body into structured pulse responses
export function parsePulseResponse(body) {
  const lower = body.toLowerCase();
  const result = { q1: null, q2: null, q3: null, raw: body };
  const lines = body.split(/\n+/).map(l => l.trim()).filter(Boolean);

  const numbered = {};
  let currentQ = null;
  for (const line of lines) {
    const match = line.match(/^([123])[.):\s]/);
    if (match) {
      currentQ = match[1];
      numbered[currentQ] = (numbered[currentQ] || "") + line.replace(/^[123][.):\s]/, "").trim();
    } else if (currentQ) {
      numbered[currentQ] += " " + line;
    }
  }

  if (numbered["1"]) result.q1 = numbered["1"].trim();
  if (numbered["2"]) result.q2 = numbered["2"].trim();
  if (numbered["3"]) result.q3 = numbered["3"].trim();

  if (!result.q1 && !result.q2 && !result.q3) {
    if (lower.includes("member") || lower.includes("help") || lower.includes("visit") || lower.includes("need")) {
      result.q1 = body;
    } else if (lower.includes("win") || lower.includes("good news") || lower.includes("update") || lower.includes("baptism")) {
      result.q3 = body;
    } else {
      result.q1 = body;
    }
  }

  return result;
}
