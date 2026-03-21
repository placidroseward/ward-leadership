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

export async function suggestMissionActions({ type, id, plan, pulseResponses = [], goals = [] }) {
  // Find the item being asked about
  let item = null;
  let context = "";

  if (type === "goal") {
    item = (plan.goals || []).find(g => g.id === id);
    context = `Key Goal: "${item?.title}" — ${item?.description}\nCurrent status: ${item?.status}\nExisting actions: ${(item?.actions || []).map(a => a.text).join(", ") || "none"}`;
  } else if (type === "org") {
    item = (plan.orgs || []).find(o => o.id === id);
    context = `Organization: "${item?.name}"\nObjective: ${item?.objective}\nCurrent status: ${item?.status}\nExisting actions: ${(item?.actions || []).map(a => a.text).join(", ") || "none"}`;
  }

  if (!item) return [];

  const recentPulse = pulseResponses.slice(-15).map(r =>
    `${r.org}: "${r.q1 || ""} ${r.q2 || ""} ${r.q3 || ""}"`
  ).join("\n");

  const activeGoals = goals.filter(g => g.status !== "completed")
    .map(g => g.title).join(", ") || "none";

  const prompt = `You are helping a Ward Council Executive Secretary brainstorm action items for a Ward Mission Plan for a congregation of The Church of Jesus Christ of Latter-day Saints.

## Item to improve:
${context}

## Overall mission plan primary goal:
${plan.primaryGoal || "Bring members and non-members closer to Jesus Christ"}

## Recent pulse responses from council members:
${recentPulse || "No recent responses"}

## Active collaborative goals:
${activeGoals}

## Task:
Suggest 3-4 specific, actionable items that would help move this ${type === "goal" ? "goal" : "organization's plan"} forward. Each suggestion should be:
- Concrete and doable within 1-4 weeks
- Relevant to the LDS ward context
- Different from the existing actions already listed
- Informed by what council members have been reporting

Return only a JSON array of strings, no other text:
["suggestion 1", "suggestion 2", "suggestion 3"]`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.map(b => b.text || "").join("");
  const clean = text.replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); } catch { return []; }
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

export async function generateBishopricAgenda({ pulseResponses, goals, weekKey, members = [], notesText = "", inboxItems = [] }) {
  function pickRandom(pool, exclude = []) {
    const avail = pool.filter(m => !exclude.includes(m.id));
    if (avail.length === 0) return pool[0];
    return avail[Math.floor(Math.random() * avail.length)];
  }

  const assigned = [];
  const spiritualThought = pickRandom(members, assigned);
  assigned.push(spiritualThought?.id);
  const openingPrayer = pickRandom(members, assigned);
  assigned.push(openingPrayer?.id);
  const closingPrayer = pickRandom(members, assigned);

  const fixed = {
    openingPrayer: openingPrayer?.name || "Bishopric Member",
    spiritualThought: spiritualThought?.name || "Bishopric Member",
    closingPrayer: closingPrayer?.name || "Bishopric Member",
  };

  const pulseSummary = pulseResponses.map(r => `${r.memberName}: "${r.raw}"`).join("\n") || "No responses yet.";
  const inboxSummary = inboxItems.map(i => `From ${i.fromName}: "${i.body}"`).join("\n") || "No items.";
  const notesSummary = notesText || "No notes provided.";

  const prompt = `You are helping an Executive Secretary prepare a Bishopric Meeting agenda for a congregation of The Church of Jesus Christ of Latter-day Saints.

Bishopric meetings are typically 60-90 minutes and include the Bishop, First Counselor, Second Counselor, Executive Secretary, and Ward Clerk.

## Pre-assigned roles:
- Opening Prayer: ${fixed.openingPrayer}
- Spiritual Thought: ${fixed.spiritualThought}  
- Closing Prayer: ${fixed.closingPrayer}

## Agenda items from SMS (this week):
${inboxSummary}

## Meeting notes / OneNote content:
${notesSummary}

## Member check-in responses:
${pulseSummary}

## Task:
Generate a structured Bishopric Meeting agenda. Standard items include:
- Interviews and personal ministry follow-ups
- Membership matters (new members, ordinances, callings, releases)
- Ward needs and welfare
- Coordination with organizations
- Calendar and upcoming events
- Any specific items from the SMS inbox above

First item must be Opening Prayer (${fixed.openingPrayer}), second Spiritual Thought (${fixed.spiritualThought}), last item Closing Prayer (${fixed.closingPrayer}).

Return only valid JSON:
{
  "title": "Bishopric Meeting — ${weekKey}",
  "totalMinutes": 75,
  "assignments": { "openingPrayer": "${fixed.openingPrayer}", "spiritualThought": "${fixed.spiritualThought}", "closingPrayer": "${fixed.closingPrayer}" },
  "items": [{ "order": 1, "title": "...", "duration": 5, "type": "opening|discussion|report|action|interview|closing", "owner": "...", "notes": "...", "collaborationFlag": false }],
  "insights": ["...", "..."]
}`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.map(b => b.text || "").join("");
  const clean = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    return {
      title: `Bishopric Meeting — ${weekKey}`,
      totalMinutes: 75,
      assignments: fixed,
      items: [
        { order: 1, title: "Opening Prayer", duration: 1, type: "opening", owner: fixed.openingPrayer, notes: "", collaborationFlag: false },
        { order: 2, title: "Spiritual Thought", duration: 5, type: "opening", owner: fixed.spiritualThought, notes: "", collaborationFlag: false },
        { order: 3, title: "Business", duration: 68, type: "discussion", owner: "Bishop", notes: text, collaborationFlag: false },
        { order: 4, title: "Closing Prayer", duration: 1, type: "closing", owner: fixed.closingPrayer, notes: "", collaborationFlag: false },
      ],
      insights: [],
    };
  }
}

export async function routeSMS({ body, fromName, currentWeek }) {
  const prompt = `You are an AI routing assistant for a church (LDS ward) dashboard. A bishopric member just sent a text message. Determine where this message should be routed.

Message from ${fromName}: "${body}"
Current week: ${currentWeek}

Routing options:
- "bishopric" = add to bishopric meeting agenda (default for most messages)
- "wardcouncil" = add to ward council agenda (only if message explicitly mentions ward council)

Also determine the target week if specified (e.g. "in two weeks", "next week", "week after next").

Return only valid JSON:
{ "destination": "bishopric" | "wardcouncil", "targetWeek": "${currentWeek}" | null, "reasoning": "brief explanation" }`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0]?.text || "{}";
  const clean = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    return { destination: "bishopric", targetWeek: currentWeek };
  }
}
