import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendSms } from "@/lib/sms";

const Body = z.object({
  slotId: z.string().uuid(),
  customerName: z.string().min(2).max(80),
  customerContact: z.string().min(2).max(120),
  customerPhone: z.string().max(30).nullable().optional(),
  smsOptIn: z.boolean().optional().default(false),
  note: z.string().max(250).nullable().optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid booking info." }, { status: 400 });
  }

  const { slotId, customerName, customerContact, customerPhone, smsOptIn, note } = parsed.data;

  const { data: slot, error: slotErr } = await supabaseAdmin
    .from("slots")
    .select("id,start_time,is_active")
    .eq("id", slotId)
    .single();

  if (slotErr || !slot) return NextResponse.json({ error: "Slot not found." }, { status: 404 });
  if (!slot.is_active) return NextResponse.json({ error: "This slot is not available." }, { status: 409 });
  if (new Date(slot.start_time).getTime() < Date.now()) {
    return NextResponse.json({ error: "That time already passed." }, { status: 409 });
  }

  const { error: insErr } = await supabaseAdmin.from("bookings").insert({
    slot_id: slotId,
    customer_name: customerName,
    customer_contact: customerContact,
    customer_phone: customerPhone ?? null,
    sms_opt_in: !!smsOptIn,
    note: note ?? null,
  });

  if (insErr) {
    // Unique constraint prevents double booking
    return NextResponse.json({ error: "This slot was just booked by someone else. Try another one." }, { status: 409 });
  }

  // SMS notifications
  const when = new Date(slot.start_time).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const barberNumber = process.env.BARBER_NOTIFY_NUMBER;
  if (barberNumber) {
    const barberMsg =
      `New haircut booking ✅\n` +
      `Time: ${when}\n` +
      `Name: ${customerName}\n` +
      `Contact: ${customerContact}` +
      (customerPhone ? `\nPhone: ${customerPhone}` : "") +
      (note ? `\nNote: ${note}` : "");

    try { await sendSms(barberNumber, barberMsg); } catch (e) { console.error("Barber SMS failed:", e); }
  }

  if (process.env.SEND_CUSTOMER_SMS === "true" && smsOptIn) {
    const phone = (customerPhone ?? "").trim();
    const isE164 = /^\+[1-9]\d{7,14}$/.test(phone);
    if (isE164) {
      try {
        await sendSms(phone, `Booked ✅ See you at ${when}. Reply STOP to opt out.`);
      } catch (e) {
        console.error("Customer SMS failed:", e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
