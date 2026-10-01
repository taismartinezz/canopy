import { createClient } from "@supabase/supabase-js";
import { sendEmail, buildTaskAssignedEmail, buildLabWinEmail } from "@/lib/email";

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const anonKey      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

// ── Auth helper ───────────────────────────────────────────────────────────────
// Accepts either INTERNAL_API_SECRET or a valid Supabase user JWT.
async function authorize(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const internalSecret = process.env.INTERNAL_API_SECRET ?? "";

  if (internalSecret && authHeader === `Bearer ${internalSecret}`) return true;
  if (internalSecret) {
    // Secret is configured but header didn't match — check if it's a user JWT
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token || !anonKey) return false;
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user } } = await anonClient.auth.getUser(token);
    return !!user;
  }
  // No secret configured — open access (dev mode)
  return true;
}

// POST /api/email/send
// Body: { type: "task_assigned"|"lab_win", recipientId: string, senderId?: string, payload: Record<string,string> }
export async function POST(request: Request) {
  if (!await authorize(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    type: string;
    recipientId: string;
    senderId?: string;   // excluded from email — never notify the person who triggered the action
    payload: Record<string, string>;
  };

  if (!body.type || !body.recipientId) {
    return Response.json({ error: "type and recipientId are required" }, { status: 400 });
  }
  if (body.senderId && body.senderId === body.recipientId) {
    return Response.json({ ok: true, skipped: "recipient is sender" });
  }

  if (!supabaseUrl || !serviceKey) {
    return Response.json({ ok: true, skipped: "Supabase not configured" });
  }
  const db = createClient(supabaseUrl, serviceKey);

  // Resolve recipient email via auth.admin (user_profiles has no email column)
  const { data: { user: authUser }, error: authErr } = await db.auth.admin.getUserById(body.recipientId);
  if (authErr || !authUser?.email) {
    return Response.json({ ok: true, skipped: "No email on file" });
  }
  const email = authUser.email;

  // Resolve recipient display name
  const { data: prof } = await db.from("user_profiles").select("name").eq("id", body.recipientId).maybeSingle();
  const name = (prof?.name as string) ?? "there";

  // Check notification preferences (columns added by migration)
  const { data: settings } = await db
    .from("user_settings")
    .select("notif_task_assigned, notif_lab_win")
    .eq("user_id", body.recipientId)
    .maybeSingle();

  let payload;

  if (body.type === "task_assigned") {
    if (settings?.notif_task_assigned === false) {
      return Response.json({ ok: true, skipped: "opted out" });
    }
    const { taskTitle = "a task", assignerName = "A teammate", projectName = "your lab" } = body.payload;
    payload = buildTaskAssignedEmail({ to: email, recipientName: name, taskTitle, assignerName, projectName });

  } else if (body.type === "lab_win") {
    if (settings?.notif_lab_win === false) {
      return Response.json({ ok: true, skipped: "opted out" });
    }
    const { content = "", posterName = "A teammate", projectName = "your lab" } = body.payload;
    payload = buildLabWinEmail({ to: email, recipientName: name, posterName, content, projectName });

  } else {
    return Response.json({ error: `Unknown type: ${body.type}` }, { status: 400 });
  }

  const result = await sendEmail(payload);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 502 });
  }
  return Response.json({ ok: true });
}
