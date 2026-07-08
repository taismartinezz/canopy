// Browser-extension endpoint — saves a captured page as a literature item.
// Auth: pass Supabase access token as "Authorization: Bearer <token>" header.

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface SavePayload {
  title: string;
  url?: string;
  doi?: string;
  authors?: string[];
  year?: number;
  journal?: string;
  abstract?: string;
  scope?: "lab" | "my" | "project";
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: "Supabase not configured" }, { status: 503 });
  }

  // Build authenticated client from the user's bearer token
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Invalid token" }, { status: 401 });

  // Look up the user's project
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("project_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.project_id) return Response.json({ error: "No project found for user" }, { status: 403 });

  const body = (await request.json()) as SavePayload;
  if (!body.title?.trim()) return Response.json({ error: "title is required" }, { status: 400 });

  const projectId = profile.project_id as string;
  const library   = body.scope ?? "lab";
  const now       = new Date().toISOString();
  const id        = crypto.randomUUID();

  const { error: insertErr } = await supabase.from("literature_items").insert({
    id,
    project_id:    projectId,
    user_id:       user.id,
    library,
    type:          "article",
    title:         body.title.trim(),
    authors:       body.authors ?? [],
    year:          body.year ?? null,
    journal:       body.journal ?? null,
    doi:           body.doi ?? null,
    abstract:      body.abstract ?? null,
    url:           body.url ?? null,
    tags:          [],
    status:        "unread",
    rating:        0,
    import_source: "url",
    created_at:    now,
  });

  if (insertErr) {
    console.error("[literature/save]", insertErr);
    return Response.json({ error: insertErr.message }, { status: 500 });
  }

  return Response.json({ id, projectId });
}
