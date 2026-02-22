export type RegStatus = "REGISTERED" | "CHECKED_IN" | "BUSTED";

export type DemoPlayer = {
  rebuys?: number;
  id: string;
  name: string;
  status: RegStatus;
  table?: number | null;
  seat?: number | null;
  paid?: boolean;
  bustOrder?: number | null;
  addon?: boolean;
  finishPos?: number | null;
  playerNumber?: string;
  rebuyCount?: number;
};

export type DemoEventModel = {
  tournamentStatus: string;

  // Event params (demo, Run is source of truth)
  buyinAmount: number;
  rebuyAmount: number;
  addonAmount: number;
  buyinChips: number;
  rebuyChips: number;
  addonChips: number;

  // Counts (demo)
  rebuys: number;
  addons: number;

  eventToken: string;
  createdAt: number;
  updatedAt?: number;

  // seating config (demo)
  seatsPerTable: number;
  tableCount: number;

  // players
  players: DemoPlayer[];

  // bust order counter
  bustCounter: number;
};

type Store = Map<string, DemoEventModel>;

const g = globalThis as any;
if (!g.__EPLT_DEMO_EVENTS__) g.__EPLT_DEMO_EVENTS__ = new Map() as Store;

export const events: Store = g.__EPLT_DEMO_EVENTS__;

// Demo convenience: treat all demo eventTokens as a single shared event.
// This prevents Run and Kiosk from drifting if different demo URLs are opened.
function demoKey(_eventToken: string) {
  return "DEMO";
}

export function seedPlayers(eventToken: string): DemoPlayer[] {
  // Demo roster seeded for kiosk/run testing
  // Player numbers are PL-###### with a 6-digit palindrome number portion.
  const base: DemoPlayer[] = [
    {'id': 'P01', 'playerNumber': 'PL-001100', 'name': 'Ryan McBride', 'status': 'CHECKED_IN', 'table': 1, 'seat': 1, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P02', 'playerNumber': 'PL-002200', 'name': 'Amanda Johnson', 'status': 'CHECKED_IN', 'table': 1, 'seat': 2, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P03', 'playerNumber': 'PL-003300', 'name': 'Charlie Williams', 'status': 'CHECKED_IN', 'table': 1, 'seat': 3, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P04', 'playerNumber': 'PL-004400', 'name': 'Megan Brown', 'status': 'CHECKED_IN', 'table': 1, 'seat': 4, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P05', 'playerNumber': 'PL-005500', 'name': 'Jordan Jones', 'status': 'CHECKED_IN', 'table': 1, 'seat': 5, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P06', 'playerNumber': 'PL-006600', 'name': 'Taylor Garcia', 'status': 'CHECKED_IN', 'table': 1, 'seat': 6, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P07', 'playerNumber': 'PL-007700', 'name': 'Casey Miller', 'status': 'CHECKED_IN', 'table': 1, 'seat': 7, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P08', 'playerNumber': 'PL-008800', 'name': 'Morgan Davis', 'status': 'CHECKED_IN', 'table': 1, 'seat': 8, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P09', 'playerNumber': 'PL-009900', 'name': 'Avery Rodriguez', 'status': 'CHECKED_IN', 'table': 1, 'seat': 9, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P10', 'playerNumber': 'PL-010010', 'name': 'Parker Martinez', 'status': 'CHECKED_IN', 'table': 1, 'seat': 10, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P11', 'playerNumber': 'PL-011110', 'name': 'Drew Hernandez', 'status': 'CHECKED_IN', 'table': 2, 'seat': 1, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P12', 'playerNumber': 'PL-012210', 'name': 'Cameron Lopez', 'status': 'CHECKED_IN', 'table': 2, 'seat': 2, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P13', 'playerNumber': 'PL-013310', 'name': 'Riley Gonzalez', 'status': 'CHECKED_IN', 'table': 2, 'seat': 3, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P14', 'playerNumber': 'PL-014410', 'name': 'Quinn Wilson', 'status': 'CHECKED_IN', 'table': 2, 'seat': 4, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P15', 'playerNumber': 'PL-015510', 'name': 'Reese Anderson', 'status': 'CHECKED_IN', 'table': 2, 'seat': 5, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P16', 'playerNumber': 'PL-016610', 'name': 'Logan Thomas', 'status': 'CHECKED_IN', 'table': 2, 'seat': 6, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P17', 'playerNumber': 'PL-017710', 'name': 'Harper Taylor', 'status': 'CHECKED_IN', 'table': 2, 'seat': 7, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P18', 'playerNumber': 'PL-018810', 'name': 'Sawyer Moore', 'status': 'CHECKED_IN', 'table': 2, 'seat': 8, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P19', 'playerNumber': 'PL-019910', 'name': 'Rowan Jackson', 'status': 'CHECKED_IN', 'table': 2, 'seat': 9, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P20', 'playerNumber': 'PL-020020', 'name': 'Blake Martin', 'status': 'CHECKED_IN', 'table': 2, 'seat': 10, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P21', 'playerNumber': 'PL-021120', 'name': 'Hayden Lee', 'status': 'CHECKED_IN', 'table': 3, 'seat': 1, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P22', 'playerNumber': 'PL-022220', 'name': 'Jesse Perez', 'status': 'CHECKED_IN', 'table': 3, 'seat': 2, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P23', 'playerNumber': 'PL-023320', 'name': 'Sam Thompson', 'status': 'CHECKED_IN', 'table': 3, 'seat': 3, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P24', 'playerNumber': 'PL-024420', 'name': 'Alex White', 'status': 'CHECKED_IN', 'table': 3, 'seat': 4, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P25', 'playerNumber': 'PL-025520', 'name': 'Jamie Harris', 'status': 'CHECKED_IN', 'table': 3, 'seat': 5, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P26', 'playerNumber': 'PL-026620', 'name': 'Devin Sanchez', 'status': 'CHECKED_IN', 'table': 3, 'seat': 6, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P27', 'playerNumber': 'PL-027720', 'name': 'Kendall Clark', 'status': 'CHECKED_IN', 'table': 3, 'seat': 7, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P28', 'playerNumber': 'PL-028820', 'name': 'Bailey Ramirez', 'status': 'CHECKED_IN', 'table': 3, 'seat': 8, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P29', 'playerNumber': 'PL-029920', 'name': 'Skyler Lewis', 'status': 'CHECKED_IN', 'table': 3, 'seat': 9, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
    {'id': 'P30', 'playerNumber': 'PL-030030', 'name': 'Emerson Robinson', 'status': 'CHECKED_IN', 'table': 3, 'seat': 10, 'rebuys': 0, 'rebuyCount': 0, 'addon': false, 'paid': false},
  ];
  return base;
}

export function getOrCreateDemoEvent(eventToken: string): DemoEventModel {
  const key = demoKey(eventToken);
  const existing = events.get(key);
  if (existing) return existing;

  const model: DemoEventModel = {
    tournamentStatus: "REGISTRATION",

    // Event params (demo defaults; Run can overwrite via control endpoint)
    buyinAmount: 125,
    rebuyAmount: 125,
    addonAmount: 20,
    buyinChips: 20000,
    rebuyChips: 20000,
    addonChips: 40000,

    // Counts (demo)
    rebuys: 0,
    addons: 0,

    eventToken: key,
    createdAt: Date.now(),

    // seating config (demo)
    seatsPerTable: 10,
    tableCount: 3,

    // players
    players: seedPlayers(eventToken),

    // bust order counter
    bustCounter: 0,
  };

  events.set(key, model);
  return model;
}
