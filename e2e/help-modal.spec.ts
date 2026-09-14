import { test, expect, type Page } from "@playwright/test";

/**
 * UI regression coverage for the "Help now" donation modal on a campaign page:
 *   1. The modal is centered on screen at both mobile and desktop viewports.
 *   2. There is exactly ONE visible close (dismiss) control — the branded
 *      header X — so the previous "duplicate dismiss" bug does not return.
 *   3. Clicking that single close control actually dismisses the modal.
 *
 * We fetch a real campaign slug from the public API (RLS-permitted read) so
 * the test does not hardcode fixture state that could drift.
 */

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

async function getCampaignSlug(request: Page["request"]): Promise<string> {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ?? "https://raohoqkhvspgnbqlzerr.supabase.co";
  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhb2hvcWtodnNwZ25icWx6ZXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MjI5NDAsImV4cCI6MjA5MzA5ODk0MH0.7oooW8h6ETTVK83fICQ1iT2hqZC6GqUFtzFw0amh1qo";
  const res = await request.get(
    `${supabaseUrl}/rest/v1/campaigns?select=slug&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  expect(res.ok(), "campaigns fetch should succeed").toBeTruthy();
  const rows = (await res.json()) as Array<{ slug: string }>;
  expect(rows.length, "at least one campaign should exist").toBeGreaterThan(0);
  return rows[0].slug;
}

async function openHelpModal(page: Page, slug: string) {
  await page.goto(`/campaigns/${slug}`);
  // Two "Help now" buttons render (sticky footer + inline CTA). Either works
  // — pick the first visible one to avoid off-screen scroll on desktop.
  const helpButtons = page.getByRole("button", { name: /help now/i });
  const btn = helpButtons.first();
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await btn.click();

  const dialog = page.getByRole("dialog").filter({ hasText: /help now/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

for (const vp of VIEWPORTS) {
  test.describe(`Help modal — ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("is horizontally + vertically centered", async ({ page, request }) => {
      const slug = await getCampaignSlug(request);
      const dialog = await openHelpModal(page, slug);

      const box = await dialog.boundingBox();
      expect(box, "dialog should have a bounding box").not.toBeNull();
      if (!box) return;

      const dialogCenterX = box.x + box.width / 2;
      const dialogCenterY = box.y + box.height / 2;
      const vpCenterX = vp.width / 2;
      const vpCenterY = vp.height / 2;

      // Allow a generous tolerance (Radix uses translate; sub-pixel drift is fine).
      // The critical guard is: NOT bottom-anchored (previous mobile bottom-sheet bug).
      expect(Math.abs(dialogCenterX - vpCenterX)).toBeLessThan(12);
      expect(Math.abs(dialogCenterY - vpCenterY)).toBeLessThan(vp.height * 0.15);

      // Guard: modal must not touch the very bottom of the viewport (the
      // old bottom-sheet variant did — this asserts we are not regressing).
      expect(box.y + box.height).toBeLessThan(vp.height - 4);
      expect(box.y).toBeGreaterThan(4);
    });

    test("renders exactly one visible dismiss control", async ({ page, request }) => {
      const slug = await getCampaignSlug(request);
      const dialog = await openHelpModal(page, slug);

      // Any element labelled "Close" inside the dialog (branded header X and
      // — if the bug returns — Radix's auto-injected close button).
      const closers = dialog.getByRole("button", { name: /close/i });
      const visibleCount = await closers.evaluateAll(
        (nodes) =>
          nodes.filter((n) => {
            const el = n as HTMLElement;
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0
            );
          }).length,
      );
      expect(visibleCount, "exactly one visible dismiss button").toBe(1);
    });

    test("dismiss button actually closes the modal", async ({ page, request }) => {
      const slug = await getCampaignSlug(request);
      const dialog = await openHelpModal(page, slug);

      await dialog.getByRole("button", { name: /close/i }).click();
      await expect(dialog).toBeHidden();
    });
  });
}
