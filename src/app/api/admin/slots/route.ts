import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data: slots, error } = await supabaseAdmin
    .from("slots")
    .select("id,start_time,end_time,is_active,created_at")
    .gte("start_time", now.toISOString())
    .lte("start_time", in30.toISOString())
    .order("start_time", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const slotIds = (slots ?? []).map((s) => s.id);
  if (slotIds.length === 0) return NextResponse.json({ slots: [] });

  const { data: bookings, error: bErr } = await supabaseAdmin
    .from("bookings")
    .select("id,slot_id,customer_name,customer_contact,customer_phone,sms_opt_in,note,created_at")
    .in("slot_id", slotIds);

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  const bookingBySlot = new Map<string, any>();
  for (const b of bookings ?? []) bookingBySlot.set(b.slot_id, b);

  const out = (slots ?? []).map((s) => ({ ...s, booking: bookingBySlot.get(s.id) ?? null }));
  return NextResponse.json({ slots: out });
}

const CreateSingle = z.object({
  startTimeISO: z.string().min(10),
  minutes: z.number().int().min(5).max(240),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = CreateSingle.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const start = new Date(parsed.data.startTimeISO);
  if (!Number.isFinite(start.getTime())) return NextResponse.json({ error: "Bad start time." }, { status: 400 });
  const end = new Date(start.getTime() + parsed.data.minutes * 60 * 1000);

  const { error } = await supabaseAdmin.from("slots").insert({
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    is_active: true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

const BulkCreate = z.object({
  slots: z.array(z.object({ start_time: z.string().min(10), end_time: z.string().min(10) })).min(1).max(500),
});

export async function PUT(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BulkCreate.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid bulk slots." }, { status: 400 });

  const { error } = await supabaseAdmin.from("slots").insert(
    parsed.data.slots.map((s) => ({ start_time: s.start_time, end_time: s.end_time, is_active: true }))
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const { data: booking } = await supabaseAdmin.from("bookings").select("id").eq("slot_id", id).maybeSingle();
  if (booking) return NextResponse.json({ error: "Cannot delete a booked slot." }, { status: 409 });

  const { error } = await supabaseAdmin.from("slots").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
