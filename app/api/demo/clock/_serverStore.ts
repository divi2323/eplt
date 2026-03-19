export type ClockState = "STOPPED" | "RUNNING" | "PAUSED";

export type BlindLevel = {
  durationSec?: number;
  sb?: number;
  bb?: number;
  ante?: number; // displayed as (ante)
  isBreak?: boolean;
};

export type ClockModel = {
  state: ClockState;

  levelDurationMs: number; // 15 min
  breakDurationMs: number; // 15 min
  breakEveryLevels: number; // every 4

  structure: BlindLevel[];
  levelIndex: number;

  startedAt: number | null;
  pausedAt: number | null;
  accumulatedPauseMs: number;
  levelStartedAt: number | null;

  // ✅ public-safe display strings
  display: {
    leagueName: string;
    eventName: string;
  };

  config: {
    buyin: number;
    rebuy: number;
    addon: number;
    startingStack: number;
    seatsPerTable: number;
    paidPlaces: number;

    // internal-only (never shown on kiosks)
    sponsorPct: number;
    prizePct: number;
    opsPct: number;
  };

  counts: {
    buyins: number;
    rebuys: number;
    addons: number;
    totalEntriesTarget: number;
  };
};

type ServerClockStore = Map<string, ClockModel>;

const g = globalThis as any;
if (!g.__EPLT_DEMO_CLOCKS__) g.__EPLT_DEMO_CLOCKS__ = new Map() as ServerClockStore;

export const clocks: ServerClockStore = g.__EPLT_DEMO_CLOCKS__;

// Demo convenience: treat all demo eventTokens as a single shared clock.
// This prevents Run and Kiosk from drifting if different demo URLs are opened.
function demoKey(_eventToken: string) {
  return "DEMO";
}

function applyBreaks(levels: BlindLevel[], breakEveryLevels: number): BlindLevel[] {
  const out: BlindLevel[] = [];
  let sinceBreak = 0;
  const n = Math.max(0, Math.floor(breakEveryLevels || 0));
  for (const lvl of levels) {
    out.push(lvl);
    if (lvl.isBreak) {
      sinceBreak = 0;
      continue;
    }
    sinceBreak++;
    if (n > 0 && sinceBreak >= n) {
      out.push({ isBreak: true, durationSec: 600 });
      sinceBreak = 0;
    }
  }
  // Avoid ending on a break row (feels weird in demos)
  while (out.length && out[out.length - 1]?.isBreak) out.pop();
  return out;
}

export function getOrCreateClock(eventToken: string): ClockModel {
  const now = Date.now();
  const key = demoKey(eventToken);
  const existing = clocks.get(key);
  if (existing) return existing;

  const model: ClockModel = {
    state: "PAUSED", // demo: start paused

    levelDurationMs: 10 * 60 * 1000, // demo: 10 min per level
    breakDurationMs: 15 * 60 * 1000, // demo: 15 min per break
    breakEveryLevels: 4,

    structure: applyBreaks(seedDefaultStructure(), 4),
    levelIndex: 0,

    startedAt: now,
    pausedAt: now,
    accumulatedPauseMs: 0,
    levelStartedAt: now,

    // ✅ Demo banners (public-safe)
    display: {
      leagueName: "Jokers Wild Poker League",
      eventName: "Monthly MTT Deepstack Freeze-Out January",
    },

    config: {
      buyin: 120,
      rebuy: 120,
      addon: 20,
      startingStack: 30000,
      seatsPerTable: 10,
      paidPlaces: 4,
      sponsorPct: 0.5,
      prizePct: 0.4,
      opsPct: 0.1,
    },

    counts: {
      buyins: 40,
      rebuys: 0,
      addons: 0,
      totalEntriesTarget: 40,
    },
  };

  clocks.set(key, model);
  return model;
}

function seedDefaultStructure(): BlindLevel[] {
  return [
    { sb: 100, bb: 200, ante: 200 },
    { sb: 200, bb: 300, ante: 300 },
    { sb: 200, bb: 400, ante: 400 },
    { sb: 300, bb: 600, ante: 600 },
    { sb: 400, bb: 800, ante: 800 },
    { sb: 500, bb: 1000, ante: 1000 },
    { sb: 600, bb: 1200, ante: 1200 },
    { sb: 800, bb: 1600, ante: 1600 },
    { sb: 1000, bb: 2000, ante: 2000 },
    { sb: 1500, bb: 3000, ante: 3000 },
    { sb: 2000, bb: 4000, ante: 4000 },
    { sb: 3000, bb: 6000, ante: 6000 },
    { sb: 4000, bb: 8000, ante: 8000 },
    { sb: 5000, bb: 10000, ante: 10000 },
    { sb: 6000, bb: 12000, ante: 12000 },
    { sb: 8000, bb: 16000, ante: 16000 },
    { sb: 10000, bb: 20000, ante: 20000 },
    { sb: 15000, bb: 30000, ante: 30000 },
    { sb: 20000, bb: 40000, ante: 40000 },
    { sb: 25000, bb: 50000, ante: 50000 },
    { sb: 50000, bb: 100000, ante: 100000 },
    { sb: 100000, bb: 200000, ante: 200000 },
    { sb: 200000, bb: 400000, ante: 400000 },
    { sb: 250000, bb: 500000, ante: 500000 },
    { sb: 500000, bb: 1000000, ante: 1000000 },
    { sb: 1000000, bb: 2000000, ante: 2000000 },
  ];
}
