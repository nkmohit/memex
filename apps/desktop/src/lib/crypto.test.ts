import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptAtRest, decryptAtRest, encryptString, decryptString, isEncrypted } from "./crypto";

describe("crypto at-rest (TS mirror of crypto.rs)", () => {
  it("round-trips XOR", () => {
    const key = new TextEncoder().encode("test-key-123");
    const pt = new TextEncoder().encode("hello memex database content");
    const enc = encryptAtRest(pt, key);
    expect(Array.from(enc)).not.toEqual(Array.from(pt));
    const dec = decryptAtRest(enc, key);
    expect(Array.from(dec)).toEqual(Array.from(pt));
  });

  it("empty key is noop", () => {
    const data = new TextEncoder().encode("hello");
    expect(Array.from(encryptAtRest(data, new Uint8Array()))).toEqual(Array.from(data));
  });

  it("empty data round-trips", () => {
    const key = new TextEncoder().encode("key");
    expect(Array.from(encryptAtRest(new Uint8Array(), key))).toEqual(Array.from(new Uint8Array()));
  });

  it("string helpers round-trip", () => {
    const enc = encryptString("secret message", "my-key");
    const dec = decryptString(enc, "my-key");
    expect(dec).toBe("secret message");
  });

  it("wrong key does not decrypt", () => {
    const pt = new TextEncoder().encode("secret");
    const enc = encryptAtRest(pt, new TextEncoder().encode("key1"));
    const dec = decryptAtRest(enc, new TextEncoder().encode("key2"));
    expect(Array.from(dec)).not.toEqual(Array.from(pt));
  });

  it("isEncrypted respects injection", () => {
    const g = globalThis as unknown as Record<string, unknown>;
    const prev = g["MEMEX_ENCRYPTED"];
    g["MEMEX_ENCRYPTED"] = "1";
    expect(isEncrypted()).toBe(true);
    g["MEMEX_ENCRYPTED"] = "0";
    expect(isEncrypted()).toBe(false);
    delete g["MEMEX_ENCRYPTED"];
    expect(isEncrypted()).toBe(false);
    if (prev !== undefined) g["MEMEX_ENCRYPTED"] = prev;
  });
});

describe("diagnostics encrypted flag wiring", () => {
  beforeEach(() => {
    const g = globalThis as unknown as Record<string, unknown>;
    delete g["MEMEX_ENCRYPTED"];
  });
  afterEach(() => {
    const g = globalThis as unknown as Record<string, unknown>;
    delete g["MEMEX_ENCRYPTED"];
  });

  it("isEncrypted defaults false (plaintext fallback)", () => {
    expect(isEncrypted()).toBe(false);
  });
});
