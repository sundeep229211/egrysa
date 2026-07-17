const encoder = new TextEncoder();

export function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function hmacSha256(key: string, value: string): Promise<string> {
  const imported = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", imported, encoder.encode(value)));
}

export async function importEd25519PrivateKey(base64Pkcs8: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "pkcs8",
    base64ToBytes(base64Pkcs8),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
}

export async function importEd25519PublicKey(base64Spki: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "spki",
    base64ToBytes(base64Spki),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
}

export async function ed25519Sign(key: CryptoKey, value: string): Promise<string> {
  return bytesToBase64(await crypto.subtle.sign("Ed25519", key, encoder.encode(value)));
}

export async function ed25519Verify(
  key: CryptoKey,
  signature: string,
  value: string,
): Promise<boolean> {
  return await crypto.subtle.verify(
    "Ed25519",
    key,
    base64ToBytes(signature),
    encoder.encode(value),
  );
}

export function bytesToBase64(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string): ArrayBuffer {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new Error("invalid base64 key material");
  }
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return buffer;
}

export function constantTimeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const size = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < size; i++) {
    diff |= (left[i % left.length] ?? 0) ^ (right[i % right.length] ?? 0);
  }
  return diff === 0;
}

export function randomToken(bytes = 12): string {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return [...value].map((b) => b.toString(16).padStart(2, "0")).join("");
}
