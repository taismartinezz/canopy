"use client";
import type { ReactNode } from "react";

interface Props {
  title: string;
  badge?: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
}

export default function PageHeader({ title, badge, subtitle, action, children }: Props) {
  const hasSub = !!(subtitle || children);
  return (
    <div
      className="px-6 pt-4 pb-3 shrink-0"
      style={{
        backgroundColor: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className={`flex items-center gap-3${hasSub ? " mb-2" : ""}`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h1
            style={{
              fontFamily: "var(--font-lora)",
              fontWeight: 700,
              fontSize: 22,
              color: "var(--color-navy)",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
          {badge}
        </div>
        {action && (
          <div className="flex items-center gap-2 shrink-0">{action}</div>
        )}
      </div>
      {subtitle && (
        <p style={{ fontSize: 13, color: "var(--color-secondary)", margin: 0 }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}
