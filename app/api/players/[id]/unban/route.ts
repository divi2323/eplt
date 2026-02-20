import { NextResponse } from "next/server";

// POST /api/players/:id/unban
// Banned status was removed from schema; endpoint kept for backwards compatibility.
export async function POST() {
  return NextResponse.json({ error: "Banned status is no longer supported" }, { status: 410 });
}
