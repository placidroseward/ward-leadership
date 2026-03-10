import Anthropic from "@anthropic-ai/sdk";
import { ORGANIZATIONS } from "../data/council.js";

let client;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export async function generateAgenda({ pulseResponses, goals, weekKey }) {
  const orgNames = Object.values(ORGANIZATIONS).map((o) => o.name).join(", ");

  const responseSummary = pulseResponses.map((r) => `
**${r.memberName} (${r.org})**
- Members needing help: ${r.q1 || "Nothing reported"}
- Needs other orgs could help with: ${r.q2 || "Nothing reported"}
- Wins/Updates: ${r.q3 || "Nothing reported"}
`).join("\n");

  const activeGoals = goals.filter((g) => g.status !== "completed");
  const goalsSummary = activeGoals.length > 0
    ? activeGoals.map((g) => `- ${g.title} (${g.orgs.join(", ")}): ${g.progress}`).join("\n")
    : "No active collaborative goals yet.";

  const prompt = `You are an assistant helping an Executive Secretary prepare a Ward Council meeting agenda for a congregation of The Church of Jesus Christ of Latter-day Saints.

The Ward Council organizations are: ${orgNames}.

Ward Council meets for ONE HOUR, twice per month. Members are volunteers with limited time. The agenda should prioritize collaborative opportunities, shared concerns, and meaningful discussion rather than just going around the room.

## This Week's Pulse Responses (Week ${weekKey}):
${responseSummary || "No responses received yet."}

## Active Collaborative Goals:
${goalsSummary}

## Your Task:
Generate a structured Ward Council agenda that:
1. Opens with a brief spiritual thought (2 min)
2. Identifies CROSS-ORGANIZATION THEMES where multiple orgs mentioned the same family, need, or opportunity
3. Lists specific action items per organization (brief)
4. Highlights collaboration opportunities where orgs can help each other
5. Updates on active collaborative goals
6. Closes with assignments and next steps

Format the agenda to fit within 60 minutes total. Use plain language.

At the end, add "AI INSIGHTS" with 2-3 observations about patterns across the responses.

Return only valid JSON in this shape:
{
  "title": "Ward Council Agenda — [week]",
  "totalMinutes": 60,
  "crossOrgThemes": [{ "theme": "...", "orgsInvolved": [...], "summary": "..." }],
  "items": [
    {
      "order": 1,
      "title": "...",
      "duration": 5,
      "type": "opening|discussion|report|action|closing",
      "owner": "...",
      "notes": "...",
      "collaborationFlag": true
    }
  ],
  "insights": ["...", "...", "..."]
}`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.map((b) => b.text || "").join("");
  const clean = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch {
    return {
      title: `Ward Council Agenda — Week ${weekKey}`,
      totalMinutes: 60,
      crossOrgThemes: [],
      items: [{ order: 1, title: "Review agenda", duration: 60, type: "discussion", owner: "Bishop", notes: text, collaborationFlag: false }],
      insights: [],
    };
  }
}

export async function suggestGoals({ pulseResponses, existingGoals }) {
  const responseSummary = pulseResponses.slice(-20).map((r) =>
    `${r.org}: Q1="${r.q1 || ""}" Q2="${r.q2 || ""}" Q3="${r.q3 || ""}"`
  ).join("\n");

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `Based on recent Ward Council pulse responses, suggest 2-3 collaborative goals that multiple organizations could work on together.

Recent responses:
${responseSummary}

Existing goals (avoid duplicates):
${existingGoals.map((g) => g.title).join(", ") || "None"}

Return only a valid JSON array:
[{ "title": "...", "description": "...", "orgs": ["org1", "org2"], "why": "why this came up in the data" }]`,
    }],
  });

  const text = response.content[0]?.text || "[]";
  const clean = text.replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); } catch { return []; }
}