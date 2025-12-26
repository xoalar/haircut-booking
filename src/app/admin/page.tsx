"use client";

import { useEffect, useMemo, useState } from "react";
import { formatLocal } from "@/lib/time";

type SlotRow = {
  id: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  booking: null | {
    id: string;
    slot_id: string;
    customer_name: string;
    customer_contact: string;
    customer_phone: string | null;
    sms_opt_in: boolean;
    note: string | null;
    created_at: string;
  };
};

type BookingRow = {
  id: string;
  slot_id: string;
  customer_name: string;
  customer_contact: string;
  customer_phone: string | null;
  sms_opt_in: boolean;
  note: string | null;
  created_at: string;
  slot: { id: string; start_time: string; end_time: string } | null;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginMsg, setLoginMsg] = useState<string | null>(null);

  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [singleStart, setSingleStart] = useState("");
  const [singleMins, setSingleMins] = useState(45);

  const [genStartDate, setGenStartDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]); // Mon-Sat
  const [openHour, setOpenHour] = useState(10);
  const [closeHour, setCloseHour] = useState(18);
  const [slotMins, setSlotMins] = useState(45);
  const [bufferMins, setBufferMins] = useState(0);
  const [genMsg, setGenMsg] = useState<string | null>(null);

  async function checkAuth() {
    const res = await fetch("/api/admin/me", { cache: "no-store" });
    const data = await res.json();
    setAuthed(!!data.ok);
  }

  useEffect(() => {
    checkAuth();
  }, []);

  async function login() {
    setLoginMsg(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoginMsg(data?.error || "Login failed.");
      return;
    }
    setPassword("");
    setAuthed(true);
    await refreshAll();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setSlots([]);
    setBookings([]);
  }

  async function refreshAll() {
    setLoading(true);
    const [sRes, bRes] = await Promise.all([
      fetch("/api/admin/slots", { cache: "no-store" }),
      fetch("/api/admin/bookings", { cache: "no-store" }),
    ]);
    const sData = await sRes.json();
    const bData = await bRes.json();
    setSlots(sData.slots ?? []);
    setBookings(bData.bookings ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (authed) refreshAll();
  }, [authed]);

  async function createSingleSlot() {
    if (!singleStart) return alert("Pick a start date/time.");
    const startISO = new Date(singleStart).toISOString();

    const res = await fetch("/api/admin/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTimeISO: startISO, minutes: Number(singleMins) }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Failed to create slot.");
    setSingleStart("");
    await refreshAll();
  }

  async function deleteSlot(id: string) {
    const res = await fetch(`/api/admin/slots?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Failed to delete slot.");
    await refreshAll();
  }

  const previewCount = useMemo(() => {
    const start = new Date(genStartDate + "T00:00:00");
    if (!Number.isFinite(start.getTime())) return 0;

    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);

      const jsDay = d.getDay();
      const customDay = jsDay === 0 ? 7 : jsDay; // 1 Mon .. 7 Sun
      if (!days.includes(customDay)) continue;

      const totalOpenMins = (closeHour - openHour) * 60;
      const perAppt = slotMins + bufferMins;
      if (perAppt <= 0) continue;
      count += Math.floor(totalOpenMins / perAppt);
    }
    return Math.max(0, count);
  }, [genStartDate, days, openHour, closeHour, slotMins, bufferMins]);

  function buildWeekSlotsClientSide() {
    const out: { start_time: string; end_time: string }[] = [];
    const start = new Date(genStartDate + "T00:00:00");
    if (!Number.isFinite(start.getTime())) return out;

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);

      const jsDay = d.getDay();
      const customDay = jsDay === 0 ? 7 : jsDay;
      if (!days.includes(customDay)) continue;

      const dayStart = new Date(d);
      dayStart.setHours(openHour, 0, 0, 0);

      const dayEnd = new Date(d);
      dayEnd.setHours(closeHour, 0, 0, 0);

      let cursor = new Date(dayStart);
      while (cursor.getTime() + slotMins * 60000 <= dayEnd.getTime()) {
        const s = new Date(cursor);
        const e = new Date(cursor.getTime() + slotMins * 60000);
        out.push({ start_time: s.toISOString(), end_time: e.toISOString() });
        cursor = new Date(cursor.getTime() + (slotMins + bufferMins) * 60000);
      }
    }
    return out;
  }

  async function generateWeekSlots() {
    setGenMsg(null);

    if (closeHour <= openHour) return setGenMsg("Close hour must be after open hour.");
    if (slotMins < 5) return setGenMsg("Slot minutes too small.");

    const bulk = buildWeekSlotsClientSide();
    if (bulk.length === 0) return setGenMsg("No slots to create with those settings.");

    const res = await fetch("/api/admin/slots", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: bulk }),
    });
    const data = await res.json();
    if (!res.ok) return setGenMsg(data?.error || "Failed to bulk create slots.");

    setGenMsg(`Created ${bulk.length} slots ✅`);
    await refreshAll();
  }

  if (authed === null) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main style={{ maxWidth: 420, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ marginTop: 0 }}>Admin Login</h1>
        <p style={{ color: "#555" }}>Enter the admin password to manage slots.</p>
        <div style={{ display: "grid", gap: 10 }}>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Admin password"
            style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
          />
          <button
            onClick={login}
            style={{ padding: 12, borderRadius: 10, border: "none", background: "#111", color: "#fff", cursor: "pointer" }}
          >
            Log in
          </button>
          {loginMsg && <p style={{ color: "#b00020" }}>{loginMsg}</p>}
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Admin</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={refreshAll} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button onClick={logout} style={{ padding: "10px 12px", borderRadius: 10, border: "none", background: "#111", color: "#fff" }}>
            Logout
          </button>
        </div>
      </div>

      <section style={{ marginTop: 18, padding: 16, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Create one slot</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Start (local)</span>
            <input type="datetime-local" value={singleStart} onChange={(e) => setSingleStart(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Minutes</span>
            <input type="number" value={singleMins} min={5} max={240} onChange={(e) => setSingleMins(Number(e.target.value))} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 120 }} />
          </label>
          <button onClick={createSingleSlot} style={{ padding: "10px 14px", borderRadius: 10, border: "none", background: "#111", color: "#fff" }}>
            Create slot
          </button>
        </div>
      </section>

      <section style={{ marginTop: 18, padding: 16, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Generate slots for 7 days</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Start date</span>
              <input type="date" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Open hour</span>
              <input type="number" value={openHour} min={0} max={23} onChange={(e) => setOpenHour(Number(e.target.value))} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 120 }} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Close hour</span>
              <input type="number" value={closeHour} min={0} max={23} onChange={(e) => setCloseHour(Number(e.target.value))} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 120 }} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Slot minutes</span>
              <input type="number" value={slotMins} min={5} max={240} onChange={(e) => setSlotMins(Number(e.target.value))} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 140 }} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Buffer minutes</span>
              <input type="number" value={bufferMins} min={0} max={60} onChange={(e) => setBufferMins(Number(e.target.value))} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 160 }} />
            </label>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 700 }}>Days:</span>
            {[
              [1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [7, "Sun"],
            ].map(([num, label]) => {
              const n = Number(num);
              const checked = days.includes(n);
              return (
                <label key={n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setDays((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort()))}
                  />
                  {label}
                </label>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={generateWeekSlots} style={{ padding: "10px 14px", borderRadius: 10, border: "none", background: "#111", color: "#fff" }}>
              Generate ({previewCount} slots)
            </button>
            {genMsg && <span style={{ color: genMsg.includes("✅") ? "green" : "#b00020" }}>{genMsg}</span>}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 18, padding: 16, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Upcoming slots</h2>
        {slots.length === 0 ? (
          <p style={{ color: "#555" }}>No slots yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {slots.map((s) => (
              <div key={s.id} style={{ padding: 12, borderRadius: 12, border: "1px solid #eee", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>
                    {formatLocal(s.start_time)}{" "}
                    <span style={{ fontWeight: 600, color: s.booking ? "green" : "#111" }}>
                      {s.booking ? "• BOOKED" : "• OPEN"}
                    </span>
                  </div>
                  {s.booking ? (
                    <div style={{ color: "#555", marginTop: 4 }}>
                      {s.booking.customer_name} — {s.booking.customer_contact}
                      {s.booking.customer_phone ? ` — ${s.booking.customer_phone}` : ""}
                      {s.booking.sms_opt_in ? " (SMS ✅)" : ""}
                      {s.booking.note ? ` — "${s.booking.note}"` : ""}
                    </div>
                  ) : (
                    <div style={{ color: "#777", marginTop: 4 }}>No booking</div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  {!s.booking && (
                    <button onClick={() => deleteSlot(s.id)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 18, padding: 16, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Bookings</h2>
        {bookings.length === 0 ? (
          <p style={{ color: "#555" }}>No bookings yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {bookings.map((b) => (
              <div key={b.id} style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
                <div style={{ fontWeight: 800 }}>
                  {b.slot ? formatLocal(b.slot.start_time) : "Unknown time"} — {b.customer_name}
                </div>
                <div style={{ color: "#555", marginTop: 4 }}>
                  {b.customer_contact}
                  {b.customer_phone ? ` • ${b.customer_phone}` : ""}
                  {b.sms_opt_in ? " • SMS ✅" : ""}
                  {b.note ? ` • "${b.note}"` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
