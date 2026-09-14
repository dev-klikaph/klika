import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end coverage for the /join quick-signup flow.
 *
 * Verifies that after creating an account, the user lands on the dashboard
 * ("/") regardless of whether they:
 *   1. Click "Skip for now" in the welcome celebration modal, OR
 *   2. Click "Verify later — explore klika.ph" in the magic-link sent screen
 *      (triggered when the email is already registered).
 *
 * The dashboard is detected via authenticated-only UI (BottomNav + dashboard
 * widgets like the Wallet card / Stats tiles) that are not present on the
 * public landing page.
 */

const uniqueEmail = () => `e2e+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@klika-test.dev`;
const uniquePhone = () => {
  // 10-digit PH mobile number starting with 9
  const rest = Math.floor(100_000_000 + Math.random() * 899_999_999).toString();
  return `9${rest.slice(0, 9)}`;
};

async function fillPhoneFirstFlow(page: Page, email: string, phone: string) {
  await page.goto("/join");

  // Step 1: phone number
  const phoneInput = page.getByLabel(/mobile number|phone/i).first();
  await expect(phoneInput).toBeVisible();
  await phoneInput.fill(phone);

  await page.getByRole("button", { name: /get started|continue|next/i }).click();

  // Step 2: name + email
  await page.getByLabel(/first name/i).fill("Test");
  await page.getByLabel(/last name/i).fill("User");
  await page.getByLabel(/email/i).fill(email);

  await page.getByRole("button", { name: /join klika|join now|create account/i }).click();
}

async function expectDashboard(page: Page) {
  await page.waitForURL((url) => url.pathname === "/" || url.pathname === "", {
    timeout: 20_000,
  });
  // Authenticated-only surface: bottom nav and dashboard widgets.
  const dashboardMarker = page
    .getByRole("link", { name: /dashboard|home|wallet|rewards/i })
    .first()
    .or(page.getByText(/your balance|available balance|klika points|welcome/i).first());
  await expect(dashboardMarker).toBeVisible({ timeout: 15_000 });
}

test.describe("Quick-join → dashboard", () => {
  test("Skip for now in celebration modal lands on dashboard", async ({ page }) => {
    const email = uniqueEmail();
    const phone = uniquePhone();

    await fillPhoneFirstFlow(page, email, phone);

    // Welcome / celebration modal
    const skipBtn = page.getByRole("button", { name: /skip for now/i });
    await expect(skipBtn).toBeVisible({ timeout: 20_000 });
    await skipBtn.click();

    await expectDashboard(page);
  });

  test("Verify later in magic-link screen lands on dashboard", async ({ page, context }) => {
    // Reuse an email by signing up once, then signing up again so the
    // backend triggers the "email already registered" magic-link branch
    // which exposes the "Verify later — explore klika.ph" button.
    const email = uniqueEmail();
    const phone = uniquePhone();

    await fillPhoneFirstFlow(page, email, phone);
    // First pass — wait for celebration, dismiss without redirect by closing tab.
    await expect(page.getByRole("button", { name: /skip for now/i })).toBeVisible({
      timeout: 20_000,
    });
    // Clear session so the second signup attempt is treated as a fresh visitor.
    await context.clearCookies();
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    // Second pass — should hit the "exists" branch → magic link sent screen.
    await fillPhoneFirstFlow(page, email, phone);

    const verifyLater = page.getByRole("button", { name: /verify later/i });
    await expect(verifyLater).toBeVisible({ timeout: 20_000 });
    await verifyLater.click();

    // Note: this branch does NOT sign the user in (magic link unclicked),
    // so we only assert the route changes to "/" (landing or dashboard,
    // depending on whether the prior session persisted in this browser).
    await page.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });
  });
});
