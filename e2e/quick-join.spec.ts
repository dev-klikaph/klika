import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * End-to-end coverage for the quick join / quick sign-up API
 * (`POST /api/quick-join`) — the same endpoint that powers both `/join` and
 * the inline QuickJoinCard on `/auth`.
 *
 * For each "role" lead-source we verify three branches:
 *   1. success         → fresh email → 200 { ok: true, userId }
 *   2. already-exists  → repeat same email → 200 { ok: false, exists: true }
 *   3. validation      → bad payload → 400 { ok: false, error: "invalid_request" }
 *
 * Roles modelled here are the lead-source variants the UI can submit:
 *   - donor              (plain quick_link, no campaign / beneficiary)
 *   - fundraiser         (campaignSlug attached)
 *   - beneficiary lead   (beneficiarySlug attached)
 *
 * App roles (admin / moderator) are NEVER created via this endpoint — the
 * server only ever provisions a regular authenticated user, so they are
 * intentionally out of scope.
 */

const uniqueEmail = (tag: string) =>
  `e2e+${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@klika-test.dev`;
const uniquePhone = () => {
  const rest = Math.floor(100_000_000 + Math.random() * 899_999_999).toString();
  return `+639${rest.slice(0, 9)}`;
};
// 16+ chars, matches the server Zod schema (z.string().min(16).max(128)).
const password = () => `Tester-${Math.random().toString(36).slice(2)}-A1!`;

async function postJoin(request: APIRequestContext, body: Record<string, unknown>) {
  const res = await request.post("/api/quick-join", {
    data: body,
    headers: { "Content-Type": "application/json" },
    failOnStatusCode: false,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status(), json };
}

type RoleCase = {
  role: "donor" | "fundraiser" | "beneficiary";
  extra: Record<string, unknown>;
};

const roleCases: RoleCase[] = [
  { role: "donor", extra: { leadSource: "quick_link" } },
  { role: "fundraiser", extra: { leadSource: "qr_poster", campaignSlug: "help-juan" } },
  { role: "beneficiary", extra: { leadSource: "ngo_lead", beneficiarySlug: "klika-foundation" } },
];

function basePayload(email: string) {
  return {
    firstName: "Quick",
    lastName: "Joiner",
    email,
    phone: uniquePhone(),
    password: password(),
  };
}

test.describe("POST /api/quick-join", () => {
  for (const { role, extra } of roleCases) {
    test.describe(`role: ${role}`, () => {
      test("success — fresh email creates the account", async ({ request }) => {
        const email = uniqueEmail(role);
        const { status, json } = await postJoin(request, { ...basePayload(email), ...extra });

        expect(status, JSON.stringify(json)).toBe(200);
        expect(json).toMatchObject({ ok: true, exists: false });
        expect(typeof json.userId).toBe("string");
        expect(json.userId.length).toBeGreaterThan(0);
      });

      test("already-exists — second signup with same email returns exists:true", async ({
        request,
      }) => {
        const email = uniqueEmail(role);

        const first = await postJoin(request, { ...basePayload(email), ...extra });
        expect(first.status, JSON.stringify(first.json)).toBe(200);
        expect(first.json.ok).toBe(true);

        const second = await postJoin(request, { ...basePayload(email), ...extra });
        // Server returns 200 with { ok: false, exists: true } so the client
        // can transparently fall back to the magic-link flow.
        expect(second.status, JSON.stringify(second.json)).toBe(200);
        expect(second.json).toMatchObject({ ok: false, exists: true });
        expect(second.json.userId).toBeUndefined();
      });

      test("validation — malformed payload returns 400 invalid_request", async ({ request }) => {
        const email = uniqueEmail(role);
        const { status, json } = await postJoin(request, {
          ...basePayload(email),
          ...extra,
          email: "not-an-email",        // fails z.string().email()
          firstName: "A",                // fails min(2)
          phone: "abc",                  // fails phone regex
          password: "short",             // fails min(16)
        });

        expect(status).toBe(400);
        expect(json).toMatchObject({ ok: false, error: "invalid_request" });
        expect(typeof json.message).toBe("string");
      });
    });
  }

  test("validation — completely empty body is rejected", async ({ request }) => {
    const { status, json } = await postJoin(request, {});
    expect(status).toBe(400);
    expect(json).toMatchObject({ ok: false, error: "invalid_request" });
  });
});
