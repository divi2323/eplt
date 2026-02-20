"use client";

export type DemoStore = {
  meta: { schema: number; createdAt: number };
  tables: {
    people: any[];
    players: any[];
    leagues: any[];
    events: any[];
    entries: any[];
    structures: any[];
  };
};

const KEY = "EPLT_DEMO_V3_STORE";
const SCHEMA = 1;

export function loadDemoStore(): DemoStore {
  if (typeof window === "undefined") {
    // client-only module, but just in case
    return seedDemoStore();
  }

  const raw = window.localStorage.getItem(KEY);
  if (!raw) {
    const seeded = seedDemoStore();
    window.localStorage.setItem(KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as DemoStore;
    if (!parsed?.meta || parsed.meta.schema !== SCHEMA) {
      const seeded = seedDemoStore();
      window.localStorage.setItem(KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed;
  } catch {
    const seeded = seedDemoStore();
    window.localStorage.setItem(KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export function saveDemoStore(store: DemoStore) {
  window.localStorage.setItem(KEY, JSON.stringify(store));
}

export function resetDemoStore() {
  const seeded = seedDemoStore();
  window.localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

function seedDemoStore(): DemoStore {
  return {
    meta: { schema: SCHEMA, createdAt: Date.now() },
    tables: {
      people: [],
      players: [],
      leagues: [],
      events: [],
      entries: [],
      structures: [],
    },
  };
}
