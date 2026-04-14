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
  maxItems?: number;
}

export default function NewsSection({
  items,
  maxItems = 4,
}: NewsSectionProps) {
  if (!items || items.length === 0) return null;

  const displayed = items.slice(0, maxItems);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {displayed.map((item, i) => (
        <a
          key={i}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="news-item"
        >
          <div className="news-item__title">{item.title}</div>
          <div className="news-item__meta">
            {item.source} · {formatDate(item.date)}
          </div>
        </a>
      ))}
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
