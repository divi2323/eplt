import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

type PlayerRow = {
  id: string;              // player_id UUID (aliased for UI)
  player_number: string;   // PL-###### human id
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

// GET /api/players?status=active|inactive|banned|all
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "active").toLowerCase();

  let where = "deleted_at IS NULL";

  // Back-compat: 'banned' no longer exists in schema; return empty set.
  if (status === "banned") {
    return NextResponse.json({ players: [] });
  } else if (status === "inactive") {
    where += " AND is_active = FALSE";
  } else if (status === "active") {
    where += " AND is_active = TRUE";
  } // 'all' => no extra filter

  const result = await sql<PlayerRow>(`
    SELECT
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
    FROM players
    WHERE ${where}
    ORDER BY is_active DESC, last_name ASC, first_name ASC, player_number DESC
  `);

  return NextResponse.json({ players: result });
}

// POST /api/players  { first_name, last_name, email?, phone?, notes? }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const first_name = String(body?.first_name ?? "").trim();
  const last_name = String(body?.last_name ?? "").trim();
  const email = body?.email == null ? null : String(body.email).trim();
  const phone = body?.phone == null ? null : String(body.phone).trim();
  const notes = body?.notes == null ? null : String(body.notes);

  if (!first_name || !last_name) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  }

  const result = await sql<PlayerRow>(`
    INSERT INTO players (first_name, last_name, email, phone, notes)
    VALUES ($1, $2, $3, $4, $5)
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
  `, [first_name, last_name, email, phone, notes]);

  return NextResponse.json({ player: result[0] }, { status: 201 });
}
