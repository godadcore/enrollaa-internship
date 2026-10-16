import { test, expect } from "@playwright/test";

const internEmail = process.env.BROWSER_INTERN_EMAIL;
const reviewerEmail = process.env.BROWSER_REVIEWER_EMAIL;
const password = process.env.BROWSER_TEST_PASSWORD;

test.beforeEach(async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /internship management workspace/i })).toBeVisible();
  await expect(page.locator("#login-email")).toBeEditable();
});

test("login rejects invalid credentials", async ({ page }) => {
  await page.locator("#login-email").fill("invalid@example.com");
  await page.locator("#login-password").fill("invalid-password");
  await expect(page.locator("#login-email")).toHaveValue("invalid@example.com");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/invalid email or password|invalid credentials|unable to sign in|incorrect/i)).toBeVisible();
});

test("login page remains usable at supported viewport widths", async ({ page }) => {
  for (const width of [320, 360, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByLabel("Registered Email Address")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("synthetic intern can sign in and see the onboarding entry point", async ({ page }) => {
  test.skip(!internEmail || !password, "Set BROWSER_INTERN_EMAIL and BROWSER_TEST_PASSWORD for the local account.");
  await page.locator("#login-email").fill(internEmail!);
  await page.locator("#login-password").fill(password!);
  await expect(page.locator("#login-email")).toHaveValue(internEmail!);
  await expect(page.locator("#login-password")).toHaveValue(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/portal/);
  await expect(page.getByText(/onboarding/i).first()).toBeVisible();
});

test("reviewer account reaches the admin review surface", async ({ page }) => {
  test.skip(!reviewerEmail || !password, "Set BROWSER_REVIEWER_EMAIL and BROWSER_TEST_PASSWORD for the local account.");
  await page.locator("#login-email").fill(reviewerEmail!);
  await page.locator("#login-password").fill(password!);
  await expect(page.locator("#login-email")).toHaveValue(reviewerEmail!);
  await expect(page.locator("#login-password")).toHaveValue(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByText(/onboarding/i).first()).toBeVisible();
});
