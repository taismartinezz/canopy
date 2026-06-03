"use client";

import { useState, useEffect } from "react";

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

type SetFn = React.Dispatch<React.SetStateAction<ToastItem[]>>;
let _set: SetFn | null = null;

export function showToast(message: string, type: ToastType = "info") {
  if (!_set) return;
  const id = crypto.randomUUID();
  _set((prev) => [...prev, { id, message, type }]);
  setTimeout(() => {
    _set?.((prev) => prev.filter((t) => t.id !== id));
  }, 3000);
}

const BG: Record<ToastType, string> = {
  success: "#2E7D52",
  error:   "#C0392B",
  info:    "#1B2E4B",
};

export default function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    _set = setToasts;
    return () => { _set = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="animate-slide-up-fade"
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            backgroundColor: BG[t.type],
            color: "#fff",
            fontFamily: "var(--font-roboto)",
            fontWeight: 600,
            fontSize: 13,
            borderRadius: 10,
            padding: "10px 18px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
            whiteSpace: "nowrap",
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
