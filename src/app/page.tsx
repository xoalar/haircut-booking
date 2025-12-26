import BookingWidget from "./ui/BookingWidget";

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 32, marginBottom: 6 }}>Book a Haircut</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Choose an available time slot and lock it in.
      </p>

      <div style={{ marginTop: 18 }}>
        <BookingWidget />
      </div>

      <footer style={{ marginTop: 36, fontSize: 12, color: "#777" }}>
        Tip: Add this page link to your Instagram bio.
      </footer>
    </main>
  );
}
