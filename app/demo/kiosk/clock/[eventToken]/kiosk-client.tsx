"use client";


import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useClock } from "../../../_lib/useClock";
import { computePointsPreview } from "../../../_lib/points";


function fmtMs(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function comma(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString();
}

// Compact number display for blind strings.
// Examples: 1000 -> 1k, 4000 -> 4k, 15000 -> 15k, 500000 -> 500k, 1000000 -> 1M
function compact(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";

  // Special case: do NOT abbreviate exactly 1,000
  if (v === 1000) return "1,000";

  const abs = Math.abs(v);

  if (abs >= 1_000_000_000 && v % 1_000_000_000 === 0) return `${v / 1_000_000_000}B`;
  if (abs >= 1_000_000 && v % 1_000_000 === 0) return `${v / 1_000_000}M`;
  if (abs >= 1_000 && v % 1_000 === 0) return `${v / 1_000}k`;

  return comma(v);
}

function compactStructure(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  // Use comma formatting up to 1,500 (and always for 1,000)
  if (v <= 1500) return comma(v);
  // Abbreviate 2,000+ (allows 2.5k etc). Keep no trailing .0
  if (Math.abs(v) >= 2000) {
    try {
      const fmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
      return fmt.format(v).replace(/\.0(?=[a-zA-Z])/, "");
    } catch {
      // Fallback to existing compact() behavior
      return compact(v);
    }
  }
  return comma(v);
}

async function postControl(eventToken: string, body: any) {
  const res = await fetch(`/api/demo/clock/${eventToken}/control`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

function Panel({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border-[2px] border-emerald-900/80 shadow-[0_10px_0_rgba(0,0,0,0.35)]
        bg-emerald-950/75 backdrop-blur-sm text-emerald-50
        ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

function placeLabel(place: number) {
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  if (place === 3) return "3rd";
  return `${place}th`;
}

function AutoFitText({
  text,
  className = "",
  maxPx = 140,
  minPx = 44,
}: {
  text: string;
  className?: string;
  maxPx?: number;
  minPx?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fontPx, setFontPx] = useState<number>(minPx);

  const fit = () => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    // Ensure we have real dimensions.
    const w = parent.clientWidth;
    if (!w) return;

    // Binary-search the largest font-size that fits (single-line).
    let lo = minPx;
    let hi = maxPx;
    let best = minPx;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      el.style.fontSize = `${mid}px`;
      // Force single line fit; height is mostly irrelevant because we keep it one-line.
      const fits = el.scrollWidth <= parent.clientWidth;
      if (fits) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    setFontPx(best);
  };

  useLayoutEffect(() => {
    // Fit after paint.
    const id = window.requestAnimationFrame(fit);
    const el = ref.current;
    const parent = el?.parentElement;
    if (!parent) return () => window.cancelAnimationFrame(id);
    const ro = new ResizeObserver(() => fit());
    ro.observe(parent);
    return () => {
      window.cancelAnimationFrame(id);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, maxPx, minPx]);

  return (
    <div ref={ref} className={className} style={{ fontSize: fontPx }}>
      {text}
    </div>
  );
}

function AutoFitRichText({
  measureText,
  children,
  className,
  minPx = 34,
  maxPx = 120,
}: {
  measureText: string;
  children: React.ReactNode;
  className?: string;
  minPx?: number;
  maxPx?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fontPx, setFontPx] = useState<number>(minPx);

  const fit = () => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    el.style.fontSize = `${minPx}px`;

    let lo = minPx;
    let hi = maxPx;
    let best = minPx;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      el.style.fontSize = `${mid}px`;
      const fits = el.scrollWidth <= parent.clientWidth;
      if (fits) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    setFontPx(best);
  };

  useLayoutEffect(() => {
    const id = window.requestAnimationFrame(fit);
    const el = ref.current;
    const parent = el?.parentElement;
    if (!parent) return () => window.cancelAnimationFrame(id);
    const ro = new ResizeObserver(() => fit());
    ro.observe(parent);
    return () => {
      window.cancelAnimationFrame(id);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureText, maxPx, minPx]);

  return (
    <div ref={ref} className={className} style={{ fontSize: fontPx }}>
      {children}
    </div>
  );
}



function CountdownDigits({
  value,
  urgent = false,
}: {
  value: string;
  urgent?: boolean;
}) {
  const [minPart, secPart] = String(value ?? "—:—").split(":");
  const prevSecRef = useRef<string>(secPart);
  const [secAnim, setSecAnim] = useState(0);

  useEffect(() => {
    if (secPart !== prevSecRef.current) {
      prevSecRef.current = secPart;
      setSecAnim((n) => n + 1);
    }
  }, [secPart]);

  return (
    <div
      className={
        `tabular-nums font-black leading-none ` +
        (urgent ? "text-red-400 kiosk-urgent-pulse" : "text-emerald-50")
      }>
      <span>{minPart}</span>
      <span>:</span>
      <span
        key={secAnim}
        className={"inline-block min-w-[2ch] text-right kiosk-sec-tick"}>
        {secPart ?? "00"}
      </span>
    </div>
  );
}
export default function KioskClockClient({ eventToken }: { eventToken: string }) {
  const { payload, estimatedNow, refreshNow } = useClock(eventToken);

  // UI state
  const [showPayouts, setShowPayouts] = useState(false);

  // Payout table (kiosk): show a fixed number of rows on-page (no scrolling in-page).
  // The full, scrollable table is available in the modal.
  const MAX_PAYOUT_ROWS = 11;
  const payoutBoxRef = useRef<HTMLDivElement | null>(null);

  // Left structure (kiosk): show a fixed number of upcoming levels (no scrolling in-page).
  // Left structure (kiosk): keep intentionally short so it bottoms-out cleanly above the buttons.
  // Fixed count, no scrolling.
  const MAX_STRUCTURE_ROWS = 7;
  const structureBoxRef = useRef<HTMLDivElement | null>(null);

  // clickable status pill cycles through common tournament states.
  const STATUS_CYCLE = [
    { key: "announced", label: "Announced", cls: "text-slate-200" },
    { key: "registering", label: "Registering", cls: "text-blue-600" },
    { key: "running_late", label: "Running (Late Reg)", cls: "text-amber-300" },
    { key: "running", label: "Running", cls: "text-emerald-300" },
    { key: "completed", label: "Completed", cls: "text-fuchsia-300" },
  ] as const;
  const [statusOverrideKey, setStatusOverrideKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const k = localStorage.getItem(`eplt_demo_status_${eventToken}`);
      if (k) setStatusOverrideKey(k);
    } catch {}
  }, [eventToken]);

  useEffect(() => {
    try {
      if (statusOverrideKey) localStorage.setItem(`eplt_demo_status_${eventToken}`, statusOverrideKey);
    } catch {}
  }, [eventToken, statusOverrideKey]);

  const advanceStatus = () => {
    setStatusOverrideKey((prev) => {
      const idx = STATUS_CYCLE.findIndex((s) => s.key === prev);
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
      return next.key;
    });
  };

  // Demo polish: pulse the blind panel once when the level changes.
  const prevLevelRef = useRef<number | null>(null);
  const [levelPulse, setLevelPulse] = useState(false);
  const [showStructureModal, setShowStructureModal] = useState(false);

  useEffect(() => {
    const lvl = (payload?.clock?.levelIndex ?? null) as number | null;
    if (lvl == null) return;
    if (prevLevelRef.current != null && lvl !== prevLevelRef.current) {
      setLevelPulse(true);
      const t = window.setTimeout(() => setLevelPulse(false), 650);
      prevLevelRef.current = lvl;
      return () => window.clearTimeout(t);
    }
    prevLevelRef.current = lvl;
  }, [payload?.clock?.levelIndex]);

  // Capability-aware controls: default disabled unless server advertises supported actions.
  const controlActionsRaw =
    (payload as any)?.public?.controlActions ??
    (payload as any)?.public?.capabilities?.controls ??
    (payload as any)?.public?.capabilities?.controlActions;
  const controlActions = Array.isArray(controlActionsRaw)
    ? controlActionsRaw.map((s: any) => String(s))
    : [];
  const controlsEnabled = controlActions.length > 0;
  const canControl = (action: string) => controlsEnabled && controlActions.includes(action);

  async function act(action: string, extra: any = {}) {
    if (!canControl(action)) return;
    await postControl(eventToken, { action, ...extra });
    await refreshNow();
  }

  // Safe payload access (no conditional hooks / no early-return hook order issues)
  const p: any = payload ?? {};
  // Running state (demo-safe: derived from payload when available; defaults false)
  const clockState = String(p.clock?.state ?? "").toUpperCase();
  const isRunning = clockState === "RUNNING";
  const isPaused = clockState === "PAUSED";
  const isStopped = clockState === "STOPPED";

  const serverNowAtPoll = Number(p.serverNow ?? 0);
  const delta = estimatedNow - serverNowAtPoll;

  const baseRemaining = Number(p.computed?.msRemainingInLevel ?? 0);
  const liveRemaining = isPaused || isStopped ? baseRemaining : (baseRemaining - delta);
  const baseUntilBreak = Number(p.computed?.msUntilNextBreak ?? 0);
  const liveUntilBreak = isPaused || isStopped ? baseUntilBreak : (baseUntilBreak - delta);

  const cur = p.computed?.currentLevel ?? null;
  const nextLevels = (p.computed?.nextLevels as any[]) || [];
  const isBreak = !!cur?.isBreak;

  // Structure list (left): show ONE level per row, no scrolling.
  // Use server-provided levels when available; otherwise fall back to the demo structure provided in this project.
  // NOTE: For kiosk visual validation (late levels are wider), we can force the fallback structure list.
  const FORCE_FALLBACK_STRUCTURE_FOR_PREVIEW = false;

  const DEFAULT_STRUCTURE_STRINGS: string[] = [
    "200/400/400",
    "500/1,000/1,000",
    "5,000/10,000/10,000",
    "50,000/100,000/100,000",
    "500,000/1,000,000/1,000,000",
    "1,000,000/2,000,000/2,000,000",
  ];

    const parseToken = (raw: string) => {
    const s = String(raw || "").trim().replace(/,/g, "");
    if (!s) return 0;
    const m = s.match(/^(\d+)([kmb])$/i);
    if (m) {
      const num = Number(m[1] || 0);
      const suf = String(m[2] || "").toUpperCase();
      const mul = suf === "K" ? 1_000 : suf === "M" ? 1_000_000 : suf === "B" ? 1_000_000_000 : 1;
      const v = num * mul;
      return Number.isFinite(v) ? v : 0;
    }
    const v = Number(s);
    return Number.isFinite(v) ? v : 0;
  };

  const parseStructureLine = (s: string) => {
    const parts = s.split("/").map((x) => x.trim());
    const [sb, bb, ante] = parts.map(parseToken);
    return { sb, bb, ante };
  };

  const rawStructureLevels: any[] =
    (p.public?.structureLevels as any[]) ??
    (p.public?.structure?.levels as any[]) ??
    (p.demo?.structureLevels as any[]) ??
    (p.demo?.structure?.levels as any[]) ??
    (p.public?.levels as any[]) ??
    (p.demo?.levels as any[]) ??
    [];

  const serverLevels: any[] =
    !FORCE_FALLBACK_STRUCTURE_FOR_PREVIEW && rawStructureLevels.length
      ? rawStructureLevels
      : DEFAULT_STRUCTURE_STRINGS.map((line, idx) => ({
          level: idx + 2,
          ...parseStructureLine(line),
          isBreak: false,
        }));

  // Kiosk structure list (left): includes breaks as rows.
  // Source order is the true clock structure order; we show the *next* entries starting after the current index.
  const structureLevels = useMemo(() => {
    const src: any[] =
      (p.clock?.structure as any[]) ??
      (serverLevels as any[]) ??
      [];

    return src.map((lvl: any, idx: number) => ({
      index: idx,
      level: idx + 1,
      sb: Number(lvl.sb ?? lvl.smallBlind ?? lvl.small_blind ?? 0),
      bb: Number(lvl.bb ?? lvl.bigBlind ?? lvl.big_blind ?? 0),
      ante: Number(lvl.ante ?? lvl.bbAnte ?? lvl.bigBlindAnte ?? lvl.big_blind_ante ?? 0),
      isBreak: Boolean(lvl.isBreak ?? lvl.is_break ?? false),
    }));
  }, [p.clock?.structure, serverLevels]);

  // Kiosk requirement: the *next* entry should always be at the top of the list (including breaks).
  const upcomingStructureLevels = useMemo(() => {
    if (!structureLevels.length) return [];
    const curIdx = Number(p.clock?.levelIndex ?? 0);
    const out: any[] = [];
    for (let i = 1; i <= structureLevels.length; i++) {
      const __idx = (curIdx + i) % structureLevels.length;
      out.push({ ...structureLevels[__idx], __idx });
    }
    return out;
  }, [structureLevels, p.clock?.levelIndex]);



  const leagueName = p.display?.leagueName ?? "Jokers Wild Poker League";
  const eventLabel = p.display?.eventLabel ?? p.display?.eventName ?? "Week 8 NL Hold'em";
  const eventTime = p.display?.eventTime ?? "6:00pm";

  // Counts / roster-derived numbers (demo-safe): driven by Run page via event store.
  const playersTotal = Number(p.public?.playersTotal ?? 0);
  const playersRemaining = Number(p.public?.playersRemaining ?? playersTotal);
  const buyinsCount = Number(p.public?.buyinsCount ?? 0);
  const rebuysCount = Number(p.public?.rebuysCount ?? 0);
  const addonsCount = Number(p.public?.addonsCount ?? 0);

  const entrants = Math.max(0, Math.floor(playersTotal));
  const remaining = Math.max(0, Math.floor(playersRemaining));

  const levelIndex = Number(p.clock?.levelIndex ?? 0);
  const levelNum = blindOrdinalFromLevels(structureLevels, levelIndex);
  // Display-only buy-in info (demo data; Run is source of truth)
  const buyin = Number(p.public?.buyinAmount ?? 120);
  const rebuy = Number(p.public?.rebuyAmount ?? 120);
  const addon = Number(p.public?.addonAmount ?? 20);

  // Stack config (chips): Run is source of truth
  const buyinStack = Number(p.public?.buyinChips ?? 20000);
  const rebuyStack = Number(p.public?.rebuyChips ?? buyinStack);
  const addonStack = Number(p.public?.addonChips ?? 40000);

  // Key rules:
  // chipsInPlay = buyins*buyinChips + rebuys*rebuyChips + addons*addonChips
  // avgStack = chipsInPlay / remainingPlayers
  const chipsInPlay = Math.max(
    0,
    Math.floor(buyinsCount) * buyinStack +
      Math.floor(rebuysCount) * rebuyStack +
      Math.floor(addonsCount) * addonStack
  );
  const avgStack = remaining > 0 ? Math.floor(chipsInPlay / remaining) : 0;

  // Payout state (computed server-side; single source of truth)
  // Be defensive: older builds may nest these differently or rename fields.
  const paidPlaces = Number((p.public?.paidPlaces ?? p.public?.paidSpots ?? p.computed?.paidPlaces) ?? 0);
  const prizePool = Number((p.public?.prizePool ?? p.public?.prizePoolDollars ?? p.computed?.prizePool) ?? 0);
  const leagueStake = Number((p.public?.leagueStake ?? p.public?.leagueStakeDollars ?? p.computed?.leagueStake) ?? 0);
  const runnerPool = Number((p.public?.runnerPool ?? p.public?.runnerDollars ?? p.computed?.runnerPool) ?? 0);
  const leaguePointsInPlay = Number((p.public?.leaguePointsInPlay ?? p.points?.leaguePointsInPlay ?? p.computed?.leaguePointsInPlay) ?? 0);
  const payouts = (p.public?.payouts ?? p.public?.payoutRowsTop5 ?? p.computed?.payouts ?? []) as any[];

  const fmtPct = (x: number) => {
    const v = Math.round((Number(x) || 0) * 1000) / 10; // 1 decimal
    return Number.isFinite(v) ? (v % 1 === 0 ? `${v.toFixed(0)}%` : `${v.toFixed(1)}%`) : '0%';
  };

  const payoutRows = useMemo(() => {
    const rows = Array.isArray(payouts) ? payouts.slice() : [];
    rows.sort((a: any, b: any) => Number(a?.place ?? 0) - Number(b?.place ?? 0));
    return rows;
  }, [payouts]);

  // Header status text
  const resolvedStatus = (() => {
    if (isBreak) return { label: "BREAK", cls: "text-emerald-50" };
    const byOverride = STATUS_CYCLE.find((s) => s.key === statusOverrideKey);
    if (byOverride) return { label: byOverride.label, cls: byOverride.cls };
    // fallback from payload
    const raw = String(p.display?.statusText ?? (p.clock?.isRunning ? "Running" : "Registering"));
    if (/announce/i.test(raw)) return { label: "Announced", cls: "text-slate-200" };
    if (/late/i.test(raw)) return { label: "Running (Late Reg)", cls: "text-amber-300" };
    if (/complete/i.test(raw)) return { label: "Completed", cls: "text-fuchsia-300" };
    if (/run/i.test(raw)) return { label: "Running", cls: "text-emerald-300" };
    return { label: "Registering", cls: "text-blue-600" };
  })();

  const statusText = resolvedStatus.label;

  const bigCountdown = fmtMs(liveRemaining);
  const breakIn = fmtMs(liveUntilBreak);

  const curSb = cur?.sb ?? "—";
  const curBb = cur?.bb ?? "—";
  const curAnte = cur?.ante ?? "—";


  // Next levels list, include the next break marker if present
  const buildFallbackNextLevels = (count: number) => {
    const out: any[] = [];
    const sb0 = Number(cur?.sb ?? 100) || 100;
    const bb0 = Number(cur?.bb ?? 200) || 200;
    const ante0 = Number(cur?.ante ?? 200) || 0;
    for (let i = 0; i < count; i++) {
      const mult = Math.pow(2, Math.floor((i + 1) / 3));
      out.push({ sb: Math.round(sb0 * mult), bb: Math.round(bb0 * mult), ante: Math.round(ante0 * mult) });
    }
    return out;
  };

  // Next levels list: try server schedule; if short, fill with a reasonable demo ladder.
  const nextList = (nextLevels.length >= 7 ? nextLevels : [...nextLevels, ...buildFallbackNextLevels(12)]).slice(0, 12);
  const next0: any = nextList?.[0] ?? {};
  const nextSb = next0?.sb ?? curSb;
  const nextBb = next0?.bb ?? curBb;
  const nextAnte = next0?.ante ?? curAnte;


  

  const isLoading = !payload;

  // Break line shown directly under the main timer (no footer panel)

  // Urgency cue: under 60 seconds remaining (running state only).
  const isUrgent = !isLoading && !isBreak && liveRemaining > 0 && liveRemaining < 60_000;

  return (
    <div className="w-screen text-emerald-50 bg-[#0b2a1c] bg-[url('/assets/bg_green_1920.webp')] bg-cover bg-center flex flex-col min-h-[100svh]">
      <style jsx global>{`
        @keyframes kioskSecTick {
          from { transform: translateY(8px); opacity: 0.4; filter: blur(0.6px); }
          to   { transform: translateY(0);   opacity: 1;   filter: blur(0); }
        }
        @keyframes kioskUrgentPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.82; }
        }
        @keyframes kioskBreakDrift {
          0%, 100% { background-position: 50% 40%, 0% 0%; }
          50%      { background-position: 50% 55%, 100% 100%; }
        }

        .kiosk-sec-tick {
          animation: kioskSecTick 180ms ease-out 1;
          will-change: transform, opacity, filter;
        }

        .kiosk-urgent-pulse {
          animation: kioskUrgentPulse 1.4s ease-in-out infinite;
          text-shadow: 0 0 14px rgba(248, 113, 113, 0.20), 0 0 28px rgba(248, 113, 113, 0.14);
          will-change: opacity;
        }

        .kiosk-break-backdrop {
          background:
            radial-gradient(1200px circle at 50% 35%, rgba(16, 185, 129, 0.18), rgba(0,0,0,0.92)),
            linear-gradient(135deg, rgba(4, 20, 14, 0.85), rgba(0, 0, 0, 0.85));
          animation: kioskBreakDrift 18s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .kiosk-sec-tick,
          .kiosk-urgent-pulse,
          .kiosk-break-backdrop {
            animation: none !important;
          }
        }
      `}</style>
      {/* 
      {/* Layout frame */}
      <div className="flex-1 w-full p-4 md:p-6 overflow-hidden min-h-0 flex flex-col">
        {/* Header strip */}
	        <Panel className="h-[64px] md:h-[72px] flex items-center px-4 md:px-5">
          <div className="w-full grid grid-cols-3 items-start">
            <div className="text-left">
	              <div className="inline-flex items-center gap-2 min-w-0">
	                <div className="text-2xl md:text-3xl font-semibold truncate min-w-0">{leagueName}</div>
	                <img
	                  src="/assets/poker_chip_diamond.png"
	                  alt="Poker chip"
	                  className="h-6 w-6 md:h-7 md:w-7 opacity-95 shrink-0"
	                />
	              </div>
            </div>
            <div className="text-center">
              <button onClick={advanceStatus} className="text-4xl md:text-6xl font-black tracking-tight select-none">
                <span className={resolvedStatus.cls}>{statusText}</span>
              </button>
            </div>
            <div className="text-right">
	              <div className="inline-flex items-center justify-end gap-2 min-w-0">
	                <img
	                  src="/assets/poker_chip_spade.png"
	                  alt="Poker chip"
	                  className="h-5 w-5 md:h-6 md:w-6 opacity-95 shrink-0"
	                />
	                <div className="text-lg md:text-xl font-semibold truncate min-w-0">{eventLabel}</div>
	              </div>
              <div className="text-lg md:text-xl font-semibold">{eventTime}</div>
            </div>
          </div>
        </Panel>

        <div className="mt-2 md:mt-3 grid grid-cols-12 gap-3 md:gap-4 flex-1 min-h-0">
          {/* Left column */}
          <div className="col-span-12 md:col-span-3">
            {/* Combined info panel (requested: 7 items + next levels list moved here) */}
            <Panel className="h-full p-5 flex flex-col overflow-hidden">
	              <div className="grid grid-cols-2 gap-y-2 text-base md:text-lg whitespace-nowrap">
	                <div className="text-emerald-100/90 font-semibold whitespace-nowrap text-lg md:text-xl">Players:</div>
	                <div className="text-right font-black tabular-nums text-amber-100 whitespace-nowrap text-2xl md:text-3xl">{entrants}</div>
	                <div className="text-emerald-100/90 font-semibold whitespace-nowrap text-lg md:text-xl">Remaining:</div>
	                <div className="text-right font-black tabular-nums text-amber-100 whitespace-nowrap text-2xl md:text-3xl">{remaining}</div>
				<div className="mt-2 text-emerald-100/90 font-semibold whitespace-nowrap">Chips In Play:</div>
                <div className="mt-2 text-right font-black tabular-nums text-amber-100 whitespace-nowrap">{comma(chipsInPlay)}</div>
	                <div className="text-emerald-100/90 font-semibold whitespace-nowrap">Avg Chips:</div>
                <div className="text-right font-black tabular-nums text-amber-100 whitespace-nowrap">{comma(avgStack)}</div>

                <div className="mt-4 col-span-2 border-t border-emerald-200/10" />

                {/* Buy-in / Rebuy / Add-on summary (3 rows). Fixed columns so the trailing "L8" lines up perfectly. */}
                <div className="mt-2 col-span-2 space-y-2">
                  <div className="grid grid-cols-[7.25rem_1fr] items-center gap-2 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-emerald-100/90 font-semibold text-sm md:text-base">
                      <span className="text-base md:text-lg">🎟️</span>
                      <span>Buy In:</span>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-1 text-right font-black tabular-nums whitespace-nowrap text-[10px] md:text-xs">
                      <div className="text-right">
                        <span className="text-emerald-50">${comma(buyin)}</span>{" "}
                        <span className="text-emerald-100/70 font-semibold">for</span>{" "}
                        <span className="text-amber-100">{comma(buyinStack)}</span>{" "}
                        <span className="text-emerald-100/70 font-semibold">up to</span>
                      </div>
                      <div className="text-right text-emerald-50 font-black whitespace-nowrap pr-0">L8</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-[7.25rem_1fr] items-center gap-2 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-emerald-100/90 font-semibold text-sm md:text-base">
                      <span className="text-base md:text-lg">🔁</span>
                      <span>Rebuys:</span>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-1 text-right font-black tabular-nums whitespace-nowrap text-[10px] md:text-xs">
                      <div className="text-right">
                        <span className="text-emerald-50">${comma(rebuy)}</span>{" "}
                        <span className="text-emerald-100/70 font-semibold">for</span>{" "}
                        <span className="text-amber-100">{comma(rebuyStack)}</span>{" "}
                        <span className="text-emerald-100/70 font-semibold">up to</span>
                      </div>
                      <div className="text-right text-emerald-50 font-black whitespace-nowrap pr-0">L8</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-[7.25rem_1fr] items-center gap-2 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-emerald-100/90 font-semibold text-sm md:text-base">
                      <span className="text-base md:text-lg">➕</span>
                      <span>Add ons:</span>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-1 text-right font-black tabular-nums whitespace-nowrap text-[10px] md:text-xs">
                      <div className="text-right">
                        <span className="text-emerald-50">${comma(addon)}</span>{" "}
                        <span className="text-emerald-100/70 font-semibold">for</span>{" "}
                        <span className="text-amber-100">{comma(addonStack)}</span>{" "}
                        <span className="text-emerald-100/70 font-semibold">up to</span>
                      </div>
                      <div className="text-right text-emerald-50 font-black whitespace-nowrap pr-0">L8</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Structure list (Levels 2–10) */}
              <div className="mt-4 border-t border-emerald-200/10" />
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <button type="button" onClick={() => setShowStructureModal(true)} className="text-sm md:text-base font-black text-emerald-100 tracking-wide text-left hover:text-emerald-50 transition-colors">Structure</button>
                <div className="text-xs opacity-60">Click for full view</div>
              </div>


              <div className="mt-2 grid grid-cols-[2.25rem_2.75rem_minmax(0,1fr)] px-2 text-[11px] md:text-sm font-black text-emerald-100/70">
                <div>Lvl</div>
                <div className="text-amber-200 text-left tabular-nums pl-1">Mins</div>
                <div className="text-right font-black"><span className="text-emerald-50">sb / bb</span> <span className="text-amber-100">(Ante)</span></div>
              </div>
	              {/* Subtle divider so headers don't run into the first data row */}
	              <div className="mt-1 border-b-2 border-emerald-200/25" />
              {/* Single-column list: one level per row (no wrapping, no scrolling) */}
              <div ref={structureBoxRef} className="mt-2 flex flex-col gap-1 text-[11px] md:text-sm overflow-hidden">
                {structureLevels.length === 0 && <div className="opacity-60">—</div>}
                {upcomingStructureLevels.slice(0, MAX_STRUCTURE_ROWS).map((lvl: any, idx: number) => (
                  <div
                    key={`${Number(lvl.__idx ?? idx)}-${idx}` }
                    className={`grid grid-cols-[2.25rem_2.75rem_minmax(0,1fr)] items-baseline gap-2 leading-tight whitespace-nowrap rounded-md px-2 py-[2px] ${
                      idx % 2 === 0 ? "bg-emerald-950/75" : "bg-emerald-900/45"
                    }`}
                  >
                    <div className="font-semibold text-emerald-100/90 whitespace-nowrap">{lvl.isBreak ? "" : `${blindOrdinalFromLevels(structureLevels, Number(lvl.__idx ?? 0))}`}</div>
                    <div className="font-black tabular-nums whitespace-nowrap text-amber-200 text-left pl-1">
                      {minsForRow(lvl, 600000, 900000)}
                    </div>
                    {lvl.isBreak ? (
                      <div className="font-black tabular-nums whitespace-nowrap text-amber-200 text-left pl-1 min-w-0 justify-self-end">BREAK</div>
                    ) : (
                      <div className="font-black tabular-nums whitespace-nowrap text-right pr-1 min-w-0 justify-self-end overflow-hidden text-ellipsis">
                        <span className="text-emerald-50">
                          {compactStructure(Number(lvl.sb))} / {compactStructure(Number(lvl.bb))}
                        </span>
                        <span className="text-amber-100"> ({compactStructure(Number(lvl.ante))})</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

            </Panel>
          </div>

          {/* Center column */}
          <div className="col-span-12 md:col-span-6 flex flex-col gap-3 md:gap-4 min-h-0">
            {/* Big clock (top-justified). Break line sits directly under the clock inside the same panel. */}
            <Panel className="px-4 md:px-6 pt-2 md:pt-3 pb-3 md:pb-4 flex flex-col items-center justify-start text-center">
              {/* Timer must be top-justified inside its box (no wasted headroom). */}
              <div className="w-full flex justify-center text-[clamp(84px,12vw,190px)]">
                <CountdownDigits value={isLoading ? "—:—" : bigCountdown} urgent={isUrgent} />
              </div>
            </Panel>

            {/* Current blind level (requested: move underneath big timer; as large as will fit) */}
            <Panel
              className={`p-3 md:p-4 text-center relative overflow-hidden ${levelPulse && !isBreak ? "animate-[pulse_0.6s_ease-in-out_1]" : ""}`}
            >
              {/* Keep the header extremely compact so the blind string can be as large as possible */}
              <div className="mt-1 w-full flex flex-col items-center">
                {/* Small header row */}
                <div className={`text-[14px] md:text-[16px] font-extrabold uppercase tracking-widest ${
                  isBreak ? "text-amber-200" : "text-emerald-200"
                }`}>
                  {isBreak ? "BREAK" : `Level ${levelNum}`}
                </div>

                {/* Big blinds row (auto-fit to width) */}
                <div className="relative mt-1 w-full">
  {isBreak ? (
    <div className="mx-auto w-[96%] rounded-2xl border border-emerald-200/15 bg-emerald-950/35 px-4 py-3 text-center">
      <div className="text-sm md:text-base font-semibold text-emerald-100/80">Next blinds after break</div>
      <div className="mt-1 text-[clamp(28px,3.6vw,54px)] font-black tabular-nums tracking-tight text-emerald-50 drop-shadow-[0_10px_16px_rgba(0,0,0,0.65)]">
        <span className="text-emerald-50">{compact(Number(nextSb))} / {compact(Number(nextBb))} </span>
        <span className="text-amber-100">({compact(Number(nextAnte))})</span>
      </div>
    </div>
  ) : (
    <AutoFitRichText
      measureText={compact(Number(curSb)) + " / " + compact(Number(curBb)) + " (" + compact(Number(curAnte)) + ")"}
      minPx={64}
      maxPx={154}
      className="mx-auto w-[96%] font-black tabular-nums leading-none whitespace-nowrap tracking-tight drop-shadow-[0_10px_16px_rgba(0,0,0,0.65)]"
    >
      <span className="text-emerald-50">
        {compact(Number(curSb))} / {compact(Number(curBb))}{" "}
      </span>
      <span className="text-amber-100">({compact(Number(curAnte))})</span>
    </AutoFitRichText>
  )}
</div>
              </div>
              <div className="relative mt-2 mx-auto h-[2px] w-[88%] bg-gradient-to-r from-transparent via-emerald-200/25 to-transparent" />
            </Panel>

            {/* Controls row */}
            <div className="grid grid-cols-6 gap-2 md:gap-3">
              {/* <span className="flex flex-col items-center leading-none">
                  <span className="text-base md:text-lg">−</span>
                  <span className="mt-1">Level</span>
                </span> */}
              <button
                onClick={() => act('prevLevel')}
                disabled={!controlsEnabled || !canControl('prevLevel')}
	                className={`rounded-2xl border-[2px] border-emerald-200/25 bg-emerald-950/95 text-emerald-50 px-3 py-3 md:py-4 text-lg md:text-xl font-semibold shadow-[0_6px_0_rgba(0,0,0,0.35)] active:translate-y-[2px] active:shadow-[0_4px_0_rgba(0,0,0,0.35)] transition-colors ${
                  !controlsEnabled || !canControl('prevLevel')
	                    ? 'opacity-95 cursor-not-allowed'
	                    : 'hover:bg-emerald-900/85'
                }`}
              >
                <span className="flex flex-col items-center leading-none">
                  <span className="text-base md:text-lg">−</span>
                  <span className="mt-1">Level</span>
                </span>
              </button>

              {/* <span className="flex flex-col items-center leading-none">
                  <span className="text-base md:text-lg">+</span>
                  <span className="mt-1">Level</span>
                </span> */}
              <button
                onClick={() => act('nextLevel')}
                disabled={!controlsEnabled || !canControl('nextLevel')}
	                className={`rounded-2xl border-[2px] border-emerald-200/25 bg-emerald-950/95 text-emerald-50 px-3 py-3 md:py-4 text-lg md:text-xl font-semibold shadow-[0_6px_0_rgba(0,0,0,0.35)] active:translate-y-[2px] active:shadow-[0_4px_0_rgba(0,0,0,0.35)] transition-colors ${
                  !controlsEnabled || !canControl('nextLevel')
	                    ? 'opacity-95 cursor-not-allowed'
	                    : 'hover:bg-emerald-900/85'
                }`}
              >
                <span className="flex flex-col items-center leading-none">
                  <span className="text-base md:text-lg">+</span>
                  <span className="mt-1">Level</span>
                </span>
              </button>

              {/* Big center Play/Pause */}
              <button
                onClick={() => (isRunning ? act('pause') : isPaused ? act('resume') : act('start'))}
                disabled={!controlsEnabled || !(canControl('start') || canControl('pause') || canControl('resume') || canControl('stop'))}
	                className={`col-span-2 rounded-2xl border-[2px] border-emerald-200/35 bg-emerald-950/95 text-emerald-50 px-3 py-3 md:py-4 text-lg md:text-xl font-black shadow-[0_8px_0_rgba(0,0,0,0.4)] active:translate-y-[2px] active:shadow-[0_6px_0_rgba(0,0,0,0.4)] transition-colors ${
		          !controlsEnabled || !(canControl('start') || canControl('pause') || canControl('resume') || canControl('stop'))
	                    ? 'opacity-95 cursor-not-allowed'
	                    : 'hover:bg-emerald-900/85'
                }`}
              >
                {/* No text label: big, obvious icon while keeping the same button size */}
                {/* No text label: big, obvious icon while keeping the same button size */}
                <span className="flex items-center justify-center w-full h-full">
                  {isRunning ? (
                    <svg viewBox="0 0 24 24" className="w-16 h-16 md:w-20 md:h-20 fill-current" aria-hidden="true">
                      <rect x="6" y="5" width="4" height="14" rx="1.2" />
                      <rect x="14" y="5" width="4" height="14" rx="1.2" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-16 h-16 md:w-20 md:h-20 fill-current" aria-hidden="true">
                      <polygon points="9,6 19,12 9,18" />
                    </svg>
                  )}
                </span>
              </button>

              {/* <span className="flex flex-col items-center leading-none">
                  <span className="text-base md:text-lg">+</span>
                  <span className="mt-1">1:00</span>
                </span> */}
              <button
                onClick={() => act('adjustMs', { deltaMs: 60000 })}
                disabled={!controlsEnabled || !canControl('adjustMs')}
	                className={`rounded-2xl border-[2px] border-emerald-200/25 bg-emerald-950/95 text-emerald-50 px-3 py-3 md:py-4 text-lg md:text-xl font-semibold shadow-[0_6px_0_rgba(0,0,0,0.35)] active:translate-y-[2px] active:shadow-[0_4px_0_rgba(0,0,0,0.35)] transition-colors ${
                  !controlsEnabled || !canControl('adjustMs')
	                    ? 'opacity-95 cursor-not-allowed'
	                    : 'hover:bg-emerald-900/85'
                }`}
              >
                <span className="flex flex-col items-center leading-none">
                  <span className="text-base md:text-lg">+</span>
                  <span className="mt-1">1:00</span>
                </span>
              </button>

              {/* <span className="flex flex-col items-center leading-none">
                  <span className="text-base md:text-lg">−</span>
                  <span className="mt-1">1:00</span>
                </span> */}
              <button
                onClick={() => act('adjustMs', { deltaMs: -60000 })}
                disabled={!controlsEnabled || !canControl('adjustMs')}
	                className={`rounded-2xl border-[2px] border-emerald-200/25 bg-emerald-950/95 text-emerald-50 px-3 py-3 md:py-4 text-lg md:text-xl font-semibold shadow-[0_6px_0_rgba(0,0,0,0.35)] active:translate-y-[2px] active:shadow-[0_4px_0_rgba(0,0,0,0.35)] transition-colors ${
                  !controlsEnabled || !canControl('adjustMs')
	                    ? 'opacity-95 cursor-not-allowed'
	                    : 'hover:bg-emerald-900/85'
                }`}
              >
                <span className="flex flex-col items-center leading-none">
                  <span className="text-base md:text-lg">−</span>
                  <span className="mt-1">1:00</span>
                </span>
              </button>
            </div>

          </div>

          {/* Right column: payouts + points (scrolls inside panel only) */}
          <div className="col-span-12 md:col-span-3">
            <Panel className="h-full p-5 flex flex-col overflow-hidden" onClick={() => setShowPayouts(true)}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-2xl font-black">🏆 Prize Pool: $<span className="text-emerald-200 tabular-nums">{comma(Math.floor(prizePool))}</span></div>
                <div className="text-xs opacity-60">Click for full view</div>
              </div>

              {/* Pool breakdown (small, cohesive) */}
              <div className="mt-2 rounded-xl border-[2px] border-emerald-200/10 bg-emerald-950/40 px-3 py-2">
                <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[11px] md:text-xs">
                  <div className="opacity-85">League Stake (60%)</div>
                  <div className="text-right font-bold tabular-nums text-emerald-200">${comma(Math.floor(leagueStake))}</div>

                  <div className="opacity-85">Runner (10%)</div>
                  <div className="text-right font-bold tabular-nums text-emerald-200">${comma(Math.floor(runnerPool))}</div>

                  <div className="opacity-70">League Points in Play</div>
                  <div className="text-right font-bold tabular-nums text-amber-200">{comma(Math.floor(leaguePointsInPlay || leagueStake))}</div>
                </div>
              </div>

              {/* Payout + points table: bottom-aligned when short; scrolls only when it overflows */}
              <div ref={payoutBoxRef} className="mt-3 flex-1 overflow-hidden rounded-xl border-[2px] border-emerald-200/15 bg-emerald-950/70">
                <div className="h-full flex flex-col">
                  <div className="px-3 pt-2 pb-1 text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-80 grid [grid-template-columns:56px_64px_1fr] gap-x-2">
                    <div className="text-amber-200">Place</div>
                    <div className="text-right text-emerald-200">%</div>
                    <div className="text-right text-sky-200">$</div>
                    
                    
                    
                    
                  </div>

                  {/* No scrolling on the kiosk view: show only as many rows as fit */}
                  <div className="flex-1 overflow-hidden px-3 pb-3 pt-2">
                    {/* Fill the panel from the top; show as many rows as fit (no in-panel scrolling on kiosk). */}
                    <div className="flex flex-col gap-1 text-xs md:text-sm">
                      {payoutRows.length === 0 && <div className="opacity-70">(No payouts configured)</div>}
                      {payoutRows.slice(0, MAX_PAYOUT_ROWS).map((r, idx: number) => {
                        const amt = Number((r as any)?.amount ?? (r as any)?.dollars ?? (r as any)?.value ?? 0);
                        return (
                        <div key={r.place} className={`grid [grid-template-columns:56px_64px_1fr] gap-x-2 items-baseline rounded-md px-1 py-[2px] ${idx % 2 === 0 ? "bg-emerald-950/70" : "bg-emerald-900/40"}`}>
                          <div className="font-black text-amber-200">{r.place}</div>
                          <div className="text-right font-black tabular-nums text-emerald-200">{fmtPct(Number(r.pct ?? 0))}</div>
                          <div className="text-right font-black tabular-nums text-emerald-200">{amt ? `$${comma(Math.floor(amt))}` : '—'}</div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              </Panel>
          </div>
        </div>
      </div>

      {/* Payout modal */}
      {showPayouts && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-6" onClick={() => setShowPayouts(false)}>
          <div
            className="w-full max-w-3xl rounded-3xl bg-emerald-950/85 border-[2px] border-emerald-800/80 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-2xl font-black">🏆 Prize Pool: $<span className="text-emerald-200 tabular-nums">{comma(Math.floor(prizePool))}</span></div>
              <button
                className="rounded-xl border-[2px] border-emerald-800/80 px-4 py-2 font-semibold shadow-[0_6px_0_rgba(0,0,0,0.2)] active:translate-y-[2px]"
                onClick={() => setShowPayouts(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-2xl border-[2px] border-emerald-800/80 overflow-hidden">
              <div className="px-4 pt-3 pb-2 text-xs font-bold uppercase tracking-wider opacity-80 grid [grid-template-columns:56px_64px_1fr] gap-x-2 bg-black/20">
                <div className="text-amber-200">Place</div>
                <div className="text-right text-emerald-200">%</div>
                    <div className="text-right text-sky-200">$</div>
                
                
                
                
              </div>
              <div className="max-h-[60vh] overflow-auto px-4 py-3">
                {payoutRows.length === 0 && <div className="opacity-70">No payouts configured.</div>}
                <div className="space-y-2 text-sm md:text-base">
                  {payoutRows.map((r, idx) => {
                    const amt = Number((r as any)?.amount ?? (r as any)?.dollars ?? (r as any)?.value ?? 0);
                    return (
                      <div key={r.place} className={`grid [grid-template-columns:56px_64px_1fr] gap-x-2 items-baseline rounded-md px-1 py-[2px] ${idx % 2 === 0 ? "bg-emerald-950/70" : "bg-emerald-900/40"}`}>
                        <div className="font-black text-amber-200">{r.place}</div>
                        <div className="text-right font-black tabular-nums text-emerald-200">{fmtPct(Number(r.pct ?? 0))}</div>
                        <div className="text-right font-black tabular-nums text-emerald-200">{amt ? `$${comma(Math.floor(amt))}` : '—'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>


          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/70 text-emerald-50 text-2xl">
          Loading clock…
        </div>
      )}

      {showStructureModal && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowStructureModal(false)}
        >
          <div
            className="w-[92vw] max-w-[1200px] max-h-[85vh] rounded-3xl border border-emerald-100/20 bg-black/60 shadow-[0_30px_80px_rgba(0,0,0,0.75)] backdrop-blur-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="text-2xl md:text-3xl font-black tracking-tight text-emerald-50">STRUCTURE</div>
              <button
                className="px-4 py-2 rounded-2xl bg-emerald-700/30 hover:bg-emerald-700/40 border border-emerald-100/15 text-emerald-50 font-bold"
                onClick={() => setShowStructureModal(false)}
              >
                Close ✕
              </button>
            </div>

            <div className="rounded-2xl border border-emerald-100/12 overflow-hidden">
              <div className="grid grid-cols-[90px_90px_minmax(0,1fr)] bg-emerald-900/35 px-4 py-3 text-emerald-100/90 font-black text-sm md:text-base">
                <div>Lvl</div>
                <div>Mins</div>
                <div className="text-right font-black"><span className="text-emerald-50">sb / bb</span> <span className="text-amber-100">(Ante)</span></div>
              </div>

              <div className="max-h-[65vh] overflow-auto bg-black/35">
                {structureLevels.map((row: any, idx: number) => {
                  const lvlLabel = row.isBreak ? "" : String(blindOrdinalFromLevels(structureLevels, idx));
                  const mins = minsForRow(row, 600000, 900000);
                  const blinds = row.isBreak ? "BREAK" : `${compactStructure(row.sb)} / ${compactStructure(row.bb)} (${compactStructure(row.ante)})`;
                  return (
                    <div
                      key={`struct-${idx}`}
                      className="grid grid-cols-[90px_90px_minmax(0,1fr)] px-4 py-2 border-t border-emerald-100/10 text-emerald-50/95 text-sm md:text-base"
                    >
                      <div className="font-black tabular-nums">{lvlLabel}</div>
                      <div className="font-bold tabular-nums text-amber-200">{mins}</div>
                      <div className={`font-semibold text-right min-w-0 overflow-hidden text-ellipsis ${row.isBreak ? "text-emerald-100/80 italic" : ""}`}>{blinds}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 text-emerald-100/70 text-sm font-semibold">
              Tip: click anywhere outside this window to close.
            </div>
          </div>
        </div>
      )}

    </div>
      
  );



function minsForRow(row: any, levelDurationMs: number, breakDurationMs: number) {
  const sec = Number(row?.durationSec ?? 0);
  if (Number.isFinite(sec) && sec > 0) return String(Math.round(sec / 60));
  const ms = row?.isBreak ? breakDurationMs : levelDurationMs;
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  return String(Math.round(ms / 60000));
}
function blindOrdinalFromLevels(levels: any[], idx: number) {
  let n = 0;
  for (let i = 0; i <= idx; i++) if (!levels[i]?.isBreak) n++;
  return Math.max(1, n);
}
function blindOrdinal(structure: any[], index: number) {
  let n = 0;
  for (let i = 0; i <= index; i++) if (!structure[i]?.isBreak) n++;
  return Math.max(1, n);
}
}