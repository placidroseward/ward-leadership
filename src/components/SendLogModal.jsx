export default function SendLogModal({ title, results, onClose }) {
  if (!results) return null;

  const sent = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;
  const allOk = failed === 0;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", width: 520, maxHeight: "80vh",
        overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--surface2)", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text)" }}>
              {title || "Send Log"}
            </div>
            <div style={{ fontSize: 11, marginTop: 3 }}>
              <span style={{ color: allOk ? "var(--success)" : "var(--warning)" }}>
                {sent}/{total} sent successfully
              </span>
              {failed > 0 && (
                <span style={{ color: "var(--danger)", marginLeft: 10 }}>
                  {failed} failed
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={onClose}>✕</button>
        </div>

        {/* Summary bar */}
        <div style={{
          height: 4, background: "var(--surface3)", flexShrink: 0,
          display: "flex", overflow: "hidden",
        }}>
          <div style={{
            width: `${total > 0 ? (sent / total) * 100 : 0}%`,
            background: allOk ? "var(--success)" : sent > 0 ? "var(--warning)" : "var(--danger)",
            transition: "width 0.3s",
          }} />
        </div>

        {/* Results list */}
        <div className="scroll" style={{ flex: 1, padding: 16 }}>
          {results.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: 12 }}>
              No recipients found — check that council members have carrier set in Council Members tab
            </div>
          ) : results.map((r, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "10px 12px", marginBottom: 6,
              background: r.success ? "rgba(74,122,94,0.08)" : "rgba(160,90,90,0.08)",
              border: `1px solid ${r.success ? "rgba(74,122,94,0.2)" : "rgba(160,90,90,0.2)"}`,
              borderRadius: "var(--radius)",
            }}>
              {/* Status icon */}
              <div style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                background: r.success ? "var(--success)" : "var(--danger)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: "#fff", fontWeight: 700,
              }}>
                {r.success ? "✓" : "✕"}
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                  {r.memberName || r.memberId}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                  {r.gatewayEmail || "No gateway email"}
                </div>
                {!r.success && r.error && (
                  <div style={{
                    fontSize: 11, color: "var(--danger)", marginTop: 4,
                    padding: "4px 8px", background: "rgba(160,90,90,0.1)",
                    borderRadius: 2, wordBreak: "break-word", lineHeight: 1.5,
                  }}>
                    {r.error}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Help text if any failed */}
          {failed > 0 && (
            <div style={{
              marginTop: 12, padding: "12px 14px",
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>Troubleshooting</div>
              <div>• <strong>No carrier set</strong> — go to Council Members tab and add the carrier for that member</div>
              <div>• <strong>Auth errors</strong> — check that GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN are set correctly in Railway</div>
              <div>• <strong>Gateway bounces</strong> — the carrier gateway address may be wrong; double-check the member's carrier</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 24px", borderTop: "1px solid var(--border)",
          background: "var(--surface2)", flexShrink: 0, textAlign: "right",
        }}>
          <button className="btn btn-gold" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
