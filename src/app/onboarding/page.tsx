"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Users, BookOpen, Check, X } from "lucide-react";
import CanopyLogo from "@/components/ui/CanopyLogo";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────

type Role = "pi" | "researcher";

// ── Constants ─────────────────────────────────────────────────────────────────


// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
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
  backgroundColor: "#fff",
};

const PAGE_WRAP: React.CSSProperties = {
  minHeight: "100dvh",
  backgroundColor: "#F6F8FC",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
  fontFamily: "var(--font-roboto)",
};

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #DDE1E7",
  borderRadius: 10,
  maxWidth: 560,
  width: "100%",
  padding: "40px 40px 44px",
  boxShadow: "0 4px 24px rgba(27,46,75,0.08)",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 32,
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const num = i + 1;
        const done = num < current;
        const active = num === current;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && (
              <div style={{ width: 44, height: 1, backgroundColor: "#DDE1E7" }} />
            )}
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: done || active ? "#1B2E4B" : "#fff",
                border: done || active ? "none" : "1px solid #DDE1E7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {done && <Check size={6} color="#fff" strokeWidth={3} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--font-roboto)",
        fontWeight: 600,
        fontSize: 13,
        color: "#1B2E4B",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        marginBottom: 20,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
    >
      ← Back
    </button>
  );
}

function NavButton({
  onClick,
  disabled,
  style: extraStyle,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        height: 44,
        backgroundColor: disabled ? "#B8C4D4" : "#1B2E4B",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        fontFamily: "var(--font-roboto)",
        fontWeight: 700,
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background-color 150ms ease",
        marginTop: 24,
        ...extraStyle,
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.backgroundColor = "#2E4A6F";
      }}
      onMouseLeave={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.backgroundColor = disabled ? "#B8C4D4" : "#1B2E4B";
      }}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-roboto)",
        fontWeight: 600,
        fontSize: 13,
        color: "#2D2D2D",
        margin: "0 0 6px",
      }}
    >
      {children}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={INPUT_STYLE}
      onKeyDown={onKeyDown}
      onFocus={(e) => { e.currentTarget.style.borderColor = "#1B2E4B"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "#DDE1E7"; }}
    />
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2
        style={{
          fontFamily: "var(--font-lora)",
          fontWeight: 700,
          fontSize: 20,
          color: "#1B2E4B",
          margin: 0,
          lineHeight: 1.25,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            fontFamily: "var(--font-roboto)",
            fontWeight: 400,
            fontSize: 13,
            color: "#6B6B6B",
            marginTop: 6,
            marginBottom: 0,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ── PI project form (shared between PI step 2 and researcher create path) ──────

function ProjectForm({
  projectName, setProjectName,
  institution, setInstitution,
  userName, setUserName,
  showResearchType, researchType, setResearchType,
  roleTitle, setRoleTitle,
  showName = true,
}: {
  projectName: string; setProjectName: (v: string) => void;
  institution: string; setInstitution: (v: string) => void;
  userName: string; setUserName: (v: string) => void;
  showResearchType: boolean; researchType?: string; setResearchType?: (v: string) => void;
  roleTitle?: string; setRoleTitle?: (v: string) => void;
  showName?: boolean;
}) {
  return (
    <>
      <Field label="Project / Lab name">
        <TextInput value={projectName} onChange={setProjectName} placeholder="e.g. Moral Injury & Resilience Lab" />
      </Field>

      <Field label="Institution">
        <TextInput value={institution} onChange={setInstitution} placeholder="e.g. Your university or research center" />
      </Field>

      {showResearchType && setResearchType && (
        <Field label="Research type">
          <TextInput
            value={researchType ?? ""}
            onChange={setResearchType}
            placeholder="e.g. Moral injury in military veterans"
          />
        </Field>
      )}

      {showName && (
        <Field label="Your name">
          <TextInput value={userName} onChange={setUserName} placeholder="Full name" />
        </Field>
      )}

      {setRoleTitle !== undefined && (
        <Field label="Your role title (optional)">
          <TextInput value={roleTitle ?? ""} onChange={setRoleTitle} placeholder="e.g. Associate Professor, Lab Director" />
        </Field>
      )}
    </>
  );
}

// ── Supabase sync (fire-and-forget) ───────────────────────────────────────────

async function syncOnboardingToSupabase({
  projectName, institution, researchType,
  userName, userRole, inviteCode, enteredInviteCode, bio, department, inviteEmails,
}: {
  projectName: string; institution: string; researchType: string;
  userName: string; userRole: "pi" | "researcher"; inviteCode?: string;
  enteredInviteCode?: string; bio?: string; department?: string;
  inviteEmails?: { email: string; code: string }[];
}): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) return null;

    const nameParts = userName.trim().split(/\s+/).filter(Boolean);
    const avatarInitials = nameParts.length === 0 ? "??"
      : nameParts.length === 1 ? nameParts[0][0].toUpperCase()
      : (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();

    let projectId: string;
    let resolvedInstitution = institution;

    if (userRole === "pi") {
      const { data: existing, error: existingErr } = await supabase
        .from("projects")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (existing) {
        projectId = existing.id as string;
      } else {
        const { data: created, error: createErr } = await supabase
          .from("projects")
          .insert({ name: projectName, institution, research_type: researchType, owner_id: user.id })
          .select("id")
          .single();
        if (createErr || !created) return `Project creation failed: ${createErr?.message ?? "unknown error"}`;
        projectId = created.id as string;
      }

      // Save the generic shareable code
      if (inviteCode) {
        const { error: codeErr } = await supabase.from("invite_codes").insert({
          code: inviteCode, project_id: projectId, created_by: user.id,
        });
        if (codeErr) console.error("[Sync] generic invite_code insert error:", codeErr.message, codeErr.code);
      }
      // Save one unique code per invited email
      if (inviteEmails && inviteEmails.length > 0) {
        for (const { email, code } of inviteEmails) {
          const { error: emailCodeErr } = await supabase.from("invite_codes").insert({
            code, project_id: projectId, created_by: user.id, invited_email: email,
          });
          // Log only code + message — not the full object, which may echo the inserted row (including email).
          if (emailCodeErr) console.error("[Sync] invite_code insert error:", emailCodeErr.message, emailCodeErr.code);
        }
      }
    } else if (enteredInviteCode) {
      // Look up the project linked to the invite code
      const normalizedCode = enteredInviteCode.trim().toUpperCase();
      const { data: inviteData, error: inviteErr } = await supabase
        .from("invite_codes")
        .select("project_id, id")
        .eq("code", normalizedCode)
        .maybeSingle();

      if (!inviteData?.project_id) {
        return `Invalid invite code. Please check the code and try again.${inviteErr ? ` (${inviteErr.message})` : ""}`;
      }

      projectId = inviteData.project_id as string;

      // Mark code as used
      await supabase.from("invite_codes").update({
        used_by: user.id,
        used_at: new Date().toISOString(),
      }).eq("code", normalizedCode);

      // Clear the pending invite from localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("pendingInviteCode");
      }
    } else {
      // Researcher creating own workspace (no invite code)
      const { data: created, error: createErr2 } = await supabase
        .from("projects")
        .insert({ name: projectName, institution, research_type: researchType, owner_id: user.id })
        .select("id")
        .single();
      if (createErr2 || !created) return `Project creation failed: ${createErr2?.message ?? "unknown error"}`;
      projectId = created.id as string;
    }

    const profilePayload = {
      id: user.id, name: userName, role: userRole,
      institution: resolvedInstitution ?? "", avatar_initials: avatarInitials,
      project_id: projectId,
      bio: bio ?? "",
      department: department ?? "",
      avatar_color: "#B4D4E3",
    };
    const { error: profileError } = await supabase
      .from("user_profiles")
      .insert(profilePayload)
      .select()
      .maybeSingle()
      .then(async (res) => {
        if (res.error?.code === "23505") {
          // Row exists — update it instead
          return supabase.from("user_profiles").update(profilePayload).eq("id", user.id);
        }
        return res;
      });
    if (profileError) return `Profile save failed: ${profileError.message}`;

    const { error: memberErr } = await supabase
      .from("team_members")
      .insert({ project_id: projectId, user_id: user.id, role: userRole })
      .select();
    if (memberErr && memberErr.code !== "23505") return `Team membership save failed: ${memberErr.message}`;

    return null;
  } catch (err) {
    console.error("[syncOnboardingToSupabase] unexpected error:", err instanceof Error ? err.message : String(err));
    return `Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role | null>(null);

  // PI step 2
  const [piProjectName, setPiProjectName] = useState("");
  const [piInstitution, setPiInstitution] = useState("");
  const [piResearchType, setPiResearchType] = useState("");
  const [piUserName, setPiUserName] = useState("");
  const [piRoleTitle, setPiRoleTitle] = useState("");

  // Researcher step 2
  const [inviteCode, setInviteCode] = useState("");
  const [resProjectName, setResProjectName] = useState("");
  const [resInstitution, setResInstitution] = useState("");
  const [resUserName, setResUserName] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // PI step 3 — invite team
  const [emailInput, setEmailInput] = useState("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [emailCodes, setEmailCodes] = useState<Record<string, string>>({});
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState("");
  const [copied, setCopied] = useState(false);

  // Researcher step 3 — profile
  const [profileName, setProfileName] = useState("");
  const [profileDept, setProfileDept] = useState("");
  const [profileBio, setProfileBio] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const checked = useRef(false);

  // Guard: session check runs FIRST — nothing renders until this resolves
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    async function init() {
      if (!isSupabaseConfigured) {
        if (!localStorage.getItem("canopy_authed")) { router.replace("/login"); return; }
        const pendingInvite = localStorage.getItem("pendingInviteCode");
        if (pendingInvite) setInviteCode(pendingInvite);
        if (localStorage.getItem("canopy_project")) { router.replace("/"); return; }
        setSessionReady(true);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      // Pre-fill invite code if researcher arrived via an invite link
      const pendingInvite = localStorage.getItem("pendingInviteCode");
      if (pendingInvite) setInviteCode(pendingInvite);

      setSessionReady(true);
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fill profile name when entering researcher step 3
  useEffect(() => {
    if (step === 3 && role === "researcher" && resUserName && !profileName) {
      setProfileName(resUserName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleStep1Continue() {
    if (!role) return;
    setStep(2);
  }

  function handlePiStep2Continue() {
    const code = "CANOPY-" + Math.random().toString(36).substring(2, 6).toUpperCase();
    setGeneratedCode(code);
    setStep(3);
  }

  function handleResearcherStep2Continue() {
    if (inviteCode.length >= 6) {
      setIsJoining(true);
      setTimeout(() => {
        setIsJoining(false);
        setStep(3);
      }, 1500);
    } else {
      setStep(3);
    }
  }

  const handleAddEmail = useCallback(() => {
    const trimmed = emailInput.trim();
    if (trimmed.includes("@") && !inviteEmails.includes(trimmed)) {
      const code = "CANOPY-" + Math.random().toString(36).substring(2, 6).toUpperCase();
      setInviteEmails((prev) => [...prev, trimmed]);
      setEmailCodes((prev) => ({ ...prev, [trimmed]: code }));
      setEmailInput("");
    }
  }, [emailInput, inviteEmails]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/login?invite=${generatedCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [generatedCode]);

  const handleCopyEmailLink = useCallback(async (email: string) => {
    const code = emailCodes[email];
    if (!code) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/login?invite=${code}`);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch { /* ignore */ }
  }, [emailCodes]);

  async function completeOnboarding() {
    if (submitting || !role) return;
    setSubmitting(true);

    const usedInvite = inviteCode.length >= 6;

    let projectName: string;
    let institution: string;
    let researchType: string;
    let userName: string;
    let userRole: "pi" | "researcher";
    let userRoleTitle: string | undefined;

    if (role === "pi") {
      projectName   = piProjectName;
      institution   = piInstitution;
      researchType  = piResearchType;
      userName      = piUserName;
      userRole      = "pi";
      userRoleTitle = piRoleTitle || undefined;
    } else {
      projectName   = usedInvite ? "Lab Workspace" : resProjectName;
      institution   = usedInvite ? "" : resInstitution;
      researchType  = "";
      userName      = profileName || resUserName;
      userRole      = "researcher";
      userRoleTitle = undefined;
    }

    localStorage.setItem(
      "canopy_project",
      JSON.stringify({
        id: crypto.randomUUID(),
        name: projectName,
        institution,
        researchType,
        createdAt: new Date().toISOString(),
      }),
    );

    const nameParts = userName.trim().split(/\s+/).filter(Boolean);
    const avatarInitials =
      nameParts.length === 0
        ? "??"
        : nameParts.length === 1
          ? nameParts[0][0].toUpperCase()
          : (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();

    localStorage.setItem(
      "canopy_user",
      JSON.stringify({
        id: crypto.randomUUID(),
        name: userName,
        role: userRole,
        roleTitle: userRoleTitle,
        institution: institution || undefined,
        avatarInitials,
      }),
    );

    if (role === "pi" && generatedCode) {
      localStorage.setItem("canopy_invite_code", generatedCode);
    }

    if (role === "pi" && inviteEmails.length > 0) {
      localStorage.setItem(
        "canopy_email_invites",
        JSON.stringify(inviteEmails.map((email) => ({ email, code: emailCodes[email] }))),
      );
    }

    // Await Supabase sync so the profile row exists before AppShell loads
    if (isSupabaseConfigured) {
      const syncErr = await syncOnboardingToSupabase({
        projectName, institution, researchType,
        userName, userRole,
        inviteCode: role === "pi" ? generatedCode : undefined,
        enteredInviteCode: role === "researcher" && inviteCode.length >= 6 ? inviteCode : undefined,
        bio: role === "researcher" ? profileBio : undefined,
        department: role === "researcher" ? profileDept : undefined,
        inviteEmails: role === "pi" ? inviteEmails.map((email) => ({ email, code: emailCodes[email] })) : undefined,
      });
      if (syncErr) {
        setSyncError(syncErr);
        setSubmitting(false);
        return;
      }
    }

    router.push("/profile");
  }

  if (!sessionReady) return null;

  // ── Step 1: Role selection ─────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div style={PAGE_WRAP}>
        <div style={CARD_STYLE}>
          <StepDots current={1} total={3} />

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <CanopyLogo size={32} />
          </div>

          <h1
            style={{
              fontFamily: "var(--font-lora)",
              fontWeight: 700,
              fontSize: 22,
              color: "#1B2E4B",
              textAlign: "center",
              margin: "16px 0 8px",
            }}
          >
            Welcome to Canopy
          </h1>
          <p
            style={{
              fontFamily: "var(--font-roboto)",
              fontWeight: 400,
              fontSize: 14,
              color: "#6B6B6B",
              textAlign: "center",
              margin: "0 0 32px",
            }}
          >
            How are you using Canopy?
          </p>

          {/* Role cards */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {(["pi", "researcher"] as Role[]).map((r) => {
              const selected = role === r;
              return (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  style={{
                    flex: "1 1 200px",
                    minHeight: 140,
                    padding: 24,
                    backgroundColor: selected ? "rgba(27,46,75,0.04)" : "#fff",
                    border: `${selected ? 2 : 1}px solid ${selected ? "#1B2E4B" : "#DDE1E7"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                    transition: "border-color 150ms ease, background-color 150ms ease",
                  }}
                >
                  {r === "pi" ? (
                    <Users size={28} color="#1B2E4B" />
                  ) : (
                    <BookOpen size={28} color="#1B2E4B" />
                  )}
                  <span
                    style={{
                      fontFamily: "var(--font-lora)",
                      fontWeight: 600,
                      fontSize: 15,
                      color: "#1B2E4B",
                      display: "block",
                      marginTop: 12,
                    }}
                  >
                    {r === "pi" ? "I'm a PI / Lab Director" : "I'm a Researcher"}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-roboto)",
                      fontWeight: 400,
                      fontSize: 13,
                      color: "#6B6B6B",
                      lineHeight: 1.5,
                      display: "block",
                      marginTop: 6,
                    }}
                  >
                    {r === "pi"
                      ? "I manage a research team and want to create a project workspace."
                      : "I've been invited to join a lab or want to create my own workspace."}
                  </span>
                </button>
              );
            })}
          </div>

          <NavButton onClick={handleStep1Continue} disabled={!role}>
            Continue
          </NavButton>
        </div>
      </div>
    );
  }

  // ── Step 2A: PI creates project ────────────────────────────────────────────

  if (step === 2 && role === "pi") {
    const canContinue =
      piProjectName.trim().length > 0 &&
      piInstitution.trim().length > 0 &&
      piResearchType.length > 0 &&
      piUserName.trim().length > 0;

    return (
      <div style={PAGE_WRAP}>
        <div style={CARD_STYLE}>
          <BackButton onClick={() => setStep(1)} />
          <StepDots current={2} total={3} />
          <SectionTitle
            title="Set up your lab workspace"
            subtitle="You can change these later in Lab Settings."
          />

          <ProjectForm
            projectName={piProjectName} setProjectName={setPiProjectName}
            institution={piInstitution} setInstitution={setPiInstitution}
            userName={piUserName} setUserName={setPiUserName}
            showResearchType researchType={piResearchType} setResearchType={setPiResearchType}
            roleTitle={piRoleTitle} setRoleTitle={setPiRoleTitle}
          />

          <NavButton onClick={handlePiStep2Continue} disabled={!canContinue}>
            Continue
          </NavButton>
        </div>
      </div>
    );
  }

  // ── Step 2B: Researcher joins or creates ───────────────────────────────────

  if (step === 2 && role === "researcher") {
    const inviteValid = inviteCode.length >= 6;
    const createValid = resProjectName.trim().length > 0;
    const canContinue = inviteValid || createValid;

    if (isJoining) {
      return (
        <div style={PAGE_WRAP}>
          <div style={{ ...CARD_STYLE, textAlign: "center", padding: "56px 40px" }}>
            <CanopyLogo size={28} />
            <p
              style={{
                fontFamily: "var(--font-lora)",
                fontWeight: 600,
                fontSize: 18,
                color: "#1B2E4B",
                marginTop: 20,
                marginBottom: 0,
              }}
            >
              Joined! Setting up your workspace...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div style={PAGE_WRAP}>
        <div style={CARD_STYLE}>
          <BackButton onClick={() => setStep(1)} />
          <StepDots current={2} total={3} />
          <SectionTitle title="How are you joining Canopy?" />

          {/* Option A: join an existing lab */}
          <div
            style={{
              border: `${inviteCode.length >= 6 ? 2 : 1}px solid ${inviteCode.length >= 6 ? "#1B2E4B" : "#DDE1E7"}`,
              borderRadius: 10,
              padding: "20px 20px 16px",
              marginBottom: 16,
              backgroundColor: inviteCode.length >= 6 ? "rgba(27,46,75,0.03)" : "#fff",
              transition: "border-color 150ms ease, background-color 150ms ease",
            }}
          >
            <p style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 14, color: "#1B2E4B", margin: "0 0 4px" }}>
              Join an existing lab
            </p>
            <p style={{ fontFamily: "var(--font-roboto)", fontSize: 12, color: "#6B6B6B", margin: "0 0 12px" }}>
              Your PI shared an invite code or link.
            </p>
            <TextInput
              value={inviteCode}
              onChange={setInviteCode}
              placeholder="e.g. CANOPY-XXXX"
            />
          </div>

          {/* Or divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0 16px" }}>
            <div style={{ flex: 1, height: 1, backgroundColor: "#DDE1E7" }} />
            <span style={{ fontFamily: "var(--font-roboto)", fontSize: 12, color: "#6B6B6B" }}>or</span>
            <div style={{ flex: 1, height: 1, backgroundColor: "#DDE1E7" }} />
          </div>

          {/* Option B: create own workspace */}
          <div
            style={{
              border: `${resProjectName.trim().length > 0 ? 2 : 1}px solid ${resProjectName.trim().length > 0 ? "#1B2E4B" : "#DDE1E7"}`,
              borderRadius: 10,
              padding: "20px 20px 4px",
              backgroundColor: resProjectName.trim().length > 0 ? "rgba(27,46,75,0.03)" : "#fff",
              transition: "border-color 150ms ease, background-color 150ms ease",
            }}
          >
            <p style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 14, color: "#1B2E4B", margin: "0 0 4px" }}>
              Create my own workspace
            </p>
            <p style={{ fontFamily: "var(--font-roboto)", fontSize: 12, color: "#6B6B6B", margin: "0 0 12px" }}>
              Start fresh — you can invite collaborators later.
            </p>
            <ProjectForm
              projectName={resProjectName} setProjectName={setResProjectName}
              institution={resInstitution} setInstitution={setResInstitution}
              userName={resUserName} setUserName={setResUserName}
              showResearchType={false}
            />
          </div>

          <NavButton onClick={handleResearcherStep2Continue} disabled={!canContinue}>
            Continue
          </NavButton>
        </div>
      </div>
    );
  }

  // ── Step 3A: PI invites team ───────────────────────────────────────────────

  if (step === 3 && role === "pi") {
    return (
      <div style={PAGE_WRAP}>
        <div style={CARD_STYLE}>
          <BackButton onClick={() => setStep(2)} />
          <StepDots current={3} total={3} />
          <SectionTitle
            title="Invite researchers to your lab"
            subtitle="They'll get access once they sign up with the same invite link."
          />

          {/* Email add row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddEmail(); } }}
              placeholder="Add email"
              aria-label="Add team member email"
              style={{ ...INPUT_STYLE, flex: 1 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#1B2E4B"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#DDE1E7"; }}
            />
            <button
              onClick={handleAddEmail}
              style={{
                height: 44,
                padding: "0 16px",
                backgroundColor: "#1B2E4B",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontFamily: "var(--font-roboto)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#2E4A6F"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#1B2E4B"; }}
            >
              Add
            </button>
          </div>

          {/* Email chips */}
          {inviteEmails.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {inviteEmails.map((email) => (
                <div
                  key={email}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    backgroundColor: "rgba(27,46,75,0.04)",
                    border: "1px solid #DDE1E7",
                    borderRadius: 8,
                    fontFamily: "var(--font-roboto)",
                    fontSize: 13,
                    color: "#2D2D2D",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {email}
                  </span>
                  <button
                    onClick={() => handleCopyEmailLink(email)}
                    aria-label={`Copy invite link for ${email}`}
                    style={{
                      flexShrink: 0,
                      background: "none",
                      border: "1px solid #DDE1E7",
                      borderRadius: 6,
                      cursor: "pointer",
                      padding: "2px 8px",
                      fontFamily: "var(--font-roboto)",
                      fontSize: 11,
                      fontWeight: 600,
                      color: copiedEmail === email ? "#2E7D52" : "#1B2E4B",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {copiedEmail === email ? "Copied!" : "Copy link"}
                  </button>
                  <button
                    onClick={() => {
                      setInviteEmails((prev) => prev.filter((e) => e !== email));
                      setEmailCodes((prev) => { const next = { ...prev }; delete next[email]; return next; });
                    }}
                    aria-label={`Remove ${email}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      color: "#6B6B6B",
                      minWidth: 16,
                      minHeight: 16,
                      flexShrink: 0,
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Copy invite link */}
          <button
            onClick={handleCopyLink}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              minHeight: 44,
              fontFamily: "var(--font-roboto)",
              fontWeight: 600,
              fontSize: 13,
              color: copied ? "#2E7D52" : "#1B2E4B",
              background: "none",
              border: "1px solid #DDE1E7",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: "pointer",
              marginTop: 8,
              transition: "color 150ms ease, border-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              if (!copied) (e.currentTarget as HTMLElement).style.borderColor = "#B8C4D4";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#DDE1E7";
            }}
          >
            {copied ? "✓ Copied!" : "Copy invite link"}
          </button>
          <p
            style={{
              fontFamily: "var(--font-roboto)",
              fontSize: 11,
              color: "#6B6B6B",
              textAlign: "center",
              marginTop: 6,
              marginBottom: 0,
            }}
          >
            {typeof window !== "undefined" ? `${window.location.origin}/login?invite=${generatedCode}` : `/login?invite=${generatedCode}`}
          </p>

          <NavButton onClick={completeOnboarding} disabled={submitting}>
            {submitting ? "Saving…" : "Go to my workspace"}
          </NavButton>

          <button
            onClick={completeOnboarding}
            disabled={submitting}
            style={{
              display: "block",
              width: "100%",
              textAlign: "center",
              fontFamily: "var(--font-roboto)",
              fontWeight: 400,
              fontSize: 13,
              color: "#6B6B6B",
              background: "none",
              border: "none",
              cursor: submitting ? "not-allowed" : "pointer",
              marginTop: 12,
              padding: 0,
              minHeight: 36,
              opacity: submitting ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!submitting) (e.currentTarget as HTMLElement).style.textDecoration = "underline";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.textDecoration = "none";
            }}
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3B: Researcher profile ────────────────────────────────────────────

  if (step === 3 && role === "researcher") {
    const canContinue = profileName.trim().length > 0;

    return (
      <div style={PAGE_WRAP}>
        <div style={CARD_STYLE}>
          <BackButton onClick={() => setStep(2)} />
          <StepDots current={3} total={3} />
          <SectionTitle title="Set up your profile" />

          <Field label="Full name">
            <TextInput value={profileName} onChange={setProfileName} placeholder="Full name" />
          </Field>

          <Field label="Department / Program (optional)">
            <TextInput
              value={profileDept}
              onChange={setProfileDept}
              placeholder="e.g. Psychology, Epidemiology"
            />
          </Field>

          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Bio (optional)</FieldLabel>
            <textarea
              value={profileBio}
              onChange={(e) => setProfileBio(e.target.value)}
              rows={3}
              placeholder="Tell your team a bit about your research background."
              style={{
                display: "block",
                width: "100%",
                border: "1px solid #DDE1E7",
                borderRadius: 8,
                padding: "10px 14px",
                fontFamily: "var(--font-roboto)",
                fontWeight: 400,
                fontSize: 14,
                color: "#2D2D2D",
                outline: "none",
                boxSizing: "border-box",
                resize: "vertical",
                minHeight: 88,
                lineHeight: 1.5,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#1B2E4B"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#DDE1E7"; }}
            />
          </div>

          <NavButton onClick={completeOnboarding} disabled={!canContinue || submitting}>
            {submitting ? "Saving…" : "Go to my workspace"}
          </NavButton>

          {syncError && (
            <p
              role="alert"
              style={{
                fontFamily: "var(--font-roboto)",
                fontSize: 13,
                color: "#C0392B",
                marginTop: 10,
                marginBottom: 0,
                textAlign: "center",
              }}
            >
              {syncError}
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
