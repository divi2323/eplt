import { NextResponse } from "next/server";
import { getOrCreateClock } from "../../_serverStore";

type Ctx = { params: Promise<{ eventToken: string }> };

/**
 * Demo clock control endpoint.
 * Accepts both the newer `{ action: "..." }` form (used by the kiosk UI)
 * and a legacy `{ type: "..." }` form.
 */
export async function POST(req: Request, context: Ctx) {
  const { eventToken } = await context.params;
  const model = getOrCreateClock(eventToken);
  const raw = (await req.json()) as any;

  // Normalize incoming payloads
  const action = String(raw?.action ?? "");
  const type = String(raw?.type ?? "");
  const deltaMsRaw = Number(raw?.deltaMs ?? raw?.delta ?? raw?.delta_ms ?? raw?.deltaMilliseconds ?? raw?.deltaMinutes ?? 0);
  const deltaMs = Number.isFinite(deltaMsRaw) ? deltaMsRaw : 0;

  const now = Date.now();

  const clampLevelStart = () => {
    if (!model.levelStartedAt) return;
    const refNow = model.pausedAt || now;
    const cur = model.structure?.[model.levelIndex] ?? { isBreak: false };
    const duration = cur.isBreak ? model.breakDurationMs : model.levelDurationMs;
    const maxStartedAt = refNow; // remaining == duration
    const minStartedAt = refNow - duration; // remaining == 0
    if (model.levelStartedAt > maxStartedAt) model.levelStartedAt = maxStartedAt;
    if (model.levelStartedAt < minStartedAt) model.levelStartedAt = minStartedAt;
  };

  // Helper: adjust remaining time by shifting the levelStartedAt timestamp.
  const applyAdjust = (dMs: number) => {
    if (!model.levelStartedAt) model.levelStartedAt = now;
    model.levelStartedAt = model.levelStartedAt + dMs;
    // IMPORTANT: Do NOT shift pausedAt when paused.
    // pausedAt is used to freeze effective time. If we move pausedAt along with
    // levelStartedAt, the computed remaining time will not change while paused.
    clampLevelStart();
  };

  // Map legacy type values to action semantics
  const effective = (() => {
    if (action) return action;
    if (!type) return "";
    const t = type.toUpperCase();
    if (t === "START") return "start";
    if (t === "STOP") return "stop";
    if (t === "PAUSE") return "pause";
    if (t === "RESUME") return "resume";
    if (t === "NEXT_LEVEL") return "nextLevel";
    if (t === "PREV_LEVEL") return "prevLevel";
    if (t === "ADJUST_MS") return "adjustMs";
    return "";
  })();

  switch (effective) {
    case "start": {
      model.state = "RUNNING";
      model.startedAt = now;
      model.levelStartedAt = now;
      model.pausedAt = null;
      model.accumulatedPauseMs = 0;
      break;
    }
    case "stop": {
      model.state = "STOPPED";
      model.startedAt = null;
      model.levelStartedAt = null;
      model.pausedAt = null;
      model.accumulatedPauseMs = 0;
      break;
    }
    case "pause": {
      if (model.state === "RUNNING") {
        model.state = "PAUSED";
        model.pausedAt = now;
      }
      break;
    }
    case "resume": {
      if (model.state === "PAUSED" && model.pausedAt) {
        model.state = "RUNNING";
        model.accumulatedPauseMs += now - model.pausedAt;
        model.pausedAt = null;
      }
      break;
    }
    case "nextLevel": {
      model.levelIndex = (model.levelIndex + 1) % model.structure.length;
      model.levelStartedAt = now;
      model.accumulatedPauseMs = 0;
      model.pausedAt = null;
      break;
    }
    case "prevLevel": {
      model.levelIndex = (model.levelIndex - 1 + model.structure.length) % model.structure.length;
      model.levelStartedAt = now;
      model.accumulatedPauseMs = 0;
      model.pausedAt = null;
      break;
    }

    // New: kiosk uses adjustMs with +/- 60000
    case "adjustMs": {
      applyAdjust(deltaMs);
      break;
    }
    // Back-compat: older kiosk builds used addMinute/subMinute
    case "addMinute": {
      applyAdjust(60_000);
      break;
    }
    case "subMinute": {
      applyAdjust(-60_000);
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
