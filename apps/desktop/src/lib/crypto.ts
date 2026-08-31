// TS mirror of `src-tauri/src/crypto.rs` — encrypted at-rest stub.
// Real impl: key in OS keychain via `tauri-plugin-stronghold`, file-level `age` or `SQLITE_HAS_CODEC PRAGMA key`.
// Fallback to plaintext when keychain unavailable (tests/jsdom).

export function isEncrypted(): boolean {
  // In Tauri, this would check via invoke("get_diagnostics"); in jsdom fallback to false.
  // Allow test injection via `MEMEX_ENCRYPTED` in globalThis for parity with Rust env var.
  try {
    const g = globalThis as unknown as Record<string, unknown>;
    if (g["MEMEX_ENCRYPTED"] === "1" || g["MEMEX_ENCRYPTED"] === "true") return true;
    if (typeof process !== "undefined" && process.env?.["MEMEX_ENCRYPTED"] === "1") return true;
  } catch {
    // ignore
  }
  return false;
}

export function encryptAtRest(plaintext: Uint8Array, key: Uint8Array): Uint8Array {
  if (key.length === 0) return plaintext.slice();
  const out = new Uint8Array(plaintext.length);
  for (let i = 0; i < plaintext.length; i++) out[i] = plaintext[i] ^ key[i % key.length];
  return out;
}

export function decryptAtRest(ciphertext: Uint8Array, key: Uint8Array): Uint8Array {
  return encryptAtRest(ciphertext, key);
}

export function encryptString(plaintext: string, keyString: string): Uint8Array {
  const enc = new TextEncoder();
  return encryptAtRest(enc.encode(plaintext), enc.encode(keyString));
}

export function decryptString(ciphertext: Uint8Array, keyString: string): string {
  const dec = new TextDecoder();
  return dec.decode(decryptAtRest(ciphertext, new TextEncoder().encode(keyString)));
}
