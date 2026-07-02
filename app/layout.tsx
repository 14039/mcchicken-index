import type { Metadata } from "next";
import Link from "next/link";
import { Orbitron, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "@/lib/config";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-orbitron",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "McChicken Index — Minutes of Work to buy a standard McChicken",
  description:
    "A U.S. fast-food affordability indicator: the minutes of work an average American production worker needs to earn one standard McDonald's McChicken. Fixed 12-metro panel surveyed twice weekly, portion-normalized, wages from BLS.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${orbitron.variable} ${jetbrainsMono.variable}`}>
      <body>
        <div className="page">
          <header className="site-header">
            <Link href="/" className="brand" style={{ textDecoration: "none" }}>
              MCCHICKEN INDEX
            </Link>
            <nav style={{ display: "flex", gap: 8 }}>
              <Link href="/journal" className="nav-link">
                Journal
              </Link>
              <Link href="/methodology" className="nav-link">
                Methodology &amp; API
              </Link>
            </nav>
          </header>
          <main className="main">{children}</main>
          <footer className="site-footer">
            Surveyed twice weekly (Mon &amp; Thu) · wages from BLS via FRED · portion
            spec from McDonald&apos;s official nutrition data ·{" "}
            <Link href="/methodology">methodology &amp; API →</Link>
          </footer>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
