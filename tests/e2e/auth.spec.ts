import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@inventory-ags.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "changeme";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.click("button[type=submit]");
}

test.describe("Authentication", () => {
  test("redirects unauthenticated visit to / → /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin can log in, lands on dashboard", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    await login(page, ADMIN_EMAIL, "wrongpassword");
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("sign out returns to login", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL("/");
    await page.click("button:has-text('Sign out')");
    await expect(page).toHaveURL(/\/login/);
  });
});
