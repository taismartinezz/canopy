import { createClient } from "@supabase/supabase-js";
import { sendEmail, buildInviteEmail } from "@/lib/email";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const APP_URL     = (process.env.APP_URL ?? "https://canopyteams.tech").replace(/\/$/, "");

// POST /api/invite/send
// Body: { inviteIds: string[] }  — array of invite_codes.id rows to email
// Auth: valid Supabase user JWT (the PI sending the invites)
export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !anonKey || !supabaseUrl) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: { user } } = await anonClient.auth.getUser(token);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { inviteIds: string[] };
  if (!Array.isArray(body.inviteIds) || body.inviteIds.length === 0) {
    return Response.json({ error: "inviteIds must be a non-empty array" }, { status: 400 });
  }

  if (!serviceKey) return Response.json({ ok: true, skipped: "service key not configured" });
  const db = createClient(supabaseUrl, serviceKey);

  // Resolve sender name + project name
  const { data: senderProf } = await db.from("user_profiles").select("name, project_id").eq("id", user.id).maybeSingle();
  const inviterName  = (senderProf?.name as string) ?? "Your PI";
  const projectId    = senderProf?.project_id as string | null;

  let labName = "the lab";
  if (projectId) {
    const { data: proj } = await db.from("projects").select("name").eq("id", projectId).maybeSingle();
    if (proj?.name) labName = proj.name as string;
  }

  // Fetch the invite rows
  const { data: invites, error } = await db
    .from("invite_codes")
    .select("id, invited_email, code, lab_role_id, email_sent_at")
    .in("id", body.inviteIds)
    .not("invited_email", "is", null);

  if (error || !invites) {
    return Response.json({ error: "Failed to fetch invites" }, { status: 500 });
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const invite of invites) {
    const email = invite.invited_email as string;
    const code  = invite.code as string;

    // Resolve role name
    let roleName = "Researcher";
    if (invite.lab_role_id) {
      const { data: role } = await db.from("lab_roles").select("name").eq("id", invite.lab_role_id as string).maybeSingle();
      if (role?.name) roleName = role.name as string;
    }

    const inviteUrl = `${APP_URL}/login?invite=${code}`;
    const emailPayload = buildInviteEmail({ to: email, labName, inviterName, role: roleName, inviteUrl });
    const result = await sendEmail(emailPayload);

    if (result.ok) {
      // Mark sent_at
      await db.from("invite_codes").update({ email_sent_at: new Date().toISOString() }).eq("id", invite.id as string);
    } else {
      console.error("[invite/send] failed for", email, result.error);
    }

    results.push({ id: invite.id as string, ok: result.ok, error: result.error });
  }

  const allOk = results.every(r => r.ok);
  return Response.json({ ok: allOk, results });
}
