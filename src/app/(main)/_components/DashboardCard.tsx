"use client";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className} style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action, onTitleClick }: { title: string; action?: React.ReactNode; onTitleClick?: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
      {onTitleClick ? (
        <button onClick={onTitleClick} className="hover:opacity-70 transition-opacity"
          style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          {title}
        </button>
      ) : (
        <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)", margin: 0 }}>{title}</h2>
      )}
      {action}
    </div>
  );
}

export const inlineInputStyle: React.CSSProperties = {
  height: 36, border: "1px solid var(--color-border)", borderRadius: 6, padding: "0 10px",
  fontSize: 13, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)",
  color: "var(--color-body)", outline: "none", boxSizing: "border-box",
};
