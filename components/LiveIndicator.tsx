"use client";

export default function LiveIndicator({
  color = "var(--green)",
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
        gap: "6px",
        position: "absolute",
        top: "16px",
        right: "20px",
      }}
    >
      <div
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: color,
          animation: "live-pulse 2s ease-in-out infinite",
        }}
      />
      <span
        style={{
          fontSize: "0.7rem",
          fontFamily: "var(--font-display)",
          fontWeight: 500,
          color,
          letterSpacing: "1.5px",
        }}
      >
        {label}
      </span>
    </div>
  );
}
