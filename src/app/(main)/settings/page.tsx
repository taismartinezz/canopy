"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw, User, Lock, Bell, Building2, Clock, Monitor, Moon, Sun, Keyboard, BellOff, Plus, Pencil, Trash2, X, ChevronDown, Compass } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { showToast } from "@/components/ui/Toast";
import { useTheme } from "@/context/ThemeContext";
import type { WorkingHours, LabRole } from "@/types";
import { WorkingHoursEditor, DEFAULT_WORKING_HOURS } from "@/components/ui/WorkingHoursEditor";

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
  color: "var(--color-body)",
  backgroundColor: "var(--color-canvas)",
  outline: "none",
  boxSizing: "border-box",
  cursor: "default",
};

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [inviteCodes, setInviteCodes] = useState<{ id: string; code: string; used_by: string | null; lab_role_id: string | null }[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Lab roles management
  const [labRoles, setLabRoles] = useState<LabRole[]>([]);
  const [myLabRoleName, setMyLabRoleName] = useState<string | null>(null);
  const [newInviteRoleId, setNewInviteRoleId] = useState<string>("");
  // Email invite flow
  const [emailInviteInput, setEmailInviteInput] = useState("");
  const [emailInviteRoleId, setEmailInviteRoleId] = useState<string>("");
  const [emailInviteError, setEmailInviteError] = useState("");
  const [emailInviteResults, setEmailInviteResults] = useState<{ email: string; code: string }[]>([]);
  const [sendingEmailInvites, setSendingEmailInvites] = useState(false);
  const [copiedEmailCode, setCopiedEmailCode] = useState<string | null>(null);
  const [addingRole, setAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [renamingRoleId, setRenamingRoleId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Notification preferences
  const [notifTaskAssigned, setNotifTaskAssigned] = useState(true);
  const [notifLabWin, setNotifLabWin] = useState(true);
  const [notifDigest, setNotifDigest] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Working hours + timezone
  const [timezone, setTimezone] = useState("America/New_York");
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // DND / quiet hours
  const [dndEnabled, setDndEnabled]               = useState(false);
  const [quietHoursStart, setQuietHoursStart]     = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd]         = useState("08:00");
  const [savingDnd, setSavingDnd]                 = useState(false);

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
            setDndEnabled((userSettings.dnd_enabled as boolean) ?? false);
            setQuietHoursStart((userSettings.quiet_hours_start as string) ?? "22:00");
            setQuietHoursEnd((userSettings.quiet_hours_end as string) ?? "08:00");
          }

          // Fetch current user's lab role name for the Profile section
          const { data: memberRow } = await supabase
            .from("team_members")
            .select("lab_role_id")
            .eq("user_id", user.id)
            .eq("project_id", membership.project_id)
            .maybeSingle();
          if (memberRow?.lab_role_id) {
            const { data: roleRow } = await supabase
              .from("lab_roles")
              .select("name")
              .eq("id", memberRow.lab_role_id as string)
              .maybeSingle();
            if (roleRow?.name) setMyLabRoleName(roleRow.name as string);
          }

          if (prof?.role === "pi") {
            const [{ data: codes }, { data: roles }] = await Promise.all([
              supabase
                .from("invite_codes")
                .select("id, code, used_by, lab_role_id")
                .eq("created_by", user.id)
                .order("created_at", { ascending: false })
                .limit(5),
              supabase
                .from("lab_roles")
                .select("id, name, permission_level, is_system, created_at")
                .eq("project_id", membership.project_id)
                .order("is_system", { ascending: false })
                .order("name"),
            ]);
            if (codes) setInviteCodes(codes as typeof inviteCodes);
            if (roles) {
              setLabRoles(roles.map((r: { id: string; name: string; permission_level: string; is_system: boolean; created_at: string }) => ({
                id: r.id,
                projectId: membership.project_id,
                name: r.name,
                permissionLevel: r.permission_level as "pi" | "researcher",
                isSystem: r.is_system,
                createdAt: r.created_at,
              })));
              // Default invite role to first researcher role
              const defaultRole = roles.find((r: { permission_level: string }) => r.permission_level === "researcher");
              if (defaultRole) {
                setNewInviteRoleId(defaultRole.id);
                setEmailInviteRoleId(defaultRole.id);
              }
            }
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
      .insert({ code, project_id: project.id, created_by: user.id, lab_role_id: newInviteRoleId || null })
      .select("id, code, used_by, lab_role_id")
      .single();
    if (data) setInviteCodes((prev) => [data as (typeof inviteCodes)[0], ...prev]);
    setGeneratingCode(false);
  }, [project, newInviteRoleId]);

  const handleSendEmailInvites = useCallback(async () => {
    if (!project?.id) return;
    const rawEmails = emailInviteInput
      .split(/[\n,]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const valid = rawEmails.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const invalid = rawEmails.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (invalid.length > 0) {
      setEmailInviteError(`Invalid email${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}`);
      return;
    }
    if (valid.length === 0) { setEmailInviteError("Enter at least one email address."); return; }
    setEmailInviteError("");
    setSendingEmailInvites(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) { setSendingEmailInvites(false); return; }

    const results: { email: string; code: string }[] = [];
    for (const email of valid) {
      const code = "CANOPY-" + Math.random().toString(36).substring(2, 6).toUpperCase();
      const { error } = await supabase.from("invite_codes").insert({
        code, project_id: project.id, created_by: user.id,
        invited_email: email,
        lab_role_id: emailInviteRoleId || null,
      });
      if (!error) results.push({ email, code });
    }
    setEmailInviteResults((prev) => [...prev, ...results]);
    setEmailInviteInput("");
    setSendingEmailInvites(false);
  }, [project, emailInviteInput, emailInviteRoleId]);

  const handleCopyEmailCode = useCallback(async (code: string) => {
    const link = `${window.location.origin}/login?invite=${code}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopiedEmailCode(code);
    setTimeout(() => setCopiedEmailCode((prev) => (prev === code ? null : prev)), 2000);
  }, []);

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
    if (!isSupabaseConfigured) { showToast("Demo mode - settings not persisted."); return; }
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

  const handleSaveDnd = useCallback(async () => {
    if (!isSupabaseConfigured) { showToast("Demo mode -- settings not persisted."); return; }
    setSavingDnd(true);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { setSavingDnd(false); return; }
    const { error } = await supabase.from("user_settings").upsert(
      { user_id: userId, dnd_enabled: dndEnabled, quiet_hours_start: quietHoursStart, quiet_hours_end: quietHoursEnd, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setSavingDnd(false);
    if (error) { showToast("Failed to save. " + error.message); }
    else { showToast("Focus settings saved."); }
  }, [dndEnabled, quietHoursStart, quietHoursEnd]);

  if (loading) return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }} className="space-y-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ borderRadius: 10, backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", padding: "20px 24px" }}>
          <div style={{ height: 14, width: "30%", backgroundColor: "var(--color-border)", borderRadius: 4, marginBottom: 16 }} className="animate-pulse" />
          <div style={{ height: 11, width: "75%", backgroundColor: "var(--color-border)", borderRadius: 4, marginBottom: 10 }} className="animate-pulse" />
          <div style={{ height: 36, width: "55%", backgroundColor: "var(--color-border)", borderRadius: 6 }} className="animate-pulse" />
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: isMobile ? "16px" : "32px 20px", fontFamily: "var(--font-roboto)" }}>
      <h1 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 22, color: "var(--color-navy)", margin: "0 0 24px" }}>
        Settings
      </h1>

      {/* Profile section */}
      <section style={sectionStyle} aria-labelledby="settings-profile-heading">
        <div style={sectionHeaderStyle}>
          <User size={16} color="var(--color-secondary)" />
          <h2 id="settings-profile-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 500, fontSize: 15, color: "var(--color-body)", margin: 0 }}>
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
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 5 }}>
                Role <Lock size={10} color="var(--color-secondary)" style={{ opacity: 0.7 }} />
              </label>
              <input
                readOnly
                value={myLabRoleName ?? (profile?.role === "pi" ? "Principal Investigator" : "Researcher")}
                style={{ ...readonlyInputStyle, backgroundColor: "var(--color-canvas)", opacity: 0.75, cursor: "not-allowed" }}
                aria-label="Role (read-only)"
              />
              <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 4, marginBottom: 0 }}>
                Managed via your lab role. Change it from the Team page.
              </p>
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
            style={{ minHeight: 44, height: 38, padding: "0 16px", backgroundColor: "var(--color-btn-primary)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-btn-primary-hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-btn-primary)"; }}
          >
            Edit profile
          </button>
        </div>
      </section>

      {/* Account section */}
      <section style={sectionStyle} aria-labelledby="settings-account-heading">
        <div style={sectionHeaderStyle}>
          <Lock size={16} color="var(--color-secondary)" />
          <h2 id="settings-account-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 500, fontSize: 15, color: "var(--color-body)", margin: 0 }}>
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

      {/* Lab & Invite - PI only */}
      {profile?.role === "pi" && (
        <section style={sectionStyle} aria-labelledby="settings-invite-heading">
          <div style={sectionHeaderStyle}>
            <Building2 size={16} color="var(--color-secondary)" />
            <h2 id="settings-invite-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 500, fontSize: 15, color: "var(--color-body)", margin: 0 }}>
              Lab &amp; Invite
            </h2>
          </div>
          <div style={{ padding: "20px" }}>

            {/* Role management */}
            {labRoles.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ ...labelStyle, marginBottom: 10 }}>Lab roles</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {labRoles.map((role) => (
                    <div key={role.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {renamingRoleId === role.id ? (
                        <>
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter" && renameValue.trim()) {
                                await supabase.from("lab_roles").update({ name: renameValue.trim() }).eq("id", role.id);
                                setLabRoles((prev) => prev.map((r) => r.id === role.id ? { ...r, name: renameValue.trim() } : r));
                                setRenamingRoleId(null);
                              } else if (e.key === "Escape") {
                                setRenamingRoleId(null);
                              }
                            }}
                            style={{ flex: 1, height: 34, border: "1px solid var(--color-navy)", borderRadius: 6, padding: "0 10px", fontSize: 13, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)", color: "var(--color-body)", outline: "none" }}
                          />
                          <button
                            onClick={async () => {
                              if (!renameValue.trim()) return;
                              await supabase.from("lab_roles").update({ name: renameValue.trim() }).eq("id", role.id);
                              setLabRoles((prev) => prev.map((r) => r.id === role.id ? { ...r, name: renameValue.trim() } : r));
                              setRenamingRoleId(null);
                            }}
                            style={{ height: 34, padding: "0 12px", backgroundColor: "var(--color-btn-primary)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >Save</button>
                          <button
                            onClick={() => setRenamingRoleId(null)}
                            style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, cursor: "pointer" }}
                          ><X size={13} color="var(--color-secondary)" /></button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1, fontSize: 13, color: "var(--color-body)" }}>
                            {role.name}
                            <span style={{ marginLeft: 8, fontSize: 11, color: "var(--color-secondary)", textTransform: "capitalize" }}>
                              ({role.permissionLevel})
                            </span>
                            {role.isSystem && (
                              <span style={{ marginLeft: 6, fontSize: 10, color: "var(--color-secondary)", border: "1px solid var(--color-border)", borderRadius: 3, padding: "0 4px" }}>built-in</span>
                            )}
                          </span>
                          {!role.isSystem && (
                            <>
                              <button
                                onClick={() => { setRenamingRoleId(role.id); setRenameValue(role.name); }}
                                style={{ height: 30, width: 30, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, cursor: "pointer" }}
                                aria-label={`Rename role ${role.name}`}
                              ><Pencil size={12} color="var(--color-secondary)" /></button>
                              <button
                                onClick={async () => {
                                  await supabase.from("lab_roles").delete().eq("id", role.id);
                                  setLabRoles((prev) => prev.filter((r) => r.id !== role.id));
                                  if (newInviteRoleId === role.id) setNewInviteRoleId("");
                                }}
                                style={{ height: 30, width: 30, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, cursor: "pointer" }}
                                aria-label={`Delete role ${role.name}`}
                              ><Trash2 size={12} color="var(--color-secondary)" /></button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add custom role */}
                {addingRole ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input
                      autoFocus
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="Role name (e.g. Lab Manager)"
                      onKeyDown={async (e) => {
                        if (e.key === "Escape") { setAddingRole(false); setNewRoleName(""); }
                      }}
                      style={{ flex: 1, height: 34, border: "1px solid var(--color-border)", borderRadius: 6, padding: "0 10px", fontSize: 13, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)", color: "var(--color-body)", outline: "none" }}
                    />
                    <button
                      onClick={async () => {
                        if (!newRoleName.trim() || !project?.id) return;
                        const { data: newRole } = await supabase
                          .from("lab_roles")
                          .insert({ project_id: project.id, name: newRoleName.trim(), permission_level: "researcher", is_system: false })
                          .select("id, name, permission_level, is_system, created_at")
                          .single();
                        if (newRole) {
                          setLabRoles((prev) => [...prev, { id: newRole.id, projectId: project.id, name: newRole.name, permissionLevel: newRole.permission_level as "pi" | "researcher", isSystem: newRole.is_system, createdAt: newRole.created_at }]);
                        }
                        setAddingRole(false);
                        setNewRoleName("");
                      }}
                      style={{ height: 34, padding: "0 14px", backgroundColor: "var(--color-btn-primary)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >Add</button>
                    <button
                      onClick={() => { setAddingRole(false); setNewRoleName(""); }}
                      style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, cursor: "pointer" }}
                    ><X size={13} color="var(--color-secondary)" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingRole(true)}
                    style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-navy)", backgroundColor: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font-roboto)", fontWeight: 600 }}
                  >
                    <Plus size={13} />
                    Add custom role
                  </button>
                )}
              </div>
            )}

            {/* Email invite flow */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ ...labelStyle, marginBottom: 10 }}>Invite by email</p>
              <p style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 12, marginTop: 0 }}>
                Enter one or more email addresses. Each gets a unique invite link.
              </p>
              <textarea
                value={emailInviteInput}
                onChange={(e) => { setEmailInviteInput(e.target.value); setEmailInviteError(""); }}
                placeholder={"colleague@university.edu\nanother@lab.org"}
                rows={3}
                style={{
                  display: "block", width: "100%", padding: "10px 12px", boxSizing: "border-box",
                  fontSize: 13, fontFamily: "var(--font-roboto)", color: "var(--color-body)",
                  backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)",
                  borderRadius: 8, resize: "vertical", outline: "none", lineHeight: 1.5,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
              />
              {emailInviteError && (
                <p style={{ fontSize: 12, color: "var(--color-error, #dc2626)", margin: "4px 0 0" }}>{emailInviteError}</p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                {labRoles.length > 0 && (
                  <div style={{ position: "relative" }}>
                    <select
                      value={emailInviteRoleId}
                      onChange={(e) => setEmailInviteRoleId(e.target.value)}
                      style={{ height: 36, border: "1px solid var(--color-border)", borderRadius: 8, padding: "0 28px 0 12px", fontSize: 13, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)", color: "var(--color-body)", outline: "none", cursor: "pointer", appearance: "none" }}
                      aria-label="Role for email invites"
                    >
                      {labRoles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} color="var(--color-secondary)" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  </div>
                )}
                <button
                  onClick={handleSendEmailInvites}
                  disabled={sendingEmailInvites || !emailInviteInput.trim()}
                  style={{ minHeight: 36, height: 36, padding: "0 16px", display: "flex", alignItems: "center", gap: 6, backgroundColor: "var(--color-btn-primary)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13, cursor: sendingEmailInvites || !emailInviteInput.trim() ? "default" : "pointer", opacity: sendingEmailInvites || !emailInviteInput.trim() ? 0.6 : 1 }}
                >
                  {sendingEmailInvites ? "Generating…" : "Generate invite links"}
                </button>
              </div>

              {/* Results */}
              {emailInviteResults.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  {emailInviteResults.map(({ email, code }) => {
                    const roleName = emailInviteRoleId ? labRoles.find((r) => r.id === emailInviteRoleId)?.name : null;
                    return (
                      <div key={code} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, color: "var(--color-body)", minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
                        {roleName && (
                          <span style={{ fontSize: 11, color: "var(--color-secondary)", border: "1px solid var(--color-border)", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>{roleName}</span>
                        )}
                        <button
                          onClick={() => handleCopyEmailCode(code)}
                          style={{ height: 30, padding: "0 10px", display: "flex", alignItems: "center", gap: 5, backgroundColor: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, color: copiedEmailCode === code ? "#2E7D52" : "var(--color-navy)", flexShrink: 0, fontFamily: "var(--font-roboto)", whiteSpace: "nowrap" }}
                        >
                          {copiedEmailCode === code ? <Check size={12} color="#2E7D52" /> : <Copy size={12} />}
                          {copiedEmailCode === code ? "Copied!" : "Copy link"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Invite codes */}
            <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 16 }}>
              Or share a general invite link (any role, anyone with the link can join):
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {inviteCodes.map((ic) => {
                const fullLink = `${typeof window !== "undefined" ? window.location.origin : ""}/login?invite=${ic.code}`;
                const isRevealed = revealedCode === ic.id;
                const roleName = ic.lab_role_id ? labRoles.find((r) => r.id === ic.lab_role_id)?.name : null;
                return (
                  <div key={ic.id} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: 8 }}>
                    <input
                      readOnly
                      value={isRevealed ? fullLink : `${typeof window !== "undefined" ? window.location.origin : "canopy.app"}/login?invite=••••••••`}
                      style={{ ...readonlyInputStyle, flex: 1, fontFamily: "monospace", fontSize: 12 }}
                      aria-label={`Invite link ${ic.code}`}
                    />
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {/* Role badge — fixed width so all rows align */}
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        minWidth: 84, fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
                        borderRadius: 5, padding: "2px 8px",
                        backgroundColor: roleName ? "rgba(27,46,75,0.08)" : "transparent",
                        color: roleName ? "var(--color-navy)" : "var(--color-secondary)",
                      }}>
                        {roleName ?? "No role"}
                      </span>

                      {/* Reveal / Hide */}
                      <button
                        onClick={() => setRevealedCode(isRevealed ? null : ic.id)}
                        style={{ height: 34, padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", borderRadius: 7, cursor: "pointer", fontSize: 12, fontFamily: "var(--font-roboto)", fontWeight: 500, color: "var(--color-body)", whiteSpace: "nowrap" }}
                        aria-label={isRevealed ? "Hide invite link" : "Reveal invite link"}
                      >
                        {isRevealed ? "Hide" : "Reveal"}
                      </button>

                      {/* Status dot + label */}
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 52, whiteSpace: "nowrap" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, backgroundColor: ic.used_by ? "var(--color-secondary)" : "#2E7D52" }} />
                        <span style={{ fontSize: 11, fontWeight: 500, color: ic.used_by ? "var(--color-secondary)" : "#2E7D52" }}>
                          {ic.used_by ? "Used" : "Active"}
                        </span>
                      </span>

                      {/* Copy */}
                      <button
                        onClick={() => handleCopyCode(ic.code)}
                        style={{ height: 34, width: 36, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", borderRadius: 7, cursor: "pointer", flexShrink: 0 }}
                        aria-label={`Copy invite link ${ic.code}`}
                      >
                        {copiedCode === ic.code ? <Check size={13} color="#2E7D52" /> : <Copy size={13} color="var(--color-secondary)" />}
                      </button>
                    </div>
                  </div>
                );
              })}

              {inviteCodes.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No invite codes yet. Generate one below.</p>
              )}
            </div>

            {/* Role picker + generate button */}
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {labRoles.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--color-secondary)", whiteSpace: "nowrap" }}>Role for this link:</span>
                  <div style={{ position: "relative" }}>
                    <select
                      value={newInviteRoleId}
                      onChange={(e) => setNewInviteRoleId(e.target.value)}
                      style={{ height: 38, border: "1px solid var(--color-border)", borderRadius: 8, padding: "0 28px 0 12px", fontSize: 13, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)", color: "var(--color-body)", outline: "none", cursor: "pointer", appearance: "none" }}
                      aria-label="Role for new invite"
                    >
                      {labRoles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} color="var(--color-secondary)" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  </div>
                </div>
              )}
              <button
                onClick={handleGenerateCode}
                disabled={generatingCode}
                style={{ minHeight: 44, height: 38, padding: "0 16px", display: "flex", alignItems: "center", gap: 6, backgroundColor: "var(--color-btn-primary)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                <RefreshCw size={13} />
                {generatingCode ? "Generating…" : "Generate new invite code"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Scheduling section */}
      <section style={sectionStyle} aria-labelledby="settings-schedule-heading">
        <div style={sectionHeaderStyle}>
          <Clock size={16} color="var(--color-secondary)" />
          <h2 id="settings-schedule-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 500, fontSize: 15, color: "var(--color-body)", margin: 0 }}>
            Scheduling &amp; Working Hours
          </h2>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>
          <WorkingHoursEditor
            timezone={timezone}
            onTimezoneChange={setTimezone}
            workingHours={workingHours}
            onWorkingHoursChange={setWorkingHours}
          />
          <button onClick={handleSaveSchedule} disabled={savingSchedule}
            style={{ alignSelf: "flex-start", minHeight: 44, height: 38, padding: "0 20px", backgroundColor: savingSchedule ? "var(--color-border)" : "var(--color-btn-primary)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13, cursor: savingSchedule ? "default" : "pointer" }}>
            {savingSchedule ? "Saving…" : "Save schedule settings"}
          </button>
        </div>
      </section>

      {/* Appearance section */}
      <section style={sectionStyle} aria-labelledby="settings-appearance-heading">
        <div style={sectionHeaderStyle}>
          <Monitor size={16} color="var(--color-secondary)" />
          <h2 id="settings-appearance-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 500, fontSize: 15, color: "var(--color-body)", margin: 0 }}>
            Appearance
          </h2>
        </div>
        <div style={{ padding: "20px" }}>
          <p style={{ ...labelStyle, marginBottom: 12 }}>Theme</p>
          <div role="group" aria-label="Theme" style={{ display: "flex", gap: 10 }}>
            {([
              { value: "light", icon: <Sun size={15} />, label: "Light" },
              { value: "dark",  icon: <Moon size={15} />, label: "Dark" },
              { value: "system", icon: <Monitor size={15} />, label: "System" },
            ] as { value: "light" | "dark" | "system"; icon: React.ReactNode; label: string }[]).map(({ value, icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                aria-pressed={theme === value}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                  border: `1.5px solid ${theme === value ? "var(--color-btn-primary)" : "var(--color-border)"}`,
                  backgroundColor: theme === value ? "var(--color-btn-primary)" : "transparent",
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
          <Bell size={16} color="var(--color-secondary)" />
          <h2 id="settings-notif-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 500, fontSize: 15, color: "var(--color-body)", margin: 0 }}>
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
            Email delivery is active - emails are sent when the{" "}
            <code style={{ fontFamily: "monospace", fontSize: 10, backgroundColor: "var(--color-canvas)", padding: "1px 4px", borderRadius: 3 }}>RESEND_API_KEY</code>{" "}
            environment variable is configured.
          </p>
        </div>
      </section>

      {/* Focus / DND section */}
      <section style={sectionStyle} aria-labelledby="settings-focus-heading">
        <div style={sectionHeaderStyle}>
          <BellOff size={16} color="var(--color-secondary)" />
          <h2 id="settings-focus-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 500, fontSize: 15, color: "var(--color-body)", margin: 0 }}>
            Focus &amp; Quiet Hours
          </h2>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <p style={{ ...labelStyle, marginBottom: 3 }}>Enable quiet hours</p>
              <p style={{ fontSize: 12, color: "var(--color-secondary)", margin: 0 }}>
                Suppress notification badges and chat unread counts during the hours you set below.
              </p>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "var(--color-secondary)" }}>{dndEnabled ? "On" : "Off"}</span>
              <input type="checkbox" checked={dndEnabled} onChange={e => setDndEnabled(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--color-navy)", cursor: "pointer" }} />
            </label>
          </div>
          {dndEnabled && (
            <div>
              <span style={labelStyle}>Quiet hours window</span>
              <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 0, marginBottom: 10 }}>
                Spans midnight if end is earlier than start (e.g. 22:00 to 08:00).
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="time" value={quietHoursStart} onChange={e => setQuietHoursStart(e.target.value)}
                  style={{ height: 36, border: "1px solid var(--color-border)", borderRadius: 7, padding: "0 10px", fontSize: 13, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-surface-2)", color: "var(--color-body)", outline: "none" }} />
                <span style={{ fontSize: 12, color: "var(--color-secondary)" }}>to</span>
                <input type="time" value={quietHoursEnd} onChange={e => setQuietHoursEnd(e.target.value)}
                  style={{ height: 36, border: "1px solid var(--color-border)", borderRadius: 7, padding: "0 10px", fontSize: 13, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-surface-2)", color: "var(--color-body)", outline: "none" }} />
              </div>
            </div>
          )}
          <button onClick={handleSaveDnd} disabled={savingDnd}
            style={{ alignSelf: "flex-start", minHeight: 44, height: 38, padding: "0 20px", backgroundColor: savingDnd ? "var(--color-border)" : "var(--color-btn-primary)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13, cursor: savingDnd ? "default" : "pointer" }}>
            {savingDnd ? "Saving…" : "Save focus settings"}
          </button>
        </div>
      </section>

      {/* Keyboard shortcuts section */}
      <section style={sectionStyle} aria-labelledby="settings-shortcuts-heading">
        <div style={sectionHeaderStyle}>
          <Keyboard size={16} color="var(--color-secondary)" />
          <h2 id="settings-shortcuts-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 500, fontSize: 15, color: "var(--color-body)", margin: 0 }}>
            Keyboard Shortcuts
          </h2>
        </div>
        <div style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)", margin: "0 0 3px" }}>View all shortcuts</p>
            <p style={{ fontSize: 12, color: "var(--color-secondary)", margin: 0 }}>See every keyboard shortcut available in Canopy. You can also press <kbd style={{ fontSize: 11, fontWeight: 700, padding: "1px 5px", borderRadius: 4, border: "1px solid var(--color-border)", backgroundColor: "var(--color-canvas)", color: "var(--color-secondary)" }}>?</kbd> anywhere.</p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("canopy:show-shortcuts"))}
            style={{ fontSize: 12, fontWeight: 700, padding: "8px 18px", borderRadius: 8, backgroundColor: "var(--color-btn-primary)", color: "#fff", border: "none", cursor: "pointer", minHeight: 40, flexShrink: 0 }}
          >
            View shortcuts
          </button>
        </div>
      </section>

      {/* Tour section */}
      <section style={sectionStyle} aria-labelledby="settings-tour-heading">
        <div style={sectionHeaderStyle}>
          <Compass size={16} color="var(--color-secondary)" />
          <h2 id="settings-tour-heading" style={{ fontFamily: "var(--font-lora)", fontWeight: 500, fontSize: 15, color: "var(--color-body)", margin: 0 }}>
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
            style={{ fontSize: 12, fontWeight: 700, padding: "8px 18px", borderRadius: 8, backgroundColor: "var(--color-btn-primary)", color: "#fff", border: "none", cursor: "pointer", minHeight: 40, flexShrink: 0 }}
          >
            Start tour
          </button>
        </div>
      </section>
    </div>
  );
}
