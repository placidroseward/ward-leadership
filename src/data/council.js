export const ORGANIZATIONS = {
  bishopric: {
    name: "Bishopric",
    color: "#C9A84C",
    members: [
      { id: "bishop", name: "Banks", role: "Bishop", phone: "+18014557980" },
      { id: "fc", name: "Dave Wells", role: "First Counselor", phone: "+18015187476" },
      { id: "sc", name: "Jorge Mohor", role: "Second Counselor", phone: "+13852232900" },
    ],
  },
  relief_society: {
    name: "Relief Society",
    color: "#7C9E87",
    members: [
      { id: "rsp", name: "Kristen Schneyder", role: "Relief Society President", phone: "+18018597993" },
    ],
  },
  elders_quorum: {
    name: "Elders Quorum",
    color: "#5B7FA6",
    members: [
      { id: "eqp", name: "Dave Matthews", role: "Elders Quorum President", phone: "+18018574588" },
    ],
  },
  young_women: {
    name: "Young Women",
    color: "#A07CB5",
    members: [
      { id: "ywp", name: "Kristal James", role: "Young Women President", phone: "+18018425904" },
    ],
  },
  primary: {
    name: "Primary",
    color: "#C97B5A",
    members: [
      { id: "pp", name: "Monica Shaheen", role: "Primary President", phone: "+14356684011" },
    ],
  },
  sunday_school: {
    name: "Sunday School",
    color: "#6B9E9E",
    members: [
      { id: "ssp", name: "Gary Dustin", role: "Sunday School President", phone: "+13853491923" },
    ],
  },
  ward_mission: {
    name: "Ward Mission",
    color: "#9E7B6B",
    members: [
      { id: "wml", name: "Mark Larsen", role: "Ward Mission Leader", phone: "+13852242809" },
    ],
  },
  exec_secretary: {
    name: "Executive Secretary",
    color: "#888888",
    members: [
      { id: "es", name: "Tyler Peterson", role: "Executive Secretary", phone: "+18013802475" },
    ],
  },
};

export const ALL_MEMBERS = Object.entries(ORGANIZATIONS).flatMap(([orgKey, org]) =>
  org.members.map((m) => ({ ...m, org: org.name, orgKey, orgColor: org.color }))
);

export const PULSE_QUESTIONS = [
  "1️⃣ Are there any members in your organization who need help, a visit, or special attention this week?",
  "2️⃣ Does your organization have any needs that another organization could help with?",
  "3️⃣ Any wins, updates, or good news to share from your organization?",
];