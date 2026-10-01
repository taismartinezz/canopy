import { createClient } from "@supabase/supabase-js";
import { sendEmail, buildInviteEmail } from "@/lib/email";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const RESEND_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes between resends per invite
const MAX_IDS = 50;

// POST /api/invite/send
// Body: { inviteIds: string[] }  — invite_codes.id values to email (max 50)
// Auth: valid Supabase user JWT belonging to a PI in the project
export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !anonKey || !supabaseUrl) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: { user } } = await anonClient.auth.getUser(token);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { inviteIds: unknown };
  if (!Array.isArray(body.inviteIds) || body.inviteIds.length === 0) {
    return Response.json({ error: "inviteIds must be a non-empty array" }, { status: 400 });
  }
  if (body.inviteIds.length > MAX_IDS) {
    return Response.json({ error: `Maximum ${MAX_IDS} inviteIds per request` }, { status: 400 });
  }
  const inviteIds = body.inviteIds as string[];

  if (!serviceKey) return Response.json({ ok: true, skipped: "service key not configured" });
  const db = createClient(supabaseUrl, serviceKey);

  // Resolve caller's project and verify PI permission level
  const { data: callerProf } = await db
    .from("user_profiles")
    .select("name, project_id, lab_role_id")
    .eq("id", user.id)
    .maybeSingle();

  const projectId = callerProf?.project_id as string | null;
  if (!projectId) {
    return Response.json({ error: "Forbidden: no project" }, { status: 403 });
  }

  // Verify caller has PI-level permission
  const callerLabRoleId = callerProf?.lab_role_id as string | null;
  let isCallerPi = false;
  if (callerLabRoleId) {
    const { data: callerRole } = await db
      .from("lab_roles")
      .select("permission_level")
      .eq("id", callerLabRoleId)
      .maybeSingle();
    isCallerPi = (callerRole?.permission_level as string) === "pi";
  }
  // Fallback: check user_profiles.role
  if (!isCallerPi) {
    const { data: rawProf } = await db.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
    isCallerPi = (rawProf?.role as string) === "pi";
  }
  if (!isCallerPi) {
    return Response.json({ error: "Forbidden: PI role required" }, { status: 403 });
  }

  const inviterName = (callerProf?.name as string) ?? "Your PI";

  const { data: proj } = await db.from("projects").select("name").eq("id", projectId).maybeSingle();
  const labName = (proj?.name as string) ?? "the lab";

  // Fetch only invites that belong to the caller's project, have an email, and are not yet used
  const { data: invites, error } = await db
    .from("invite_codes")
    .select("id, invited_email, code, lab_role_id, email_sent_at, used_by")
    .in("id", inviteIds)
    .eq("project_id", projectId)           // scope to caller's lab only
    .not("invited_email", "is", null)
    .is("used_by", null);                  // skip accepted invites

  if (error || !invites) {
    return Response.json({ error: "Failed to fetch invites" }, { status: 500 });
  }

  const now = new Date();
  const results: { id: string; ok: boolean; skipped?: string; error?: string }[] = [];

  for (const invite of invites) {
    // Cooldown: skip if sent recently
    const sentAt = invite.email_sent_at ? new Date(invite.email_sent_at as string) : null;
    if (sentAt && now.getTime() - sentAt.getTime() < RESEND_COOLDOWN_MS) {
      results.push({ id: invite.id as string, ok: false, skipped: "cooldown" });
      continue;
    }

    const email = invite.invited_email as string;
    const code  = invite.code as string;

    // Resolve role name
    let roleName = "Researcher";
    if (invite.lab_role_id) {
      const { data: role } = await db.from("lab_roles").select("name").eq("id", invite.lab_role_id as string).maybeSingle();
      if (role?.name) roleName = role.name as string;
    }

    const emailPayload = buildInviteEmail({ to: email, labName, inviterName, role: roleName, inviteCode: code });
    const result = await sendEmail(emailPayload);

    if (result.ok) {
      await db.from("invite_codes").update({ email_sent_at: now.toISOString() }).eq("id", invite.id as string);
    } else {
      console.error("[invite/send] failed for", email, result.error);
    }

    results.push({ id: invite.id as string, ok: result.ok, error: result.error });
  }

  const allOk = results.every(r => r.ok || r.skipped === "cooldown");
  return Response.json({ ok: allOk, results });
}
