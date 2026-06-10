"use client";

import Link from "next/link";
import CanopyLogo from "@/components/ui/CanopyLogo";

export default function PrivacyPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "#F6F8FC",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 16px",
        fontFamily: "var(--font-roboto)",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #DDE1E7",
          borderRadius: 10,
          maxWidth: 640,
          width: "100%",
          padding: "48px 40px",
          boxShadow: "0 4px 24px rgba(27,46,75,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <CanopyLogo size={28} />
          <span style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 18, color: "#1B2E4B" }}>
            Canopy
          </span>
        </div>

        <h1 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 24, color: "#1B2E4B", margin: "0 0 8px" }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: "#6B6B6B", margin: "0 0 32px" }}>Last updated: June 2026</p>

        <div style={{ backgroundColor: "#F6F8FC", border: "1px solid #DDE1E7", borderRadius: 8, padding: "16px 20px", marginBottom: 32 }}>
          <p style={{ fontSize: 14, color: "#1B2E4B", fontWeight: 600, margin: "0 0 6px" }}>
            Coming soon
          </p>
          <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.6, margin: 0 }}>
            Our full privacy policy is being drafted. Canopy is built on privacy-first principles —
            your individual data is never shared with your PI or institution. Only aggregate,
            anonymized trends (with ≥3 respondents) are visible to anyone other than you.
          </p>
        </div>

        <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 16, color: "#1B2E4B", margin: "0 0 12px" }}>
          Core commitments
        </h2>
        <ul style={{ fontSize: 14, color: "#2D2D2D", lineHeight: 1.8, margin: "0 0 24px", paddingLeft: 20 }}>
          <li>Journal entries are private and visible only to you — never to PIs or lab members.</li>
          <li>Your personal check-in data is encrypted and not accessible to your institution.</li>
          <li>We collect only the minimum data needed to provide the service.</li>
          <li>We do not sell, rent, or share your personal data with third parties.</li>
          <li>You can request deletion of your data at any time.</li>
        </ul>

        <Link
          href="/login"
          style={{ fontSize: 13, color: "#1B2E4B", textDecoration: "underline" }}
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
