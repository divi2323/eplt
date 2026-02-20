import { NextResponse } from "next/server";
import { getOrCreateDemoEvent } from "../_serverStore";

type Ctx = { params: Promise<{ eventToken: string }> };

export async function GET(_: Request, context: Ctx) {
  const { eventToken } = await context.params;
  const model = getOrCreateDemoEvent(eventToken);
  const serverNow = Date.now();

  return NextResponse.json({
    eventToken,
    serverNow,
    event: {
      seatsPerTable: model.seatsPerTable,
      tableCount: model.tableCount,
    },
    players: model.players,
    meta: {
      bustCounter: model.bustCounter,
    },
    public: {
      controlActions: ["register", "unregister", "checkIn", "undoCheckIn", "assignSeat", "clearSeat", "bustOut", "undoBustOut", "resetDemo"],
    },
  });
}