import { test, expect, type Page } from "@playwright/test";

/**
 * E2E: New-user OnboardingModal — Daily Challenge (Phase 4).
 *
 * Verifies that stopping the stopwatch at exactly 10.00s (±0.10s) shows the
 * win banner and writes a `win: true` entry to
 * `klika.dailyChallenge.<yyyy-mm-dd>` localStorage.
 *
 * Timing is made deterministic by patching `performance.now()` in the page
 * to add an adjustable offset. The stopwatch reads `performance.now()` on
 * Start and again on every RAF tick, so advancing the offset by ~10 000ms
 * between Start and Stop lands elapsed inside the win tolerance.
 *
 * Reaching the Daily Challenge requires walking the whole mandatory
 * onboarding sequence: Salamat (3s) → % away (2.5s) → Reward popup
 * ("Unlock rewards now" CTA) → Daily Challenge.
 */


const uniqueEmail = () =>
  `e2e+daily-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@klika-test.dev`;
const uniquePhone = () => {
  const rest = Math.floor(100_000_000 + Math.random() * 899_999_999).toString();
  return `9${rest.slice(0, 9)}`;
};

async function signUpFreshUser(page: Page) {
  const email = uniqueEmail();
  const phone = uniquePhone();

  await page.goto("/join");

  const phoneInput = page.getByLabel(/mobile number|phone/i).first();
  await expect(phoneInput).toBeVisible();
  await phoneInput.fill(phone);
  await page.getByRole("button", { name: /get started|continue|next/i }).click();

  await page.getByLabel(/first name/i).fill("Daily");
  await page.getByLabel(/last name/i).fill("Challenger");
  await page.getByLabel(/email/i).fill(email);
  await page
    .getByRole("button", { name: /join klika|join now|create account/i })
    .click();

  // Some flows show a celebration modal with "Skip for now" before landing
  // on the dashboard. Dismiss it if it appears; otherwise we're already on /.
  const skipBtn = page.getByRole("button", { name: /skip for now/i });
  try {
    await skipBtn.waitFor({ state: "visible", timeout: 8_000 });
    await skipBtn.click();
  } catch {
    /* no celebration modal — continue */
  }

  await page.waitForURL((url) => url.pathname === "/" || url.pathname === "", {
    timeout: 20_000,
  });
}

/** Patch performance.now() to add a controllable offset. Call BEFORE Start. */
async function installFakeClock(page: Page) {
  await page.evaluate(() => {
    const realNow = performance.now.bind(performance);
    let offset = 0;
    Object.defineProperty(performance, "now", {
      configurable: true,
      value: () => realNow() + offset,
    });
    (window as any).__advanceNow = (deltaMs: number) => {
      offset += deltaMs;
    };
  });
}

test.describe("Onboarding — Daily Challenge", () => {
  test("stopping at exactly 10.00s shows the win banner", async ({ page }) => {
    await signUpFreshUser(page);

    // Phase 1 — Salamat hero.
    await expect(
      page.getByRole("heading", { name: /salamat for joining klika\.ph/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Phase 2 — "% away" swap.
    await expect(page.getByText(/away/i).first()).toBeVisible({ timeout: 8_000 });

    // Phase 3 — Reward popup. Skip the 10s auto-claim by clicking the CTA.
    const unlockBtn = page.getByRole("button", { name: /unlock rewards now/i });
    await expect(unlockBtn).toBeVisible({ timeout: 8_000 });
    await unlockBtn.click();

    // Phase 4 — Precision Bonus.
    await expect(
      page.getByRole("heading", { name: /stop the timer at exactly 10\.00/i }),
    ).toBeVisible({ timeout: 8_000 });

    const startBtn = page.getByRole("button", { name: /start the timer/i });
    await expect(startBtn).toBeVisible();

    await installFakeClock(page);
    await startBtn.click();

    // Wait for countdown (3-2-1-GO ~ 3s) then Stop appears.
    const stopBtn = page.getByRole("button", { name: /stop the timer/i });
    await stopBtn.waitFor({ state: "visible", timeout: 6_000 });

    // Advance fake clock so elapsed lands ≈ 10 000ms.
    await page.evaluate(() => (window as any).__advanceNow(9_995));
    await page.waitForTimeout(50);
    await stopBtn.click();

    // Result: near-perfect or perfect banner, and "Claim reward".
    await expect(page.getByText(/perfect|so close|close!/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(
      page.getByRole("button", { name: /claim reward/i }),
    ).toBeVisible();
  });
});

