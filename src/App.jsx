import { useState, useEffect } from "react";
import PulseManager from "./components/PulseManager.jsx";
import AgendaBuilder from "./components/AgendaBuilder.jsx";
import GoalsTracker from "./components/GoalsTracker.jsx";
import UserProfile from "./components/UserProfile.jsx";
import UserManager from "./components/UserManager.jsx";
import Login from "./components/Login.jsx";
import MissionPlan from "./components/MissionPlan.jsx";
import BishopricAgendaBuilder from "./components/BishopricAgendaBuilder.jsx";
import SacramentProgram from "./components/SacramentProgram.jsx";
import WardCalendar from "./components/WardCalendar.jsx";

const API = import.meta.env.VITE_API_URL || "";

// Top nav. Entries with `councilOnly` are shown only to Ward Council members
// (and admins). `restricted` is the Bishopric-only flag.
const TOP_NAV = [
  { id: "wardcouncil", label: "Ward Council",  icon: "◈", councilOnly: true },
  { id: "mission",    label: "Mission Plan",  icon: "✦", councilOnly: true },
  { id: "bishopric",  label: "Bishopric",     icon: "◉", restricted: true },
  { id: "calendar",   label: "Ward Calendar", icon: "◎" },
];

const SUBTABS = {
  wardcouncil: [
    { id: "pulse", label: "Weekly Pulse" },
    { id: "agenda", label: "Agenda Builder" },
    { id: "goals", label: "Goals & Collaboration" },
  ],
  bishopric: [
    { id: "bishopric-agenda", label: "Agenda Builder" },
    { id: "sacrament-program", label: "Sacrament Program" },
  ],
};

export default function App() {
  const [topTab, setTopTab] = useState("wardcouncil");
  const [subTab, setSubTab] = useState("pulse");
  const [week, setWeek] = useState(null);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [lightMode, setLightMode] = useState(() => localStorage.getItem("lightMode") === "1");

  useEffect(() => {
    const saved = localStorage.getItem("wc_user");
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u.stayLoggedIn) {
          setUser(u);
          if (u.lightMode) setLightMode(u.lightMode === true);
        }
      } catch {}
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (user) fetch(`${API}/api/week`).then(r => r.json()).then(d => setWeek(d.week)).catch(() => {});
  }, [user]);

  // If the currently-selected top tab isn't visible to this user (e.g. a
  // non-council user landed on the "wardcouncil" default), fall back to the
  // first tab they can see. Declared here, above the early returns, to satisfy
  // the rules of hooks.
  useEffect(() => {
    if (!user) return;
    const isCouncil   = user.role === "admin" || !!user.isWardCouncil;
    const isBishopric = user.role === "admin" || user.role === "bishopric";
    const visible = TOP_NAV.filter(n => {
      if (n.restricted  && !isBishopric) return false;
      if (n.councilOnly && !isCouncil)   return false;
      return true;
    });
    if (!visible.find(n => n.id === topTab) && visible.length > 0) {
      const next = visible[0];
      setTopTab(next.id);
      const subs = SUBTABS[next.id];
      if (subs) setSubTab(subs[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLogin = (u, stay) => {
    const userData = { ...u, stayLoggedIn: stay };
    setUser(userData);
    if (stay) localStorage.setItem("wc_user", JSON.stringify(userData));
    else localStorage.removeItem("wc_user");
  };

  const handleLogout = () => {
    localStorage.removeItem("wc_user");
    setUser(null);
  };

  const handleToggleLightMode = () => {
    const next = !lightMode;
    setLightMode(next);
    localStorage.setItem("lightMode", next ? "1" : "0");
    if (user) {
      fetch(`${API}/api/users/${user.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lightMode: next }),
      }).catch(() => {});
    }
  };

  const handleUpdateUser = (updated) => {
    const merged = { ...updated, stayLoggedIn: user.stayLoggedIn };
    setUser(merged);
    if (merged.stayLoggedIn) localStorage.setItem("wc_user", JSON.stringify(merged));
    if (updated.lightMode !== undefined) setLightMode(updated.lightMode);
  };

  const canSeeBishopric = (u) => {
    if (!u) return false;
    // Bishopric tab is gated on role. Admins also see it so they don't lock
    // themselves out while managing the app.
    return u.role === "bishopric" || u.role === "admin";
  };

  const canSeeWardCouncil = (u) => {
    if (!u) return false;
    // Ward Council + Mission Plan are gated on the isWardCouncil flag.
    // Admins see them regardless so they can administer the app.
    return u.role === "admin" || !!u.isWardCouncil;
  };

  const handleTopTab = (id) => {
    setTopTab(id);
    const subs = SUBTABS[id];
    if (subs) setSubTab(subs[0].id);
  };

  const lm = lightMode;

  if (!authChecked) return null;
  if (!user) return (
    <>
      <style>{getStyles(false)}</style>
      <Login api={API} onLogin={handleLogin} />
    </>
  );

  const visibleTopNav = TOP_NAV.filter(n => {
    if (n.restricted  && !canSeeBishopric(user))  return false;
    if (n.councilOnly && !canSeeWardCouncil(user)) return false;
    return true;
  });
  const currentSubtabs = SUBTABS[topTab] || [];

  return (
    <>
      <style>{getStyles(lm)}</style>

      {showProfile && (
        <UserProfile
          api={API} user={user}
          onUpdate={handleUpdateUser}
          onClose={() => setShowProfile(false)}
          lightMode={lightMode}
          onToggleLightMode={handleToggleLightMode}
        />
      )}

      <div className="app">
        <header className="header">
          <div>
            <span className="header-title">
              Placid Rose Ward Council
              <span>Executive Dashboard</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="header-week">{week ? `Current: ${week}` : "Loading..."}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {user.role === "admin" && (
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 10px" }}
                  onClick={() => setShowUsers(!showUsers)}>
                  ◇ Users
                </button>
              )}
              <button onClick={() => setShowProfile(true)} style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "var(--surface3)", border: "1px solid var(--border2)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-display)", fontSize: 14, color: "var(--gold)",
              }} title="My Profile">
                {(user.firstName?.[0] || user.email?.[0] || "?").toUpperCase()}
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 10px" }} onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {showUsers && user.role === "admin" ? (
          <div className="main scroll" style={{ padding: 0 }}>
            <UserManager api={API} currentUser={user} />
          </div>
        ) : (
          <>
            {/* Top nav */}
            <nav className="nav">
              {visibleTopNav.map(n => (
                <button key={n.id}
                  className={`nav-btn${topTab === n.id ? " active" : ""}`}
                  onClick={() => handleTopTab(n.id)}>
                  <span className="nav-icon">{n.icon}</span>
                  {n.label}
                </button>
              ))}
            </nav>

            {/* Sub nav */}
            {currentSubtabs.length > 0 && (
              <div className="subnav">
                {currentSubtabs.map(s => (
                  <button key={s.id}
                    className={`subnav-btn${subTab === s.id ? " active" : ""}`}
                    onClick={() => setSubTab(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            <main className="main">
              {/* Ward Council subtabs */}
              {topTab === "wardcouncil" && subTab === "pulse" && <PulseManager api={API} week={week} />}
              {topTab === "wardcouncil" && subTab === "agenda" && <AgendaBuilder api={API} week={week} />}
              {topTab === "wardcouncil" && subTab === "goals" && <GoalsTracker api={API} />}

              {/* Mission Plan */}
              {topTab === "mission" && <MissionPlan api={API} />}

              {/* Bishopric subtabs */}
              {topTab === "bishopric" && subTab === "bishopric-agenda" && <BishopricAgendaBuilder api={API} week={week} />}
              {topTab === "bishopric" && subTab === "sacrament-program" && <SacramentProgram />}

              {/* Ward Calendar */}
              {topTab === "calendar" && <WardCalendar api={API} />}
            </main>
          </>
        )}
      </div>
    </>
  );
}

function getStyles(lm) {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: ${lm ? "#F4F1EC" : "#0C0D0F"};
      --surface: ${lm ? "#FFFFFF" : "#13151A"};
      --surface2: ${lm ? "#F0EDE6" : "#1A1D25"};
      --surface3: ${lm ? "#E8E4DC" : "#21252F"};
      --border: ${lm ? "#D4CFC6" : "#2A2F3C"};
      --border2: ${lm ? "#C4BFB5" : "#353C4A"};
      --gold: ${lm ? "#8B6914" : "#C9A84C"};
      --gold-dim: ${lm ? "#B8891C" : "#8A6E2F"};
      --gold-glow: ${lm ? "rgba(139,105,20,0.1)" : "rgba(201,168,76,0.15)"};
      --text: ${lm ? "#1A1814" : "#E8E4DC"};
      --text-dim: ${lm ? "#3D3A34" : "#B0B4BF"};
      --text-muted: ${lm ? "#6B6760" : "#7A7F8C"};
      --rs: #7C9E87; --eq: #5B7FA6; --yw: #A07CB5;
      --primary-color: #C97B5A; --ss: #6B9E9E; --wm: #9E7B6B;
      --success: #4A7A5E; --warning: ${lm ? "#8B6914" : "#C9A84C"}; --danger: #A05A5A;
      --font-display: 'Cormorant Garamond', serif;
      --font-mono: 'JetBrains Mono', monospace;
      --radius: 4px; --radius-lg: 8px;
    }

    html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font-mono); font-size: 13px; line-height: 1.6; -webkit-font-smoothing: antialiased; }

    .app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

    .header { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; border-bottom: 1px solid var(--border); background: var(--surface); flex-shrink: 0; position: relative; }
    .header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--gold-dim), transparent); }
    .header-title { font-family: var(--font-display); font-size: 20px; font-weight: 400; letter-spacing: 0.15em; color: var(--gold); text-transform: uppercase; }
    .header-title span { color: var(--text-muted); font-size: 11px; font-family: var(--font-mono); font-weight: 400; letter-spacing: 0.2em; margin-left: 16px; text-transform: uppercase; }
    .header-week { font-size: 11px; color: var(--text-muted); letter-spacing: 0.15em; font-weight: 400; }

    .nav { display: flex; gap: 2px; padding: 12px 32px 0; border-bottom: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
    .nav-btn { display: flex; align-items: center; gap: 8px; padding: 8px 20px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; margin-bottom: -1px; }
    .nav-btn:hover { color: var(--text-dim); }
    .nav-btn.active { color: var(--gold); border-bottom-color: var(--gold); }
    .nav-icon { font-size: 14px; }

    .subnav { display: flex; gap: 2px; padding: 0 32px; border-bottom: 1px solid var(--border); background: var(--surface2); flex-shrink: 0; }
    .subnav-btn { padding: 6px 16px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; margin-bottom: -1px; }
    .subnav-btn:hover { color: var(--text-dim); }
    .subnav-btn.active { color: var(--gold); border-bottom-color: var(--gold); }

    .main { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

    .panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
    .panel-header { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--surface2); }
    .panel-title { font-family: var(--font-display); font-size: 16px; font-weight: 400; letter-spacing: 0.1em; color: var(--text); }
    .panel-body { padding: 20px; }

    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: var(--radius); font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; font-weight: 500; }
    .btn-gold { background: var(--gold); color: ${lm ? "#FFF" : "#0C0D0F"}; border-color: var(--gold); }
    .btn-gold:hover { filter: brightness(1.1); }
    .btn-outline { background: transparent; color: var(--text-dim); border-color: var(--border2); }
    .btn-outline:hover { border-color: var(--gold-dim); color: var(--gold); }
    .btn-ghost { background: transparent; color: var(--text-muted); border-color: transparent; }
    .btn-ghost:hover { color: var(--text-dim); background: var(--surface3); }
    .btn-danger { background: transparent; color: var(--danger); border-color: var(--danger); }
    .btn-danger:hover { background: rgba(160,90,90,0.1); }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 2px; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500; }

    .input { background: var(--surface3); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text); font-family: var(--font-mono); font-size: 12px; padding: 8px 12px; outline: none; transition: border-color 0.15s; width: 100%; }
    .input:focus { border-color: var(--gold-dim); }
    .input::placeholder { color: var(--text-muted); }
    textarea.input { resize: vertical; min-height: 80px; }
    select.input { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236B6760'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px; }

    .label { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 6px; font-weight: 500; }
    .field { margin-bottom: 16px; }
    .divider { border: none; border-top: 1px solid var(--border); margin: 16px 0; }

    .empty-state { text-align: center; padding: 48px 24px; color: var(--text-muted); }
    .empty-state-icon { font-size: 32px; display: block; margin-bottom: 12px; opacity: 0.4; }
    .empty-state-text { font-size: 12px; letter-spacing: 0.1em; color: var(--text-muted); }

    .tag { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 2px; font-size: 10px; letter-spacing: 0.08em; margin-right: 4px; margin-bottom: 4px; border: 1px solid; opacity: 0.85; }

    .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid transparent; border-top-color: currentColor; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .toast { position: fixed; bottom: 24px; right: 24px; background: var(--surface2); border: 1px solid var(--gold-dim); border-radius: var(--radius); padding: 12px 20px; font-size: 12px; color: var(--text); z-index: 1000; animation: slideIn 0.2s ease; }
    @keyframes slideIn { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    .scroll { overflow-y: auto; }
    .scroll::-webkit-scrollbar { width: 4px; }
    .scroll::-webkit-scrollbar-track { background: transparent; }
    .scroll::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

    @media (max-width: 900px) {
      .two-col, .three-col { grid-template-columns: 1fr; }
      .header, .nav, .subnav { padding-left: 16px; padding-right: 16px; }
    }
  `;
}
