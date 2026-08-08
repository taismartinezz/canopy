"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw, User, Lock, Bell, Building2, Clock, Monitor, Moon, Sun, MapPin } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { showToast } from "@/components/ui/Toast";
import { useTheme } from "@/context/ThemeContext";
import type { WorkingHours } from "@/types";

// ── Working-hours helpers ─────────────────────────────────────────────────────

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DEFAULT_WORKING_HOURS: WorkingHours = {
  "0": { start: "09:00", end: "17:00" },
  "1": { start: "09:00", end: "17:00" },
  "2": { start: "09:00", end: "17:00" },
  "3": { start: "09:00", end: "17:00" },
  "4": { start: "09:00", end: "17:00" },
  "5": null,
  "6": null,
};

const COMMON_TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "America/Honolulu", "America/Toronto", "America/Vancouver",
  "America/Mexico_City", "America/Sao_Paulo", "America/Buenos_Aires",
  "Europe/London", "Europe/Dublin", "Europe/Lisbon",
  "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome",
  "Europe/Amsterdam", "Europe/Stockholm", "Europe/Warsaw", "Europe/Zurich",
  "Europe/Helsinki", "Europe/Athens", "Europe/Istanbul",
  "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok",
  "Asia/Singapore", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo",
  "Asia/Seoul", "Australia/Sydney", "Australia/Melbourne", "Pacific/Auckland",
  "UTC",
];

const sectionStyle: React.CSSProperties = {
  backgroundColor: "var(--color-surface)",
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
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [inviteCodes, setInviteCodes] = useState<{ id: string; code: string; used_by: string | null }[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Notification preferences
  const [notifTaskAssigned, setNotifTaskAssigned] = useState(true);
  const [notifLabWin, setNotifLabWin] = useState(true);
  const [notifDigest, setNotifDigest] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Working hours + timezone
  const [timezone, setTimezone] = useState("America/New_York");
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    function checkWidth() { setIsMobile(window.innerWidth < 600); }
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  useEffect(() => {
    async function load() {
      try {
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

          // Load working hours + timezone
          const { data: userSettings } = await supabase
            .from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
          if (userSettings) {
            setTimezone((userSettings.timezone as string) ?? "America/New_York");
            setWorkingHours((userSettings.working_hours as WorkingHours) ?? DEFAULT_WORKING_HOURS);
          }

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
      } catch (err) {
        console.error("[Settings] load error:", err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
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

  const handleSaveSchedule = useCallback(async () => {
    if (!isSupabaseConfigured) { showToast("Demo mode — settings not persisted."); return; }
    setSavingSchedule(true);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { setSavingSchedule(false); return; }
    const { error } = await supabase.from("user_settings").upsert(
      { user_id: userId, timezone, working_hours: workingHours, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setSavingSchedule(false);
    if (error) { showToast("Failed to save. " + error.message); }
    else { showToast("Schedule settings saved."); }
  }, [timezone, workingHours]);

  if (loading) return null;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: isMobile ? "16px" : "32px 20px", fontFamily: "var(--font-roboto)" }}>
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
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
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
            style={{ minHeight: 44, height: 38, padding: "0 16px", backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
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
            style={{ minHeight: 44, height: "auto", padding: "10px 16px", backgroundColor: "transparent", color: "var(--color-navy)", border: "1px solid var(--color-border)", borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: isMobile ? "normal" : "nowrap" }}
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
              {inviteCodes.map((ic) => {
                const fullLink = `${typeof window !== "undefined" ? window.location.origin : ""}/login?invite=${ic.code}`;
                const isRevealed = revealedCode === ic.id;
                return (
                  <div key={ic.id} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: 8 }}>
                    <input
                      readOnly
                      value={isRevealed ? fullLink : `${typeof window !== "undefined" ? window.location.origin : "canopy.app"}/login?invite=••••••••`}
                      style={{ ...readonlyInputStyle, flex: 1, fontFamily: "monospace", fontSize: 12 }}
                      aria-label={`Invite link ${ic.code}`}
                    />
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        onClick={() => setRevealedCode(isRevealed ? null : ic.id)}
                        style={{ minHeight: 44, height: 40, padding: "0 10px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", border: "1px solid var(--color-border)", borderRadius: 8, cursor: "pointer", fontSize: 11, fontFamily: "var(--font-roboto)", color: "var(--color-secondary)", whiteSpace: "nowrap" }}
                        aria-label={isRevealed ? "Hide invite link" : "Reveal invite link"}
                      >
                        {isRevealed ? "Hide" : "Reveal"}
                      </button>
                      <span style={{ fontSize: 11, color: ic.used_by ? "#2E7D52" : "var(--color-secondary)", whiteSpace: "nowrap" }}>
                        {ic.used_by ? "Used" : "Active"}
                      </span>
                      <button
                        onClick={() => handleCopyCode(ic.code)}
                        style={{ minHeight: 44, height: 40, width: 40, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", border: "1px solid var(--color-border)", borderRadius: 8, cursor: "pointer" }}
                        aria-label={`Copy invite link ${ic.code}`}
                      >
                        {copiedCode === ic.code ? <Check size={14} color="#2E7D52" /> : <Copy size={14} color="var(--color-secondary)" />}
                      </button>
                    </div>
                  </div>
                );
              })}

              {inviteCodes.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No invite codes yet. Generate one below.</p>
              )}
            </div>

            <button
              onClick={handleGenerateCode}
              disabled={generatingCode}
              style={{ marginTop: 16, minHeight: 44, height: 38, padding: "0 16px", display: "flex", alignItems: "center", gap: 6, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              <RefreshCw size={13} />
              {generatingCode ? "Generating…" : "Generate new invite code"}
            </button>
          </div>
        </section>
      )}

      {/* Scheduling section */}
      <section style={sectionStyle} aria-labelledby="settings-schedule-heading">
        <div style={sectionHeaderStyle}>
          <Clock size={16} color="var(--color-navy)" />
          <h2 id="settings-schedule-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)", margin: 0 }}>
            Scheduling &amp; Working Hours
          </h2>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Timezone */}
          <div>
            <label htmlFor="tz-select" style={labelStyle}>Time zone</label>
            <select id="tz-select" value={timezone} onChange={e => setTimezone(e.target.value)}
              style={{ ...readonlyInputStyle, backgroundColor: "var(--color-canvas)", color: "var(--color-body)", cursor: "pointer", appearance: "auto" }}>
              {COMMON_TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
            </select>
            <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 4 }}>
              Used for scheduling suggestions and (when enabled) the weekly digest email.
            </p>
          </div>

          {/* Per-day working hours */}
          <div>
            <span style={labelStyle}>Working hours</span>
            <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 0, marginBottom: 12 }}>
              The &ldquo;Find best times&rdquo; feature in Scheduling will only suggest slots within these hours.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {DAY_LABELS.map((dayName, idx) => {
                const key = String(idx);
                const val = workingHours[key];
                const isOn = val !== null && val !== undefined;
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 40 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, width: isMobile ? 92 : 110, cursor: "pointer", flexShrink: 0 }}>
                      <input type="checkbox" checked={isOn}
                        onChange={e => setWorkingHours(prev => ({ ...prev, [key]: e.target.checked ? { start: "09:00", end: "17:00" } : null }))}
                        style={{ width: 15, height: 15, accentColor: "var(--color-navy)", cursor: "pointer" }} />
                      <span style={{ fontSize: 13, color: "var(--color-body)", fontWeight: isOn ? 500 : 400 }}>{dayName}</span>
                    </label>
                    {isOn ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="time" value={val!.start}
                          onChange={e => setWorkingHours(prev => ({ ...prev, [key]: { ...(prev[key] as { start: string; end: string }), start: e.target.value } }))}
                          style={{ height: 34, border: "1px solid var(--color-border)", borderRadius: 6, padding: "0 8px", fontSize: 13, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)", color: "var(--color-body)", outline: "none" }} />
                        <span style={{ fontSize: 12, color: "var(--color-secondary)" }}>to</span>
                        <input type="time" value={val!.end}
                          onChange={e => setWorkingHours(prev => ({ ...prev, [key]: { ...(prev[key] as { start: string; end: string }), end: e.target.value } }))}
                          style={{ height: 34, border: "1px solid var(--color-border)", borderRadius: 6, padding: "0 8px", fontSize: 13, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)", color: "var(--color-body)", outline: "none" }} />
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--color-secondary)", fontStyle: "italic" }}>Off</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={handleSaveSchedule} disabled={savingSchedule}
            style={{ alignSelf: "flex-start", minHeight: 44, height: 38, padding: "0 20px", backgroundColor: savingSchedule ? "var(--color-border)" : "var(--color-navy)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13, cursor: savingSchedule ? "default" : "pointer" }}>
            {savingSchedule ? "Saving…" : "Save schedule settings"}
          </button>
        </div>
      </section>

      {/* Appearance section */}
      <section style={sectionStyle} aria-labelledby="settings-appearance-heading">
        <div style={sectionHeaderStyle}>
          <Monitor size={16} color="var(--color-navy)" />
          <h2 id="settings-appearance-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)", margin: 0 }}>
            Appearance
          </h2>
        </div>
        <div style={{ padding: "20px" }}>
          <p style={{ ...labelStyle, marginBottom: 12 }}>Theme</p>
          <div style={{ display: "flex", gap: 10 }}>
            {([
              { value: "light", icon: <Sun size={15} />, label: "Light" },
              { value: "dark",  icon: <Moon size={15} />, label: "Dark" },
              { value: "system", icon: <Monitor size={15} />, label: "System" },
            ] as { value: "light" | "dark" | "system"; icon: React.ReactNode; label: string }[]).map(({ value, icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                  border: `1.5px solid ${theme === value ? "var(--color-navy)" : "var(--color-border)"}`,
                  backgroundColor: theme === value ? "var(--color-navy)" : "transparent",
                  color: theme === value ? "#fff" : "var(--color-secondary)",
                  transition: "all 0.15s",
                  minHeight: 40,
                }}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

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
            <label key={id} htmlFor={id} style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer", minHeight: 44 }}>
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
            Email delivery is active — emails are sent when the{" "}
            <code style={{ fontFamily: "monospace", fontSize: 10, backgroundColor: "var(--color-canvas)", padding: "1px 4px", borderRadius: 3 }}>RESEND_API_KEY</code>{" "}
            environment variable is configured.
          </p>
        </div>
      </section>

      {/* Tour section */}
      <section style={sectionStyle} aria-labelledby="settings-tour-heading">
        <div style={sectionHeaderStyle}>
          <MapPin size={16} color="var(--color-navy)" />
          <h2 id="settings-tour-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)", margin: 0 }}>
            Welcome Tour
          </h2>
        </div>
        <div style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)", margin: "0 0 3px" }}>Show me around again</p>
            <p style={{ fontSize: 12, color: "var(--color-secondary)", margin: 0 }}>Re-open the onboarding tour from the beginning.</p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("canopy:show-onboarding"))}
            style={{ fontSize: 12, fontWeight: 700, padding: "8px 18px", borderRadius: 8, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", cursor: "pointer", minHeight: 40, flexShrink: 0 }}
          >
            Start tour
          </button>
        </div>
      </section>
    </div>
  );
}
