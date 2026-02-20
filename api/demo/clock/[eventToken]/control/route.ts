import { NextResponse } from "next/server";
import { getOrCreateClock } from "../../_serverStore";

type Action =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "NEXT_LEVEL" }
  | { type: "SET_LEVEL_INDEX"; levelIndex: number }
  | { type: "SET_COUNTS"; buyins?: number; rebuys?: number; addons?: number };

export async function POST(req: Request, { params }: { params: { eventToken: string } }) {
  const model = getOrCreateClock(params.eventToken);
  const body = (await req.json()) as Action;
  const now = Date.now();

  switch (body.type) {
    case "START":
      model.state = "RUNNING";
      model.startedAt = now;
      model.levelStartedAt = now;
      model.pausedAt = null;
      model.accumulatedPauseMs = 0;
      break;

    case "PAUSE":
      if (model.state === "RUNNING") {
        model.state = "PAUSED";
        model.pausedAt = now;
      }
      break;

    case "RESUME":
      if (model.state === "PAUSED" && model.pausedAt) {
        model.state = "RUNNING";
        model.accumulatedPauseMs += now - model.pausedAt;
        model.pausedAt = null;
      }
      break;

    case "NEXT_LEVEL":
      model.levelIndex = Math.min(model.levelIndex + 1, model.structure.length - 1);
      model.levelStartedAt = now;
      model.accumulatedPauseMs = 0;
      model.pausedAt = null;
      if (model.state === "STOPPED") model.state = "RUNNING";
      break;

    case "SET_LEVEL_INDEX":
      model.levelIndex = Math.max(0, Math.min(body.levelIndex, model.structure.length - 1));
      model.levelStartedAt = now;
      model.accumulatedPauseMs = 0;
      model.pausedAt = null;
      break;

    case "SET_COUNTS":
      model.counts.buyins = body.buyins ?? model.counts.buyins;
      model.counts.rebuys = body.rebuys ?? model.counts.rebuys;
      model.counts.addons = body.addons ?? model.counts.addons;
      break;
  }

  return NextResponse.json({ ok: true });
}
