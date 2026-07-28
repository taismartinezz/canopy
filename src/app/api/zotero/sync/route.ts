// Zotero Web API v3 proxy — fetches items in CSL JSON format for a user library.
// Runs server-side so the API key is never exposed in browser network requests.

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { apiKey, zoteroUserId, groupId, collectionKey } = (await request.json()) as {
    apiKey?: string;
    zoteroUserId?: string;
    groupId?: string;
    collectionKey?: string;
  };

  if (!apiKey?.trim() || !zoteroUserId?.trim()) {
    return Response.json({ error: "apiKey and zoteroUserId are required" }, { status: 400 });
  }

  const base = groupId
    ? `https://api.zotero.org/groups/${groupId}`
    : `https://api.zotero.org/users/${zoteroUserId}`;

  // When a collection key is provided, scope items to that collection
  const itemsPath = collectionKey
    ? `${base}/collections/${collectionKey}/items`
    : `${base}/items`;

  // Fetch in batches of 100 (Zotero max) with CSL JSON format
  const items: unknown[] = [];
  let start = 0;
  const limit = 100;

  while (true) {
    const url = `${itemsPath}?format=csljson&limit=${limit}&start=${start}&itemType=-attachment`;
    const res = await fetch(url, {
      headers: {
        "Zotero-API-Key": apiKey,
        "Zotero-API-Version": "3",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Zotero API error ${res.status}: ${text}` }, { status: 502 });
    }

    const data = (await res.json()) as { items?: unknown[] } | unknown[];
    const batch = Array.isArray(data)
      ? data
      : (data as { items?: unknown[] }).items ?? [];

    items.push(...batch);

    if (batch.length < limit) break; // last page
    start += limit;
    if (start > 5000) break; // safety cap
  }

  // Second pass: discover PDF attachments stored in Zotero cloud (imported_file only).
  // Fetches all attachments in native JSON format and maps parentItem key → attachment info.
  // A separate /api/zotero/fetch-pdf call later downloads and stores each file.
  const pdfAttachments: Record<string, { attachmentKey: string; filename: string }> = {};
  let attStart = 0;
  while (true) {
    const attUrl = `${itemsPath}?itemType=attachment&format=json&limit=100&start=${attStart}`;
    const attRes = await fetch(attUrl, {
      headers: { "Zotero-API-Key": apiKey, "Zotero-API-Version": "3" },
    });
    if (!attRes.ok) break; // silently skip if attachment discovery fails
    const attBatch = (await attRes.json()) as Array<{
      key: string;
      data: {
        parentItem?: string;
        contentType?: string;
        title?: string;
        linkMode?: string;
      };
    }>;
    if (!Array.isArray(attBatch) || attBatch.length === 0) break;
    for (const att of attBatch) {
      const { parentItem, contentType, title, linkMode } = att.data ?? {};
      // Only include PDFs that are actually stored in Zotero cloud
      if (
        contentType === "application/pdf" &&
        linkMode === "imported_file" &&
        parentItem &&
        !pdfAttachments[parentItem]  // first PDF attachment per item wins
      ) {
        pdfAttachments[parentItem] = {
          attachmentKey: att.key,
          filename: title ?? "attachment.pdf",
        };
      }
    }
    if (attBatch.length < 100) break;
    attStart += 100;
    if (attStart > 5000) break;
  }

  // Third pass: fetch all child text notes and map parentItem key → note HTML strings.
  const notesMap: Record<string, string[]> = {};
  let noteStart = 0;
  while (true) {
    const noteUrl = `${itemsPath}?itemType=note&format=json&limit=100&start=${noteStart}`;
    const noteRes = await fetch(noteUrl, {
      headers: { "Zotero-API-Key": apiKey, "Zotero-API-Version": "3" },
    });
    if (!noteRes.ok) break;
    const noteBatch = (await noteRes.json()) as Array<{
      key: string;
      data: { parentItem?: string; note?: string };
    }>;
    if (!Array.isArray(noteBatch) || noteBatch.length === 0) break;
    for (const n of noteBatch) {
      const parent = n.data?.parentItem;
      const html = n.data?.note;
      if (parent && html) {
        if (!notesMap[parent]) notesMap[parent] = [];
        notesMap[parent].push(html);
      }
    }
    if (noteBatch.length < 100) break;
    noteStart += 100;
    if (noteStart > 5000) break;
  }

  return Response.json({ items, pdfAttachments, notesMap });
}
