"use client";

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useState } from "react";

type Role = "player" | "admin" | "staff" | "viewer";

type Player = {
  id: string;
  player_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  role: Role;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type FilterMode = "active" | "inactive" | "all";

function statusLabel(p: Pick<Player, "is_active">) {
  return p.is_active ? "Active" : "Inactive";
}

function fullName(p: Pick<Player, "first_name" | "last_name">) {
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
}

function rowSearchText(p: Player): string {
  const parts: string[] = [];
  parts.push(fullName(p));
  parts.push(String(p.player_number ?? ""));
  parts.push(String(p.email ?? ""));
  parts.push(String(p.phone ?? ""));
  parts.push(String(p.role ?? ""));
  parts.push(String(p.notes ?? ""));
  parts.push(statusLabel(p));
  parts.push(p.is_active ? "active" : "inactive");
  for (const v of Object.values(p as any)) {
    if (v == null) continue;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") parts.push(String(v));
  }
  return parts.join(" ").toLowerCase();
}

function parseFullName(input: string): { first_name: string; last_name: string } | null {
  const parts = String(input ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

export default function PlayersCrud() {
  const [filter, setFilter] = useState<FilterMode>("active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Player[]>([]);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [row, setRow] = useState<Partial<Player> | null>(null);

  // UI stays single "Player Name" input but we map to first/last.
  const [playerName, setPlayerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("player");
  const [notes, setNotes] = useState("");

  const OPEN_MS = 900;
  const CLOSE_MS = 520;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/players?status=all`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load players");
      setItems(data.players || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load players");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filteredItems = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return (items || []).filter((r) => {
      if (filter === "active" && !r.is_active) return false;
      if (filter === "inactive" && r.is_active) return false;
      if (!q) return true;
      return rowSearchText(r).includes(q);
    });
  }, [items, filter, deferredQuery]);

  const closeDrawer = () => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setRow(null);
    }, CLOSE_MS);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.classList.add("epltDrawerOpen");
    return () => {
      body.classList.remove("epltDrawerOpen");
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [open]);

  const openNew = () => {
    setRow({});
    setPlayerName("");
    setEmail("");
    setPhone("");
    setRole("player");
    setNotes("");
    setClosing(false);
    setOpen(true);
  };

  const openEdit = (r: Player) => {
    setRow(r);
    setPlayerName(fullName(r));
    setEmail(r.email ?? "");
    setPhone(r.phone ?? "");
    setRole(r.role ?? "player");
    setNotes(r.notes ?? "");
    setClosing(false);
    setOpen(true);
  };

  async function save() {
    const parsed = parseFullName(playerName);
    if (!parsed) {
      alert("Enter a first and last name.");
      return;
    }

    try {
      const isEdit = Boolean(row && (row as any).id);
      const url = isEdit ? `/api/players/${(row as any).id}` : "/api/players";
      const method = isEdit ? "PATCH" : "POST";

      const payload: any = {
        first_name: parsed.first_name,
        last_name: parsed.last_name,
        email: email.trim() ? email.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
        role,
        notes: notes.trim() ? notes.trim() : null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Save failed");

      await load();
      closeDrawer();
    } catch (e: any) {
      alert(e?.message || "Save failed");
    }
  }

  async function activateToggle() {
    if (!row?.id) return;
    const doActivate = !Boolean((row as any).is_active);
    const path = doActivate ? "activate" : "deactivate";

    try {
      const res = await fetch(`/api/players/${row.id}/${path}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Update failed");

      await load();
      const updated = (data.player || null) as Player | null;
      if (updated) setRow(updated);
    } catch (e: any) {
      alert(e?.message || "Update failed");
    }
  }

  async function softDelete() {
    if (!row?.id) return;
    const ok = confirm("Soft delete this player? (It can be recovered later once we add a recycle bin.)");
    if (!ok) return;

    try {
      const res = await fetch(`/api/players/${row.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Delete failed");

      await load();
      closeDrawer();
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "78px max-content minmax(0, 1fr) max-content",
          width: "100%",
          minWidth: 0,
          gridTemplateRows: "auto auto",
          columnGap: 12,
          rowGap: 10,
          alignItems: "stretch",
        }}
      >
        <img
          src="/assets/poker_chip_heart.png"
          width={78}
          height={78}
          alt="Players"
          style={{
            gridColumn: "1",
            gridRow: "1 / span 2",
            borderRadius: 999,
            filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.65))",
            alignSelf: "center",
          }}
        />

        <div style={{ gridColumn: "2", gridRow: "1 / span 2", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05 }}>Players</h1>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>Manage Players</div>
        </div>

        <div style={{ gridColumn: "3", gridRow: "1", position: "relative", alignSelf: "center", minWidth: 0 }}>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            style={{ width: "100%", paddingRight: 38 }}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="btnGhost"
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", padding: "6px 10px", lineHeight: 1 }}
            >
              ×
            </button>
          ) : null}
        </div>

        <button
          className="btn"
          onClick={openNew}
          style={{
            gridColumn: "4",
            gridRow: "1 / span 2",
            justifySelf: "end",
            height: "100%",
            minHeight: 78,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingInline: 18,
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.05 }}>
            <span style={{ fontSize: 20, fontWeight: 900 }}>+</span>
            <span>Player</span>
          </span>
        </button>

        <div style={{ gridColumn: "3", gridRow: "2", display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-start", alignSelf: "center" }}>
          <button className={filter === "active" ? "btn" : "btnGhost"} onClick={() => setFilter("active")}>Active</button>
          <button className={filter === "inactive" ? "btn" : "btnGhost"} onClick={() => setFilter("inactive")}>Inactive</button>
          <button className={filter === "all" ? "btn" : "btnGhost"} onClick={() => setFilter("all")}>All</button>
        </div>
      </div>

      {error && (
        <div className="panel" style={{ marginTop: 12, padding: 12, borderColor: "rgba(255,80,80,.25)" }}>
          <b style={{ color: "#ffd1d1" }}>Error:</b> {error}
          <div style={{ color: "var(--muted)", marginTop: 6 }}>
            If this is a schema error, run the latest DB migration in <span className="mono">/home/eplt/db/migrations</span>.
          </div>
        </div>
      )}

      <div className="panel" style={{ padding: 0, marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 140 }}>Player #</th>
              <th>Player Name</th>
              <th style={{ width: 140 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={{ padding: 14, color: "var(--muted)" }}>Loading…</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: 14, color: "var(--muted)" }}>No players found.</td></tr>
            ) : (
              filteredItems.map((r) => (
                <tr key={r.id} className="rowHover" onClick={() => openEdit(r)}>
                  <td className="mono">{String(r.player_number ?? "")}</td>
                  <td>{fullName(r)}</td>
                  <td><span className="badge">{statusLabel(r)}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className={`drawerWrap ${closing ? "drawerClosing" : "drawerOpening"}`}>
          <div className="drawerBackdrop" onClick={closeDrawer} />

          <div className="drawer" style={{ animationDuration: `${OPEN_MS}ms` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>{(row as any)?.id ? "Edit Player" : "New Player"}</h2>
                {(row as any)?.id && (
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                    <span className="mono">{String((row as any).player_number ?? "")}</span> • <span className="mono">{(row as any).id}</span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {(row as any)?.id && (
                  <button className="btnGhost" onClick={activateToggle}>
                    {Boolean((row as any).is_active) ? "Deactivate" : "Activate"}
                  </button>
                )}
                <button className="btnGhost" onClick={closeDrawer}>Close</button>
              </div>
            </div>

            <div className="hr" />

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div className="fieldLabel">Player Name</div>
                <input className="input" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="First Last" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="fieldLabel">Email</div>
                  <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
                </div>
                <div>
                  <div className="fieldLabel">Phone</div>
                  <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(###) ###-####" />
                </div>
              </div>

              <div>
                <div className="fieldLabel">Role</div>
                <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="player">player</option>
                  <option value="admin">admin</option>
                  <option value="staff">staff</option>
                  <option value="viewer">viewer</option>
                </select>
              </div>

              <div>
                <div className="fieldLabel">Notes</div>
                <textarea className="input" style={{ minHeight: 110 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  {(row as any)?.id ? "Changes save immediately to the database." : "A new player number will be assigned automatically."}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  {(row as any)?.id && (
                    <button className="btnGhost" onClick={softDelete}>Delete</button>
                  )}
                  <button className="btn" onClick={save}>Save</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
