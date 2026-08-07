"use client";

import { useState, useRef, useCallback, useId } from "react";

interface TooltipProps {
  label: string;
  children: React.ReactElement;
  delay?: number;
  placement?: "top" | "bottom" | "left" | "right";
}

export default function Tooltip({ label, children, delay = 500, placement = "bottom" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const show = useCallback(() => {
    timer.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
  }, []);

  const placementStyle: React.CSSProperties = (() => {
    switch (placement) {
      case "top":    return { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" };
      case "left":   return { right: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" };
      case "right":  return { left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" };
      default:       return { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" };
    }
  })();

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={hide}
    >
      {children}
      {visible && label && (
        <span
          role="tooltip"
          id={id}
          style={{
            position: "absolute",
            ...placementStyle,
            whiteSpace: "nowrap",
            backgroundColor: "rgba(15,23,42,0.88)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 500,
            fontFamily: "var(--font-roboto)",
            borderRadius: 5,
            padding: "4px 8px",
            pointerEvents: "none",
            zIndex: 9999,
            letterSpacing: "0.01em",
            lineHeight: 1.4,
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
