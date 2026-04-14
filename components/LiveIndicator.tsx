"use client";

export default function LiveIndicator({
  color = "var(--neon-green)",
  label = "LIVE",
}: {
  color?: string;
  label?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        position: "absolute",
        top: "12px",
        right: "16px",
      }}
    >
      <div
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}, 0 0 12px ${color}60`,
          animation: "live-pulse 2s ease-in-out infinite",
        }}
      />
      <span
        style={{
          fontSize: "0.45rem",
          fontFamily: "var(--font-display)",
          color,
          letterSpacing: "2px",
          opacity: 0.8,
        }}
      >
        {label}
      </span>
    </div>
  );
}
