// Council member roster — edit this file to match your actual ward council
export const ORGANIZATIONS = {
  bishopric: {
    name: "Bishopric",
    color: "#C9A84C",
    members: [
      { id: "bishop", name: "Bishop", role: "Bishop", phone: "+1xxxxxxxxxx" },
      { id: "fc", name: "First Counselor", role: "First Counselor", phone: "+1xxxxxxxxxx" },
      { id: "sc", name: "Second Counselor", role: "Second Counselor", phone: "+1xxxxxxxxxx" },
    ],
  },
  relief_society: {
    name: "Relief Society",
    color: "#7C9E87",
    members: [
      { id: "rsp", name: "RS President", role: "Relief Society President", phone: "+1xxxxxxxxxx" },
    ],
  },
  elders_quorum: {
    name: "Elders Quorum",
    color: "#5B7FA6",
    members: [
      { id: "eqp", name: "EQ President", role: "Elders Quorum President", phone: "+1xxxxxxxxxx" },
    ],
  },
  young_women: {
    name: "Young Women",
    color: "#A07CB5",
    members: [
      { id: "ywp", name: "YW President", role: "Young Women President", phone: "+1xxxxxxxxxx" },
    ],
  },
  primary: {
    name: "Primary",
    color: "#C97B5A",
    members: [
      { id: "pp", name: "Primary President", role: "Primary President", phone: "+1xxxxxxxxxx" },
    ],
  },
  sunday_school: {
    name: "Sunday School",
    color: "#6B9E9E",
    members: [
      { id: "ssp", name: "SS President", role: "Sunday School President", phone: "+1xxxxxxxxxx" },
    ],
  },
  ward_mission: {
    name: "Ward Mission",
    color: "#9E7B6B",
    members: [
      { id: "wml", name: "Ward Mission Leader", role: "Ward Mission Leader", phone: "+1xxxxxxxxxx" },
    ],
  },
  exec_secretary: {
    name: "Executive Secretary",
    color: "#888888",
    members: [
      { id: "es", name: "Executive Secretary", role: "Executive Secretary (You)", phone: "+1xxxxxxxxxx" },
    ],
  },
  ward_clerk: {
    name: "Ward Clerk",
    color: "#6B7E9E",
    members: [
      { id: "wc", name: "Ward Clerk", role: "Ward Clerk", phone: "+1xxxxxxxxxx" },
    ],
  },
};

// Flat list of all council members
export const ALL_MEMBERS = Object.values(ORGANIZATIONS).flatMap((org) =>
  org.members.map((m) => ({ ...m, org: org.name, orgKey: Object.keys(ORGANIZATIONS).find(k => ORGANIZATIONS[k] === org), orgColor: org.color }))
);

// The three pulse questions sent every Wednesday
export const PULSE_QUESTIONS = [
  "1️⃣ Are there any members in your organization who need help, a visit, or special attention this week?",
  "2️⃣ Does your organization have any needs that another organization could help with?",
  "3️⃣ Any wins, updates, or good news to share from your organization?",
];
