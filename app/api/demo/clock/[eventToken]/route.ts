import { NextResponse } from "next/server";
import { getOrCreateClock } from "../_serverStore";
import { getOrCreateDemoEvent } from "../../event/_serverStore";

// Always dynamic: this endpoint is polled by the kiosk and must reflect live Run-page state.
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ eventToken: string }> };

/**
 * NOTE: Demo math helpers are implemented locally to avoid path/alias issues in deployment packages.
 * These are intentionally simple, stable, and **whole-dollar**.
 */

type SplitCfg = { leaguePct: number; prizePct: number; runnerPct: number };

const DEFAULT_SPLIT: SplitCfg = { leaguePct: 0.60, prizePct: 0.30, runnerPct: 0.10 };
const DEFAULT_PAID_PCT = 0.15;

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function calcGross(buyins: number, buyinAmt: number, rebuys: number, rebuyAmt: number, addons: number, addonAmt: number) {
  const b = Math.max(0, Math.floor(buyins)) * Math.max(0, Number(buyinAmt) || 0);
  const r = Math.max(0, Math.floor(rebuys)) * Math.max(0, Number(rebuyAmt) || 0);
  const a = Math.max(0, Math.floor(addons)) * Math.max(0, Number(addonAmt) || 0);
  return Math.max(0, Math.floor(b + r + a));
}

function splitPools(eligibleDollars: number, cfg: SplitCfg) {
  // Whole dollars. Any rounding remainder flows to PRIZE (players go home with something).
  const gross = Math.max(0, Math.floor(Number(eligibleDollars) || 0));
  const league = Math.floor(gross * clamp01(cfg.leaguePct));
  const runner = Math.floor(gross * clamp01(cfg.runnerPct));
  const prize = Math.max(0, gross - league - runner);
  return { eligibleDollars: gross, leagueStakeDollars: league, runnerDollars: runner, prizePoolDollars: prize };
}

function calcPaidPlaces(entriesTotal: number, paidPct = DEFAULT_PAID_PCT) {
  const n = Math.max(0, Math.floor(Number(entriesTotal) || 0));
  if (n <= 0) return 0;
  return Math.max(1, Math.ceil(n * clamp01(paidPct)));
}

function payoutPctTable(spots: number): number[] {
  // Placeholder table (swappable later). Designed to be sane + sum to 1.00.
  const s = Math.max(1, Math.floor(spots));

  const fixed: Record<number, number[]> = {
    1: [1.0],
    2: [0.65, 0.35],
    3: [0.50, 0.30, 0.20],
    4: [0.40, 0.28, 0.18, 0.14],
    5: [0.40, 0.25, 0.16, 0.11, 0.08],
    6: [0.36, 0.23, 0.15, 0.11, 0.08, 0.07],
    7: [0.33, 0.21, 0.14, 0.10, 0.08, 0.07, 0.07],
    8: [0.30, 0.19, 0.13, 0.10, 0.08, 0.07, 0.07, 0.06],
    9: [0.28, 0.18, 0.12, 0.10, 0.08, 0.07, 0.06, 0.06, 0.05],
    10:[0.27, 0.17, 0.12, 0.09, 0.08, 0.07, 0.06, 0.05, 0.05, 0.04],
  };

  if (fixed[s]) return fixed[s];

  // For larger paid fields, use a simple geometric decay and normalize.
  // (Placeholder only; will be replaced with a real payout table source.)
  const weights: number[] = [];
  const ratio = 0.86;
  let w = 1;
  for (let i = 0; i < s; i++) {
    weights.push(w);
    w *= ratio;
  }
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map(x => x / sum);
}

function calcPayoutRows(prizePoolDollars: number, paidPlaces: number) {
  const pool = Math.max(0, Math.floor(Number(prizePoolDollars) || 0));
  const spots = Math.max(0, Math.floor(Number(paidPlaces) || 0));
  if (pool <= 0 || spots <= 0) return [] as Array<{ place: number; pct: number; amount: number }>;

  const pct = payoutPctTable(spots);
  const raw = pct.map((p) => Math.floor(pool * p));
  const paidOut = raw.reduce((s, v) => s + v, 0);
  const rem = pool - paidOut;
  if (raw.length) raw[0] += rem; // remainder to 1st

  return raw.map((amt, idx) => ({ place: idx + 1, pct: pct[idx] ?? 0, amount: Math.max(0, Math.floor(amt)) }));
}

function calcSponsorPointsTotal(eligibleDollars: number, leagueStakeDollars: number) {
  // Your model: league stake pool dollars = points to distribute (1:1).
  // Use the already whole-dollar leagueStakeDollars.
  return Math.max(0, Math.floor(Number(leagueStakeDollars) || 0));
}

function calcShowUpEach(totalSponsorPoints: number, entrants: number) {
  // Demo: 20% for show-up split equally, trunc remainder back into pool.
  const total = Math.max(0, Math.floor(Number(totalSponsorPoints) || 0));
  const n = Math.max(1, Math.floor(entrants) || 1);
  const showUpTotal = Math.floor(total * 0.2);
  const each = Math.floor(showUpTotal / n);
  const remainder = showUpTotal - (each * n);
  return { total: showUpTotal, each, remainder };
}


function compute(model: ReturnType<typeof getOrCreateClock>, serverNow: number) {
  let levelStartedAt = model.levelStartedAt ?? model.startedAt ?? serverNow;

  // Hardening: if we're paused but lost pausedAt (e.g., due to a reset/seed),
  // re-stamp it so the clock truly freezes and resume works reliably.
  if (model.state === "PAUSED" && !model.pausedAt) {
    model.pausedAt = serverNow;
  }

  // If paused, freeze the effective "now" so computed time doesn't drain.
  const pausedExtra =
    model.state === "PAUSED" && model.pausedAt ? serverNow - model.pausedAt : 0;

  const effectiveNow = serverNow - pausedExtra;

  let elapsed = Math.max(
    0,
    effectiveNow - levelStartedAt - model.accumulatedPauseMs
  );


  // Demo auto-advance: if running and elapsed exceeds current duration, advance levels and carry over overflow.
  // This makes the kiosk continuously testable without manual resets.
  if (model.state === "RUNNING") {
    // IMPORTANT: use a rolling start time while advancing, otherwise we can "fast-forward"
    // through many levels on the first rollover.
    let guard = 0;
    let rollingStart = (model.levelStartedAt ?? levelStartedAt);

    while (guard++ < 100) {
      const cur0 = model.structure[model.levelIndex] ?? { isBreak: true };
      const dur0 = (Number(cur0.durationSec ?? 0) > 0 ? Number(cur0.durationSec) * 1000 : (cur0.isBreak ? model.breakDurationMs : model.levelDurationMs));

      const elapsed0 = Math.max(0, effectiveNow - rollingStart - model.accumulatedPauseMs);
      if (!dur0 || elapsed0 < dur0) break;

      // Advance one row (cycle through structure)
      model.levelIndex = (model.levelIndex + 1) % model.structure.length;

      // Move the start forward by exactly one duration, preserving any overflow.
      rollingStart += dur0;
    }

    model.levelStartedAt = rollingStart;
  }

  levelStartedAt = model.levelStartedAt ?? levelStartedAt;
  elapsed = Math.max(0, effectiveNow - levelStartedAt - model.accumulatedPauseMs);
  const current = model.structure[model.levelIndex] ?? { isBreak: true };
  const duration = current.isBreak ? model.breakDurationMs : model.levelDurationMs;

  const msRemainingInLevel = Math.max(0, duration - elapsed);

  // Always visible: time until next break
  let msUntilNextBreak = msRemainingInLevel;
  for (let i = model.levelIndex + 1; i < model.structure.length; i++) {
    if (model.structure[i]?.isBreak) break;
    msUntilNextBreak += model.levelDurationMs;
  }

  // Next 2 non-break blind levels
  const nextLevels: Array<{ sb: number; bb: number; ante: number }> = [];
  for (
    let i = model.levelIndex + 1;
    i < model.structure.length && nextLevels.length < 2;
    i++
  ) {
    const lvl = model.structure[i];
    if (!lvl || lvl.isBreak) continue;
    nextLevels.push({ sb: lvl.sb!, bb: lvl.bb!, ante: lvl.ante! });
  }

  // Eligible dollars are pooled (buy-ins + rebuys + add-ons), then split:
  // League stake (points backing), Prize pool (cash payouts), Runner expenses.
  const eligibleDollars = calcGross(
    model.counts.buyins,
    model.config.buyin,
    model.counts.rebuys,
    model.config.rebuy,
    model.counts.addons,
    model.config.addon
  );

  const pools = splitPools(eligibleDollars, DEFAULT_SPLIT);

  // Paid places: 15% of total entries, always rounded UP.
  // Entries are unique paid entrants (registered + busted), not rebuys.
  const entriesTotal = Math.max(0, Math.floor(Number(model.counts.buyins) || 0));
  const paidPlaces = calcPaidPlaces(entriesTotal, DEFAULT_PAID_PCT);

  const payouts = calcPayoutRows(pools.prizePoolDollars, paidPlaces);

  const totalSponsorPoints = calcSponsorPointsTotal(pools.eligibleDollars, pools.leagueStakeDollars);
  const showUp = calcShowUpEach(totalSponsorPoints, Math.max(1, entriesTotal));

  return {
    msRemainingInLevel,
    msUntilNextBreak,
    currentLevel: current,
    nextLevels,
    public: {
      prizePool: pools.prizePoolDollars,
      leagueStake: pools.leagueStakeDollars,
      runnerPool: pools.runnerDollars,
      leaguePointsInPlay: calcSponsorPointsTotal(pools.eligibleDollars, pools.leagueStakeDollars),
      paidPlaces,
      payouts,
    },
    pointsPreview: {
      totalSponsorPoints,
      showUpPointsEach: showUp.each,
      finishTierTotal: Math.round(totalSponsorPoints * 0.3),
      winnerTierTotal: Math.round(totalSponsorPoints * 0.5),
    },
  };
}

export async function GET(_: Request, context: Ctx) {
  const { eventToken } = await context.params;

  const serverNow = Date.now();

  try {
  const model = getOrCreateClock(eventToken);
  const ev = getOrCreateDemoEvent(eventToken);

  const entrantsPlayers = ev.players.filter((p: any) => String((p as any).status ?? "") !== "CHECKED_IN");

  // Demo historically used p.paid, but some UI flows may omit it.
  // For payouts/counts, treat any non-checked-in player as an entrant.
  const paidPlayers = entrantsPlayers.filter((p: any) => Boolean((p as any).paid));
  const entrantsCount = entrantsPlayers.length;

  // Public roster stats for Kiosk (Run is source of truth).
  const playersTotal = entrantsCount; // paid entrants (registered + busted)
  const playersRemaining = entrantsPlayers.filter((p: any) => p.status === "REGISTERED").length;

  const buyinsCount = playersTotal;

  const rebuysCount = entrantsPlayers.reduce(
    (sum: number, p: any) => sum + Math.max(0, Math.floor(Number((p as any).rebuys ?? 0))),
    0
  );
  const addonsCount = entrantsPlayers.reduce((sum: number, p: any) => sum + (Boolean((p as any).addon) ? 1 : 0), 0);

  const chipsInPlay = Math.max(
    0,
    Math.floor(
      buyinsCount * Number((ev as any).buyinChips ?? 0) +
        rebuysCount * Number((ev as any).rebuyChips ?? 0) +
        addonsCount * Number((ev as any).addonChips ?? 0)
    )
  );
  const avgStack = playersRemaining > 0 ? Math.floor(chipsInPlay / playersRemaining) : 0;

// Sync clock economics from Run-owned event params
  model.config.buyin = Number((ev as any).buyinAmount ?? 0);
  model.config.rebuy = Number((ev as any).rebuyAmount ?? 0);
  model.config.addon = Number((ev as any).addonAmount ?? 0);
  model.config.startingStack = Number((ev as any).buyinChips ?? 0);

  model.counts.buyins = buyinsCount;
  model.counts.rebuys = rebuysCount;
  model.counts.addons = addonsCount;
  model.counts.totalEntriesTarget = playersTotal;

  const computed = compute(model, serverNow);

  const kioskPublic = {
    ...(computed.public ?? {}),
    // Kiosk control surface (client checks this list before enabling buttons)
    controlActions: ["start", "stop", "pause", "resume", "nextLevel", "prevLevel", "adjustMs"],
    tournamentStatus: (ev as any).tournamentStatus ?? "REGISTRATION",
    playersTotal,
    playersRemaining,
    buyinsCount,
    rebuysCount,
    addonsCount,
    chipsInPlay,
    avgStack,
    buyinAmount: Number((ev as any).buyinAmount ?? 0),
    rebuyAmount: Number((ev as any).rebuyAmount ?? 0),
    addonAmount: Number((ev as any).addonAmount ?? 0),
    buyinChips: Number((ev as any).buyinChips ?? 0),
    rebuyChips: Number((ev as any).rebuyChips ?? 0),
    addonChips: Number((ev as any).addonChips ?? 0),
  };


  return NextResponse.json(
    {
    eventToken,
    serverNow,

    // ✅ Used by kiosk banners
    display: model.display,

    public: kioskPublic,
    // ✅ Public/demo data used by kiosk layout (single source)

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
    pointsPreview: computed.pointsPreview,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
  } catch (err: any) {
    const msg = String(err?.message ?? err ?? "Unknown error");
    return NextResponse.json(
      {
        eventToken,
        serverNow,
        display: { leagueName: "EPLT Demo", eventName: eventToken },
        public: {
          tournamentStatus: "REGISTRATION",
          playersTotal: 0,
          playersRemaining: 0,
          buyinsCount: 0,
          rebuysCount: 0,
          addonsCount: 0,
          chipsInPlay: 0,
          avgStack: 0,
          buyinAmount: 0,
          rebuyAmount: 0,
          addonAmount: 0,
          buyinChips: 0,
          rebuyChips: 0,
          addonChips: 0,
          prizePool: 0,
          leagueStake: 0,
          runnerPool: 0,
          paidPlaces: 0,
          payouts: [],
          controlActions: ["start", "stop", "pause", "resume", "nextLevel", "prevLevel", "adjustMs"],
          error: msg,
        },
        clock: {
          state: "PAUSED",
          levelIndex: 0,
          levelDurationMs: 600000,
          breakDurationMs: 900000,
          breakEveryLevels: 4,
          structure: [],
          startedAt: null,
          pausedAt: null,
          accumulatedPauseMs: 0,
          levelStartedAt: null,
          counts: { buyins: 0, rebuys: 0, addons: 0, totalEntriesTarget: 0 },
        },
        computed: { msRemainingInLevel: 0, msUntilNextBreak: 0, nextLevels: [], currentLevel: null },
        pointsPreview: null,
      },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

}