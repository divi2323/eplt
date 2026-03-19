import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// PATCH /api/players/:id   { first_name?, last_name?, email?, phone?, notes?, is_active?, role? }
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const fields: string[] = [];
  const params: any[] = [];
  let p = 1;

  if (body.first_name !== undefined) {
    const v = String(body.first_name ?? "").trim();
    if (!v) return NextResponse.json({ error: "First name is required" }, { status: 400 });
    fields.push(`first_name = $${p++}`); params.push(v);
  }
  if (body.last_name !== undefined) {
    const v = String(body.last_name ?? "").trim();
    if (!v) return NextResponse.json({ error: "Last name is required" }, { status: 400 });
    fields.push(`last_name = $${p++}`); params.push(v);
  }
  if (body.email !== undefined) {
    const v = body.email == null ? null : String(body.email).trim();
    fields.push(`email = $${p++}`); params.push(v);
  }
  if (body.phone !== undefined) {
    const v = body.phone == null ? null : String(body.phone).trim();
    fields.push(`phone = $${p++}`); params.push(v);
  }
  if (body.notes !== undefined) {
    const v = body.notes == null ? null : String(body.notes);
    fields.push(`notes = $${p++}`); params.push(v);
  }
  if (body.is_active !== undefined) {
    fields.push(`is_active = $${p++}`); params.push(Boolean(body.is_active));
  }
  if (body.role !== undefined) {
    const v = String(body.role ?? "").trim();
    if (!["player","admin","staff","viewer"].includes(v)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    fields.push(`role = $${p++}`); params.push(v);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  params.push(id);

  const result = await sql(`
    UPDATE players
    SET ${fields.join(", ")}
    WHERE player_id = $${p} AND deleted_at IS NULL
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
  `, params);

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json({ player: result.rows[0] });
}

// DELETE /api/players/:id  (soft delete)
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const result = await sql(`
    UPDATE players
    SET deleted_at = NOW()
    WHERE player_id = $1 AND deleted_at IS NULL
    RETURNING player_id AS id
  `, [id]);

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
