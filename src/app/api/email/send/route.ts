import { createClient } from "@supabase/supabase-js";

// ── Email delivery via Resend ─────────────────────────────────────────────────
//
// To activate: set RESEND_API_KEY in your environment (.env.local / Vercel vars).
// Without the key, all calls succeed silently - no emails are sent.
// Resend free tier: 3 000 emails/month, 100/day.
//
// Payload schema:
//   { to: string, subject: string, html: string, text?: string }
//
// Called internally from API routes (task assignment, lab-win posting).
// Users control per-type opt-in via their user_settings row.

const RESEND_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? "Canopy <notifications@canopy.app>";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_KEY) {
    // Key not configured - skip silently so the rest of the request still succeeds
    console.info("[Email] RESEND_API_KEY not set - email skipped:", payload.subject);
    return { ok: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      ...(payload.text ? { text: payload.text } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Resend error ${res.status}: ${body}` };
  }
  return { ok: true };
}

// ── Route handler ─────────────────────────────────────────────────────────────
//
// POST /api/email/send
// Body: { type: "task_assigned" | "lab_win" | "reading_assigned", payload: Record<string, string> }
//
// Auth: requires service-role or server-side call (not called from the browser directly).

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function POST(request: Request) {
  // Simple shared-secret guard: only internal API calls should reach this route
  const authHeader = request.headers.get("Authorization") ?? "";
  const internalSecret = process.env.INTERNAL_API_SECRET ?? "";
  if (internalSecret && authHeader !== `Bearer ${internalSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    type: string;
    recipientId: string;   // user_id of the person to notify
    payload: Record<string, string>;
  };

  if (!body.type || !body.recipientId) {
    return Response.json({ error: "type and recipientId are required" }, { status: 400 });
  }

  // Look up recipient email + notification preferences
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ ok: true, skipped: "Supabase not configured" });
  }
  const db = createClient(supabaseUrl, serviceKey);

  const { data: profile } = await db
    .from("user_profiles")
    .select("email, name")
    .eq("id", body.recipientId)
    .maybeSingle();

  if (!profile?.email) {
    return Response.json({ ok: true, skipped: "No email on file" });
  }

  const { data: settings } = await db
    .from("user_settings")
    .select("notif_task_assigned, notif_lab_win, notif_reading_assigned")
    .eq("user_id", body.recipientId)
    .maybeSingle();

  let emailPayload: EmailPayload | null = null;

  if (body.type === "task_assigned") {
    if (settings?.notif_task_assigned === false) {
      return Response.json({ ok: true, skipped: "User opted out" });
    }
    const { taskTitle = "a task", assignerName = "A teammate", projectName = "your project" } = body.payload;
    emailPayload = {
      to: profile.email,
      subject: `${assignerName} assigned you a task in ${projectName}`,
      html: `<p>Hi ${profile.name ?? "there"},</p>
<p><strong>${assignerName}</strong> assigned you the task <strong>"${taskTitle}"</strong> in <em>${projectName}</em>.</p>
<p>Open Canopy to view it.</p>`,
      text: `${assignerName} assigned you "${taskTitle}" in ${projectName}.`,
    };
  } else if (body.type === "reading_assigned") {
    if (settings?.notif_task_assigned === false) {
      return Response.json({ ok: true, skipped: "User opted out" });
    }
    const { paperTitle = "a paper", assignerName = "A teammate" } = body.payload;
    emailPayload = {
      to: profile.email,
      subject: `${assignerName} assigned you a paper to read`,
      html: `<p>Hi ${profile.name ?? "there"},</p>
<p><strong>${assignerName}</strong> asked you to read <strong>"${paperTitle}"</strong> in Canopy.</p>
<p>Open the Literature module to find it in your personal library.</p>`,
      text: `${assignerName} assigned you "${paperTitle}" to read.`,
    };
  } else if (body.type === "lab_win") {
    if (settings?.notif_lab_win === false) {
      return Response.json({ ok: true, skipped: "User opted out" });
    }
    const { winTitle = "a lab win", posterName = "Someone" } = body.payload;
    emailPayload = {
      to: profile.email,
      subject: `New lab win: ${winTitle}`,
      html: `<p><strong>${posterName}</strong> posted a lab win: <em>${winTitle}</em>.</p>`,
      text: `${posterName} posted a lab win: ${winTitle}.`,
    };
  } else {
    return Response.json({ error: `Unknown notification type: ${body.type}` }, { status: 400 });
  }

  if (!emailPayload) return Response.json({ ok: true });

  const result = await sendEmail(emailPayload);
  if (!result.ok) {
    console.error("[Email] send failed:", result.error);
    return Response.json({ ok: false, error: result.error }, { status: 502 });
  }
  return Response.json({ ok: true });
}
