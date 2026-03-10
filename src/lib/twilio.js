import twilio from "twilio";
import { PULSE_QUESTIONS } from "../data/council.js";

let client;
function getClient() {
  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

export async function sendSMS(to, body) {
  const c = getClient();
  return c.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER, to });
}

export async function sendPulse(member) {
  const greeting = `Hi ${member.name.split(" ")[0]}! It's time for your weekly Ward Council check-in (reply back to this number):\n\n`;
  const questions = PULSE_QUESTIONS.join("\n\n");
  const footer = `\n\nYou can reply all at once or separately. Thank you! 🙏`;
  return sendSMS(member.phone, greeting + questions + footer);
}

export async function sendAgenda(member, agendaText) {
  return sendSMS(member.phone, `📋 Ward Council Agenda\n\n${agendaText}\n\nSee you Sunday!`);
}

export function parsePulseResponse(body) {
  const result = { q1: null, q2: null, q3: null, raw: body };
  const lines = body.split(/\n+/).map((l) => l.trim()).filter(Boolean);

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
    const lower = body.toLowerCase();
    if (lower.includes("win") || lower.includes("good news") || lower.includes("update")) {
      result.q3 = body;
    } else {
      result.q1 = body;
    }
  }

  return result;
}