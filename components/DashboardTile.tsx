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
  accentColor = "var(--neon-cyan)",
  children,
  className = "",
}: DashboardTileProps) {
  return (
    <div
      className={`dashboard-tile ${className}`}
      style={{
        background: "var(--bg-panel)",
        border: `1px solid ${accentColor}33`,
        borderTop: `2px solid ${accentColor}`,
        padding: "24px",
        backdropFilter: "blur(10px)",
        boxShadow: `0 0 20px ${accentColor}10, inset 0 0 20px ${accentColor}05`,
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)`,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {icon && <span style={{ fontSize: "1.2rem" }}>{icon}</span>}
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "3px",
            color: accentColor,
            textTransform: "uppercase",
            textShadow: `0 0 8px ${accentColor}60`,
          }}
        >
          {title}
        </h2>
      </div>

      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
