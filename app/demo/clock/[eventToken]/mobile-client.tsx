"use client";

import React from "react";
import { useClock } from "../../_lib/useClock";
import { computePointsPreview } from "../../_lib/points";

function fmtMs(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}
function comma(n: number) {
  return (n ?? 0).toLocaleString();
}

// Compact number display for blind strings.
// Examples: 1000 -> 1k, 4000 -> 4k, 15000 -> 15k, 500000 -> 500k, 1000000 -> 1M
function compact(n: number) {
  const v = Number(n ?? 0);
  const abs = Math.abs(v);

  const fmt = (x: number, suffix: string) => {
    const rounded = Math.round(x * 10) / 10;
    const s = Number.isInteger(rounded) ? String(rounded) : String(rounded);
    return `${s}${suffix}`;
  };

  if (abs >= 1_000_000_000) return fmt(v / 1_000_000_000, "B");
  if (abs >= 1_000_000) return fmt(v / 1_000_000, "M");
  if (abs >= 1_000) return fmt(v / 1_000, "k");
  return String(v);
}
function placeLabel(place: number) {
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  if (place === 3) return "3rd";
  return `${place}th`;
}

export default function MobileClockClient({ eventToken }: { eventToken: string }) {
  const { payload, estimatedNow } = useClock(eventToken);

  if (!payload) {
    return (
      <div className="min-h-screen grid place-items-center text-emerald-50 text-xl bg-black bg-[url('/assets/bg_green_1920.webp')] bg-cover bg-center">
        Loading…
      </div>
    );
  }

  const serverNowAtPoll = payload.serverNow as number;
  const delta = estimatedNow - serverNowAtPoll;

  const liveRemaining = (payload.computed.msRemainingInLevel as number) - delta;
  const liveUntilBreak = (payload.computed.msUntilNextBreak as number) - delta;

  const cur = payload.computed.currentLevel as any;
  const next = (payload.computed.nextLevels as any[]) || [];
  const isBreak = !!cur?.isBreak;
  const levelNum = (payload.clock?.levelIndex ?? 0) + 1;

  const leagueName = payload.display?.leagueName ?? "Jokers Wild Poker League";
  const eventName = payload.display?.eventName ?? "Monthly MTT Deepstack Freeze-Out January";

  const buyinsCount = Number(payload.public?.buyinsCount ?? payload.demo?.buyinsCount ?? 40);
  const rebuysCount = Number(payload.public?.rebuysCount ?? payload.demo?.rebuysCount ?? 0);
  const addonsCount = Number(payload.public?.addonsCount ?? payload.demo?.addonsCount ?? 0);

  const entrants = Math.max(0, Math.floor(buyinsCount + rebuysCount));
  const remaining = Number(
    payload.public?.remainingEntrants ??
      payload.demo?.remainingEntrants ??
      Math.max(0, Math.min(entrants, 18))
  );

  const startingStack = Number(payload.demo?.startingStack ?? 30000);
  const chipsInPlay = Number(payload.public?.chipsInPlay ?? payload.demo?.chipsInPlay ?? entrants * startingStack);
  const avgStack = remaining > 0 ? Math.floor(chipsInPlay / remaining) : 0;

  const buyin = Number(payload.demo?.buyin ?? 120);
  const rebuy = Number(payload.demo?.rebuy ?? 120);
  const addon = Number(payload.demo?.addon ?? 20);

  const gross = buyinsCount * buyin + rebuysCount * rebuy + addonsCount * addon;

  const prizePool = Number(payload.public?.prizePool ?? payload.demo?.prizePool ?? 0);
  const payouts = (payload.public?.payouts as any[]) || [];
  const paidPlaces = Number(payload.public?.paidPlaces ?? payload.demo?.paidPlaces ?? 4);

  const points = computePointsPreview({ entries: entrants || 40, paidPlaces, buyin, gross });
  const payoutMap = new Map<number, number>();
  payouts.forEach((p: any) => payoutMap.set(Number(p.place), Number(p.amount)));

  const combinedRows = points.rows.map((r) => ({
    ...r,
    cash: payoutMap.get(r.place) ?? 0,
  }));

  const blindsText = isBreak
    ? "15 MIN BREAK"
    : `${compact(cur?.sb)}/${compact(cur?.bb)} (${compact(cur?.ante)})`;
  const next5 = next.slice(0, 5);

  return (
    <div className="min-h-screen text-emerald-50 font-sans bg-black bg-[url('/assets/bg_green_1920.webp')] bg-cover bg-center">
      {/* Full-screen break takeover (spectator) */}
      {isBreak && (
        <div className="fixed inset-0 z-40 bg-black/85 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-emerald-200/15 bg-black/60 p-6 text-center">
            <div className="text-4xl font-black tracking-[0.22em] uppercase">BREAK</div>
            <div className="mt-4 text-[72px] font-black leading-none tabular-nums">{fmtMs(liveRemaining)}</div>
            <div className="mt-3 text-base opacity-85">Play resumes in</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums">{fmtMs(liveRemaining)}</div>
          </div>
        </div>
      )}
      <div className="px-4 pt-4">
        <div className="rounded-2xl bg-black/35 backdrop-blur-md border border-emerald-200/10 px-4 py-4">
          <div className="text-xs tracking-[0.25em] uppercase opacity-70">League</div>
          <div className="text-xl font-extrabold">{leagueName}</div>
          <div className="mt-2 text-xs tracking-[0.25em] uppercase opacity-70">Event</div>
          <div className="text-lg font-bold">{eventName}</div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="rounded-3xl bg-black/55 backdrop-blur-md border border-emerald-200/10 px-5 py-6 text-center shadow-2xl">
          <div className="text-3xl font-black tracking-[0.18em] uppercase">{isBreak ? "BREAK" : `LEVEL ${levelNum}`}</div>
          <div className="mt-3 text-[92px] font-black leading-none tabular-nums">{fmtMs(liveRemaining)}</div>
          <div className="mt-3 text-2xl font-extrabold">{blindsText}</div>
          <div className="mt-2 text-sm opacity-80">
            Break in <span className="font-black tabular-nums">{fmtMs(liveUntilBreak)}</span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-black/35 border border-emerald-200/10 p-4">
          <div className="text-xs tracking-[0.25em] uppercase opacity-70">Players</div>
          <div className="mt-2 text-sm opacity-80">Entrants</div>
          <div className="text-2xl font-black tabular-nums">{entrants}</div>
          <div className="mt-2 text-sm opacity-80">Remaining</div>
          <div className="text-2xl font-black tabular-nums">{remaining}</div>
        </div>

        <div className="rounded-2xl bg-black/35 border border-emerald-200/10 p-4">
          <div className="text-xs tracking-[0.25em] uppercase opacity-70">Chips</div>
          <div className="mt-2 text-sm opacity-80">In play</div>
          <div className="text-xl font-black tabular-nums">{comma(chipsInPlay)}</div>
          <div className="mt-2 text-sm opacity-80">Average</div>
          <div className="text-xl font-black tabular-nums">{comma(avgStack)}</div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="rounded-2xl bg-black/35 border border-emerald-200/10 p-4">
          <div className="text-xs tracking-[0.25em] uppercase opacity-70">Next 5 levels</div>
          <div className="mt-3 space-y-2">
            {next5.length === 0 && <div className="opacity-70">—</div>}
            {next5.map((lvl: any, i: number) => (
              <div key={i} className="flex items-baseline justify-between gap-3">
                <div className="opacity-75 text-sm">Lvl {levelNum + i + 1}</div>
                <div className="font-black tabular-nums">
                  {lvl?.isBreak ? "BREAK" : `${compact(lvl?.sb)}/${compact(lvl?.bb)} (${compact(lvl?.ante)})`}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-black/35 border border-emerald-200/10 p-4">
          <div className="text-xs tracking-[0.25em] uppercase opacity-70">Prize Pool</div>
          <div className="mt-2 text-4xl font-black tabular-nums">{comma(prizePool)}</div>
          <div className="mt-2 text-xs opacity-65">(Public view only — no sponsor/admin splits.)</div>
        </div>

        <div className="rounded-2xl bg-black/35 border border-emerald-200/10 p-4">
          <div className="text-xs tracking-[0.25em] uppercase opacity-70">Event details</div>
          <div className="mt-3 grid grid-cols-2 gap-y-2 text-base">
            <div className="opacity-75">Buy-in</div>
            <div className="text-right font-black tabular-nums">{buyin}</div>
            <div className="opacity-75">Rebuy</div>
            <div className="text-right font-black tabular-nums">{rebuy}</div>
            <div className="opacity-75">Add-on</div>
            <div className="text-right font-black tabular-nums">{addon}</div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-10">
        <div className="rounded-2xl bg-black/35 border border-emerald-200/10 overflow-hidden">
          <div className="px-4 py-3">
            <div className="text-xs tracking-[0.25em] uppercase opacity-70">Payouts + Points</div>
            <div className="text-xs opacity-60">Cash shows paid places only. Points are sponsor-points preview by finish.</div>
          </div>

          <div className="grid grid-cols-3 gap-0 text-[11px] uppercase tracking-wider bg-emerald-900/20">
            <div className="px-3 py-2">Place</div>
            <div className="px-3 py-2 text-right">Cash</div>
            <div className="px-3 py-2 text-right">Points</div>
          </div>

          {combinedRows.map((r) => (
            <div key={r.place} className="grid grid-cols-3 gap-0 text-sm border-t border-emerald-200/10">
              <div className="px-3 py-2 font-semibold">{placeLabel(r.place)}</div>
              <div className="px-3 py-2 text-right tabular-nums">{r.cash ? `$${r.cash}` : ""}</div>
              <div className="px-3 py-2 text-right tabular-nums font-black">{r.total}</div>
            </div>
          ))}

          <div className="px-4 py-3 text-xs opacity-60 border-t border-emerald-200/10">
            Sponsor points total: <span className="font-mono">{points.sponsorTotal}</span> • Show-up each:{" "}
            <span className="font-mono">{(points as any).showUpEach ?? "-"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
