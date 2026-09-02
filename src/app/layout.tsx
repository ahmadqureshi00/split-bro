import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Split Bro — Split Hostel Expenses Instantly",
  description:
    "Zero-signup expense splitting for hostels, trips, and shared living. Create a room, add your crew, track expenses, and settle debts — all in one tap.",
  keywords: ["expense splitter", "hostel", "split expenses", "roommates", "group expenses"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
