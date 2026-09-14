# End-to-end tests

Playwright tests that drive the running app in a real browser.

## Setup

```bash
bun add -d @playwright/test          # already in devDependencies
bunx playwright install chromium     # one-time browser download
```

## Running

Make sure the dev server is up (default `http://localhost:8080`), then:

```bash
bunx playwright test
```

Override the base URL for a deployed environment:

```bash
BASE_URL=https://new-klika.lovable.app bunx playwright test
```

## Suites

- `join-skip-verify.spec.ts` — verifies the `/join` quick-signup flow lands
  the user on the dashboard after both "Skip for now" (celebration modal)
  and "Verify later" (magic-link sent screen).
- `quick-join.spec.ts` — hits `POST /api/quick-join` for each lead role
  (donor, fundraiser, beneficiary) and asserts success, already-exists, and
  validation-error branches.
