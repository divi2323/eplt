"use client";

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useState } from "react";

type LeagueOption = { id: string; league_number: string; name: string; league_status: "active" | "inactive" | null; };

type EventRow = {
  id: string;
  event_number: string;
  league_id: string;
  event_date: string;
  name: string;
  location: string | null;
  format: "rebuy" | "freezeout" | "bounty";
  buyin_amount: number | null;
  rebuy_amount: number | null;
  addon_amount: number | null;
  bounty_amount: number | null;
  status: "scheduled" | "registering" | "running" | "completed" | "locked";
  created_at?: string;
  updated_at?: string;
};

type FilterMode = "scheduled" | "registering" | "running" | "completed" | "locked" | "all";

function rowSearchText(e: EventRow, leagueMap: Map<string, LeagueOption>): string {
  const parts: string[] = [];
  parts.push(String(e.event_number ?? ""));
  parts.push(String(e.name ?? ""));
  parts.push(String(e.event_date ?? ""));
  parts.push(String(e.location ?? ""));
  parts.push(String(e.format ?? ""));
  parts.push(String(e.status ?? ""));
  const lg = leagueMap.get(e.league_id);
  if (lg) {
    parts.push(lg.league_number);
    parts.push(lg.name);
  }
  for (const v of Object.values(e as any)) {
    if (v == null) continue;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") parts.push(String(v));
  }
  return parts.join(" ").toLowerCase();
}

export default function EventsCrud() {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EventRow[]>([]);
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [row, setRow] = useState<Partial<EventRow> | null>(null);

  // Drawer fields
  const [leagueId, setLeagueId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [format, setFormat] = useState<EventRow["format"]>("freezeout");
  const [status, setStatus] = useState<EventRow["status"]>("scheduled");
  const [buyin, setBuyin] = useState<string>("");
  const [rebuy, setRebuy] = useState<string>("");
  const [addon, setAddon] = useState<string>("");
  const [bounty, setBounty] = useState<string>("");

  const OPEN_MS = 900;
  const CLOSE_MS = 520;

  const leagueMap = useMemo(() => new Map(leagues.map(l => [l.id, l])), [leagues]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [evRes, lgRes] = await Promise.all([
        fetch(`/api/events`, { cache: "no-store" }),
        fetch(`/api/leagues?archived=all`, { cache: "no-store" }),
      ]);

      const evData = await evRes.json().catch(() => ({}));
      const lgData = await lgRes.json().catch(() => ({}));

      if (!evRes.ok) throw new Error(evData?.error || "Failed to load events");
      if (!lgRes.ok) throw new Error(lgData?.error || "Failed to load leagues");

      setItems(evData.events || []);
      setLeagues(lgData.leagues || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return (items || []).filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return rowSearchText(r as EventRow, leagueMap).includes(q);
    });
  }, [items, filter, deferredQuery, leagueMap]);

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
    setLeagueId(leagues.find(l => l.league_status !== "inactive")?.id || leagues[0]?.id || "");
    setEventDate("");
    setName("");
    setLocation("");
    setFormat("freezeout");
    setStatus("scheduled");
    setBuyin("");
    setRebuy("");
    setAddon("");
    setBounty("");
    setClosing(false);
    setOpen(true);
  };

  const openEdit = (r: EventRow) => {
    setRow(r);
    setLeagueId(r.league_id || "");
    setEventDate(r.event_date || "");
    setName(r.name || "");
    setLocation(r.location || "");
    setFormat(r.format || "freezeout");
    setStatus(r.status || "scheduled");
    setBuyin(r.buyin_amount == null ? "" : String(r.buyin_amount));
    setRebuy(r.rebuy_amount == null ? "" : String(r.rebuy_amount));
    setAddon(r.addon_amount == null ? "" : String(r.addon_amount));
    setBounty(r.bounty_amount == null ? "" : String(r.bounty_amount));
    setClosing(false);
    setOpen(true);
  };

  async function save() {
    if (!leagueId) {
      alert("League is required.");
      return;
    }
    if (!eventDate) {
      alert("Event date is required.");
      return;
    }
    if (!name.trim()) {
      alert("Event name is required.");
      return;
    }

    try {
      const isEdit = Boolean(row && (row as any).id);
      const url = isEdit ? `/api/events/${(row as any).id}` : "/api/events";
      const method = isEdit ? "PATCH" : "POST";

      const payload = {
        league_id: leagueId,
        event_date: eventDate,
        name: name.trim(),
        location: location.trim() ? location.trim() : null,
        format,
        status,
        buyin_amount: buyin.trim() ? Number(buyin) : null,
        rebuy_amount: rebuy.trim() ? Number(rebuy) : null,
        addon_amount: addon.trim() ? Number(addon) : null,
        bounty_amount: bounty.trim() ? Number(bounty) : null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Save failed");

      await loadAll();
      closeDrawer();
    } catch (e: any) {
      alert(e?.message || "Save failed");
    }
  }

  async function softDelete() {
    if (!row?.id) return;
    const ok = confirm("Soft delete this event? (It can be recovered later once we add a recycle bin.)");
    if (!ok) return;

    try {
      const res = await fetch(`/api/events/${row.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Delete failed");

      await loadAll();
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
          src="/assets/poker_chip_club.png"
          width={78}
          height={78}
          alt="Events"
          style={{
            gridColumn: "1",
            gridRow: "1 / span 2",
            borderRadius: 999,
            filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.65))",
            alignSelf: "center",
          }}
        />

        <div style={{ gridColumn: "2", gridRow: "1 / span 2", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05 }}>Events</h1>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>Manage Events</div>
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
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                padding: "6px 10px",
                lineHeight: 1,
              }}
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
            <span>Event</span>
          </span>
        </button>

        <div style={{ gridColumn: "3", gridRow: "2", display: "flex", gap: 8, alignItems: "center", alignSelf: "center" }}>
          {(["scheduled","registering","running","completed","locked","all"] as FilterMode[]).map((k) => (
            <button
              key={k}
              className={filter === k ? "btn" : "btnGhost"}
              onClick={() => setFilter(k)}
            >
              {k === "all" ? "All" : (k.charAt(0).toUpperCase() + k.slice(1))}
            </button>
          ))}
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
              <th style={{ width: 170 }}>Event #</th>
              <th>Event Name</th>
              <th style={{ width: 140 }}>Date</th>
              <th style={{ width: 140 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 14, color: "var(--muted)" }}>Loading…</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 14, color: "var(--muted)" }}>No events found.</td></tr>
            ) : (
              filteredItems.map((r) => (
                <tr key={r.id} className="rowHover" onClick={() => openEdit(r)}>
                  <td className="mono">{r.event_number}</td>
                  <td>{r.name}</td>
                  <td className="mono">{r.event_date}</td>
                  <td><span className="badge">{r.status}</span></td>
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
                <h2 style={{ margin: 0 }}>{(row as any)?.id ? "Edit Event" : "New Event"}</h2>
                {(row as any)?.id && (
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                    <span className="mono">{String((row as any).event_number ?? "")}</span> • <span className="mono">{(row as any).id}</span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button className="btnGhost" onClick={closeDrawer}>Close</button>
              </div>
            </div>

            <div className="hr" />

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div className="fieldLabel">League</div>
                <select className="input" value={leagueId} onChange={(e) => setLeagueId(e.target.value)}>
                  <option value="" disabled>Select league…</option>
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.league_number} — {l.name}{l.league_status === "inactive" ? " (inactive)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="fieldLabel">Event Date</div>
                  <input className="input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                </div>
                <div>
                  <div className="fieldLabel">Status</div>
                  <select className="input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                    {(["scheduled","registering","running","completed","locked"] as EventRow["status"][]).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="fieldLabel">Event Name</div>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div>
                <div className="fieldLabel">Location</div>
                <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="(optional)" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="fieldLabel">Format</div>
                  <select className="input" value={format} onChange={(e) => setFormat(e.target.value as any)}>
                    {(["freezeout","rebuy","bounty"] as EventRow["format"][]).map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="fieldLabel">Buy-in Amount</div>
                  <input className="input" inputMode="decimal" value={buyin} onChange={(e) => setBuyin(e.target.value)} placeholder="(optional)" />
                </div>
                <div>
                  <div className="fieldLabel">Rebuy Amount</div>
                  <input className="input" inputMode="decimal" value={rebuy} onChange={(e) => setRebuy(e.target.value)} placeholder="(optional)" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="fieldLabel">Addon Amount</div>
                  <input className="input" inputMode="decimal" value={addon} onChange={(e) => setAddon(e.target.value)} placeholder="(optional)" />
                </div>
                <div>
                  <div className="fieldLabel">Bounty Amount</div>
                  <input className="input" inputMode="decimal" value={bounty} onChange={(e) => setBounty(e.target.value)} placeholder="(optional)" />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  {(row as any)?.id ? "Changes save immediately to the database." : "A new event number will be assigned automatically."}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  {(row as any)?.id && <button className="btnGhost" onClick={softDelete}>Delete</button>}
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
