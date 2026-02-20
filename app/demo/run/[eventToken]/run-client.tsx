"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computePointsPreview } from "../../_lib/points";

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

  // Operator convenience: mark paid places. Persisted locally per browser + event token.
  const paidKey = useMemo(() => `eplt.demo.paid.${eventToken}`, [eventToken]);
  const [paidByPlace, setPaidByPlace] = useState<Record<number, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(paidKey);
      if (raw) setPaidByPlace(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [paidKey]);
  useEffect(() => {
    try {
      localStorage.setItem(paidKey, JSON.stringify(paidByPlace));
    } catch {
      // ignore
    }
  }, [paidKey, paidByPlace]);
  const [copiedPayoutsAt, setCopiedPayoutsAt] = useState<number>(0);

  // "All Data" overlay for the full field payouts/points view.
  const [allDataOpen, setAllDataOpen] = useState(false);
  const [showResultsPanel, setShowResultsPanel] = useState<boolean>(true);
  const [resultsView, setResultsView] = useState<"latest" | "all">("latest");

  // Drag & drop reorder for finishing results (better UX than click-click-click).
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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
      if (c.ok) {
        const cd: any = await c.json();
        setClockData(cd);
        // Keep Run operator params in sync with the demo clock and economics.
        try {
          const pub = cd?.public ?? {};
          setEventParams({
            tournamentStatus: String(pub.tournamentStatus ?? "REGISTERING").toUpperCase(),
            buyinAmount: Number(pub.buyinAmount ?? 0),
            rebuyAmount: Number(pub.rebuyAmount ?? 0),
            addonAmount: Number(pub.addonAmount ?? 0),
            buyinChips: Number(pub.buyinChips ?? 0),
            rebuyChips: Number(pub.rebuyChips ?? 0),
            addonChips: Number(pub.addonChips ?? 0),
            rebuys: Number(pub.rebuysCount ?? 0),
            addons: Number(pub.addonsCount ?? 0),
          });
        } catch {}
      }
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
      const sp = localStorage.getItem("eplt_run_show_results");
      if (sp === "0") setShowResultsPanel(false);
      const rv = localStorage.getItem("eplt_run_results_view");
      if (rv === "latest" || rv === "all") setResultsView(rv);
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("eplt_run_density", density);
    } catch {}
  }, [density, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("eplt_run_show_results", showResultsPanel ? "1" : "0");
      localStorage.setItem("eplt_run_results_view", resultsView);
    } catch {}
  }, [showResultsPanel, resultsView, mounted]);


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

  const latestBusted = useMemo(() => busted.slice(0, 5), [busted]);

  // Payout math (demo): pay top 15% of the field, always rounding up.
  const totalEntrants = registered.length + busted.length;
  const paidPlaces = Number(publicData?.paidPlaces ?? (totalEntrants > 0 ? Math.ceil(totalEntrants * 0.15) : 0));

  const buyinAmt = Number(publicData?.buyinAmount ?? 0);
  const rebuyAmt = Number(publicData?.rebuyAmount ?? 0);
  const addonAmt = Number(publicData?.addonAmount ?? 0);
  const buyinsCount = totalEntrants;
  const rebuysCount = Math.max(0, Math.floor(Number(publicData?.rebuysCount ?? eventParams?.rebuys ?? 0)));
  const addonsCount = Math.max(0, Math.floor(Number(publicData?.addonsCount ?? eventParams?.addons ?? 0)));
  const eligibleGross = Math.max(0, Math.floor(buyinsCount * buyinAmt + rebuysCount * rebuyAmt + addonsCount * addonAmt));

  const payoutRows = (publicData?.payouts as any[]) || [];
  const payoutMap = useMemo(() => {
    const m = new Map<number, number>();
    (payoutRows || []).forEach((r: any) => m.set(Number(r.place), Number(r.amount)));
    return m;
  }, [payoutRows]);

  const points = useMemo(() => {
    const sponsorTotal = Number(publicData?.leaguePointsInPlay ?? publicData?.leagueStake ?? 0);
    return computePointsPreview({
      entries: Math.max(0, Math.floor(totalEntrants || 0)),
      paidPlaces: Math.max(0, Math.floor(paidPlaces || 0)),
      buyin: buyinAmt,
      gross: eligibleGross,
      sponsorTotalOverride: sponsorTotal,
    });
  }, [publicData, totalEntrants, paidPlaces, buyinAmt, eligibleGross]);

  const pointsByPlace = useMemo(() => {
    const m = new Map<number, any>();
    (points?.rows || []).forEach((r: any) => m.set(Number(r.place), r));
    return m;
  }, [points]);

  const finisherByPlace = useMemo(() => {
    const m = new Map<number, Player>();
    busted.forEach((p: any) => {
      const fp = Number((p as any).finishPos ?? 0);
      if (fp > 0) m.set(fp, p);
    });
    return m;
  }, [busted]);

  // Full field list (busted + still-in). Used for the "All Data" overlay.
  const fullFieldRows = useMemo(() => {
    const inPlay = registered.map((p) => ({ p, finishPos: null as number | null }));
    const finished = busted.map((p: any) => ({ p, finishPos: Number((p as any).finishPos ?? null) as any }));

    // Put remaining players first (no finish yet), then completed finishes (1..N).
    const rows = [...inPlay, ...finished];
    rows.sort((a, b) => {
      const af = a.finishPos;
      const bf = b.finishPos;
      if (af == null && bf == null) return String(a.p.name).localeCompare(String(b.p.name));
      if (af == null) return -1;
      if (bf == null) return 1;
      return af - bf;
    });
    return rows;
  }, [registered, busted]);

// Pay sheet ordering: slot-based 1..N (N = entrants). We *display* 1st→last top-down,
// and we *fill* from the bottom up as bust-outs happen (Nth, N-1th, ...). The next bust-out slot is highlighted.
const paySheetRows = useMemo(() => {
  const entrants = Math.max(0, Math.floor(totalEntrants || 0));
  if (!entrants) return [];

  const finished = busted.map((p: any) => ({ p, finishPos: Number((p as any).finishPos ?? null) as any }));
  const finisherByPlaceLocal = new Map<number, any>();
  for (const r of finished) {
    if (r.finishPos != null && Number.isFinite(r.finishPos)) finisherByPlaceLocal.set(Number(r.finishPos), r.p);
  }

  const finishedCount = finished.filter((r) => r.finishPos != null).length;
  const nextPlace = Math.max(1, entrants - finishedCount);

  const rows: { place: number; p: any | null; isNext: boolean }[] = [];
  for (let place = 1; place <= entrants; place++) {
    rows.push({
      place,
      p: finisherByPlaceLocal.get(place) ?? null,
      isNext: place === nextPlace && finishedCount < entrants,
    });
  }
  return rows;
}, [totalEntrants, busted]);


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
          {/* Crest (big, left) */}
          <div className="col-span-12 md:col-span-3 min-w-0">
            <div className="rounded-2xl border-[2px] border-emerald-900/80 shadow-[0_10px_0_rgba(0,0,0,0.35)] bg-emerald-950/75 backdrop-blur-sm overflow-hidden">
              <div className="p-3 md:p-2 flex items-center justify-center">
                <img
                  src="/assets/eplt_crest_art_transparent_background.png"
                  alt="EPLT Crest"
                  className="w-full h-[260px] md:h-[320px] object-contain drop-shadow-[0_18px_20px_rgba(0,0,0,0.65)]"
                />
              </div>
              <div className="px-5 pb-4 text-center">
                <div className="text-[11px] uppercase tracking-widest text-emerald-200/80 font-black">Inaugural Season</div>
                <div className="text-lg font-black text-emerald-50/95">Elite Poker League</div>
              </div>
            </div>
          </div>

          {/* Payouts (middle) */}
          <div className="col-span-12 md:col-span-6 min-w-0">
            <div className="rounded-2xl border-[2px] border-emerald-900/80 shadow-[0_10px_0_rgba(0,0,0,0.35)] bg-emerald-950/75 backdrop-blur-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-emerald-200/10 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-widest text-emerald-200/80 font-black">Payouts + Points</div>
                  <div className="text-2xl font-black truncate">Operator Pay Sheet</div>
                  <div className="mt-1 text-sm text-emerald-100/75 font-semibold">
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
    <div>
      Prize Pool:{" "}
      <span className="font-black tabular-nums text-emerald-100/95">
        ${Number(publicData?.prizePool ?? 0).toLocaleString()}
      </span>
    </div>
    <div className="text-emerald-200/40">•</div>
    <div>
      Paid Places: <span className="font-black tabular-nums">{paidPlaces}</span>
    </div>
    <div className="text-emerald-200/40">•</div>
    <div>
      Entrants: <span className="font-black tabular-nums">{Number(players?.length ?? 0)}</span>
    </div>
  </div>

  <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs">
    <div className="text-emerald-100/65">Buy-ins</div>
    <div className="tabular-nums font-black">
      {Number(players?.length ?? 0)} × ${Number(publicData?.buyinAmount ?? 0).toLocaleString()}
      {" "}
      = ${Number((players?.length ?? 0) * Number(publicData?.buyinAmount ?? 0)).toLocaleString()}
    </div>

    <div className="text-emerald-100/65">Rebuys</div>
    <div className="tabular-nums font-black">
      {Number(publicData?.rebuysCount ?? 0)} × ${Number(publicData?.rebuyAmount ?? 0).toLocaleString()}
      {" "}
      = ${Number(Number(publicData?.rebuysCount ?? 0) * Number(publicData?.rebuyAmount ?? 0)).toLocaleString()}
    </div>

    <div className="text-emerald-100/65">Add-ons</div>
    <div className="tabular-nums font-black">
      {Number(publicData?.addonsCount ?? 0)} × ${Number(publicData?.addonAmount ?? 0).toLocaleString()}
      {" "}
      = ${Number(Number(publicData?.addonsCount ?? 0) * Number(publicData?.addonAmount ?? 0)).toLocaleString()}
    </div>
  </div>
</div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-[11px] uppercase tracking-widest text-emerald-200/70 font-black">League points in play</div>
                  <div className="text-2xl font-black tabular-nums">{Number(publicData?.leaguePointsInPlay ?? publicData?.leagueStake ?? 0).toLocaleString()}</div>

                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      className="px-3 py-1.5 rounded-xl border border-emerald-200/15 bg-emerald-900/20 hover:bg-emerald-900/30 text-xs font-black"
                      onClick={() => setAllDataOpen(true)}
                      title="Show full field (all entrants)"
                    >
                      All Data
                    </button>

                    <button
                      className="px-3 py-1.5 rounded-xl border border-emerald-200/15 bg-emerald-900/20 hover:bg-emerald-900/30 text-xs font-black"
                      onClick={async () => {
                        try {
                          const lines = Array.from({ length: Math.max(0, paidPlaces) }, (_, i) => i + 1).map((place) => {
                            const pl = finisherByPlace.get(place as any) as any;
                            const cash = payoutMap.get(place) ?? 0;
                            const pr: any = pointsByPlace.get(place) ?? null;
                            const nm = (pl?.name ?? "—").replace(/\s+/g, " ").trim();
                            const cashTxt = cash ? `$${Number(cash).toLocaleString()}` : "";
                            const ptsTxt = pr ? `${pr.total} pts` : "";
                            const paidTxt = paidByPlace?.[place] ? "(PAID)" : "";
                            return `${place}. ${nm} ${paidTxt}${cashTxt || ptsTxt ? " — " : ""}${[cashTxt, ptsTxt].filter(Boolean).join(" / ")}`.trim();
                          });
                          await navigator.clipboard.writeText(lines.join("\n"));
                          setCopiedPayoutsAt(Date.now());
                        } catch {
                          // ignore
                        }
                      }}
                      title="Copy paid places list"
                    >
                      Copy
                    </button>
                    <div className="text-[11px] text-emerald-200/70 font-semibold tabular-nums min-w-[52px]">
                      {copiedPayoutsAt && Date.now() - copiedPayoutsAt < 2500 ? "Copied" : ""}
                    </div>
                  </div>
                </div>
              </div>

              
	<div className="grid grid-cols-[72px_1fr_110px_92px_78px_78px_80px_84px] gap-0 text-[11px] uppercase tracking-wider bg-emerald-900/20">
  <div className="px-4 py-2">Place</div>
  <div className="px-4 py-2">Player</div>
  <div className="px-4 py-2 text-right">Cash</div>
	  <div className="px-4 py-2 text-right">Show-up</div>
	  <div className="px-4 py-2 text-right">Finish</div>
  <div className="px-4 py-2 text-right">ITM</div>
	  <div className="px-4 py-2 text-right">Total</div>
  <div className="px-4 py-2 text-right">Paid</div>
</div>

{/* Fixed-height scroll region so the page doesn't resize as rows change */}
<div className={"h-[320px] " + scrollCls}>
  {paySheetRows.length === 0 ? (
    <div className="h-full flex items-center justify-center text-sm text-emerald-100/55 font-semibold">
      No entrants yet — register players to populate payouts and points.
    </div>
  ) : (
    paySheetRows.map(({ place, p, isNext }) => {
  const pr: any = pointsByPlace.get(Number(place)) ?? null;
  const cash = payoutMap.get(Number(place)) ?? 0;

  // If points preview isn't available for a place yet (rare), fall back to show-up points.
  const showUp = pr ? pr.showUp : Number(points?.showUpEach ?? 0);
  const finishTier = pr ? pr.finishTier : 0;
  const winnerTier = pr ? pr.winnerTier : 0;
  const totalPts = pr ? pr.total : showUp;

  const tooltip = `Show-up: ${showUp}\nFinish: ${finishTier}\nITM: ${winnerTier}\nTotal: ${totalPts}`;

  const paidChecked = !!paidByPlace?.[place];
  const hasMoney = !!cash && place <= paidPlaces;

  return (
    <div
      key={String(place)}
	      className={
	        "grid grid-cols-[72px_1fr_110px_92px_78px_78px_80px_84px] gap-0 text-sm border-t border-emerald-200/10 " +
        (isNext ? "bg-emerald-400/10 ring-1 ring-inset ring-emerald-300/30" : "")
      }
    >
      <div className="px-4 py-2 font-black tabular-nums">
        {place}
        {isNext && <span className="ml-2 text-[10px] uppercase tracking-widest text-emerald-200/80 font-black">Next</span>}
      </div>

      <div className="px-4 py-2 font-semibold truncate">
        {p?.name ?? <span className="text-emerald-100/40">—</span>}
      </div>

      <div className="px-4 py-2 text-right tabular-nums font-black">
        {hasMoney ? `$${Number(cash).toLocaleString()}` : ""}
      </div>

      <div className="px-4 py-2 text-right tabular-nums font-black" title="Show-up points">
        {showUp ? showUp : ""}
      </div>

      <div className="px-4 py-2 text-right tabular-nums font-black" title="Finish points">
        {finishTier ? finishTier : ""}
      </div>

      <div className="px-4 py-2 text-right tabular-nums font-black" title="In-the-money points">
        {winnerTier ? winnerTier : ""}
      </div>

      <div className="px-4 py-2 text-right tabular-nums font-black" title={tooltip}>
        {totalPts ? totalPts : ""}
      </div>

      <div className="px-4 py-2 flex items-center justify-end">
        <label
          className={
            "inline-flex items-center gap-2 text-xs font-black select-none " +
            (hasMoney ? "cursor-pointer" : "cursor-not-allowed opacity-50")
          }
        >
          <input
            type="checkbox"
            disabled={!hasMoney}
            checked={paidChecked}
            onChange={(e) => setPaidByPlace((prev) => ({ ...prev, [place]: e.target.checked }))}
            className="accent-emerald-400"
          />
          <span className={paidChecked ? "text-emerald-200" : "text-emerald-200/60"}>Paid</span>
        </label>
      </div>
    </div>
  );
})
  )}
</div>

<div className="px-5 py-3 text-xs text-emerald-100/70 border-t border-emerald-200/10">
  Full field view (scroll). Show-up/Finish/ITM show the point buckets; hover Total for breakdown. Drag & drop finishers to fix bust-out order.
</div>

            </div>
          </div>

          {/* Operator tools (right) */}
          <div className="col-span-12 md:col-span-3 min-w-0">
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

      {/* All Data overlay */}
      {allDataOpen && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-5xl rounded-2xl border-[2px] border-emerald-200/15 bg-emerald-950/90 shadow-[0_22px_0_rgba(0,0,0,0.45)] overflow-hidden">
            <div className="px-5 py-4 border-b border-emerald-200/10 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-emerald-200/80 font-black">All Entrants</div>
                <div className="text-2xl font-black">Payouts & Points — Full Field</div>
              </div>
              <button
                className="rounded-2xl border border-emerald-200/15 bg-black/25 px-4 py-2 font-black hover:bg-black/40"
                onClick={() => setAllDataOpen(false)}
              >
                Close
              </button>
            </div>

            
	<div className="grid grid-cols-[92px_1fr_120px_92px_78px_78px_80px] gap-0 text-[11px] uppercase tracking-wider bg-emerald-900/25">
  <div className="px-5 py-3">Place</div>
  <div className="px-5 py-3">Player</div>
  <div className="px-5 py-3 text-right">Cash</div>
	  <div className="px-5 py-3 text-right">Show-up</div>
	  <div className="px-5 py-3 text-right">Finish</div>
  <div className="px-5 py-3 text-right">ITM</div>
	  <div className="px-5 py-3 text-right">Total</div>
</div>

<div className={"max-h-[70svh] " + scrollCls}>
  {fullFieldRows.map(({ p, finishPos }) => {
    const place = finishPos ?? 0;
    const cash = place > 0 ? (payoutMap.get(place) ?? 0) : 0;
    const pr: any = place > 0 ? (pointsByPlace.get(place) ?? null) : null;

    const showUp = pr ? pr.showUp : Number(points?.showUpEach ?? 0);
    const finishTier = pr ? pr.finishTier : 0;
    const winnerTier = pr ? pr.winnerTier : 0;
    const totalPts = pr ? pr.total : showUp;

    const tooltip = `Show-up: ${showUp}\nFinish: ${finishTier}\nITM: ${winnerTier}\nTotal: ${totalPts}`;

    const rowIsMoney = place > 0 && paidPlaces > 0 && place <= paidPlaces;
    return (
	      <div key={p.id} className="grid grid-cols-[92px_1fr_120px_92px_78px_78px_80px] gap-0 text-sm border-t border-emerald-200/10">
        <div className="px-5 py-3 font-black tabular-nums">
          {place ? (
            <span className={rowIsMoney ? "text-emerald-200" : "text-amber-200"}>{place}</span>
          ) : (
            <span className="text-emerald-200/60">IN</span>
          )}
        </div>
        <div className="px-5 py-3 font-semibold truncate">{p.name}</div>
        <div className="px-5 py-3 text-right tabular-nums font-black">{cash ? `$${Number(cash).toLocaleString()}` : ""}</div>
        <div className="px-5 py-3 text-right tabular-nums font-black">{showUp ? showUp : ""}</div>
        <div className="px-5 py-3 text-right tabular-nums font-black">{finishTier ? finishTier : ""}</div>
        <div className="px-5 py-3 text-right tabular-nums font-black">{winnerTier ? winnerTier : ""}</div>
        <div className="px-5 py-3 text-right tabular-nums font-black" title={tooltip}>{totalPts ? totalPts : ""}</div>
      </div>
    );
  })}
</div>

          </div>
        </div>
      )}

      {/* Main grid (no page scroll) */}
      <div className="px-6 pb-6">
        {/* 3-panel layout baseline is 3/5/4 (12-col). Apply a tiny ~1-icon (24px) shift from
            Registered → Checked In now that the "$" badge is removed from Registered. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[calc(25%+24px)_calc(41.666%-24px)_33.334%]">
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
          <div className="min-w-0">
            {showResultsPanel ? (
              <div className="rounded-2xl border-[2px] border-emerald-900/80 shadow-[0_10px_0_rgba(0,0,0,0.35)] bg-emerald-950/75 backdrop-blur-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-emerald-200/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={s.headerText}>Finishing Results</div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setResultsView("latest")}
                        className={`px-2 py-1 rounded-xl border text-xs font-black transition-colors ${
                          resultsView === "latest"
                            ? "border-emerald-200/35 bg-emerald-900/35 text-emerald-50"
                            : "border-emerald-200/15 bg-black/15 text-emerald-100/70 hover:bg-black/25"
                        }`}
                      >
                        Latest
                      </button>
                      <button
                        onClick={() => setResultsView("all")}
                        className={`px-2 py-1 rounded-xl border text-xs font-black transition-colors ${
                          resultsView === "all"
                            ? "border-emerald-200/35 bg-emerald-900/35 text-emerald-50"
                            : "border-emerald-200/15 bg-black/15 text-emerald-100/70 hover:bg-black/25"
                        }`}
                      >
                        All
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className={s.countText + " text-emerald-100/85 tabular-nums"}>{busted.length}</div>
                    <button
                      onClick={() => setShowResultsPanel(false)}
                      className="px-2 py-1 rounded-xl border border-emerald-200/15 bg-black/15 text-emerald-100/80 text-xs font-black hover:bg-black/25 transition-colors"
                      title="Hide this panel"
                    >
                      Hide
                    </button>
                  </div>
                </div>

                <div className="p-5">
                  {resultsView === "latest" ? (
                    <div className={"" + s.gapY + " h-[62svh] " + scrollCls}>
                      {latestBusted.map((p) => {
                        const rebuyCount = Math.max(0, Math.floor(Number((p as any).rebuys ?? 0)));
                        const hasRebuy = rebuyCount > 0;
                        const hasAddon = Boolean((p as any).addon);

                        return (
                          <div
                            key={p.id}
                            className={`rounded-2xl border border-emerald-200/15 bg-black/20 ${s.rowPad} ${rowCls(p)}`}
                          >
                            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                              {(() => {
                                const fp = Number((p as any).finishPos ?? 0);
                                const inMoney = paidPlaces > 0 && fp > 0 && fp <= paidPlaces;
                                return (
                                  <span
                                    className={
                                      "inline-flex items-center justify-center w-9 h-9 aspect-square shrink-0 rounded-full border font-black text-sm " +
                                      (inMoney
                                        ? "border-emerald-200/95 bg-emerald-500/75 text-emerald-50 shadow-[0_0_0_3px_rgba(16,185,129,0.38)]"
                                        : "border-amber-200/95 bg-amber-400/70 text-amber-50 shadow-[0_0_0_3px_rgba(251,191,36,0.34)]")
                                    }
                                    title={inMoney ? "In the money" : "Finish position"}
                                  >
                                    {fp || "—"}
                                  </span>
                                );
                              })()}

                              <div className="min-w-0">
                                <div className={s.rowText + " truncate"} title={p.name}>
                                  {p.name}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {hasAddon && (
                                  <span className="inline-flex items-center px-2 h-6 rounded-2xl border border-emerald-200/15 bg-black/15 text-emerald-100/80 text-xs font-black">
                                    AO
                                  </span>
                                )}
                                {hasRebuy && (
                                  <span
                                    className="inline-flex items-center px-2 h-6 rounded-2xl border border-emerald-200/15 bg-black/15 text-emerald-100/80 text-xs font-black tabular-nums"
                                    title={`${rebuyCount} rebuy${rebuyCount === 1 ? "" : "s"}`}
                                  >
                                    RB {rebuyCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {!loading && latestBusted.length === 0 && (
                        <div className="text-emerald-100/70 text-lg font-semibold">Nobody busted yet.</div>
                      )}

                      {!loading && latestBusted.length > 0 && (
                        <div className="text-emerald-100/55 text-xs font-semibold pt-1">
                          Tip: switch to <span className="text-emerald-100/80">All</span> to drag &amp; reorder.
                        </div>
                      )}
                    </div>
                  ) : (
                                  <div className={"" + s.gapY + " h-[62svh] " + scrollCls}>
                                    {busted.map((p, idx) => {
                                      // Preserve badges for busted players (add-on/rebuys) so the icons "follow" them.
                                      const rebuyCount = Math.max(0, Math.floor(Number((p as any).rebuys ?? 0)));
                                      const hasRebuy = rebuyCount > 0;
                                      const hasAddon = Boolean((p as any).addon);
                                      // NOTE: Do NOT carry the "$" paid badge into finishing results.

                                      return (
                                        <div
                                          key={p.id}
                                          draggable
                                          onDragStart={(e) => {
                                            setDragId(p.id);
                                            setDragOverId(p.id);
                                            try {
                                              e.dataTransfer.setData("text/plain", p.id);
                                              e.dataTransfer.effectAllowed = "move";
                                            } catch {}
                                          }}
                                          onDragOver={(e) => {
                                            e.preventDefault();
                                            if (dragOverId !== p.id) setDragOverId(p.id);
                                            try { e.dataTransfer.dropEffect = "move"; } catch {}
                                          }}
                                          onDrop={async (e) => {
                                            e.preventDefault();
                                            const from = dragId || (() => {
                                              try { return e.dataTransfer.getData("text/plain"); } catch { return ""; }
                                            })();
                                            const to = p.id;
                                            if (!from || !to || from === to) return;

                                            const ids = busted.map((x) => x.id);
                                            const fromIdx = ids.indexOf(from);
                                            const toIdx = ids.indexOf(to);
                                            if (fromIdx < 0 || toIdx < 0) return;

                                            const next = [...ids];
                                            next.splice(fromIdx, 1);
                                            next.splice(toIdx, 0, from);

                                            await post(eventToken, { action: "reorderFinishers", orderedIds: next });
                                            await refresh();
                                          }}
                                          onDragEnd={() => {
                                            setDragId(null);
                                            setDragOverId(null);
                                          }}
                                          className={`rounded-2xl border border-emerald-200/15 bg-black/20 ${s.rowPad} ${rowCls(p)} ${dragOverId === p.id ? "outline outline-2 outline-emerald-300/40" : ""}`}
                                        >
                                          {/* Player | Badges+Actions (fixed right) so finish badge + icons line up */}
                                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                            {/* Player */}
                                            <div className="min-w-0">
                                              <div className={s.rowText + " flex items-center gap-2 min-w-0 overflow-hidden"}>

                                                <span
                                                  className="inline-flex items-center justify-center w-7 h-7 rounded-xl border border-emerald-200/15 bg-black/25 text-emerald-50/90 text-sm font-black cursor-grab active:cursor-grabbing"
                                                  title="Drag to reorder"
                                                  aria-label="Drag handle"
                                                >
                                                  ≡
                                                </span>
                              

                                                {/* Finish position: focal + consistent alignment */}
                                                {(() => {
                                                  const fp = Number((p as any).finishPos ?? 0);
                                                  const inMoney = paidPlaces > 0 && fp > 0 && fp <= paidPlaces;
                                                  return (
                                                    <span
                                                      className={
                                                        "inline-flex items-center justify-center w-9 h-9 aspect-square shrink-0 rounded-full border font-black text-sm " +
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

                                              <div className="flex items-center gap-1">
                                                <button
                                                  onClick={() => act("moveFinisher", { playerId: p.id, dir: "up" })}
                                                  disabled={idx === 0}
                                                  className={`rounded-2xl border border-emerald-200/15 bg-black/20 px-2 py-1 text-xs font-black hover:bg-black/35 transition-colors ${idx === 0 ? "opacity-40 cursor-not-allowed" : ""}`}
                                                  title="Move up (better finish)"
                                                >
                                                  ▲
                                                </button>
                                                <button
                                                  onClick={() => act("moveFinisher", { playerId: p.id, dir: "down" })}
                                                  disabled={idx === busted.length - 1}
                                                  className={`rounded-2xl border border-emerald-200/15 bg-black/20 px-2 py-1 text-xs font-black hover:bg-black/35 transition-colors ${idx === busted.length - 1 ? "opacity-40 cursor-not-allowed" : ""}`}
                                                  title="Move down (worse finish)"
                                                >
                                                  ▼
                                                </button>
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
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-[2px] border-emerald-900/80 shadow-[0_10px_0_rgba(0,0,0,0.35)] bg-emerald-950/75 backdrop-blur-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-emerald-200/10 flex items-center justify-between gap-3">
                  <div className={s.headerText}>Finishing Results</div>
                  <button
                    onClick={() => setShowResultsPanel(true)}
                    className="px-3 py-1.5 rounded-xl border border-emerald-200/15 bg-black/15 text-emerald-100/80 text-xs font-black hover:bg-black/25 transition-colors"
                    title="Show finishing results"
                  >
                    Show
                  </button>
                </div>
                <div className="p-5 text-emerald-100/60 text-sm font-semibold">
                  Hidden (toggle back on any time).
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
    </>
  );
}