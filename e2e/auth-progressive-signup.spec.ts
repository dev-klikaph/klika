import { test, expect } from "@playwright/test";

const uniqueEmail = () =>
  `e2e+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@klika-test.dev`;

/**
 * End-to-end coverage for the /auth progressive create-account flow.
 *
 * Verifies that:
 *   - The Continue/Submit button is disabled until the current step is valid.
 *   - The Terms & Privacy footer is visible on every step (1, 2, 3).
 *   - The Terms/Privacy buttons open the in-app modal.
 *   - The form advances through the three steps and submits successfully,
 *     ending on the email-verification dialog.
 */
test.describe("/auth progressive signup", () => {
  test("Continue/Submit is disabled until each step is valid and form submits", async ({ page }) => {
    await page.goto("/auth?tab=signup", { waitUntil: "networkidle" });

    const footer = page.getByTestId("signup-legal-footer");
    const termsButton = footer.getByRole("button", { name: /terms/i });
    const privacyButton = footer.getByRole("button", { name: /privacy/i });
    const continueButton = page.getByRole("button", { name: "Continue", exact: true });
    const createButton = page.getByRole("button", { name: /create account/i });

    // Step 1: name
    await expect(page.getByText(/step 1 of 3/i)).toBeVisible();
    await expect(footer).toBeVisible();
    await expect(termsButton).toBeVisible();
    await expect(privacyButton).toBeVisible();
    await expect(continueButton).toBeDisabled();

    await page.locator("#firstName").fill("EtoE");
    await page.locator("#lastName").fill("Tester");
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Step 2: contact
    await expect(page.getByText(/step 2 of 3/i)).toBeVisible();
    await expect(footer).toBeVisible();
    await expect(continueButton).toBeDisabled();

    await page.locator("#signup-email").fill(uniqueEmail());
    await page.locator("#phone").fill("09171234567");
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Step 3: password
    await expect(page.getByText(/step 3 of 3/i)).toBeVisible();
    await expect(footer).toBeVisible();
    await expect(createButton).toBeDisabled();

    // Terms modal opens and closes
    await termsButton.click();
    await expect(page.getByRole("heading", { name: /terms of service/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: /terms of service/i })).not.toBeVisible();

    await page.locator("#signup-password").fill("Test1234!");
    await page.locator("#confirmPassword").fill("Test1234!");
    await expect(createButton).toBeEnabled();
    await createButton.click();

    // Successful submission shows the email verification dialog.
    await expect(page.getByRole("heading", { name: /verify your email/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
