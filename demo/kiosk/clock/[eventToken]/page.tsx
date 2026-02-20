"use client";

import { useClock } from "../../../_lib/useClock";

function fmtMs(ms: number) {
  const s = Math.ceil(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function placeLabel(place: number) {
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  if (place === 3) return "3rd";
  return `${place}th`;
}

export default function KioskClockPage({ params }: { params: { eventToken: string } }) {
  const { payload } = useClock(params.eventToken);

  if (!payload) return <div className="p-8 text-2xl">Loading clock…</div>;

  const rem = payload.computed.msRemainingInLevel as number;
  const toBreak = payload.computed.msUntilNextBreak as number;
  const cur = payload.computed.currentLevel as any;
  const next = payload.computed.nextLevels as any[];
  const prizePool = payload.public.prizePool as number;
  const payouts = payload.public.payouts as any[];

  const isBreak = !!cur?.isBreak;

  return (
    <div className="min-h-screen p-8 flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <div className="text-5xl font-bold">
          {isBreak ? "BREAK" : `LEVEL ${payload.clock.levelIndex + 1}`}
        </div>
        <div className="text-7xl font-black tabular-nums">{fmtMs(rem)}</div>
      </div>

      <div className="flex justify-between gap-6">
        <div className="flex-1 rounded-2xl p-6 border">
          <div className="text-xl opacity-70">Time until next break</div>
          <div className="text-4xl font-bold tabular-nums">{fmtMs(toBreak)}</div>
        </div>

        <div className="flex-1 rounded-2xl p-6 border">
          <div className="text-xl opacity-70">Next levels</div>
          <div className="text-3xl font-semibold">
            {next?.[0] ? `${next[0].sb}/${next[0].bb} (BBA ${next[0].ante})` : "—"}
          </div>
          <div className="text-3xl font-semibold opacity-80">
            {next?.[1] ? `${next[1].sb}/${next[1].bb} (BBA ${next[1].ante})` : "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-2xl p-6 border">
          <div className="text-xl opacity-70">Prize Pool</div>
          <div className="text-5xl font-black">${prizePool}</div>
        </div>

        <div className="rounded-2xl p-6 border">
          <div className="text-xl opacity-70">Payouts (Top 4)</div>
          <div className="mt-3 space-y-2 text-2xl">
            {payouts.map((p) => (
              <div key={p.place} className="flex justify-between">
                <div>{placeLabel(p.place)}</div>
                <div className="font-bold">${p.amount}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-6 border">
        <div className="text-xl opacity-70">Points preview</div>
        <div className="mt-2 text-2xl">
          Total sponsor points: <span className="font-bold">{payload.pointsPreview.totalSponsorPoints}</span>
          <br />
          Show-up points each: <span className="font-bold">{payload.pointsPreview.showUpPointsEach}</span>
        </div>
        <div className="mt-2 opacity-70">
          (Public kiosk does not show sponsor/admin splits. We’re classy like that.)
        </div>
      </div>
    </div>
  );
}
