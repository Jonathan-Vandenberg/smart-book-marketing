import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Book Marketing",
  description: "Agentic marketing dashboard for Smart Book Planner",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
