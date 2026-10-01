// Client-side only. AES-256-GCM encryption for journal entry content.
// The raw key is fetched from /api/journal/key (derived server-side from JOURNAL_KEY_SECRET + userId).
// Content in Supabase is { enc: "aes-gcm-v1", ct: "<base64>", iv: "<base64>" }.
// Plaintext legacy entries (no enc field) are read as-is and re-encrypted on next save.

export interface EncryptedContent {
  enc: "aes-gcm-v1";
  ct: string; // base64 ciphertext
  iv: string; // base64 12-byte IV
}

export function isEncryptedContent(v: unknown): v is EncryptedContent {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as Record<string, unknown>).enc === "aes-gcm-v1"
  );
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}

function bytesToB64(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer)));
}

export async function importJournalKey(base64Key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    b64ToBytes(base64Key),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJournalContent(
  key: CryptoKey,
  data: unknown,
): Promise<EncryptedContent> {
  const iv: Uint8Array<ArrayBuffer> = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    enc: "aes-gcm-v1",
    ct: bytesToB64(ciphertext),
    iv: bytesToB64(iv),
  };
}

export async function decryptJournalContent(
  key: CryptoKey,
  enc: EncryptedContent,
): Promise<unknown> {
  const ct = b64ToBytes(enc.ct);
  const iv = b64ToBytes(enc.iv);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(plaintext));
}
