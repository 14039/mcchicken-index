"use client";

import type { ReactNode } from "react";

interface DashboardTileProps {
  title: string;
  icon?: string;
  accentColor?: string;
  children: ReactNode;
  className?: string;
}

export default function DashboardTile({
  title,
  icon,
  accentColor = "var(--accent)",
  children,
  className = "",
}: DashboardTileProps) {
  return (
    <div
      className={`card card--accent-top ${className}`}
      style={{ position: "relative" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        {icon && <span style={{ fontSize: "1.2rem" }}>{icon}</span>}
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.85rem",
            fontWeight: 600,
            letterSpacing: "1.5px",
            color: accentColor,
            textTransform: "uppercase",
          }}
        >
          {title}
        </h2>
      </div>

      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
