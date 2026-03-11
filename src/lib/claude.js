import Anthropic from "@anthropic-ai/sdk";
import { ORGANIZATIONS } from "../data/council.js";

let client;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// Pick a random member from a list, excluding already-picked ones
function pickRandom(members, exclude = []) {
  const pool = members.filter(m => !exclude.includes(m.id));
  if (pool.length === 0) return members[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

// Build the three fixed opening/closing items with randomly assigned members
function buildFixedItems(members) {
  const assigned = [];

  const spiritualThoughtMember = pickRandom(members, []);
  assigned.push(spiritualThoughtMember.id);

  const openingPrayerMember = pickRandom(members, assigned);
  assigned.push(openingPrayerMember.id);

  const closingPrayerMember = pickRandom(members, assigned);

  return {
    openingPrayer: openingPrayerMember.name,
    spiritualThought: spiritualThoughtMember.name,
    closingPrayer: closingPrayerMember.name,
  };
}

export async function generateAgenda({ pulseResponses, goals, weekKey, members = [], minutesText = "" }) {
  const orgNames = Object.values(ORGANIZATIONS).map((o) => o.name).join(", ");

  // Format pulse responses for the prompt
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

  // Assign fixed roles randomly from the member list
  const memberList = members.length > 0 ? members : [];
  const fixed = memberList.length >= 3
    ? buildFixedItems(memberList)
    : { openingPrayer: "Council Member", spiritualThought: "Council Member", closingPrayer: "Council Member" };

  // Attendance context for the prompt
  const attendanceNote = `
## Attendance Notes:
- The Bishopric (Bishop, First Counselor, Second Counselor) and Executive Secretary attend every meeting.
- Other organizations will have their president present, or a counselor/secretary representing them if the president cannot attend.
- Pre-assigned roles for this meeting:
  - Opening Prayer: ${fixed.openingPrayer}
  - Spiritual Thought: ${fixed.spiritualThought}
  - Closing Prayer: ${fixed.closingPrayer}
`;

  const minutesSection = minutesText
    ? `## Previous Meeting Minutes (provided by Ward Clerk):\n${minutesText}\n\nNote: Include a "Minutes Review" agenda item (3 min) owned by the Ward Clerk to approve the previous minutes.`
    : `## Previous Meeting Minutes:\nNone provided for this week.`;

  const prompt = `You are an assistant helping an Executive Secretary prepare a Ward Council meeting agenda for a congregation of The Church of Jesus Christ of Latter-day Saints.

The Ward Council organizations are: ${orgNames}.

Ward Council meets for ONE HOUR, twice per month. Members are volunteers with limited time. The council should not just "go around the room" — instead, the agenda should prioritize collaborative opportunities, shared concerns, and meaningful discussion.

${attendanceNote}

${minutesSection}

## This Week's Pulse Responses (Week ${weekKey}):
${responseSummary || "No responses received yet."}

## Active Collaborative Goals:
${goalsSummary}

## Your Task:
Generate a structured Ward Council agenda. The first three items and last item are FIXED and must appear exactly as follows — do not change the owners or titles:

Item 1: Opening Prayer (1 min) — owner: "${fixed.openingPrayer}" — type: "opening"
Item 2: Spiritual Thought (3 min) — owner: "${fixed.spiritualThought}" — type: "opening" — notes: "Share a brief scripture or thought relevant to the council's work"
Item 3: Welcome & Agenda Review (2 min) — owner: "Bishop" — type: "opening"

Then add the main agenda body:
- Identify CROSS-ORGANIZATION THEMES where multiple orgs mentioned the same family, need, or opportunity. These are highest priority.
- Brief reports and action items per organization
- Collaboration opportunities
- Updates on active goals

Last item must always be:
Closing Prayer — owner: "${fixed.closingPrayer}" — type: "closing" — duration: 1 min

All items together must fit within 60 minutes total. Use plain language.

At the end add "AI INSIGHTS" with 2-3 observations about patterns across the responses.

Return only valid JSON in this exact shape:
{
  "title": "Ward Council Agenda — Week ${weekKey}",
  "totalMinutes": 60,
  "assignments": {
    "openingPrayer": "${fixed.openingPrayer}",
    "spiritualThought": "${fixed.spiritualThought}",
    "closingPrayer": "${fixed.closingPrayer}"
  },
  "crossOrgThemes": [{ "theme": "...", "orgsInvolved": [...], "summary": "..." }],
  "items": [
    {
      "order": 1,
      "title": "...",
      "duration": 1,
      "type": "opening|discussion|report|action|closing",
      "owner": "...",
      "notes": "...",
      "collaborationFlag": false
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
      assignments: fixed,
      crossOrgThemes: [],
      items: [
        { order: 1, title: "Opening Prayer", duration: 1, type: "opening", owner: fixed.openingPrayer, notes: "", collaborationFlag: false },
        { order: 2, title: "Spiritual Thought", duration: 3, type: "opening", owner: fixed.spiritualThought, notes: "Share a brief scripture or thought", collaborationFlag: false },
        { order: 3, title: "Welcome & Agenda Review", duration: 2, type: "opening", owner: "Bishop", notes: "", collaborationFlag: false },
        { order: 4, title: "Council Discussion", duration: 53, type: "discussion", owner: "Bishop", notes: text, collaborationFlag: false },
        { order: 5, title: "Closing Prayer", duration: 1, type: "closing", owner: fixed.closingPrayer, notes: "", collaborationFlag: false },
      ],
      insights: [],
    };
  }
}

export async function summarizeMemberResponse(raw) {
  const response = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `Summarize this Ward Council pulse response in 1-2 sentences, preserving the key facts. Be concise and factual.\n\nResponse: "${raw}"`,
    }],
  });
  return response.content[0]?.text || raw;
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
