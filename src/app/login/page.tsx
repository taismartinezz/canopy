"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Eye, EyeOff } from "lucide-react";
import CanopyLogo from "@/components/ui/CanopyLogo";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

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

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="#000000"/>
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
      type="button"
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
  const [mode, setMode] = useState<"signin" | "signup">(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("mode") === "signup"
        ? "signup"
        : "signin";
    }
    return "signin";
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const hasFetched = useRef(false);

  // Already authed? Route to correct destination.
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    // Capture invite code from URL before any redirect
    const inviteParam = new URLSearchParams(window.location.search).get("invite");
    if (inviteParam) localStorage.setItem("pendingInviteCode", inviteParam);

    if (!isSupabaseConfigured) {
      if (localStorage.getItem("canopy_authed") === "true") router.replace("/");
      else setChecking(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { setChecking(false); return; }
      try {
        const { data: member, error: memberError } = await supabase
          .from("team_members").select("id").eq("user_id", session.user.id).maybeSingle();
        if (memberError) {
          setChecking(false);
          return;
        }
        router.replace(member ? "/" : "/onboarding");
      } catch {
        // On query error stay on /login — do not bounce to /onboarding
        setChecking(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmailAuth = useCallback(async () => {
    if (!email.includes("@")) { setEmailError("Please enter a valid email address."); return; }
    if (password.length < 6) { setPasswordError("Password must be at least 6 characters."); return; }
    setEmailError("");
    setPasswordError("");
    setFormError("");
    setLoading(true);

    if (!isSupabaseConfigured) {
      setLoading(false);
      localStorage.setItem("canopy_authed", "true");
      router.push("/");
      return;
    }

    try {
      const { error: authError } = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (authError) { setFormError(authError.message); setLoading(false); return; }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setFormError("Sign-in succeeded but session has no user."); setLoading(false); return; }

      if (mode === "signup") {
        router.push("/onboarding");
        return;
      }

      const { data: member, error: memberError } = await supabase
        .from("team_members").select("id").eq("user_id", user.id).maybeSingle();
      if (memberError) {
        setLoading(false);
        return;
      }
      router.push(member ? "/" : "/onboarding");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setLoading(false);
    }
  }, [email, password, mode, router]);

  const handleForgotPassword = useCallback(async () => {
    if (!forgotEmail.includes("@")) { setForgotError("Please enter a valid email address."); return; }
    setForgotLoading(true);
    setForgotError("");
    if (isSupabaseConfigured) {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: (typeof window !== "undefined" ? window.location.origin : "") + "/reset-password",
      });
      if (resetError) { setForgotError(resetError.message); setForgotLoading(false); return; }
    }
    setForgotSent(true);
    setForgotLoading(false);
  }, [forgotEmail]);

  const handleOAuth = useCallback(async (provider: "github" | "google" | "apple" | "azure") => {
    if (isSupabaseConfigured) {
      localStorage.removeItem("canopy_user");
      localStorage.removeItem("canopy_project");
      localStorage.removeItem("canopy_authed");
      await supabase.auth.signInWithOAuth({ provider });
      return;
    }
    localStorage.setItem("canopy_authed", "true");
    router.push(localStorage.getItem("canopy_project") ? "/" : "/onboarding");
  }, [router]);

  if (checking) return null;

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
      <h1 style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
        {mode === "signin" ? "Sign in to Canopy" : "Create your Canopy account"}
      </h1>

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
            aria-hidden="true"
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

        {/* Mode heading */}
        <p
          style={{
            fontFamily: "var(--font-lora)",
            fontWeight: 600,
            fontSize: 15,
            color: "#1B2E4B",
            textAlign: "center",
            margin: "0 0 16px",
          }}
        >
          {mode === "signin" ? "Sign in" : "Create your account"}
        </p>

        {/* Auth buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <AuthButton
            icon={<GitHubIcon />}
            label="Continue with GitHub"
            ariaLabel="Sign in with GitHub"
            onClick={() => handleOAuth("github")}
          />

          <AuthButton
            icon={<GoogleIcon />}
            label="Continue with Google"
            ariaLabel="Sign in with Google"
            onClick={() => handleOAuth("google")}
          />

          <AuthButton
            icon={<AppleIcon />}
            label="Continue with Apple"
            ariaLabel="Sign in with Apple"
            onClick={() => handleOAuth("apple")}
          />

          <AuthButton
            icon={<MicrosoftIcon />}
            label="Continue with Microsoft"
            ariaLabel="Sign in with Microsoft"
            onClick={() => handleOAuth("azure")}
          />

          <AuthButton
            icon={<Building2 size={18} color="#6B6B6B" />}
            label="Sign in with your institution"
            ariaLabel="Sign in with your institution"
            onClick={() => setSsoOpen(true)}
            muted
          />
        </div>

        {/* Or divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 24,
            marginBottom: 24,
          }}
        >
          <div style={{ flex: 1, height: 1, backgroundColor: "#DDE1E7" }} />
          <span
            style={{
              fontFamily: "var(--font-roboto)",
              fontWeight: 400,
              fontSize: 12,
              color: "#6B6B6B",
            }}
          >
            or
          </span>
          <div style={{ flex: 1, height: 1, backgroundColor: "#DDE1E7" }} />
        </div>

        {/* Email form */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleEmailAuth(); }}
          noValidate
        >
        {mode === "signup" && (
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setFormError(""); }}
            placeholder="Full name"
            autoComplete="name"
            aria-label="Full name"
            style={{
              display: "block",
              width: "100%",
              height: 44,
              border: "1px solid #DDE1E7",
              borderRadius: 8,
              padding: "0 14px",
              fontFamily: "var(--font-roboto)",
              fontWeight: 400,
              fontSize: 14,
              color: "#2D2D2D",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: 10,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#1B2E4B"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#DDE1E7"; }}
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
          placeholder="Email"
          autoComplete="email"
          aria-label="Email"
          style={{
            display: "block",
            width: "100%",
            height: 44,
            border: `1px solid ${emailError ? "#C0392B" : "#DDE1E7"}`,
            borderRadius: 8,
            padding: "0 14px",
            fontFamily: "var(--font-roboto)",
            fontWeight: 400,
            fontSize: 14,
            color: "#2D2D2D",
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = emailError ? "#C0392B" : "#1B2E4B"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = emailError ? "#C0392B" : "#DDE1E7"; }}
        />
        {emailError && (
          <p role="alert" style={{ fontFamily: "var(--font-roboto)", fontSize: 12, color: "#C0392B", margin: "4px 0 0" }}>
            {emailError}
          </p>
        )}
        <div style={{ position: "relative", marginTop: 10 }}>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
            placeholder="Password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            aria-label="Password"
            style={{
              display: "block",
              width: "100%",
              height: 44,
              border: `1px solid ${passwordError ? "#C0392B" : "#DDE1E7"}`,
              borderRadius: 8,
              padding: "0 44px 0 14px",
              fontFamily: "var(--font-roboto)",
              fontWeight: 400,
              fontSize: 14,
              color: "#2D2D2D",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = passwordError ? "#C0392B" : "#1B2E4B"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = passwordError ? "#C0392B" : "#DDE1E7"; }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", padding: 4,
              display: "flex", alignItems: "center", color: "#6B6B6B",
            }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {passwordError && (
          <p role="alert" style={{ fontFamily: "var(--font-roboto)", fontSize: 12, color: "#C0392B", margin: "4px 0 0" }}>
            {passwordError}
          </p>
        )}
        {!passwordError && mode === "signup" && (
          <p style={{ fontFamily: "var(--font-roboto)", fontSize: 12, color: "#6B6B6B", margin: "4px 0 0", lineHeight: 1.5 }}>
            Use a unique password — your account protects sensitive research data.
          </p>
        )}

        {/* Forgot password — sign-in only */}
        {mode === "signin" && !forgotOpen && (
          <div style={{ textAlign: "right", marginTop: 6 }}>
            <button
              type="button"
              onClick={() => { setForgotOpen(true); setForgotEmail(email); setForgotSent(false); setForgotError(""); setEmailError(""); setPasswordError(""); setFormError(""); }}
              style={{ background: "none", border: "none", padding: 0, fontFamily: "var(--font-roboto)", fontSize: 12, color: "#1B2E4B", cursor: "pointer", textDecoration: "underline" }}
            >
              Forgot password?
            </button>
          </div>
        )}

        {/* Inline forgot-password form */}
        {forgotOpen && (
          <div style={{ marginTop: 12, padding: "14px 16px", backgroundColor: "#F6F8FC", borderRadius: 8, border: "1px solid #DDE1E7" }}>
            {forgotSent ? (
              <p style={{ fontFamily: "var(--font-roboto)", fontSize: 13, color: "#2E7D52", margin: 0 }}>
                Check your email for a password reset link.
              </p>
            ) : (
              <>
                <p style={{ fontFamily: "var(--font-roboto)", fontSize: 13, color: "#2D2D2D", margin: "0 0 10px" }}>
                  Enter your email and we&apos;ll send a reset link.
                </p>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => { setForgotEmail(e.target.value); setForgotError(""); }}
                  placeholder="Your email"
                  aria-label="Email for password reset"
                  style={{ display: "block", width: "100%", height: 40, border: `1px solid ${forgotError ? "#C0392B" : "#DDE1E7"}`, borderRadius: 8, padding: "0 12px", fontFamily: "var(--font-roboto)", fontSize: 13, color: "#2D2D2D", outline: "none", boxSizing: "border-box", marginBottom: forgotError ? 4 : 8 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = forgotError ? "#C0392B" : "#1B2E4B"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = forgotError ? "#C0392B" : "#DDE1E7"; }}
                />
                {forgotError && (
                  <p role="alert" style={{ fontFamily: "var(--font-roboto)", fontSize: 12, color: "#C0392B", margin: "0 0 8px" }}>
                    {forgotError}
                  </p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={forgotLoading}
                    style={{ flex: 1, height: 38, backgroundColor: "#1B2E4B", color: "#fff", border: "none", borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    {forgotLoading ? "Sending…" : "Send reset link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForgotOpen(false); setForgotError(""); setFormError(""); }}
                    style={{ height: 38, padding: "0 14px", backgroundColor: "transparent", color: "#6B6B6B", border: "1px solid #DDE1E7", borderRadius: 8, fontFamily: "var(--font-roboto)", fontSize: 13, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            display: "block",
            width: "100%",
            height: 44,
            minHeight: 44,
            backgroundColor: loading ? "#B8C4D4" : "#1B2E4B",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            fontFamily: "var(--font-roboto)",
            fontWeight: 700,
            fontSize: 13,
            cursor: loading ? "not-allowed" : "pointer",
            marginTop: 12,
            transition: "background-color 150ms ease",
          }}
          onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = "#2E4A6F"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = loading ? "#B8C4D4" : "#1B2E4B"; }}
          aria-busy={loading}
        >
          {loading ? "Please wait…" : mode === "signin" ? "Continue with email" : "Create account"}
        </button>

        {formError && (
          <p
            role="alert"
            style={{
              fontFamily: "var(--font-roboto)",
              fontWeight: 400,
              fontSize: 12,
              color: "#C0392B",
              margin: "8px 0 0",
            }}
          >
            {formError}
          </p>
        )}
        </form>

        <p
          style={{
            fontFamily: "var(--font-roboto)",
            fontWeight: 400,
            fontSize: 12,
            color: "#6B6B6B",
            textAlign: "center",
            margin: "12px 0 0",
          }}
        >
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <a
            href={mode === "signin" ? "/login?mode=signup" : "/login"}
            onClick={(e) => { e.preventDefault(); setMode(mode === "signin" ? "signup" : "signin"); setEmailError(""); setPasswordError(""); setFormError(""); setForgotOpen(false); }}
            style={{ color: "#1B2E4B", textDecoration: "underline" }}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </a>
        </p>
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
        By signing in, you agree to Canopy&apos;s{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#1B2E4B", textDecoration: "underline" }}>
          privacy-first principles
        </a>
        .
      </p>

      {ssoOpen && <InstitutionModal onClose={() => setSsoOpen(false)} />}
    </div>
  );
}
