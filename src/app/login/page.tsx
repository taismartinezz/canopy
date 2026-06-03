"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import CanopyLogo from "@/components/ui/CanopyLogo";

// ── Provider icons ────────────────────────────────────────────────────────────

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
        fill="#2D2D2D"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M11.4 2H2v9.4h9.4V2z"       fill="#F25022"/>
      <path d="M22 2h-9.4v9.4H22V2z"        fill="#7FBA00"/>
      <path d="M11.4 12.6H2V22h9.4v-9.4z"   fill="#00A4EF"/>
      <path d="M22 12.6h-9.4V22H22v-9.4z"   fill="#FFB900"/>
    </svg>
  );
}

// ── Auth button ───────────────────────────────────────────────────────────────

function AuthButton({
  icon,
  label,
  ariaLabel,
  onClick,
  muted = false,
  dashed = false,
}: {
  icon: React.ReactNode;
  label: string;
  ariaLabel: string;
  onClick: () => void;
  muted?: boolean;
  dashed?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        height: 48,
        minHeight: 48,
        backgroundColor: "#ffffff",
        border: `1px ${dashed ? "dashed" : "solid"} ${hovered ? "#B8C4D4" : "#DDE1E7"}`,
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "var(--font-roboto)",
        fontWeight: 600,
        fontSize: 14,
        color: muted ? "#6B6B6B" : "#2D2D2D",
        boxShadow: hovered ? "0 2px 8px rgba(27,46,75,0.08)" : "none",
        transition: "border-color 150ms ease, box-shadow 150ms ease",
        position: "relative",
        padding: 0,
      }}
    >
      {/* Icon — pinned 24px from left edge */}
      <span
        style={{
          position: "absolute",
          left: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {icon}
      </span>
      {/* Label — centered in the full button width */}
      <span style={{ flex: 1, textAlign: "center" }}>{label}</span>
    </button>
  );
}

// ── Institution modal ─────────────────────────────────────────────────────────

function InstitutionModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: "rgba(27,46,75,0.3)" }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          maxWidth: 400,
          width: "100%",
          padding: 32,
          borderRadius: 10,
          border: "1px solid #DDE1E7",
          boxShadow: "0 8px 32px rgba(27,46,75,0.14)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="institution-modal-title"
      >
        <h2
          id="institution-modal-title"
          style={{
            fontFamily: "var(--font-lora)",
            fontWeight: 600,
            fontSize: 16,
            color: "#1B2E4B",
            margin: "0 0 12px",
          }}
        >
          Institution login
        </h2>
        <p
          style={{
            fontFamily: "var(--font-roboto)",
            fontSize: 13,
            color: "#6B6B6B",
            lineHeight: 1.6,
            margin: "0 0 24px",
          }}
        >
          Institution SSO will be available when your lab is onboarded by a PI.
          Contact your PI to get started.
        </p>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            height: 44,
            minHeight: 44,
            backgroundColor: "#1B2E4B",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            fontFamily: "var(--font-roboto)",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#2E4A6F"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#1B2E4B"; }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

// ── Login page ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [ssoOpen, setSsoOpen] = useState(false);

  // Already authed? Send to app immediately.
  useEffect(() => {
    if (localStorage.getItem("canopy_authed") === "true") {
      router.replace("/");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = useCallback(() => {
    localStorage.setItem("canopy_authed", "true");
    router.push("/");
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "#F6F8FC",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "var(--font-roboto)",
      }}
    >
      {/* ── Card ── */}
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #DDE1E7",
          borderRadius: 10,
          maxWidth: 480,
          width: "100%",
          paddingTop: 48,
          paddingBottom: 48,
          paddingLeft: 40,
          paddingRight: 40,
          boxShadow: "0 4px 24px rgba(27,46,75,0.08)",
        }}
      >
        {/* Logo + wordmark */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <CanopyLogo size={40} />
          <span
            style={{
              fontFamily: "var(--font-lora)",
              fontWeight: 700,
              fontSize: 22,
              color: "#1B2E4B",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Canopy
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontFamily: "var(--font-roboto)",
            fontSize: 14,
            color: "#6B6B6B",
            textAlign: "center",
            maxWidth: 300,
            lineHeight: 1.6,
            margin: "16px auto 0",
          }}
        >
          For researchers doing meaningful, difficult work.
        </p>

        {/* Divider */}
        <div
          style={{
            height: 1,
            backgroundColor: "#DDE1E7",
            margin: "28px 0",
          }}
          role="separator"
        />

        {/* Auth buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <AuthButton
            icon={<GitHubIcon />}
            label="Continue with GitHub"
            ariaLabel="Sign in with GitHub"
            onClick={handleLogin}
          />

          <AuthButton
            icon={<GoogleIcon />}
            label="Continue with Google"
            ariaLabel="Sign in with Google"
            onClick={handleLogin}
          />

          <AuthButton
            icon={<MicrosoftIcon />}
            label="Continue with Microsoft"
            ariaLabel="Sign in with Microsoft"
            onClick={handleLogin}
          />

          <AuthButton
            icon={<Building2 size={18} color="#6B6B6B" />}
            label="Sign in with your institution"
            ariaLabel="Sign in with your institution"
            onClick={() => setSsoOpen(true)}
            muted
            dashed
          />
        </div>
      </div>

      {/* Footer */}
      <p
        style={{
          fontFamily: "var(--font-roboto)",
          fontSize: 12,
          color: "#6B6B6B",
          textAlign: "center",
          marginTop: 20,
        }}
      >
        By signing in, you agree to Canopy&apos;s privacy-first principles.
      </p>

      {ssoOpen && <InstitutionModal onClose={() => setSsoOpen(false)} />}
    </div>
  );
}
