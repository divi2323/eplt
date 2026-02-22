import { NextResponse } from "next/server";
import { getOrCreateDemoEvent, seedPlayers } from "../../_serverStore";

type Ctx = { params: Promise<{ eventToken: string }> };

type Body =
  | { action: "register"; name?: string }
  | { action: "unregister"; playerId: string }
  | { action: "checkIn"; playerId: string }
  | { action: "undoCheckIn"; playerId: string }
  | { action: "assignSeat"; playerId: string; table: number; seat: number }
  | { action: "clearSeat"; playerId: string }
  | { action: "bustOut"; playerId: string }
  | { action: "undoBustOut"; playerId: string }
  | { action: "addRebuy"; playerId: string }
  | { action: "removeRebuy"; playerId: string }
  | { action: "toggleAddon"; playerId: string }
  | { action: "resetDemo" }
  | { action: "reorderFinishers"; orderedIds: string[] }
  | { action: "setStatus"; status: string }
  | { action: "setParams"; buyinAmount?: number; rebuyAmount?: number; addonAmount?: number; buyinChips?: number; rebuyChips?: number; addonChips?: number }
  | { action: "setCounts"; rebuys?: number; addons?: number };


function recomputeBustAndFinishes(model: any) {
  // Renumber busted players sequentially (no gaps), then compute finishing positions.
  const busted = model.players
    .filter((p: any) => p.status === "BUSTED" && Number.isFinite(Number(p.bustOrder)))
    .sort((a: any, b: any) => Number(a.bustOrder) - Number(b.bustOrder));

  busted.forEach((p: any, idx: number) => {
    p.bustOrder = idx + 1;
  });

  const totalEntrants = model.players.filter((p: any) => p.status === "REGISTERED" || p.status === "BUSTED" || Boolean(p.paid)).length;
  model.players.forEach((p: any) => {
    if (p.status === "BUSTED" && Number.isFinite(Number(p.bustOrder))) {
      p.finishPos = Math.max(1, totalEntrants - Number(p.bustOrder) + 1);
    } else {
      p.finishPos = null;
    }
  });
}

function normalizeName(s: string) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

export async function POST(req: Request, context: Ctx) {
  const { eventToken } = await context.params;
  const model = getOrCreateDemoEvent(eventToken);
  const body = (await req.json()) as Body;

  try {
    switch (body.action) {
      case "register": {
        const b: any = body as any;
        const playerId = String(b.playerId || "");
        if (!playerId) throw new Error("playerId required");
        const p = model.players.find((x) => x.id === playerId);
        if (!p) throw new Error("player not found");

        // Register means: player is in the tournament and paid
        p.status = "REGISTERED";
        p.paid = true;
        if (p.addon === undefined) p.addon = false;
        if (p.rebuys === undefined) p.rebuys = 0;

        // If entrants change after someone already busted, finishing positions must re-evaluate.
        recomputeBustAndFinishes(model);
        model.updatedAt = Date.now();
        break;
      }
      case "unregister": {
        const b: any = body as any;
        const playerId = String(b.playerId || "");
        if (!playerId) throw new Error("playerId required");
        const p = model.players.find((x) => x.id === playerId);
        if (!p) throw new Error("player not found");

        // Unregister means: revert back to checked-in (not paid / not in tournament)
        p.status = "CHECKED_IN";
        p.paid = false;
        p.rebuys = 0;
        p.addon = false;

        model.updatedAt = Date.now();
        break;
      }
      case "checkIn": {
        // Staff registers (paid) a checked-in player into the tournament roster.
        const p = model.players.find((x) => x.id === body.playerId);
        if (p) {
          p.status = "REGISTERED";
          p.paid = true;
          recomputeBustAndFinishes(model);
        }
        break;
      }
      case "undoCheckIn": {
        // Undo registration (refund/unpay): send back to Checked In.
        const p = model.players.find((x) => x.id === body.playerId);
        if (p) {
          p.status = "CHECKED_IN";
          p.paid = false;
          p.table = null;
          p.seat = null;
          recomputeBustAndFinishes(model);
        }
        break;
      }
      case "assignSeat": {
        const p = model.players.find((x) => x.id === body.playerId);
        if (p && p.status === "REGISTERED") {
          p.table = Number(body.table);
          p.seat = Number(body.seat);
        }
        break;
      }
      case "clearSeat": {
        const p = model.players.find((x) => x.id === body.playerId);
        if (p) {
          p.table = null;
          p.seat = null;
        }
        break;
      }
      case "bustOut": {
        const p = model.players.find((x) => x.id === body.playerId);
        if (p && p.status === "REGISTERED") {
          const maxBust = Math.max(0, ...model.players.map((x: any) => Number(x.bustOrder) || 0));
          p.status = "BUSTED";
          p.bustOrder = maxBust + 1;
          recomputeBustAndFinishes(model);
        }
        break;
      }
      case "undoBustOut": {
        // Undo bust: return to Registered (still paid).
        const p = model.players.find((x) => x.id === body.playerId);
        if (p) {
          p.status = "REGISTERED";
          p.paid = true;
          p.bustOrder = null;
          p.finishPos = null;
          recomputeBustAndFinishes(model);
        }
        break;
      }

      case "reorderFinishers": {
        const b: any = body as any;
        const orderedIds = Array.isArray(b.orderedIds) ? b.orderedIds.map((x: any) => String(x)) : [];
        if (!orderedIds.length) break;

        // Client sends busted players in *finish order* (best -> worst). Our model uses bustOrder
        // (first out -> last out). So we assign larger bustOrder to better finishes.
        const busted = model.players.filter((p: any) => p.status === "BUSTED");
        const bustedById = new Map(busted.map((p: any) => [String(p.id), p]));
        const orderedBusted = orderedIds.map((id: string) => bustedById.get(id)).filter(Boolean) as any[];
        if (!orderedBusted.length) break;

        // Highest bustOrder => best finish among busted.
        const n = orderedBusted.length;
        orderedBusted.forEach((p: any, idx: number) => {
          p.bustOrder = n - idx;
        });

        recomputeBustAndFinishes(model);
        model.updatedAt = Date.now();
        break;
      }

      case "setStatus": {
        model.tournamentStatus = String((body as any).status || "REGISTERING").toUpperCase();
        break;
      }
      case "setParams": {
        const b: any = body as any;
        const setNum = (k: string, minv: number) => {
          const v = Number(b[k]);
          if (Number.isFinite(v) && v >= minv) (model as any)[k] = v;
        };
        setNum("buyinAmount", 0);
        setNum("rebuyAmount", 0);
        setNum("addonAmount", 0);
        setNum("buyinChips", 1);
        setNum("rebuyChips", 1);
        setNum("addonChips", 1);
        break;
      }
      
      case "addRebuy": {
        const p = model.players.find((x) => x.id === body.playerId);
        if (p && p.status === "REGISTERED") {
          (p as any).rebuys = Math.max(0, Math.floor(Number((p as any).rebuys ?? 0)) + 1);
        }
        break;
      }
      case "removeRebuy": {
        const p = model.players.find((x) => x.id === body.playerId);
        if (p && p.status === "REGISTERED") {
          (p as any).rebuys = Math.max(0, Math.floor(Number((p as any).rebuys ?? 0)) - 1);
        }
        break;
      }
      case "toggleAddon": {
        // Staff-controlled add-on toggle (can toggle on/off).
        const p = model.players.find((x) => x.id === (body as any).playerId);
        if (p && p.status === "REGISTERED") {
          (p as any).addon = !Boolean((p as any).addon);
        }
        recomputeBustAndFinishes(model);
        break;
      }

      case "setCounts": {
        const b: any = body as any;
        const r = Number(b.rebuys);
        const a = Number(b.addons);
        if (Number.isFinite(r) && r >= 0) model.rebuys = Math.floor(r);
        if (Number.isFinite(a) && a >= 0) model.addons = Math.floor(a);
        break;
      }

      case "resetDemo": {
        // Reset to initial seeded demo state (keep seating config).
        // IMPORTANT: Keep the PL-###### playerNumber convention used across Run/Kiosk.
        model.tournamentStatus = "REGISTRATION";
        model.buyinAmount = 125;
        model.rebuyAmount = 125;
	        model.addonAmount = 20;
        model.buyinChips = 20000;
        model.rebuyChips = 20000;
        model.addonChips = 40000;
        model.rebuys = 0;
        model.addons = 0;
        model.bustCounter = 0;

        // Deep-ish reset: clone seed objects so later mutation doesn't affect the seed list.
        model.players = seedPlayers(eventToken).map((p: any) => ({ ...p }));
        break;
      }
    }
  } catch {
    // ignore demo errors
  }

  return NextResponse.json({ ok: true });
}