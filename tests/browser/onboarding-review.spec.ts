import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";

const internEmail = process.env.BROWSER_INTERN_EMAIL || "ui.intern.acceptance@example.com";
const reviewerEmail = process.env.BROWSER_REVIEWER_EMAIL || "ui.admin.acceptance@example.com";
const password = process.env.BROWSER_TEST_PASSWORD;

async function login(page: Page, email: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#login-email")).toBeEditable();
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password!);
  await expect(page.locator("#login-email")).toHaveValue(email);
  await page.getByRole("button", { name: /sign in/i }).click();
}

async function openOnboarding(page: Page) {
  await expect(page).toHaveURL(/\/portal/);
  await page.getByRole("button", { name: "Onboarding", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Onboarding", exact: true })).toBeVisible();
}

test("intern submits and reviewer approves a synthetic onboarding record", async ({ browser }) => {
  test.skip(!password, "Set BROWSER_TEST_PASSWORD for the local synthetic accounts.");
  const intern: BrowserContext = await browser.newContext();
  const reviewer: BrowserContext = await browser.newContext();
  const internPage = await intern.newPage();
  const reviewerPage = await reviewer.newPage();
  const marker = `Browser Acceptance ${Date.now()}`;

  try {
    await login(internPage, internEmail);
    await openOnboarding(internPage);

    const phone = internPage.getByText("Phone", { exact: true }).locator(".." ).getByRole("textbox");
    const city = internPage.getByText("City", { exact: true }).locator(".." ).getByRole("textbox");
    const institution = internPage.getByText("Institution", { exact: true }).locator(".." ).getByRole("textbox");
    const accountName = internPage.getByText("Account name", { exact: true }).locator(".." ).getByRole("textbox");
    const accountNumber = internPage.getByText(/Account number/).locator(".." ).getByRole("textbox");
    await phone.fill("08012345678");
    await city.fill("Synthetic City");
    await institution.fill(marker);
    await accountName.fill("Synthetic Account Holder");
    await accountNumber.fill("0123456789");
    await expect(phone).toHaveValue("08012345678");
    await expect(city).toHaveValue("Synthetic City");
    await expect(institution).toHaveValue(marker);

    const files = internPage.locator('input[type="file"]');
    await files.nth(0).setInputFiles(path.join(process.cwd(), "public/favicon.png"));
    await expect(internPage.getByText(/photograph uploaded/i)).toBeVisible();
    await files.nth(1).setInputFiles({
      name: "synthetic-acceptance-cv.doc",
      mimeType: "application/msword",
      buffer: Buffer.from(`Synthetic CV for ${marker}. No personal information.`),
    });
    await expect(internPage.getByText(/cv uploaded/i)).toBeVisible();

    const draftResponse = internPage.waitForResponse((response) => response.url().endsWith("/api/onboarding/me") && response.request().method() === "PUT");
    await internPage.getByRole("button", { name: /save draft/i }).click();
    const savedResponse = await draftResponse;
    expect(savedResponse.status()).toBe(200);
    expect((await savedResponse.json()).success).toBe(true);
    expect(savedResponse.request().postDataJSON()).toMatchObject({ phone: "08012345678", locationCity: "Synthetic City", institution: marker });
    await expect(internPage.getByText("Draft saved.", { exact: true })).toBeVisible();
    await internPage.reload({ waitUntil: "domcontentloaded" });
    await openOnboarding(internPage);
    await expect(institution).toHaveValue(marker);
    await expect(phone).toHaveValue("08012345678");
    await accountNumber.fill("0123456789");

    await internPage.getByLabel(/I accept the internship terms/i).check();
    await internPage.getByPlaceholder("Typed signature").fill("Synthetic Acceptance");
    await internPage.getByRole("button", { name: "Submit for review", exact: true }).click();
    await expect(internPage.getByText("Onboarding submitted for review.", { exact: true })).toBeVisible();
    await expect(internPage.getByText(/Onboarding: submitted/i)).toBeVisible();
    await internPage.reload({ waitUntil: "domcontentloaded" });
    await openOnboarding(internPage);
    await expect(internPage.getByText(/Onboarding: submitted/i)).toBeVisible();

    await login(reviewerPage, reviewerEmail);
    await expect(reviewerPage).toHaveURL(/\/admin/);
    await reviewerPage.getByRole("button", { name: "Onboarding", exact: true }).click();
    await expect(reviewerPage.getByRole("heading", { name: "Onboarding", exact: true }).last()).toBeVisible();
    const submittedRow = reviewerPage.getByRole("table").getByText("UI Intern", { exact: true });
    await expect(submittedRow).toBeVisible();
    await submittedRow.click();
    await expect(reviewerPage.getByRole("heading", { name: "Onboarding review", exact: true })).toBeVisible();
    await expect(reviewerPage.getByText(marker, { exact: true })).toBeVisible();
    await expect(reviewerPage.getByText(/Open photo:/i)).toBeVisible();
    await expect(reviewerPage.getByText(/Open cv:/i)).toBeVisible();

    const photoButton = reviewerPage.getByRole("button", { name: /Open photo:/i });
    const photoPopup = reviewerPage.waitForEvent("popup", { timeout: 8_000 });
    await photoButton.click();
    const photoPage = await photoPopup;
    await expect(photoPage).toHaveURL(/.+/);
    await photoPage.close();

    await reviewerPage.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(reviewerPage.getByText("Onboarding approved.", { exact: true })).toBeVisible();
    await reviewerPage.getByRole("button", { name: "Approved", exact: true }).click();
    await expect(reviewerPage.getByText("UI Intern", { exact: true })).toBeVisible();

    await internPage.reload({ waitUntil: "domcontentloaded" });
    await openOnboarding(internPage);
    await expect(internPage.getByText(/Onboarding: approved/i)).toBeVisible();
  } finally {
    await intern.close();
    await reviewer.close();
  }
});

test("reviewer reviews the submitted synthetic onboarding record", async ({ browser }) => {
  test.skip(!password, "Set BROWSER_TEST_PASSWORD for the local synthetic accounts.");
  const intern = await browser.newContext();
  const reviewer = await browser.newContext();
  const internPage = await intern.newPage();
  const reviewerPage = await reviewer.newPage();
  try {
    await login(reviewerPage, reviewerEmail);
    await expect(reviewerPage).toHaveURL(/\/admin/);
    await reviewerPage.getByRole("button", { name: "Onboarding", exact: true }).click();
    await expect(reviewerPage.getByRole("heading", { name: "Onboarding", exact: true }).last()).toBeVisible();
    const submittedRow = reviewerPage.getByRole("table").getByText("UI Intern", { exact: true });
    await expect(submittedRow).toBeVisible();
    await submittedRow.click();
    await expect(reviewerPage.getByText(/Status: submitted/i)).toBeVisible();
    await expect(reviewerPage.getByRole("button", { name: /Open photo:/i })).toBeVisible();
    await expect(reviewerPage.getByRole("button", { name: /Open cv:/i })).toBeVisible();
    const popup = reviewerPage.waitForEvent("popup", { timeout: 8_000 });
    await reviewerPage.getByRole("button", { name: /Open photo:/i }).click();
    const documentPage = await popup;
    await expect(documentPage).toHaveURL(/.+/);
    await documentPage.close();
    await reviewerPage.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(reviewerPage.getByText("Onboarding approved.", { exact: true })).toBeVisible();

    await login(internPage, internEmail);
    await openOnboarding(internPage);
    await expect(internPage.getByText(/Onboarding: approved/i)).toBeVisible();
  } finally {
    await intern.close();
    await reviewer.close();
  }
});
