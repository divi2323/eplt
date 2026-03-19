import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

type PlayerRow = {
  id: string; // player_id UUID (aliased)
  player_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  role: "player" | "admin" | "staff" | "viewer";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// POST /api/players/:id/activate
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const result = await sql<PlayerRow>(`
    UPDATE players
    SET is_active = TRUE
    WHERE player_id = $1 AND deleted_at IS NULL
    RETURNING
      player_id AS id,
      player_number,
      first_name,
      last_name,
      email,
      phone,
      notes,
      role,
      is_active,
      created_at,
      updated_at
  `, [id]);

  if (result.rows.length === 0) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  return NextResponse.json({ player: result.rows[0] });
}
