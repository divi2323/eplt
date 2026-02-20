import { NextResponse } from "next/server";
import { getOrCreateClock } from "../_serverStore";
import {
  calcGross,
  calcPrizePool,
  calcPayouts,
  calcSponsorPointsTotal,
  calcShowUpEach,
} from "../../../../../src/lib/demo/math";

function compute(model: ReturnType<typeof getOrCreateClock>, serverNow: number) {
  const levelStartedAt = model.levelStartedAt ?? model.startedAt ?? serverNow;

  // If paused, freeze time (don’t let the display count down)
  const pausedExtra = model.state === "PAUSED" && model.pausedAt ? serverNow - model.pausedAt : 0;
  const effectiveNow = serverNow - pausedExtra;

  const elapsed = Math.max(0, effectiveNow - levelStartedAt - model.accumulatedPauseMs);

  const current = model.structure[model.levelIndex] ?? { isBreak: true };
  const duration = current.isBreak ? model.breakDurationMs : model.levelDurationMs;

  const msRemainingInLevel = Math.max(0, duration - elapsed);

  // Time until next break: sum remaining time in this level + full levels until next break marker
  let msUntilNextBreak = msRemainingInLevel;
  for (let i = model.levelIndex + 1; i < model.structure.length; i++) {
    if (model.structure[i]?.isBreak) break;
    msUntilNextBreak += model.levelDurationMs;
  }

  // Next 2 blind levels (non-break)
  const nextLevels: Array<{ sb: number; bb: number; ante: number }> = [];
  for (let i = model.levelIndex + 1; i < model.structure.length && nextLevels.length < 2; i++) {
    const lvl = model.structure[i];
    if (!lvl || lvl.isBreak) continue;
    nextLevels.push({ sb: lvl.sb!, bb: lvl.bb!, ante: lvl.ante! });
  }

  // Money + points preview (public-safe + points)
  const gross = calcGross({
    buyins: model.counts.buyins,
    rebuys: model.counts.rebuys,
    addons: model.counts.addons,
    buyin: model.config.buyin,
    rebuy: model.config.rebuy,
    addon: model.config.addon,
  });

  const prizePool = calcPrizePool(gross);
  const payouts = calcPayouts(prizePool);

  const totalSponsorPoints = calcSponsorPointsTotal(gross);
  const totalEntries = model.counts.buyins + model.counts.rebuys;
  const showUp = calcShowUpEach(totalSponsorPoints, Math.max(1, totalEntries));

  return {
    msRemainingInLevel,
    msUntilNextBreak,
    currentLevel: current,
    nextLevels,
    public: { prizePool, payouts },
    pointsPreview: {
      totalSponsorPoints,
      showUpPointsEach: showUp.each,
      finishTierTotal: Math.round(totalSponsorPoints * 0.3),
      winnerTierTotal: Math.round(totalSponsorPoints * 0.5),
    },
  };
}

export async function GET(_: Request, { params }: { params: { eventToken: string } }) {
  const serverNow = Date.now();
  const model = getOrCreateClock(params.eventToken);
  const computed = compute(model, serverNow);

  return NextResponse.json({
    eventToken: params.eventToken,
    serverNow,
    clock: {
      state: model.state,
      levelIndex: model.levelIndex,
      levelDurationMs: model.levelDurationMs,
      breakDurationMs: model.breakDurationMs,
      breakEveryLevels: model.breakEveryLevels,
      structure: model.structure,
      startedAt: model.startedAt,
      pausedAt: model.pausedAt,
      accumulatedPauseMs: model.accumulatedPauseMs,
      levelStartedAt: model.levelStartedAt,
      counts: model.counts,
    },
    computed: {
      msRemainingInLevel: computed.msRemainingInLevel,
      msUntilNextBreak: computed.msUntilNextBreak,
      nextLevels: computed.nextLevels,
      currentLevel: computed.currentLevel,
    },
    public: computed.public,
    pointsPreview: computed.pointsPreview,
  });
}
