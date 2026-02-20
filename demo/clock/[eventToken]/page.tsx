"use client";

import { useClock } from "../../_lib/useClock";

function fmtMs(ms: number) {
  const s = Math.ceil(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export default function MobileClockPage({ params }: { params: { eventToken: string } }) {
  const { payload } = useClock(params.eventToken);

  if (!payload) return <div className="p-6 text-xl">Loading…</div>;

  const rem = payload.computed.msRemainingInLevel as number;
  const toBreak = payload.computed.msUntilNextBreak as number;
  const cur = payload.computed.currentLevel as any;
  const next = payload.computed.nextLevels as any[];
  const prizePool = payload.public.prizePool as number;

  const isBreak = !!cur?.isBreak;

  return (
    <div className="min-h-screen p-6 flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-bold">{isBreak ? "BREAK" : `LEVEL ${payload.clock.levelIndex + 1}`}</div>
        <div className="text-4xl font-black tabular-nums">{fmtMs(rem)}</div>
      </div>

      <div className="rounded-2xl p-4 border">
        <div className="text-sm opacity-70">Next break in</div>
        <div className="text-2xl font-bold tabular-nums">{fmtMs(toBreak)}</div>
      </div>

      <div className="rounded-2xl p-4 border">
        <div className="text-sm opacity-70">Next blinds</div>
        <div className="text-xl font-semibold">
          {next?.[0] ? `${next[0].sb}/${next[0].bb} (BBA ${next[0].ante})` : "—"}
        </div>
        <div className="text-xl font-semibold opacity-80">
          {next?.[1] ? `${next[1].sb}/${next[1].bb} (BBA ${next[1].ante})` : "—"}
        </div>
      </div>

      <div className="rounded-2xl p-4 border">
        <div className="text-sm opacity-70">Prize pool</div>
        <div className="text-3xl font-black">${prizePool}</div>
      </div>
    </div>
  );
}
