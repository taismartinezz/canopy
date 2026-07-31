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
    console.warn("[fetch-pdf] Missing required fields", { attachmentKey, projectId, itemId, filename });
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const base = groupId
    ? `https://api.zotero.org/groups/${groupId}`
    : `https://api.zotero.org/users/${zoteroUserId}`;

  const fileUrl = `${base}/items/${attachmentKey}/file`;
  console.log(`[fetch-pdf] Fetching: ${fileUrl} | file="${filename}" | groupId=${groupId ?? "personal"} | itemId=${itemId}`);

  // Download PDF from Zotero (follows redirects automatically)
  let fileRes: Response;
  try {
    fileRes = await fetch(fileUrl, {
      headers: { "Zotero-API-Key": apiKey, "Zotero-API-Version": "3" },
      redirect: "follow",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fetch-pdf] Network error for ${attachmentKey}: ${msg}`);
    return Response.json({ error: `Zotero fetch failed: ${msg}` }, { status: 502 });
  }

  if (!fileRes.ok) {
    // 403 = file not stored in Zotero cloud (linked_file) or group access restricted
    const reason = fileRes.status === 403
      ? "file not in Zotero cloud storage or group access denied"
      : `HTTP ${fileRes.status}`;
    console.warn(`[fetch-pdf] Zotero returned ${fileRes.status} for attachment ${attachmentKey} ("${filename}"): ${reason}`);
    return Response.json(
      { error: `Zotero returned ${fileRes.status} for attachment ${attachmentKey}: ${reason}` },
      { status: fileRes.status === 403 ? 403 : 502 }
    );
  }

  const bytes = await fileRes.arrayBuffer();
  if (bytes.byteLength === 0) {
    console.warn(`[fetch-pdf] Empty file returned for ${attachmentKey} ("${filename}")`);
    return Response.json({ error: "Empty file returned from Zotero" }, { status: 502 });
  }

  console.log(`[fetch-pdf] Downloaded ${bytes.byteLength} bytes for "${filename}" (${attachmentKey})`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("[fetch-pdf] Supabase not configured — missing env vars");
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const fileId = crypto.randomUUID();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${projectId}/${itemId}/${fileId}-${safeName}`;

  console.log(`[fetch-pdf] Uploading to storage: ${storagePath}`);
  const { error: uploadErr } = await supabase.storage
    .from("literature-files")
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });

  if (uploadErr) {
    console.error(`[fetch-pdf] Storage upload failed for "${filename}":`, uploadErr.message);
    return Response.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 });
  }

  const publicUrl = supabase.storage.from("literature-files").getPublicUrl(storagePath).data.publicUrl;
  console.log(`[fetch-pdf] ✓ Success: "${filename}" → ${publicUrl}`);

  return Response.json({
    url: publicUrl,
    storagePath,
    name: safeName,
    size: bytes.byteLength,
    fileId,
  });
}
