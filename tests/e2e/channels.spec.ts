import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@inventory-ags.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "changeme";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.click("button[type=submit]");
  await expect(page).toHaveURL("/");
}

test.describe("Settings → Channels (ADMIN only)", () => {
  test("admin can see Channels page with Shopify Connect form", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/settings/channels");
    await expect(page.getByRole("heading", { name: /^channels$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /shopify/i })).toBeVisible();
    // Either we already have a connection from prior tests, OR we should see Connect form.
    // Both are valid outcomes for this assertion.
    const connectBtn = page.getByRole("button", { name: /^connect shopify$/i });
    const disconnectBtn = page.getByRole("button", { name: /^disconnect$/i });
    await expect(connectBtn.or(disconnectBtn)).toBeVisible();
  });

  test("Connect button is disabled for invalid shop input", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/settings/channels");

    // Skip if already connected
    const disconnected = await page
      .getByRole("button", { name: /^connect shopify$/i })
      .count();
    test.skip(disconnected === 0, "Already connected; test not applicable.");

    const input = page.getByPlaceholder(/your-store\.myshopify\.com/i);
    const button = page.getByRole("button", { name: /^connect shopify$/i });

    await input.fill("evil.com");
    await expect(button).toBeDisabled();

    await input.fill("valid-shop.myshopify.com");
    await expect(button).toBeEnabled();
  });

  test("staff user is redirected from /settings/channels to /", async ({ page }) => {
    const staffEmail = `staff-ch-${Date.now()}@example.com`;
    const staffPassword = "staffPass123!";

    // Admin invites a STAFF
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/settings/users");
    await page.fill("input[name=name]", "Staff Channels Test");
    await page.fill("input[name=email]", staffEmail);
    await page.fill("input[name=password]", staffPassword);
    await page.selectOption("select[name=role]", "STAFF");
    await page.click("button:has-text('Invite user')");
    await expect(page.getByRole("cell", { name: staffEmail })).toBeVisible();
    await page.click("button:has-text('Sign out')");
    await expect(page).toHaveURL(/\/login/);

    // STAFF tries channels page
    await login(page, staffEmail, staffPassword);
    await page.goto("/settings/channels");
    await expect(page).toHaveURL("/");
  });
});
