"use client";

interface NewsItem {
  title: string;
  url: string;
  source: string;
  date: string;
  summary?: string;
}

interface NewsSectionProps {
  items: NewsItem[];
  accentColor?: string;
  maxItems?: number;
}

export default function NewsSection({
  items,
  accentColor = "var(--neon-cyan)",
  maxItems = 4,
}: NewsSectionProps) {
  if (!items || items.length === 0) return null;

  const displayed = items.slice(0, maxItems);

  return (
    <div style={{ marginTop: "8px" }}>
      <div
        style={{
          fontSize: "0.55rem",
          fontFamily: "var(--font-display)",
          color: "var(--text-secondary)",
          letterSpacing: "2px",
          marginBottom: "6px",
        }}
      >
        LATEST NEWS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {displayed.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              padding: "4px 6px",
              background: "rgba(255,255,255,0.02)",
              borderLeft: `2px solid ${accentColor}40`,
              textDecoration: "none",
              transition: "all 0.15s",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderLeftColor = accentColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.02)";
              e.currentTarget.style.borderLeftColor = `${accentColor}40`;
            }}
          >
            <div
              style={{
                fontSize: "0.6rem",
                color: "var(--text-primary)",
                lineHeight: 1.3,
                marginBottom: "1px",
              }}
            >
              {item.title}
            </div>
            <div
              style={{
                fontSize: "0.5rem",
                color: "var(--text-secondary)",
              }}
            >
              {item.source} · {formatDate(item.date)}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}
