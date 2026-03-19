"use client";

import CollapsiblePanel from "@/app/components/CollapsiblePanel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Player = {
  id: string;
  name: string;
  status: "REGISTERED" | "CHECKED_IN" | "BUSTED";
  paid?: boolean;
  bustOrder?: number | null;
};

async function post(eventToken: string, body: any) {
  const res = await fetch(`/api/demo/event/${eventToken}/control`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function sendParams(eventToken: string, patch: Partial<EventParams>) {
  await post(eventToken, { action: 'setParams', ...patch });
}
async function sendCounts(eventToken: string, patch: { rebuys?: number; addons?: number }) {
  await post(eventToken, { action: 'setCounts', ...patch });
}
async function sendStatus(eventToken: string, status: string) {
  await post(eventToken, { action: 'setStatus', status });
}

// Hide scrollbars but allow scroll inside panels (TV-safe: no page scroll).
const scrollCls =
  "overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const TZ = "America/Chicago";
function formatChicagoTime(ts: number) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZone: TZ,
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString();
  }
}
type EventParams = {
  tournamentStatus: string;
  buyinAmount: number;
  rebuyAmount: number;
  addonAmount: number;
  buyinChips: number;
  rebuyChips: number;
  addonChips: number;
  rebuys: number;
  addons: number;
};

type Density = "comfortable" | "compact" | "dense";

function densityStyles(d: Density) {
  if (d === "dense") {
    return {
      rowPad: "px-2 py-0",
      rowText: "text-[11px] font-semibold",
      btnPad: "px-1.5 py-0",
      btnText: "text-[11px] font-bold",
      gapY: "space-y-[2px]",
      headerText: "text-lg font-black",
      countText: "text-sm font-bold",
    };
  }
  if (d === "compact") {
    return {
      rowPad: "px-4 py-2",
      rowText: "text-base font-bold",
      btnPad: "px-3 py-1.5",
      btnText: "text-base font-bold",
      gapY: "space-y-1.5",
      headerText: "text-xl font-black",
      countText: "text-base font-bold",
    };
  }
  return {
    rowPad: "px-5 py-3",
    rowText: "text-lg font-bold",
    btnPad: "px-4 py-2",
    btnText: "text-lg font-black",
    gapY: "space-y-2",
    headerText: "text-2xl font-black",
    countText: "text-lg font-black",
  };
}

export default function RunEventClient({ eventToken }: { eventToken: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [eventParams, setEventParams] = useState<EventParams | null>(null);
  const [clockData, setClockData] = useState<any | null>(null);

  const [serverNow, setServerNow] = useState<number>(Date.now());
  const [loading, setLoading] = useState(true);

  // fast operator tools
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [mounted, setMounted] = useState(false);
  const [density, setDensity] = useState<Density>("dense");

  // Kiosk polish: snap/fade + "action landed" highlight
  const prevRef = useRef<Record<string, Player>>({});
  const [recentIds, setRecentIds] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/demo/event/${eventToken}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();

    // Pull live kiosk/public stats (chips in play / avg stack / etc.)
    try {
      const c = await fetch(`/api/demo/clock/${eventToken}`, { cache: "no-store" });
      if (c.ok) setClockData(await c.json());
    } catch {}

    const nextPlayers = (data.players || []) as Player[];

    // Detect changes to highlight affected rows (dealer confidence cue)
    const prev = prevRef.current || {};
    const nowTs = Date.now();
    const changed: Record<string, number> = {};

    for (const p of nextPlayers) {
      const q = prev[p.id];
      if (!q) continue;
      const changedStatus = q.status !== p.status;
      const changedPaid = Boolean(q.paid) !== Boolean(p.paid);
      const changedBust = (q.bustOrder ?? null) !== (p.bustOrder ?? null);
      if (changedStatus || changedPaid || changedBust) changed[p.id] = nowTs;
    }
    // Highlight brand-new rows
    for (const p of nextPlayers) {
      if (!prev[p.id]) changed[p.id] = nowTs;
    }

    setPlayers(nextPlayers);
    prevRef.current = Object.fromEntries(nextPlayers.map((p) => [p.id, p])) as Record<string, Player>;
    setServerNow(Number(data.serverNow ?? Date.now()));
    setLoading(false);

    if (Object.keys(changed).length) {
      setRecentIds((cur) => ({ ...cur, ...changed }));
      window.setTimeout(() => {
        setRecentIds((cur) => {
          const out: Record<string, number> = {};
          const keepMs = 1200;
          const t = Date.now();
          for (const [id, ts] of Object.entries(cur)) {
            if (t - ts < keepMs) out[id] = ts;
          }
          return out;
        });
      }, 1300);
    }
  }, [eventToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setMounted(true);
    try {
      const v = (localStorage.getItem("eplt_run_density") || "") as Density;
      if (v === "comfortable" || v === "compact" || v === "dense") setDensity(v);
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("eplt_run_density", density);
    } catch {}
  }, [density, mounted]);

  const norm = (s: string) => String(s || "").toLowerCase().trim();

  const filtered = useMemo(() => {
    const q = norm(search);
    if (!q) return players;
    return players.filter((p) => norm(p.name).includes(q) || norm(p.id).includes(q) || norm(String((p as any).playerNumber ?? "")).includes(q));
  }, [players, search]);

  const registered = useMemo(() => filtered.filter((p) => p.status === "REGISTERED"), [filtered]);
  const checkedIn = useMemo(() => filtered.filter((p) => p.status === "CHECKED_IN"), [filtered]);
  const publicData = (clockData as any)?.public ?? {};

  const busted = useMemo(
    () =>
      filtered
        .filter((p) => p.status === "BUSTED")
        .sort((a, b) => Number((a as any).finishPos ?? 9999) - Number((b as any).finishPos ?? 9999)),
    [filtered]
  );

  // Payout math (demo): pay top 15% of the field, always rounding up.
  const totalEntrants = registered.length + busted.length;
  const paidPlaces = totalEntrants > 0 ? Math.ceil(totalEntrants * 0.15) : 0;

  const act = useCallback(
    async (action: string, extra: any = {}) => {
      await post(eventToken, { action, ...extra });
      await refresh();
    },
    [eventToken, refresh]
  );

  const rowCls = (p: Player) => {
    const recent = Boolean(recentIds[p.id]);
    return "kiosk-row-enter " + (recent ? "kiosk-row-flash " : "");
  };

  const s = densityStyles(density);

  return (
    <>
    <div className="mb-2 rounded-2xl border border-emerald-100/10 bg-black/40 px-3 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs font-black tracking-widest text-emerald-100/80 uppercase">Event Params</div>

        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-slate-200/80">Status</span>
          <select
            className="rounded-lg bg-emerald-950/80 border border-emerald-100/10 px-2 py-1 text-xs font-semibold text-emerald-50"
            value={(eventParams?.tournamentStatus ?? "REGISTERING").toUpperCase()}
            onChange={async (e) => {
              const status = String(e.target.value || "REGISTERING").toUpperCase();
              setEventParams((p) => p ? { ...p, tournamentStatus: status } : p);
              await sendStatus(eventToken, status);
            }}
          >
            {["REGISTERING","SEATED","IN_PROGRESS","ON_BREAK","FINAL_TABLE","FINISHED"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200/80">Buy-in Chips</span>
          <input
            className="w-24 rounded-lg bg-emerald-950/80 border border-emerald-100/10 px-2 py-1 text-xs font-semibold text-emerald-50 tabular-nums"
            type="number"
            value={eventParams?.buyinChips ?? 20000}
            onChange={(e) => setEventParams((p) => p ? { ...p, buyinChips: Number(e.target.value) } : p)}
            onBlur={async () => eventParams && await sendParams(eventToken, { buyinChips: eventParams.buyinChips })}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200/80">Rebuy Chips</span>
          <input
            className="w-24 rounded-lg bg-emerald-950/80 border border-emerald-100/10 px-2 py-1 text-xs font-semibold text-emerald-50 tabular-nums"
            type="number"
            value={eventParams?.rebuyChips ?? 20000}
            onChange={(e) => setEventParams((p) => p ? { ...p, rebuyChips: Number(e.target.value) } : p)}
            onBlur={async () => eventParams && await sendParams(eventToken, { rebuyChips: eventParams.rebuyChips })}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200/80">Add-on Chips</span>
          <input
            className="w-24 rounded-lg bg-emerald-950/80 border border-emerald-100/10 px-2 py-1 text-xs font-semibold text-emerald-50 tabular-nums"
            type="number"
            value={eventParams?.addonChips ?? 40000}
            onChange={(e) => setEventParams((p) => p ? { ...p, addonChips: Number(e.target.value) } : p)}
            onBlur={async () => eventParams && await sendParams(eventToken, { addonChips: eventParams.addonChips })}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200/80">Rebuys</span>
          <input
            className="w-16 rounded-lg bg-emerald-950/80 border border-emerald-100/10 px-2 py-1 text-xs font-semibold text-emerald-50 tabular-nums"
            type="number"
            value={eventParams?.rebuys ?? 0}
            onChange={(e) => setEventParams((p) => p ? { ...p, rebuys: Number(e.target.value) } : p)}
            onBlur={async () => eventParams && await sendCounts(eventToken, { rebuys: eventParams.rebuys })}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200/80">Add-ons</span>
          <input
            className="w-16 rounded-lg bg-emerald-950/80 border border-emerald-100/10 px-2 py-1 text-xs font-semibold text-emerald-50 tabular-nums"
            type="number"
            value={eventParams?.addons ?? 0}
            onChange={(e) => setEventParams((p) => p ? { ...p, addons: Number(e.target.value) } : p)}
            onBlur={async () => eventParams && await sendCounts(eventToken, { addons: eventParams.addons })}
          />
        </div>
      </div>
    </div>
    <div className="w-screen min-h-[100svh] overflow-hidden bg-[#071b12] bg-[url('/assets/bg_green_1920.webp')] bg-cover bg-center text-emerald-50">
      <style jsx global>{`
        @keyframes kioskRowEnter {
          0%   { opacity: 0; transform: translateY(10px); filter: saturate(0.95); }
          100% { opacity: 1; transform: translateY(0);   filter: saturate(1); }
        }
        @keyframes kioskRowFlash {
          0%   { box-shadow: 0 0 0 rgba(0,0,0,0); filter: brightness(1); }
          35%  { box-shadow: 0 0 22px rgba(253, 230, 138, 0.18), 0 0 40px rgba(16, 185, 129, 0.10); filter: brightness(1.06); }
          100% { box-shadow: 0 0 0 rgba(0,0,0,0); filter: brightness(1); }
        }
        .kiosk-row-enter { animation: kioskRowEnter 180ms ease-out both; will-change: transform, opacity; }
        .kiosk-row-flash { animation: kioskRowFlash 900ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .kiosk-row-enter, .kiosk-row-flash { animation: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="grid grid-cols-12 gap-4 items-start">
          <div className="col-span-12 md:col-span-8 min-w-0">
            <div className="text-5xl font-black tracking-tight leading-none">Run Event</div>
            <div className="mt-2 text-emerald-100/80 font-semibold text-xl">
              Dealer / TD kiosk — register → check-in → bust-out
            </div>
          </div>

          <div className="col-span-12 md:col-span-4 min-w-0">
            {/* Match timer panel opacity */}
            <div className="rounded-2xl border-[2px] border-emerald-900/80 shadow-[0_10px_0_rgba(0,0,0,0.35)] bg-emerald-950/75 backdrop-blur-sm px-5 py-4">
              <div className="text-xs uppercase tracking-widest text-emerald-200/80 font-bold">Token</div>
              <div className="font-mono text-lg truncate" title={eventToken}>{eventToken}</div>

              <div className="mt-3 grid grid-cols-12 gap-2 items-center">
                <div className="col-span-7 text-sm text-emerald-100/70 font-semibold">
                  Server: {mounted ? formatChicagoTime(serverNow) : "--:--:--"}
                </div>
                <div className="col-span-5 flex justify-end gap-2">
                  <button
                    onClick={() => act("resetDemo")}
                    className="rounded-2xl border border-emerald-200/15 bg-black/20 px-3 py-1.5 font-black hover:bg-black/35 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-widest text-emerald-200/70 font-bold">Density</div>
                <div className="flex gap-2">
                  {(["comfortable","compact","dense"] as Density[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDensity(d)}
                      className={`rounded-2xl border px-3 py-1 text-xs font-black uppercase tracking-widest transition-colors ${
                        density === d
                          ? "border-emerald-200/25 bg-black/35 text-emerald-50"
                          : "border-emerald-200/10 bg-black/15 text-emerald-100/70 hover:bg-black/25"
                      }`}
                    >
                      {d === "comfortable" ? "Comfort" : d === "compact" ? "Compact" : "Dense"}
                    </button>
                  ))}
                </div>
              </div>


              <div className="mt-3 relative">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search players..."
                  className="w-full rounded-2xl border border-emerald-200/15 bg-black/20 px-4 pr-12 py-3 text-lg font-semibold outline-none placeholder:text-emerald-100/35"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl border border-emerald-200/15 bg-black/25 w-9 h-9 flex items-center justify-center text-emerald-50/90 text-xl font-black hover:bg-black/40 transition-colors"
                    title="Clear"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid (no page scroll) */}
      <div className="px-6 pb-6">

        {/* Super Bust Out (quick action) */}
        <div className="mb-4">
          <CollapsiblePanel
            id="run.superBustOut"
            title="Super Bust Out"
            count={busted.length}
            defaultOpen={false}
            rightSlot={
              <div className="text-xs font-black tracking-widest text-emerald-100/70 uppercase">
                Finishing Results
              </div>
            }
          >
            <div className={"" + s.gapY + " h-[62svh] " + scrollCls}>
                              {busted.map((p) => {
                                // Preserve badges for busted players (add-on/rebuys) so the icons "follow" them.
                                const rebuyCount = Math.max(0, Math.floor(Number((p as any).rebuys ?? 0)));
                                const hasRebuy = rebuyCount > 0;
                                const hasAddon = Boolean((p as any).addon);
                                // NOTE: Do NOT carry the "$" paid badge into finishing results.

                                return (
                                  <div
                                    key={p.id}
                                    className={`rounded-2xl border border-emerald-200/15 bg-black/20 ${s.rowPad} ${rowCls(p)}`}
                                  >
                                    {/* Player | Badges+Actions (fixed right) so finish badge + icons line up */}
                                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                      {/* Player */}
                                      <div className="min-w-0">
                                        <div className={s.rowText + " flex items-center gap-2 min-w-0 overflow-hidden"}>


                                          {/* Finish position: focal + consistent alignment */}
                                          {(() => {
                                            const fp = Number((p as any).finishPos ?? 0);
                                            const inMoney = paidPlaces > 0 && fp > 0 && fp <= paidPlaces;
                                            return (
                                              <span
                                                className={
                                                  "inline-flex items-center justify-center w-9 h-9 rounded-full border font-black text-sm " +
                                                  (inMoney
                                                    ? "border-emerald-200/95 bg-emerald-500/75 text-emerald-50 shadow-[0_0_0_3px_rgba(16,185,129,0.38)]"
                                                    : "border-amber-200/95 bg-amber-400/70 text-amber-50 shadow-[0_0_0_3px_rgba(251,191,36,0.34)]")
                                                }
                                                title={inMoney ? "In the money" : "Finish position"}
                                              >
                                                {fp ? String(fp) : ""}
                                              </span>
                                            );
                                          })()}

            <span className="inline-flex items-center justify-start w-[4.9rem] px-1 h-6 rounded-2xl border border-emerald-200/15 bg-emerald-950/60 text-emerald-100/90 text-xs font-black font-mono tabular-nums whitespace-nowrap">
                                            {String((p as any).playerNumber ?? (p as any).number ?? "")}
                                          </span>

                                          <span className="truncate min-w-0 leading-none text-amber-100/90 text-[12px]" title={p.name}>{p.name}</span>
                                        </div>
                                      </div>

                                      {/* Badges + Actions */}
                                      <div className="flex items-center justify-end gap-2 shrink-0">
                                        {/* Status icons (match Registered) */}
                                        <div className="flex justify-end gap-[2px] items-center tabular-nums">
                                          <div className="w-[22px] flex justify-end">
                                            <span
                                              title="Add-on"
                                              className={`inline-flex items-center justify-center w-6 h-6 rounded-md bg-red-700 text-white font-black text-xs ${hasAddon ? "" : "opacity-0"}`}
                                            >
                                              A
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-end gap-[1px]">
                                            <span
                                              title="Rebuy"
                                              className={`inline-flex items-center justify-center w-6 h-6 rounded-md bg-red-700 text-white font-black text-xs ${hasRebuy ? "" : "opacity-0"}`}
                                            >
                                              R
                                            </span>
                                            <span className={`text-emerald-100/90 font-semibold tabular-nums whitespace-nowrap ${hasRebuy ? "" : "opacity-0"}`}>
                                              ×{rebuyCount}
                                            </span>
                                          </div>
                                        </div>

                                        <button
                                          onClick={() => act("undoBustOut", { playerId: p.id })}
                                          className={`rounded-2xl border border-emerald-200/15 bg-black/20 ${s.btnPad} ${s.btnText} hover:bg-black/35 transition-colors`}
                                        >
                                          Undo
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {!loading && busted.length === 0 && (
                                <div className="text-emerald-100/70 text-lg font-semibold">Nobody busted yet.</div>
                              )}
                            </div>
          </CollapsiblePanel>
        </div>

        {/* 2-panel layout (Checked In + Registered). Apply a tiny ~1-icon (24px) shift from
            Registered → Checked In now that the "$" badge is removed from Registered. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Checked In (unpaid player list) */}
          {/* 1080p TV layout: give Checked In a bit more width so names never feel squeezed */}
          <div className="min-w-0">
            <div className="rounded-2xl border-[2px] border-emerald-900/80 shadow-[0_10px_0_rgba(0,0,0,0.35)] bg-emerald-950/75 backdrop-blur-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-emerald-200/10 flex items-center justify-between">
                <div className={s.headerText}>Checked In</div>
                <div className={s.countText + " text-emerald-100/85 tabular-nums"}>{checkedIn.length}</div>
              </div>

              <div className="p-5">
                <div className={"" + s.gapY + " h-[62svh] " + scrollCls}>
                  {checkedIn.map((p) => (
                    <div
                      key={p.id}
                      className={`rounded-2xl border border-emerald-200/15 bg-black/20 ${s.rowPad} ${rowCls(p)}`}
                    >
                      <div className="grid grid-cols-12 items-center gap-3">
                        <div className="col-span-9 min-w-0">
                          {/* Checked-in players are NOT paid/registered yet: no status badges here. */}
                          <div className={s.rowText + " flex items-center gap-2 min-w-0 overflow-hidden"}>
                            <span className="inline-flex items-center justify-start w-[4.9rem] px-1 h-6 rounded-2xl border border-emerald-200/15 bg-emerald-950/60 text-emerald-100/90 text-xs font-black font-mono tabular-nums whitespace-nowrap">
                              {String((p as any).playerNumber ?? (p as any).number ?? "")}
                            </span>
                            <span className="truncate min-w-0 leading-none text-amber-100/90 text-[12px]" title={p.name}>{p.name}</span>
                          </div>
                        </div>

                        <div className="col-span-3 flex items-center justify-end">
                          <button
                            onClick={() => act("register", { playerId: p.id })}
                            className={`rounded-2xl border border-emerald-200/20 bg-emerald-900/20 px-3 py-1 text-xs font-bold hover:bg-emerald-900/35 transition-colors`}
                          >
                            Register
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!loading && checkedIn.length === 0 && (
                    <div className="text-emerald-100/70 text-lg font-semibold">No players yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Registered (paid + in tournament) */}
          {/* Slightly narrower to offset Checked In width increase */}
          <div className="min-w-0">
            <div className="rounded-2xl border-[2px] border-emerald-900/80 shadow-[0_10px_0_rgba(0,0,0,0.35)] bg-emerald-950/75 backdrop-blur-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-emerald-200/10 flex items-center justify-between">
                <div className={s.headerText}>Registered</div>
                <div className={s.countText + " text-emerald-100/85 tabular-nums"}>{registered.length}</div>
              </div>

              <div className="p-5">
                <div className={"" + s.gapY + " h-[62svh] " + scrollCls}>
                  {registered.map((p) => {
                    const rebuyCount = Math.max(0, Math.floor(Number((p as any).rebuys ?? 0)));
                    const hasRebuy = rebuyCount > 0;
                    const hasAddon = Boolean((p as any).addon);
                    return (
                      <div
                        key={p.id}
                        className={`rounded-2xl border border-emerald-200/15 bg-black/20 ${s.rowPad} ${rowCls(p)}`}
                      >
                        {/* Use a 3-column grid (Player | Status | Actions) to prevent column overlap at 1080p */}
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                          {/* Player */}
                          <div className="min-w-0">
                            <div className={s.rowText + " flex items-center gap-2 min-w-0 overflow-hidden"}>
	                              <span className="inline-flex items-center justify-start w-[4.9rem] px-1 h-6 rounded-2xl border border-emerald-200/15 bg-emerald-950/60 text-emerald-100/90 text-xs font-black font-mono tabular-nums whitespace-nowrap">
                                {String((p as any).playerNumber ?? (p as any).number ?? "")}
                              </span>
                              <span className="truncate min-w-0 leading-none text-amber-100/90 text-[12px]" title={p.name}>{p.name}</span>
                            </div>
                          </div>

                          {/* Status / toggles: keep compact and never overlapping */}
                          <div className="flex justify-end gap-[2px] items-center tabular-nums shrink-0">
                            {/* Add-on is a true toggle: the A icon IS the toggle (no separate AO pill) */}
                            <button
                              type="button"
                              onClick={() => act("toggleAddon", { playerId: p.id })}
                              title={hasAddon ? "Add-on: ON" : "Add-on: OFF"}
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-md border border-red-200/20 font-black text-xs transition-colors ${
                                hasAddon
                                  ? "bg-red-700/75 text-white"
                                  : "bg-transparent text-red-200/40 opacity-80 hover:bg-red-900/20"
                              }`}
                            >
                              A
                            </button>
	                            {/* Keep the R + ×# glued together (no phantom padding) */}
	                            <div className="flex items-center justify-end gap-[1px]">
	                              <span
	                                title="Rebuy"
	                                className={`inline-flex items-center justify-center w-6 h-6 rounded-md bg-red-700 text-white font-black text-xs ${hasRebuy ? "" : "opacity-0"}`}
	                              >
	                                R
	                              </span>
	                              <span
	                                className={`text-emerald-100/90 font-semibold tabular-nums whitespace-nowrap ${hasRebuy ? "" : "opacity-0"}`}
	                              >
	                                ×{rebuyCount}
	                              </span>
	                            </div>
                          </div>

                          {/* Actions in requested order */}
						  <div className="flex items-center justify-end gap-[3px] flex-nowrap whitespace-nowrap shrink-0">
                            <button
                              onClick={() => act("addRebuy", { playerId: p.id })}
	                              className={`rounded-2xl border border-emerald-200/15 bg-black/20 px-1.5 py-1 leading-none ${s.btnText} hover:bg-black/35 transition-colors`}
                              title="Add rebuy"
                            >
                              +RB
                            </button>
                            <button
                              onClick={() => act("removeRebuy", { playerId: p.id })}
	                              className={`rounded-2xl border border-emerald-200/15 bg-black/20 px-1.5 py-1 leading-none ${s.btnText} hover:bg-black/35 transition-colors`}
                              title="Remove rebuy"
                            >
                              -RB
                            </button>

                            <button
                              onClick={() => act("bustOut", { playerId: p.id })}
	                              className={`rounded-2xl border border-red-200/20 bg-red-900/20 px-1.5 py-1 text-xs font-bold hover:bg-red-900/35 transition-colors`}
                            >
                              Bust
                            </button>

	                            <button
	                              onClick={() => act("undoCheckIn", { playerId: p.id })}
	                              className="rounded-2xl border border-emerald-200/15 bg-black/20 px-1.5 py-1 leading-none text-xs font-bold hover:bg-black/35 transition-colors"
	                            >
                              Unreg
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
{!loading && registered.length === 0 && (
                    <div className="text-emerald-100/70 text-lg font-semibold">No registered players.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Finishing Results */}
          
        </div>

      </div>
    </div>
    </>
  );
}