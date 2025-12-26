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

  // 1) Get slot
  const { data: slot, error: slotErr } = await supabaseAdmin
    .from("slots")
    .select("id,start_time,is_active,booked")
    .eq("id", slotId)
    .single();

  if (slotErr || !slot) return NextResponse.json({ error: "Slot not found." }, { status: 404 });

  if (!slot.is_active || slot.booked) {
    return NextResponse.json({ error: "This slot is not available." }, { status: 409 });
  }

  if (new Date(slot.start_time).getTime() < Date.now()) {
    return NextResponse.json({ error: "That time already passed." }, { status: 409 });
  }

  // 2) Atomically "claim" the slot (prevents double booking)
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("slots")
    .update({ booked: true, is_active: false })
    .eq("id", slotId)
    .eq("booked", false) // only if not already booked
    .select("id,start_time")
    .maybeSingle();

  if (claimErr) {
    console.error("Claim slot failed:", claimErr);
    return NextResponse.json({ error: "Booking failed (server/database). Check logs." }, { status: 500 });
  }

  if (!claimed) {
    return NextResponse.json(
      { error: "This slot was just booked by someone else. Try another one." },
      { status: 409 }
    );
  }

  // 3) Insert booking row
  const { error: insErr } = await supabaseAdmin.from("bookings").insert({
    slot_id: slotId,
    customer_name: customerName,
    customer_contact: customerContact,
    customer_phone: customerPhone ?? null,
    sms_opt_in: !!smsOptIn,
    note: note ?? null,
  });

  if (insErr) {
    // rollback slot if booking insert fails
    console.error("Booking insert failed:", insErr);

    await supabaseAdmin
      .from("slots")
      .update({ booked: false, is_active: true })
      .eq("id", slotId);

    return NextResponse.json(
      { error: "Booking failed (server/database). Check logs." },
      { status: 500 }
    );
  }

  // 4) SMS notifications
  const when = new Date(claimed.start_time).toLocaleString([], {
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

    try {
      await sendSms(barberNumber, barberMsg);
    } catch (e) {
      console.error("Barber SMS failed:", e);
    }
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

  // 5) Return success response the UI can show
  return NextResponse.json({
    ok: true,
    message: `Booking confirmed for ${when}`,
  });
}
