export const metadata = {
  title: "Haircut Booking",
  description: "Book a haircut time slot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
