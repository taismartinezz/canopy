import Link from "next/link";
import CanopyLogo from "@/components/ui/CanopyLogo";

export const metadata = { title: "Coming Soon - Canopy" };

export default function ComingSoonPage() {
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
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

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: "#DDE1E7", margin: "28px 0" }} />

        {/* Icon */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <svg
            viewBox="0 0 48 48"
            width={48}
            height={48}
            fill="none"
            aria-hidden="true"
          >
            <circle cx="24" cy="24" r="20" stroke="#1B2E4B" strokeWidth="1.8" opacity="0.15" />
            <circle cx="24" cy="24" r="14" stroke="#1B2E4B" strokeWidth="1.8" opacity="0.35" />
            <line x1="24" y1="14" x2="24" y2="24" stroke="#1B2E4B" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="24" y1="24" x2="31" y2="28" stroke="#1B2E4B" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="24" cy="24" r="2" fill="#1B2E4B" />
          </svg>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontFamily: "var(--font-lora)",
            fontWeight: 600,
            fontSize: 18,
            color: "#1B2E4B",
            textAlign: "center",
            margin: "0 0 12px",
            lineHeight: 1.4,
          }}
        >
          Social sign-in isn&apos;t ready yet
        </h1>

        {/* Body */}
        <p
          style={{
            fontSize: 14,
            color: "#6B6B6B",
            textAlign: "center",
            lineHeight: 1.7,
            margin: "0 auto 28px",
            maxWidth: 340,
          }}
        >
          Google, Microsoft, and GitHub sign-in are still being configured.
          For now, please use your email address and password to sign in or
          create an account.
        </p>

        {/* CTA */}
        <Link
          href="/login"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: 48,
            backgroundColor: "#1B2E4B",
            borderRadius: 8,
            fontFamily: "var(--font-roboto)",
            fontWeight: 600,
            fontSize: 14,
            color: "#ffffff",
            textDecoration: "none",
            transition: "opacity 150ms ease",
          }}
        >
          Continue with email
        </Link>

        {/* Footer note */}
        <p
          style={{
            fontSize: 12,
            color: "#9CA3AF",
            textAlign: "center",
            marginTop: 20,
            marginBottom: 0,
            lineHeight: 1.5,
          }}
        >
          Social sign-in will be available once OAuth is configured.
        </p>
      </div>
    </div>
  );
}
