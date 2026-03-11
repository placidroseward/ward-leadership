import { useState } from "react";

export default function Login({ api, onLogin }) {
  const [step, setStep] = useState("email"); // email | password | setpassword
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  const checkEmail = async () => {
    if (!email.trim()) return setError("Please enter your email");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${api}/api/auth/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUserInfo(data);
      if (data.stayLoggedIn) {
        // Auto-login — just confirm email is enough
        onLogin(data.user, true);
      } else if (!data.hasPassword) {
        setStep("setpassword");
      } else {
        setStep("password");
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const submitPassword = async () => {
    if (!password) return setError("Please enter your password");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${api}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, stayLoggedIn }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onLogin(data.user, stayLoggedIn);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const setFirstPassword = async () => {
    if (!password) return setError("Please enter a password");
    if (password !== confirm) return setError("Passwords don't match");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${api}/api/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, stayLoggedIn }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onLogin(data.user, stayLoggedIn);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleKey = (e, fn) => { if (e.key === "Enter") fn(); };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)",
    }}>
      <div style={{
        width: 400, background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          padding: "28px 32px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface2)",
          textAlign: "center",
        }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 22, color: "var(--gold)",
            letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4,
          }}>
            Placid Rose
          </div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.25em", textTransform: "uppercase" }}>
            Ward Council Dashboard
          </div>
        </div>

        <div style={{ padding: 32 }}>
          {step === "email" && (
            <>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text)", marginBottom: 6 }}>
                Welcome back
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 20, lineHeight: 1.6 }}>
                Enter your email address to continue
              </div>
              <div className="field">
                <label className="label">Email Address</label>
                <input
                  className="input" type="email" value={email} autoFocus
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => handleKey(e, checkEmail)}
                  placeholder="your@email.com"
                />
              </div>
              {error && <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 12 }}>{error}</div>}
              <button className="btn btn-gold" style={{ width: "100%" }} onClick={checkEmail} disabled={loading}>
                {loading ? <><span className="spinner" /> Checking...</> : "Continue →"}
              </button>
            </>
          )}

          {step === "password" && (
            <>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text)", marginBottom: 4 }}>
                Welcome back, {userInfo?.user?.firstName || email}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 20 }}>{email}</div>
              <div className="field">
                <label className="label">Password</label>
                <input
                  className="input" type="password" value={password} autoFocus
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => handleKey(e, submitPassword)}
                  placeholder="Enter your password"
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <input type="checkbox" id="sli" checked={stayLoggedIn}
                  onChange={e => setStayLoggedIn(e.target.checked)}
                  style={{ accentColor: "var(--gold)", width: 14, height: 14 }} />
                <label htmlFor="sli" style={{ fontSize: 12, color: "var(--text-dim)", cursor: "pointer" }}>
                  Stay logged in
                </label>
              </div>
              {error && <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 12 }}>{error}</div>}
              <button className="btn btn-gold" style={{ width: "100%", marginBottom: 10 }} onClick={submitPassword} disabled={loading}>
                {loading ? <><span className="spinner" /> Signing in...</> : "Sign In"}
              </button>
              <button className="btn btn-ghost" style={{ width: "100%", fontSize: 11 }} onClick={() => { setStep("email"); setError(null); setPassword(""); }}>
                ← Use a different email
              </button>
            </>
          )}

          {step === "setpassword" && (
            <>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text)", marginBottom: 4 }}>
                Welcome, {userInfo?.user?.firstName || email}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 20, lineHeight: 1.6 }}>
                This is your first login. Please create a password for your account.
              </div>
              <div className="field">
                <label className="label">Create Password</label>
                <input className="input" type="password" value={password} autoFocus
                  onChange={e => setPassword(e.target.value)} placeholder="Choose a password" />
              </div>
              <div className="field">
                <label className="label">Confirm Password</label>
                <input className="input" type="password" value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => handleKey(e, setFirstPassword)}
                  placeholder="Confirm your password" />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <input type="checkbox" id="sli2" checked={stayLoggedIn}
                  onChange={e => setStayLoggedIn(e.target.checked)}
                  style={{ accentColor: "var(--gold)", width: 14, height: 14 }} />
                <label htmlFor="sli2" style={{ fontSize: 12, color: "var(--text-dim)", cursor: "pointer" }}>
                  Stay logged in
                </label>
              </div>
              {error && <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 12 }}>{error}</div>}
              <button className="btn btn-gold" style={{ width: "100%" }} onClick={setFirstPassword} disabled={loading}>
                {loading ? <><span className="spinner" /> Setting up...</> : "Create Account & Sign In"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
