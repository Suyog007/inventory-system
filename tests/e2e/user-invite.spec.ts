import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@inventory-ags.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "changeme";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.click("button[type=submit]");
}

test.describe("User invite flow (ADMIN only)", () => {
  test("admin invites a STAFF user; that user can log in but cannot access /settings/users", async ({ page }) => {
    const staffEmail = `staff-${Date.now()}@example.com`;
    const staffPassword = "staffPass123!";

    // 1. Log in as admin
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL("/");

    // 2. Go to /settings/users and invite
    await page.goto("/settings/users");
    await expect(page.getByRole("heading", { name: /users/i })).toBeVisible();

    await page.fill("input[name=name]", "Staff Test");
    await page.fill("input[name=email]", staffEmail);
    await page.fill("input[name=password]", staffPassword);
    await page.selectOption("select[name=role]", "STAFF");
    await page.click("button:has-text('Invite user')");

    // The user row should now appear in the table (use cell role to disambiguate
    // from the success message that also contains the email)
    await expect(page.getByRole("cell", { name: staffEmail })).toBeVisible();

    // 3. Sign out
    await page.click("button:has-text('Sign out')");
    await expect(page).toHaveURL(/\/login/);

    // 4. Log in as the new staff user
    await login(page, staffEmail, staffPassword);
    await expect(page).toHaveURL("/");

    // 5. STAFF tries /settings/users — middleware should redirect to /
    await page.goto("/settings/users");
    await expect(page).toHaveURL("/");
  });

  test("STAFF user does NOT see Admin links in sidebar", async ({ page }) => {
    // (Uses a fresh staff invite each run to keep tests independent)
    const staffEmail = `staff-nav-${Date.now()}@example.com`;
    const staffPassword = "staffPass123!";

    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL("/");
    await page.goto("/settings/users");
    await page.fill("input[name=name]", "Staff Nav");
    await page.fill("input[name=email]", staffEmail);
    await page.fill("input[name=password]", staffPassword);
    await page.selectOption("select[name=role]", "STAFF");
    await page.click("button:has-text('Invite user')");
    await expect(page.getByRole("cell", { name: staffEmail })).toBeVisible();
    await page.click("button:has-text('Sign out')");
    await expect(page).toHaveURL(/\/login/);

    await login(page, staffEmail, staffPassword);
    await expect(page).toHaveURL("/");
    // STAFF should NOT see Users or Channels in sidebar
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Channels" })).toHaveCount(0);
  });
});
