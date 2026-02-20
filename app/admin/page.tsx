import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p style={{ color: "var(--muted)" }}>
        Left navigation, list panels, and drawer editors are now locked in.
      </p>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <Link className="btnGhost" href="/admin/leagues">Leagues</Link>
        <Link className="btnGhost" href="/admin/events">Events</Link>
        <Link className="btnGhost" href="/admin/players">Players</Link>
        <Link className="btnGhost" href="/admin/run">Run</Link>
        <Link className="btnGhost" href="/admin/register">Register</Link>
      </div>
    </div>
  );
}
