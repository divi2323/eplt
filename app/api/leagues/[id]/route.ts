import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const LEAGUE_TYPES = ["rolling", "season"] as const;
const LEAGUE_STATUS = ["active", "inactive"] as const;

type LeagueType = typeof LEAGUE_TYPES[number];
type LeagueStatus = typeof LEAGUE_STATUS[number];

type LeagueRow = {
  id: string;
  league_number: string;
  name: string;
  notes: string | null;
  is_archived: boolean;
  league_type: LeagueType | null;
  league_status: LeagueStatus | null;
  start_date: string | null;
  end_date: string | null;
  runner_id: string | null;
  created_at: string;
  updated_at: string;
};

// PATCH /api/leagues/:id
// { name?, notes?, is_archived?, league_type?, league_status?, start_date?, end_date?, runner_id? }
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const fields: string[] = [];
  const params: any[] = [];
  let pnum = 1;

  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    fields.push(`league_name = $${pnum++}`); params.push(name);
  }
  if (body.notes !== undefined) {
    const notes = body.notes == null ? null : String(body.notes);
    fields.push(`notes = $${pnum++}`); params.push(notes);
  }
  if (body.is_archived !== undefined) {
    const is_archived = Boolean(body.is_archived);
    fields.push(`league_status = $${pnum++}`); params.push(is_archived ? "inactive" : "active");
  }
  if (body.league_type !== undefined) {
    const v = body.league_type == null ? null : String(body.league_type).trim();
    if (v !== null && !LEAGUE_TYPES.includes(v as any)) {
      return NextResponse.json({ error: "Invalid league_type" }, { status: 400 });
    }
    fields.push(`league_type = $${pnum++}`); params.push(v);
  }
  if (body.league_status !== undefined) {
    const v = body.league_status == null ? null : String(body.league_status).trim();
    if (v !== null && !LEAGUE_STATUS.includes(v as any)) {
      return NextResponse.json({ error: "Invalid league_status" }, { status: 400 });
    }
    fields.push(`league_status = $${pnum++}`); params.push(v);
  }
  if (body.start_date !== undefined) {
    const v = body.start_date == null ? null : String(body.start_date).trim();
    fields.push(`start_date = $${pnum++}`); params.push(v ? v : null);
  }
  if (body.end_date !== undefined) {
    const v = body.end_date == null ? null : String(body.end_date).trim();
    fields.push(`end_date = $${pnum++}`); params.push(v ? v : null);
  }
  if (body.runner_id !== undefined) {
    const v = body.runner_id == null ? null : String(body.runner_id).trim();
    fields.push(`runner_id = $${pnum++}`); params.push(v ? v : null);
  }

  if (fields.length == 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  params.push(id);

  const result = await sql<LeagueRow>(`
    UPDATE leagues
    SET ${fields.join(", ")}
    WHERE league_id = $${pnum} AND deleted_at IS NULL
    RETURNING
      league_id AS id,
      league_number,
      league_name AS name,
      notes,
      (league_status = 'inactive') AS is_archived,
      league_type,
      league_status,
      start_date,
      end_date,
      runner_id,
      created_at,
      updated_at
  `, params);

  if (result.length === 0) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  return NextResponse.json({ league: result[0] });
}

// DELETE /api/leagues/:id  (soft delete)
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const result = await sql(`
    UPDATE leagues
    SET deleted_at = NOW()
    WHERE league_id = $1 AND deleted_at IS NULL
    RETURNING league_id AS id
  `, [id]);

  if (result.length === 0) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
