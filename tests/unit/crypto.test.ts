import { describe, it, expect, beforeAll } from "vitest";
import { encryptToken, decryptToken } from "@/lib/crypto";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-encryption-do-not-use-in-prod-1234567890";
});

describe("crypto", () => {
  it("roundtrips a token", () => {
    const original = "shpat_1234567890abcdef";
    const encrypted = encryptToken(original);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(original);
  });

  it("encrypts differently each call (random IV)", () => {
    const original = "shpat_same_input";
    const a = encryptToken(original);
    const b = encryptToken(original);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(original);
    expect(decryptToken(b)).toBe(original);
  });

  it("rejects tampered ciphertext", () => {
    const original = "shpat_xyz";
    const encrypted = encryptToken(original);
    // Flip a byte in the middle of the ciphertext
    const buf = Buffer.from(encrypted, "base64");
    buf[buf.length - 2] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("handles unicode + long strings", () => {
    const original = "naïve-tokën-™-" + "x".repeat(2000);
    expect(decryptToken(encryptToken(original))).toBe(original);
  });
});
