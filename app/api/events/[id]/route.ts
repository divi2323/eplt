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

// PATCH /api/events/:id
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const fields: string[] = [];
  const params: any[] = [];
  let p = 1;

  const pushField = (sqlFrag: string, val: any) => {
    fields.push(sqlFrag.replace("$X", `$${p++}`));
    params.push(val);
  };

  if (body.league_id !== undefined) {
    const v = body.league_id == null ? null : String(body.league_id).trim();
    if (!v) return NextResponse.json({ error: "League is required" }, { status: 400 });
    if (!UUID_RE.test(v)) return NextResponse.json({ error: "League selection is invalid" }, { status: 400 });
    pushField("league_id = $X", v);
  }
  if (body.event_date !== undefined) {
    const v = body.event_date == null ? null : String(body.event_date).trim();
    if (!v) return NextResponse.json({ error: "Event date is required" }, { status: 400 });
    pushField("event_date = $X", v);
  }
  if (body.name !== undefined) {
    const v = String(body.name ?? "").trim();
    if (!v) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    pushField("name = $X", v);
  }
  if (body.location !== undefined) {
    const v = body.location == null ? null : String(body.location);
    pushField("location = $X", v);
  }
  if (body.format !== undefined) {
    const v = String(body.format ?? "").trim();
    if (!["rebuy","freezeout","bounty"].includes(v)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }
    pushField("format = $X", v);
  }
  if (body.status !== undefined) {
    const v = String(body.status ?? "").trim();
    if (!["scheduled","registering","running","completed","locked"].includes(v)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    pushField("status = $X", v);
  }

  for (const key of ["buyin_amount","rebuy_amount","addon_amount","bounty_amount"] as const) {
    if (body[key] !== undefined) {
      // Treat blank/null as 0 to match schema defaults (and avoid NOT NULL violations).
      pushField(`${key} = $X`, toMoneyOrZero(body[key]));
    }
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  params.push(id);

  try {
    const result = await sql<EventRow>(`
      UPDATE events
      SET ${fields.join(", ")}
      WHERE event_id = $${p} AND deleted_at IS NULL
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
    `, params);

    if (result.length === 0) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ event: result[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Save failed" }, { status: 500 });
  }
}

// DELETE /api/events/:id (soft delete)
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  try {
    const result = await sql(`
      UPDATE events
      SET deleted_at = NOW()
      WHERE event_id = $1 AND deleted_at IS NULL
      RETURNING event_id AS id
    `, [id]);

    if (result.length === 0) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Delete failed" }, { status: 500 });
  }
}
