import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "OBSIDIA — The Infinite Forge",
  description:
    "OBSIDIA is a server-authoritative incremental clicker: strike the infinite forge, raise a sanctuary of companions, rebirth through ten worlds, and climb live leaderboards.",
  applicationName: "OBSIDIA",
  keywords: ["incremental game", "clicker", "idle game", "obsidia", "browser game"],
};

export const viewport: Viewport = {
  themeColor: "#08070b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="page-bg" aria-hidden="true" />
        <div className="page-grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
