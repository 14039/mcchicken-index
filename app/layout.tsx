import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "McChicken Index™ — Tracking Fast Food Inflation",
  description:
    "The McChicken Index™ tracks the average price of a McDonald's McChicken sandwich as an economic indicator for food price inflation, labor costs, and consumer purchasing power.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
