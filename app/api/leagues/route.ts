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

// GET /api/leagues?archived=0|1|all
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const archived = (searchParams.get("archived") ?? "0").toLowerCase();

  let where = "deleted_at IS NULL";

  // Back-compat with the UI: archived=true => inactive, archived=false => active
  if (archived === "1" || archived === "true" || archived === "inactive") {
    where += " AND league_status = 'inactive'";
  } else if (archived === "0" || archived === "false" || archived === "active") {
    where += " AND league_status = 'active'";
  }

  const result = await sql<LeagueRow>(`
    SELECT
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
    FROM leagues
    WHERE ${where}
    ORDER BY (league_status = 'inactive') ASC, league_number DESC, created_at DESC
  `);

  return NextResponse.json({ leagues: result });
}

// POST /api/leagues
// { name, notes?, league_type?, league_status?, start_date?, end_date?, runner_id? }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const name = String(body?.name ?? "").trim();
  const notes = body?.notes == null ? null : String(body.notes);

  const league_type = body?.league_type == null ? null : String(body.league_type).trim();
  if (league_type !== null && !LEAGUE_TYPES.includes(league_type as any)) {
    return NextResponse.json({ error: "Invalid league_type" }, { status: 400 });
  }

  const league_status = body?.league_status == null ? "active" : String(body.league_status).trim();
  if (league_status !== null && !LEAGUE_STATUS.includes(league_status as any)) {
    return NextResponse.json({ error: "Invalid league_status" }, { status: 400 });
  }

  const start_date = body?.start_date == null ? null : String(body.start_date).trim();
  const end_date = body?.end_date == null ? null : String(body.end_date).trim();
  const runner_id = body?.runner_id == null ? null : String(body.runner_id).trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const result = await sql<LeagueRow>(`
    INSERT INTO leagues (league_name, notes, league_type, league_status, start_date, end_date, runner_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
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
  `, [name, notes, league_type, league_status, start_date ? start_date : null, end_date ? end_date : null, runner_id ? runner_id : null]);

  return NextResponse.json({ league: result[0] }, { status: 201 });
}
