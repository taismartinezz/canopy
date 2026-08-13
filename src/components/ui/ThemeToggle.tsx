"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const OPTIONS = [
  { value: "light",  Icon: Sun,     label: "Light mode"  },
  { value: "dark",   Icon: Moon,    label: "Dark mode"   },
  { value: "system", Icon: Monitor, label: "System theme" },
] as const;

interface Props {
  compact?: boolean;
}

export default function ThemeToggle({ compact = false }: Props) {
  const { theme, setTheme } = useTheme();

  if (compact) {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    const current = OPTIONS.find(o => o.value === theme)!;
    return (
      <button
        onClick={() => setTheme(next)}
        title={current.label}
        aria-label={`Theme: ${current.label}. Click to switch.`}
        className="flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-navy-dim)]"
        style={{ width: 32, height: 32, border: "none", background: "none", cursor: "pointer", color: "var(--color-secondary)" }}
      >
        <current.Icon size={14} />
      </button>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        backgroundColor: "var(--color-navy-dim)",
        borderRadius: 7,
        padding: 2,
        gap: 1,
      }}
      role="group"
      aria-label="Color theme"
    >
      {OPTIONS.map(({ value, Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 26,
              borderRadius: 5,
              border: "none",
              cursor: "pointer",
              transition: "background-color 0.12s",
              backgroundColor: active ? "var(--color-segment-active)" : "transparent",
              color: active ? "var(--color-navy)" : "var(--color-secondary)",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
            }}
          >
            <Icon size={13} />
          </button>
        );
      })}
    </div>
  );
}
