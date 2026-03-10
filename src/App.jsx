import { useState, useEffect } from "react";
import PulseManager from "./components/PulseManager.jsx";
import AgendaBuilder from "./components/AgendaBuilder.jsx";
import GoalsTracker from "./components/GoalsTracker.jsx";

const API = import.meta.env.VITE_API_URL || "";

const NAV = [
  { id: "pulse", label: "Weekly Pulse", icon: "◈" },
  { id: "agenda", label: "Agenda Builder", icon: "◉" },
  { id: "goals", label: "Goals & Collaboration", icon: "◎" },
];

export default function App() {
  const [tab, setTab] = useState("pulse");
  const [week, setWeek] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/week`).then(r => r.json()).then(d => setWeek(d.week)).catch(() => {});
  }, []);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #0C0D0F;
          --surface: #13151A;
          --surface2: #1A1D25;
          --surface3: #21252F;
          --border: #2A2F3C;
          --border2: #353C4A;
          --gold: #C9A84C;
          --gold-dim: #8A6E2F;
          --gold-glow: rgba(201,168,76,0.15);
          --text: #E8E4DC;
          --text-dim: #8A8E9A;
          --text-muted: #4A4F5C;
          --rs: #7C9E87;
          --eq: #5B7FA6;
          --yw: #A07CB5;
          --primary: #C97B5A;
          --ss: #6B9E9E;
          --wm: #9E7B6B;
          --success: #5A8A6E;
          --warning: #C9A84C;
          --danger: #A05A5A;
          --font-display: 'Cormorant Garamond', serif;
          --font-mono: 'JetBrains Mono', monospace;
          --radius: 4px;
          --radius-lg: 8px;
        }

        html, body, #root {
          height: 100%;
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-mono);
          font-size: 13px;
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
        }

        .app {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          height: 60px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
          flex-shrink: 0;
          position: relative;
        }

        .header::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--gold-dim), transparent);
        }

        .header-title {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 400;
          letter-spacing: 0.15em;
          color: var(--gold);
          text-transform: uppercase;
        }

        .header-title span {
          color: var(--text-dim);
          font-size: 11px;
          font-family: var(--font-mono);
          font-weight: 300;
          letter-spacing: 0.2em;
          margin-left: 16px;
          text-transform: uppercase;
        }

        .header-week {
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 0.15em;
          font-weight: 300;
        }

        .nav {
          display: flex;
          gap: 2px;
          padding: 12px 32px 0;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
          flex-shrink: 0;
        }

        .nav-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 20px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.15s;
          margin-bottom: -1px;
        }

        .nav-btn:hover { color: var(--text-dim); }
        .nav-btn.active { color: var(--gold); border-bottom-color: var(--gold); }
        .nav-icon { font-size: 14px; }

        .main { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

        .panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
        .panel-header { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--surface2); }
        .panel-title { font-family: var(--font-display); font-size: 16px; font-weight: 400; letter-spacing: 0.1em; color: var(--text); }
        .panel-body { padding: 20px; }

        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: var(--radius); font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; font-weight: 500; }
        .btn-gold { background: var(--gold); color: #0C0D0F; border-color: var(--gold); }
        .btn-gold:hover { filter: brightness(1.05); }
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
        select.input { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%234A4F5C'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px; }

        .label { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 6px; font-weight: 500; }
        .field { margin-bottom: 16px; }
        .divider { border: none; border-top: 1px solid var(--border); margin: 16px 0; }

        .empty-state { text-align: center; padding: 48px 24px; color: var(--text-muted); }
        .empty-state-icon { font-size: 32px; display: block; margin-bottom: 12px; opacity: 0.4; }
        .empty-state-text { font-size: 12px; letter-spacing: 0.1em; }

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
          .header, .nav { padding-left: 16px; padding-right: 16px; }
        }
      `}</style>

      <div className="app">
        <header className="header">
          <div>
            <span className="header-title">
              Ward Council
              <span>Executive Dashboard</span>
            </span>
          </div>
          <div className="header-week">{week ? `Current: ${week}` : "Loading..."}</div>
        </header>

        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-btn${tab === n.id ? " active" : ""}`}
              onClick={() => setTab(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <main className="main">
          {tab === "pulse" && <PulseManager api={API} week={week} />}
          {tab === "agenda" && <AgendaBuilder api={API} week={week} />}
          {tab === "goals" && <GoalsTracker api={API} />}
        </main>
      </div>
    </>
  );
}