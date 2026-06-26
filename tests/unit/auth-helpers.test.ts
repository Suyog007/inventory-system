import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth-helpers";

describe("auth-helpers", () => {
  it("hashPassword produces a bcrypt hash (not the original)", async () => {
    const password = "mySecret123";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it("verifyPassword returns true for correct password", async () => {
    const password = "mySecret123";
    const hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  it("verifyPassword returns false for wrong password", async () => {
    const password = "mySecret123";
    const hash = await hashPassword(password);
    expect(await verifyPassword("wrongPassword", hash)).toBe(false);
  });
});
