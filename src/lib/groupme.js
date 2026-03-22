import { PULSE_QUESTIONS } from "./src/data/council.js";

const GROUPME_API = "https://api.groupme.com/v3";

async function botPost(botId, text) {
  const res = await fetch(`${GROUPME_API}/bots/post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_id: botId, text }),
  });
  if (!res.ok) throw new Error(`GroupMe API error: ${res.status} ${await res.text()}`);
  return res;
}

export async function sendToWardCouncil(text) {
  const botId = process.env.GROUPME_WARDCOUNCIL_BOT_ID;
  if (!botId) throw new Error("GROUPME_WARDCOUNCIL_BOT_ID not set");
  return botPost(botId, text);
}

export async function sendToBishopric(text) {
  const botId = process.env.GROUPME_BISHOPRIC_BOT_ID;
  if (!botId) throw new Error("GROUPME_BISHOPRIC_BOT_ID not set");
  return botPost(botId, text);
}

export async function sendPulse(members) {
  const greeting = `👋 Time for the weekly Ward Council check-in!\n\nPlease reply with your updates:\n\n`;
  const questions = PULSE_QUESTIONS.join("\n\n");
  const footer = `\n\nYou can reply all at once or separately. Thank you! 🙏`;
  return sendToWardCouncil(greeting + questions + footer);
}

export async function sendBishopricPulse() {
  const msg = `👋 Bishopric meeting is this Sunday!\n\nPlease reply with any items you'd like added to the agenda.\n\nYou can specify a future week too, e.g. "Add to agenda in 2 weeks: [topic]" 🙏`;
  return sendToBishopric(msg);
}

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

// Match a GroupMe sender name to a council member
export function matchMember(senderName, memberList) {
  if (!senderName) return null;
  const lower = senderName.toLowerCase();
  return memberList.find(m => {
    const name = (m.name || "").toLowerCase();
    const parts = name.split(" ");
    return name === lower ||
      parts[0] === lower ||
      parts[parts.length - 1] === lower ||
      lower.includes(parts[0]) ||
      lower.includes(parts[parts.length - 1]);
  }) || null;
}
