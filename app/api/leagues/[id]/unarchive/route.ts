import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// POST /api/leagues/:id/unarchive
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const result = await sql(`
    UPDATE leagues
    SET league_status = 'active'
    WHERE league_id = $1 AND deleted_at IS NULL
    RETURNING
      league_id AS id,
      league_number,
      league_name AS name,
      notes,
      (league_status = 'inactive') AS is_archived,
      created_at,
      updated_at
  `, [id]);

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  return NextResponse.json({ league: result.rows[0] });
}
