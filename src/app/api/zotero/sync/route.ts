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

  // First pass: fetch all non-attachment items in CSL JSON format (batched)
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

    if (batch.length < limit) break;
    start += limit;
    if (start > 5000) break;
  }

  // Second pass: discover PDF attachments stored in Zotero cloud.
  // Both "imported_file" (added from local) and "imported_url" (added from URL) mean the
  // PDF is stored in Zotero cloud — group libraries predominantly use "imported_url".
  // Also builds attachmentParentMap (attachmentKey → parentItemKey) for the annotation pass.
  const pdfAttachments: Record<string, { attachmentKey: string; filename: string }> = {};
  const attachmentParentMap: Record<string, string> = {};
  let attStart = 0;
  while (true) {
    const attUrl = `${itemsPath}?itemType=attachment&format=json&limit=100&start=${attStart}`;
    const attRes = await fetch(attUrl, {
      headers: { "Zotero-API-Key": apiKey, "Zotero-API-Version": "3" },
    });
    if (!attRes.ok) break;
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
      // Track every attachment for annotation resolution
      if (parentItem) attachmentParentMap[att.key] = parentItem;
      // Accept both linkModes — both mean the file lives in Zotero cloud storage
      if (
        contentType === "application/pdf" &&
        (linkMode === "imported_file" || linkMode === "imported_url") &&
        parentItem &&
        !pdfAttachments[parentItem]
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

  // Third pass: fetch all child text notes and map parentItem key → HTML strings.
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

  // Fourth pass: fetch PDF annotation items and resolve them to top-level item keys.
  // Zotero annotation parentItem points to the PDF attachment, not the top-level item,
  // so we resolve annotation → attachment → top-level item via attachmentParentMap.
  const annotationsForItem: Record<string, string[]> = {};
  let annStart = 0;
  while (true) {
    const annUrl = `${itemsPath}?itemType=annotation&format=json&limit=100&start=${annStart}`;
    const annRes = await fetch(annUrl, {
      headers: { "Zotero-API-Key": apiKey, "Zotero-API-Version": "3" },
    });
    if (!annRes.ok) break;
    const annBatch = (await annRes.json()) as Array<{
      key: string;
      data: {
        parentItem?: string;
        annotationType?: string;
        annotationText?: string;
        annotationComment?: string;
        annotationColor?: string;
        annotationPageLabel?: string;
      };
    }>;
    if (!Array.isArray(annBatch) || annBatch.length === 0) break;
    for (const ann of annBatch) {
      const attachKey = ann.data?.parentItem;
      if (!attachKey) continue;
      const topKey = attachmentParentMap[attachKey];
      if (!topKey) continue;
      const { annotationType, annotationText, annotationComment, annotationPageLabel } = ann.data;
      const typeLabel =
        annotationType === "highlight" ? "Highlight"
        : annotationType === "note" ? "Note"
        : annotationType === "underline" ? "Underline"
        : (annotationType ?? "Annotation");
      const page = annotationPageLabel ? `, p. ${annotationPageLabel}` : "";
      const parts: string[] = [`[${typeLabel}${page}]`];
      if (annotationText) parts.push(`"${annotationText}"`);
      if (annotationComment) parts.push(`→ ${annotationComment}`);
      if (!annotationsForItem[topKey]) annotationsForItem[topKey] = [];
      annotationsForItem[topKey].push(parts.join(" "));
    }
    if (annBatch.length < 100) break;
    annStart += 100;
    if (annStart > 5000) break;
  }

  // Merge PDF annotations into notesMap under a clear separator
  for (const [key, lines] of Object.entries(annotationsForItem)) {
    if (!notesMap[key]) notesMap[key] = [];
    notesMap[key].push(`--- PDF Annotations ---\n${lines.join("\n")}`);
  }

  // Fifth pass: native JSON items to collect Zotero tags AND detect CSL-drop gaps.
  // CSL JSON format does not include Zotero-specific tags — a separate native-format
  // pass is required. Each item's key matches the key embedded in the CSL id URI.
  // We also use this pass to cross-reference against the CSL JSON output: if an item
  // is present in native JSON but absent from CSL JSON, it was silently dropped by
  // Zotero's CSL serializer. We surface those as droppedItems in the response.
  const tagsMap: Record<string, string[]> = {};
  const nativeItems: { key: string; title: string }[] = [];
  let tagStart = 0;
  while (true) {
    const tagUrl = `${itemsPath}?format=json&limit=100&start=${tagStart}&itemType=-attachment`;
    const tagRes = await fetch(tagUrl, {
      headers: { "Zotero-API-Key": apiKey, "Zotero-API-Version": "3" },
    });
    if (!tagRes.ok) break;
    const tagBatch = (await tagRes.json()) as Array<{
      key: string;
      data: { tags?: Array<{ tag: string }>; title?: string };
    }>;
    if (!Array.isArray(tagBatch) || tagBatch.length === 0) break;
    for (const t of tagBatch) {
      nativeItems.push({ key: t.key, title: t.data?.title ?? "" });
      if (t.data?.tags?.length) {
        tagsMap[t.key] = t.data.tags.map((tag) => tag.tag).filter(Boolean);
      }
    }
    if (tagBatch.length < 100) break;
    tagStart += 100;
    if (tagStart > 5000) break;
  }

  // Keys present in the CSL JSON first pass (extracted from the id URI field)
  const cslKeys = new Set(
    (items as Array<{ id?: string }>)
      .map((z) => z.id?.split("/").pop())
      .filter(Boolean) as string[]
  );
  const droppedItems = nativeItems
    .filter(({ key }) => !cslKeys.has(key))
    .map(({ key, title }) => ({ key, title }));

  if (droppedItems.length > 0) {
    console.warn(
      `[ZoteroSync] ${droppedItems.length} item(s) present in native JSON but missing from CSL JSON:`,
      droppedItems.map((d) => `${d.key}: "${d.title}"`).join(", ")
    );
  }

  return Response.json({ items, pdfAttachments, notesMap, tagsMap, droppedItems });
}
