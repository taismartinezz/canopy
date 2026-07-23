// Zotero Web API v3 proxy — fetches collection list for a user library.
// Runs server-side to keep the API key out of browser network requests.

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { apiKey, zoteroUserId } = (await request.json()) as {
    apiKey?: string;
    zoteroUserId?: string;
  };

  if (!apiKey?.trim() || !zoteroUserId?.trim()) {
    return Response.json({ error: "apiKey and zoteroUserId are required" }, { status: 400 });
  }

  const url = `https://api.zotero.org/users/${zoteroUserId.trim()}/collections?limit=100`;
  const res = await fetch(url, {
    headers: {
      "Zotero-API-Key": apiKey.trim(),
      "Zotero-API-Version": "3",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return Response.json({ error: `Zotero API error ${res.status}: ${text}` }, { status: 502 });
  }

  const data = (await res.json()) as { key?: string; data?: { name?: string } }[];
  const collections = (Array.isArray(data) ? data : []).map((c) => ({
    key: c.key ?? "",
    name: c.data?.name ?? c.key ?? "Unnamed",
  })).filter((c) => c.key);

  return Response.json({ collections });
}
