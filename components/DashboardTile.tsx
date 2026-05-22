"use client";

import type { ReactNode } from "react";

interface DashboardTileProps {
  title: string;
  icon?: string;
  children: ReactNode;
  className?: string;
}

export default function DashboardTile({
  title,
  icon,
  children,
  className = "",
}: DashboardTileProps) {
  return (
    <section className={`tile ${className}`}>
      <div className="tile-header">
        {icon && (
          <span style={{ fontSize: "1.4rem" }} aria-hidden>
            {icon}
          </span>
        )}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
