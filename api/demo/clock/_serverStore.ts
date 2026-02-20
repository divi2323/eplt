export type ClockState = "STOPPED" | "RUNNING" | "PAUSED";

export type BlindLevel = {
  sb?: number;
  bb?: number;
  ante?: number; // BBA (ante = big blind)
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

  // tournament config snapshot for public math
  config: {
    buyin: number; // 120
    rebuy: number; // 120
    addon: number; // 20
    startingStack: number; // 30,000
    seatsPerTable: number; // 10
    paidPlaces: number; // 4
    sponsorPct: number; // 0.50 internal
    prizePct: number; // 0.40 public
    opsPct: number; // 0.10 internal
  };

  // demo money counts
  counts: {
    buyins: number;
    rebuys: number;
    addons: number;
    totalEntriesTarget: number; // 40
  };

  // results (optional, for "points by finish" after completion)
  results?: {
    finishOrderEntryIds: string[]; // index 0 = winner
    checkedOutEntryIds: Set<string>;
  };
};

type ServerClockStore = Map<string, ClockModel>;

// Persist store across HMR in dev by using a global
const g = globalThis as any;
if (!g.__EPLT_DEMO_CLOCKS__) g.__EPLT_DEMO_CLOCKS__ = new Map() as ServerClockStore;

export const clocks: ServerClockStore = g.__EPLT_DEMO_CLOCKS__;

export function getOrCreateClock(eventToken: string): ClockModel {
  const existing = clocks.get(eventToken);
  if (existing) return existing;

  const model: ClockModel = {
    state: "STOPPED",
    levelDurationMs: 15 * 60 * 1000,
    breakDurationMs: 15 * 60 * 1000,
    breakEveryLevels: 4,

    structure: seedDefaultStructure(),
    levelIndex: 0,

    startedAt: null,
    pausedAt: null,
    accumulatedPauseMs: 0,
    levelStartedAt: null,

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

  clocks.set(eventToken, model);
  return model;
}

function seedDefaultStructure(): BlindLevel[] {
  // Simple BBA ladder; editable later via a Structures table
  return [
    { sb: 100, bb: 200, ante: 200 },
    { sb: 100, bb: 300, ante: 300 },
    { sb: 200, bb: 400, ante: 400 },
    { sb: 200, bb: 500, ante: 500 },
    { isBreak: true },
    { sb: 300, bb: 600, ante: 600 },
    { sb: 400, bb: 800, ante: 800 },
    { sb: 500, bb: 1000, ante: 1000 },
    { sb: 600, bb: 1200, ante: 1200 },
    { isBreak: true },
    { sb: 800, bb: 1600, ante: 1600 },
    { sb: 1000, bb: 2000, ante: 2000 },
    { sb: 1200, bb: 2400, ante: 2400 },
    { sb: 1500, bb: 3000, ante: 3000 },
    { isBreak: true },
  ];
}
