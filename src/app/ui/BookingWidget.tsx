"use client";

import { useEffect, useMemo, useState } from "react";
import { formatLocal } from "@/lib/time";
import { formatUSPretty, normalizeUSPhoneToE164 } from "@/lib/phone";

type Slot = {
  id: string;
  start_time: string;
  end_time: string;
};

export default function BookingWidget() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [note, setNote] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  async function loadSlots() {
    setLoading(true);
    // IMPORTANT: don't clear msg here, or it will erase "Booked! ✅" immediately
    const res = await fetch("/api/slots", { cache: "no-store" });
    const data = await res.json();
    setSlots(data.slots ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadSlots();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const d = new Date(s.start_time);
      const key = d.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      map.set(key, [...(map.get(key) || []), s]);
    }
    return Array.from(map.entries());
  }, [slots]);

  async function submitBooking() {
    if (!selectedSlot) return;

    setMsg(null);

    if (name.trim().length < 2) return setMsg("Please enter your name.");
    if (contact.trim().length < 2)
      return setMsg("Please enter your Instagram handle (or other contact).");
    if (smsOptIn && !phoneE164)
      return setMsg("To get texts, enter a valid US phone number.");

    setBooking(true);
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slotId: selectedSlot.id,
        customerName: name.trim(),
        customerContact: contact.trim(),
        customerPhone: phoneE164,
        smsOptIn,
        note: note.trim() || null,
      }),
    });

    const data = await res.json();
    setBooking(false);

    if (!res.ok) {
      setMsg(data?.error || "Could not book this slot. Try another one.");
      await loadSlots();
      return;
    }

    setMsg("Booked! ✅ See you then.");
    setSelectedSlot(null);
    setName("");
    setContact("");
    setPhone("");
    setPhoneE164(null);
    setSmsOptIn(false);
    setNote("");

    await loadSlots();
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ padding: 16, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Available slots</h2>

        {loading ? (
          <p>Loading…</p>
        ) : slots.length === 0 ? (
          <p style={{ color: "#555" }}>No open slots right now. Check back soon.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {grouped.map(([day, daySlots]) => (
              <div key={day}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{day}</div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {daySlots.map((s) => {
                    const isSelected = selectedSlot?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          setMsg(null);
                          setSelectedSlot(s);
                        }}
                        style={{
                          borderRadius: 999,
                          padding: "8px 12px",
                          border: "1px solid #ddd",
                          background: isSelected ? "#111" : "#fff",
                          color: isSelected ? "#fff" : "#111",
                          cursor: "pointer",
                        }}
                      >
                        {new Date(s.start_time).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: 16, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Book</h2>

        {!selectedSlot ? (
          <p style={{ color: "#555" }}>Select a slot above to book it.</p>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>
              Booking: <b>{formatLocal(selectedSlot.start_time)}</b>
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Instagram (or any contact)</span>
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="@yourhandle"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Phone (optional)</span>
                <input
                  value={phone}
                  onChange={(e) => {
                    const typed = e.target.value;

                    if (typed.trim().startsWith("+")) {
                      setPhone(typed);
                      setPhoneE164(normalizeUSPhoneToE164(typed));
                      return;
                    }

                    const pretty = formatUSPretty(typed);
                    setPhone(pretty);
                    setPhoneE164(normalizeUSPhoneToE164(pretty));
                  }}
                  placeholder="(209) 555-1212 or +12095551212"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
                <span style={{ fontSize: 12, color: "#777" }}>
                  {phoneE164 ? `Will text: ${phoneE164}` : "Enter a US number to enable texts."}
                </span>
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={smsOptIn}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (checked && !phoneE164) {
                      setMsg("Add a valid phone number first (US) to enable texts.");
                      return;
                    }
                    setSmsOptIn(checked);
                  }}
                />
                <span>Text me confirmations (opt-in)</span>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Note (optional)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything to know?"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={submitBooking}
                  disabled={booking}
                  style={{
                    borderRadius: 12,
                    padding: "10px 14px",
                    border: "none",
                    background: "#111",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {booking ? "Booking…" : "Confirm booking"}
                </button>

                <button
                  onClick={() => setSelectedSlot(null)}
                  style={{
                    borderRadius: 12,
                    padding: "10px 14px",
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}

        {msg && <p style={{ marginTop: 12, color: msg.includes("✅") ? "green" : "#b00020" }}>{msg}</p>}
      </div>
    </div>
  );
}
