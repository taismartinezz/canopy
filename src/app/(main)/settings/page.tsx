"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw, User, Lock, Bell, Building2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { showToast } from "@/components/ui/Toast";

const sectionStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  overflow: "hidden",
  marginBottom: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "16px 20px",
  borderBottom: "1px solid var(--color-border)",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-roboto)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-body)",
  marginBottom: 4,
  display: "block",
};

const readonlyInputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: 40,
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  padding: "0 12px",
  fontFamily: "var(--font-roboto)",
  fontSize: 14,
  color: "var(--color-secondary)",
  backgroundColor: "#F6F8FC",
  outline: "none",
  boxSizing: "border-box",
};

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [inviteCodes, setInviteCodes] = useState<{ id: string; code: string; used_by: string | null }[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Notification preferences (UI only for now)
  const [notifTaskAssigned, setNotifTaskAssigned] = useState(true);
  const [notifLabWin, setNotifLabWin] = useState(true);
  const [notifDigest, setNotifDigest] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) { router.replace("/login"); return; }

      const { data: prof } = await supabase
        .from("user_profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(prof ? { ...prof, email: user.email } : { email: user.email });

      const { data: membership } = await supabase
        .from("team_members").select("project_id").eq("user_id", user.id).maybeSingle();

      if (membership?.project_id) {
        const { data: proj } = await supabase
          .from("projects").select("*").eq("id", membership.project_id).maybeSingle();
        setProject(proj);

        if (prof?.role === "pi") {
          const { data: codes } = await supabase
            .from("invite_codes")
            .select("id, code, used_by")
            .eq("created_by", user.id)
            .order("created_at", { ascending: false })
            .limit(5);
          if (codes) setInviteCodes(codes as typeof inviteCodes);
        }
      }

      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyCode = useCallback(async (code: string) => {
    const link = `${window.location.origin}/login?invite=${code}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 2000);
    showToast("Invite link copied!");
  }, []);

  const handleGenerateCode = useCallback(async () => {
    if (!project?.id) return;
    setGeneratingCode(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) { setGeneratingCode(false); return; }
    const code = "CANOPY-" + Math.random().toString(36).substring(2, 6).toUpperCase();
    const { data } = await supabase
      .from("invite_codes")
      .insert({ code, project_id: project.id, created_by: user.id })
      .select("id, code, used_by")
      .single();
    if (data) setInviteCodes((prev) => [data as (typeof inviteCodes)[0], ...prev]);
    setGeneratingCode(false);
  }, [project]);

  const handlePasswordReset = useCallback(async () => {
    if (!profile?.email) return;
    if (!isSupabaseConfigured) {
      showToast("Password reset is not available in demo mode.");
      return;
    }
    await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    showToast("Password reset email sent. Check your inbox.");
  }, [profile]);

  if (loading) return null;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px", fontFamily: "var(--font-roboto)" }}>
      <h1 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 22, color: "var(--color-navy)", margin: "0 0 24px" }}>
        Settings
      </h1>

      {/* Profile section */}
      <section style={sectionStyle} aria-labelledby="settings-profile-heading">
        <div style={sectionHeaderStyle}>
          <User size={16} color="var(--color-navy)" />
          <h2 id="settings-profile-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)", margin: 0 }}>
            Profile
          </h2>
        </div>
        <div style={{ padding: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Display name</label>
              <input readOnly value={profile?.name ?? ""} style={readonlyInputStyle} aria-label="Display name (read-only)" />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <input readOnly value={profile?.role === "pi" ? "Principal Investigator" : "Researcher"} style={readonlyInputStyle} aria-label="Role (read-only)" />
            </div>
          </div>
          {profile?.bio && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Bio</label>
              <input readOnly value={profile.bio} style={readonlyInputStyle} aria-label="Bio (read-only)" />
            </div>
          )}
          <button
            onClick={() => router.push("/profile")}
            style={{ height: 38, padding: "0 16px", backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#2E4A6F"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-navy)"; }}
          >
            Edit profile
          </button>
        </div>
      </section>

      {/* Account section */}
      <section style={sectionStyle} aria-labelledby="settings-account-heading">
        <div style={sectionHeaderStyle}>
          <Lock size={16} color="var(--color-navy)" />
          <h2 id="settings-account-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)", margin: 0 }}>
            Account
          </h2>
        </div>
        <div style={{ padding: "20px" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input readOnly value={profile?.email ?? ""} style={readonlyInputStyle} aria-label="Email address (read-only)" />
          </div>
          <button
            onClick={handlePasswordReset}
            style={{ height: 38, padding: "0 16px", backgroundColor: "transparent", color: "var(--color-navy)", border: "1px solid var(--color-border)", borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Send password reset email
          </button>
        </div>
      </section>

      {/* Lab & Invite — PI only */}
      {profile?.role === "pi" && (
        <section style={sectionStyle} aria-labelledby="settings-invite-heading">
          <div style={sectionHeaderStyle}>
            <Building2 size={16} color="var(--color-navy)" />
            <h2 id="settings-invite-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)", margin: 0 }}>
              Lab &amp; Invite
            </h2>
          </div>
          <div style={{ padding: "20px" }}>
            <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 16 }}>
              Share an invite link so researchers can join your lab.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {inviteCodes.map((ic) => (
                <div key={ic.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/login?invite=${ic.code}`}
                    style={{ ...readonlyInputStyle, flex: 1, fontFamily: "monospace", fontSize: 12 }}
                    aria-label={`Invite link ${ic.code}`}
                  />
                  <span style={{ fontSize: 11, color: ic.used_by ? "#2E7D52" : "var(--color-secondary)", whiteSpace: "nowrap" }}>
                    {ic.used_by ? "Used" : "Active"}
                  </span>
                  <button
                    onClick={() => handleCopyCode(ic.code)}
                    style={{ height: 40, width: 40, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", border: "1px solid var(--color-border)", borderRadius: 8, cursor: "pointer" }}
                    aria-label={`Copy invite link ${ic.code}`}
                  >
                    {copiedCode === ic.code ? <Check size={14} color="#2E7D52" /> : <Copy size={14} color="var(--color-secondary)" />}
                  </button>
                </div>
              ))}

              {inviteCodes.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No invite codes yet. Generate one below.</p>
              )}
            </div>

            <button
              onClick={handleGenerateCode}
              disabled={generatingCode}
              style={{ marginTop: 16, height: 38, padding: "0 16px", display: "flex", alignItems: "center", gap: 6, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              <RefreshCw size={13} />
              {generatingCode ? "Generating…" : "Generate new invite code"}
            </button>
          </div>
        </section>
      )}

      {/* Notifications section */}
      <section style={sectionStyle} aria-labelledby="settings-notif-heading">
        <div style={sectionHeaderStyle}>
          <Bell size={16} color="var(--color-navy)" />
          <h2 id="settings-notif-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)", margin: 0 }}>
            Notifications
          </h2>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { id: "notif-task", label: "Task assignments", description: "When someone assigns a task to you", value: notifTaskAssigned, set: setNotifTaskAssigned },
            { id: "notif-win", label: "Lab wins", description: "When a lab win is posted", value: notifLabWin, set: setNotifLabWin },
            { id: "notif-digest", label: "Weekly digest", description: "A weekly summary of lab activity", value: notifDigest, set: setNotifDigest },
          ].map(({ id, label, description, value, set }) => (
            <label key={id} htmlFor={id} style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
              <input
                type="checkbox"
                id={id}
                checked={value}
                onChange={(e) => set(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--color-navy)", cursor: "pointer" }}
              />
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)", display: "block" }}>{label}</span>
                <span style={{ fontSize: 12, color: "var(--color-secondary)" }}>{description}</span>
              </div>
            </label>
          ))}
          <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 4 }}>
            Email notification delivery coming soon.
          </p>
        </div>
      </section>
    </div>
  );
}
