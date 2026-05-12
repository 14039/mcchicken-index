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
    <div className="tile-glow-frame">
      <div
        className={`dashboard-tile ${className}`}
        style={{
          background:
            "linear-gradient(180deg, rgba(20,10,8,0.95) 0%, rgba(8,8,16,0.92) 100%)",
          padding: "26px",
          backdropFilter: "blur(10px)",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Cyberpunk HUD corner brackets */}
        <span className="hud-corner tl" />
        <span className="hud-corner tr" />
        <span className="hud-corner bl" />
        <span className="hud-corner br" />

        {/* Inner ambient glow */}
        <div
          style={{
            position: "absolute",
            top: "-40%",
            left: "-10%",
            right: "-10%",
            height: "70%",
            background:
              "radial-gradient(ellipse at center, rgba(255,102,0,0.18) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1px",
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
            opacity: 0.9,
          }}
        />

        {/* Subtle horizontal scanlines */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 4px)",
            pointerEvents: "none",
            mixBlendMode: "screen",
            opacity: 0.5,
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {icon && (
            <span
              style={{
                fontSize: "1.6rem",
                filter: "drop-shadow(0 0 6px rgba(255,102,0,0.7))",
              }}
            >
              {icon}
            </span>
          )}
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.78rem",
              fontWeight: 800,
              letterSpacing: "4px",
              color: accentColor,
              textTransform: "uppercase",
              textShadow: `0 0 10px ${accentColor}, 0 0 22px ${accentColor}80`,
            }}
          >
            {title}
          </h2>
        </div>

        <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
