import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toMoneyOrZero(v: any): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

type EventRow = {
  id: string;
  event_number: string;
  league_id: string;
  event_date: string;
  name: string;
  location: string | null;
  format: "rebuy" | "freezeout" | "bounty";
  buyin_amount: number | null;
  rebuy_amount: number | null;
  addon_amount: number | null;
  bounty_amount: number | null;
  status: "scheduled" | "registering" | "running" | "completed" | "locked";
  created_at: string;
  updated_at: string;
};

// GET /api/events
export async function GET(_req: Request) {
  try {
    const result = await sql<EventRow>(`
      SELECT
        event_id AS id,
        event_number,
        league_id,
        event_date,
        name,
        location,
        format,
        buyin_amount,
        rebuy_amount,
        addon_amount,
        bounty_amount,
        status,
        created_at,
        updated_at
      FROM events
      WHERE deleted_at IS NULL
      ORDER BY event_date DESC, event_number DESC
    `);

    return NextResponse.json({ events: result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load events" }, { status: 500 });
  }
}

// POST /api/events
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const league_id = String(body?.league_id ?? "").trim();
  const event_date = String(body?.event_date ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const location = body?.location == null ? null : String(body.location);

  // NOTE: format is an enum (rebuy|freezeout|bounty). Default must be a valid enum.
  const format = String(body?.format ?? "freezeout").trim();
  const status = String(body?.status ?? "scheduled").trim();

  // Schema may treat these as NOT NULL with defaults. Treat blanks as 0.
  const buyin_amount = toMoneyOrZero(body?.buyin_amount);
  const rebuy_amount = toMoneyOrZero(body?.rebuy_amount);
  const addon_amount = toMoneyOrZero(body?.addon_amount);
  const bounty_amount = toMoneyOrZero(body?.bounty_amount);

  if (!league_id) return NextResponse.json({ error: "League is required" }, { status: 400 });
  if (!UUID_RE.test(league_id)) return NextResponse.json({ error: "League selection is invalid" }, { status: 400 });
  if (!event_date) return NextResponse.json({ error: "Event date is required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  if (!['rebuy','freezeout','bounty'].includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }
  if (!['scheduled','registering','running','completed','locked'].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const result = await sql<EventRow>(`
      INSERT INTO events (
        league_id, event_date, name, location, format,
        buyin_amount, rebuy_amount, addon_amount, bounty_amount, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING
        event_id AS id,
        event_number,
        league_id,
        event_date,
        name,
        location,
        format,
        buyin_amount,
        rebuy_amount,
        addon_amount,
        bounty_amount,
        status,
        created_at,
        updated_at
    `, [league_id, event_date, name, location, format, buyin_amount, rebuy_amount, addon_amount, bounty_amount, status]);

    return NextResponse.json({ event: result.rows[0] }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Save failed" }, { status: 500 });
  }
}
