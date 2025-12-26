import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: slots, error } = await supabaseAdmin
    .from("slots")
    .select("id,start_time,end_time,is_active")
    .eq("is_active", true)
    .gte("start_time", now.toISOString())
    .lte("start_time", in7.toISOString())
    .order("start_time", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!slots || slots.length === 0) return NextResponse.json({ slots: [] });

  const slotIds = slots.map((s) => s.id);
  const { data: booked, error: bErr } = await supabaseAdmin
    .from("bookings")
    .select("slot_id")
    .in("slot_id", slotIds);

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  const bookedSet = new Set((booked || []).map((b) => b.slot_id));
  const open = slots
    .filter((s) => !bookedSet.has(s.id))
    .map(({ id, start_time, end_time }) => ({ id, start_time, end_time }));

  return NextResponse.json({ slots: open });
}
