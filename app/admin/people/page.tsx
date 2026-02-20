export default function Page() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>People</h1>
        <button style={{
          background: "rgba(198,161,91,.18)",
          border: "1px solid rgba(198,161,91,.35)",
          color: "var(--text)",
          padding: "8px 12px",
          borderRadius: 12,
          cursor: "pointer",
          fontWeight: 700
        }}>+ New (placeholder)</button>
      </div>

      <p style={{ color: "var(--muted)", marginTop: 6 }}>
        Layout locked. CRUD wiring comes next.
      </p>

      <div className="panel" style={{ padding: 14, borderColor: "rgba(255,255,255,.10)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>Table (placeholder)</div>
          <label style={{ color: "var(--muted)", fontSize: 12 }}>
            <input type="checkbox" disabled style={{ marginRight: 8 }} />
            Toggle/filter (placeholder)
          </label>
        </div>

        <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 12, background: "rgba(255,255,255,.04)", color: "var(--muted)", fontSize: 12 }}>
            Columns will match EPLT schema
          </div>
          <div style={{ padding: 12, color: "var(--muted)" }}>
            No data yet — this is the locked shell.
          </div>
        </div>
      </div>
    </div>
  );
}
