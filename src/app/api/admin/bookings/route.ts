import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const now = new Date();
  const before = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select("id,slot_id,customer_name,customer_contact,customer_phone,sms_opt_in,note,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const slotIds = (bookings ?? []).map((b) => b.slot_id);
  if (slotIds.length === 0) return NextResponse.json({ bookings: [] });

  const { data: slots, error: sErr } = await supabaseAdmin
    .from("slots")
    .select("id,start_time,end_time")
    .in("id", slotIds)
    .gte("start_time", now.toISOString())
    .lte("start_time", before.toISOString());

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const slotMap = new Map((slots ?? []).map((s) => [s.id, s]));
  const out = (bookings ?? []).map((b) => ({ ...b, slot: slotMap.get(b.slot_id) ?? null })).filter((b) => b.slot);

  return NextResponse.json({ bookings: out });
}
