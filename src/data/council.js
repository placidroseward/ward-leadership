// Council member roster — edit this file to match your actual ward council
export const ORGANIZATIONS = {
  bishopric: {
    name: "Bishopric",
    color: "#C9A84C",
    members: [
      { id: "bishop", name: "Nathan Banks", role: "Bishop", phone: "+18014557980", carrier: "xfinity" },
      { id: "fc", name: "Dave Wells", role: "First Counselor", phone: "+18015187476", carrier: "" },
      { id: "sc", name: "Jorge Mohor", role: "Second Counselor", phone: "+13852232900", carrier: "" },
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
      { id: "ywp", name: "Kristal James", role: "YW President", phone: "+18018425904", carrier: "xfinity" },
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
      { id: "es", name: "Tyler Peterson", role: "Executive Secretary", phone: "+18013802475", carrier: "verizon" },
    ],
  },
  ward_clerk: {
    name: "Ward Clerk",
    color: "#6B7E9E",
    members: [
      { id: "wc", name: "Ward Clerk", role: "Ward Clerk", phone: "+1xxxxxxxxxx", carrier: "" },
    ],
  },
};

// Flat list of all council members
export const ALL_MEMBERS = Object.values(ORGANIZATIONS).flatMap((org) =>
  org.members.map((m) => ({ ...m, org: org.name, orgKey: Object.keys(ORGANIZATIONS).find(k => ORGANIZATIONS[k] === org), orgColor: org.color }))
);

// Catalog of ward-council organizations — used by the User Management UI as
// the dropdown source when marking a user as a Member of Ward Council. Every
// flagged user should have exactly one org from this list.
export const ORG_CATALOG = Object.entries(ORGANIZATIONS).map(([key, o]) => ({
  key,
  name: o.name,
  color: o.color,
}));

// The three pulse questions sent every Wednesday
export const PULSE_QUESTIONS = [
  "1️⃣ Are there any members in your organization who need help, a visit, or special attention this week?",
  "2️⃣ Does your organization have any needs that another organization could help with?",
  "3️⃣ Any wins, updates, or good news to share from your organization?",
];
