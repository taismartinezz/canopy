// Server-side proxy: downloads a PDF from Zotero cloud storage and uploads it
// directly to Supabase Storage, keeping the Zotero API key server-side only.

export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const {
    apiKey, zoteroUserId, groupId,
    attachmentKey, projectId, itemId, filename,
  } = (await request.json()) as {
    apiKey?: string; zoteroUserId?: string; groupId?: string;
    attachmentKey?: string; projectId?: string; itemId?: string; filename?: string;
  };

  if (!apiKey || !zoteroUserId || !attachmentKey || !projectId || !itemId || !filename) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const base = groupId
    ? `https://api.zotero.org/groups/${groupId}`
    : `https://api.zotero.org/users/${zoteroUserId}`;

  // Download PDF from Zotero (follows redirects automatically)
  let fileRes: Response;
  try {
    fileRes = await fetch(`${base}/items/${attachmentKey}/file`, {
      headers: { "Zotero-API-Key": apiKey, "Zotero-API-Version": "3" },
      redirect: "follow",
    });
  } catch (err) {
    return Response.json({ error: `Zotero fetch failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 });
  }

  if (!fileRes.ok) {
    // 403 = file not stored in Zotero cloud (linked_file or access restricted)
    return Response.json(
      { error: `Zotero returned ${fileRes.status} for attachment ${attachmentKey}` },
      { status: fileRes.status === 403 ? 403 : 502 }
    );
  }

  const bytes = await fileRes.arrayBuffer();
  if (bytes.byteLength === 0) {
    return Response.json({ error: "Empty file returned from Zotero" }, { status: 502 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const fileId = crypto.randomUUID();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${projectId}/${itemId}/${fileId}-${safeName}`;

  const { error: uploadErr } = await supabase.storage
    .from("literature-files")
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });

  if (uploadErr) {
    return Response.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 });
  }

  const publicUrl = supabase.storage.from("literature-files").getPublicUrl(storagePath).data.publicUrl;

  return Response.json({
    url: publicUrl,
    storagePath,
    name: safeName,
    size: bytes.byteLength,
    fileId,
  });
}
