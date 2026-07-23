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

  return Response.json({ items });
}
