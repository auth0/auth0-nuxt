# Testing

## Frameworks

- **Vitest 4** — the unit runner. Workspace config in `vitest.workspace.js` (`packages/*`).
- **`@nuxt/test-utils` + Playwright** — the e2e tier (`packages/auth0-nuxt/test/`), which boots a real Nuxt app fixture and drives a browser.
- **`nock`** — HTTP mocking for outbound calls to Auth0.
- **`happy-dom`** — DOM environment; **`@vue/test-utils`** for component-level checks.
- **Coverage:** `@vitest/coverage-v8`, produced by `test:ci` (`vitest --watch false --coverage`). No hard threshold is configured in the repo.

## Layout

- **Unit specs** live beside the source as `*.spec.ts` (e.g. `src/runtime/server/api/auth/login.get.spec.ts`, `src/runtime/server/utils/url.spec.ts`).
- **e2e** lives under `packages/auth0-nuxt/test/`, with app fixtures in `test/fixtures/`.

## Running

```bash
npm run test:unit -w @auth0/auth0-nuxt   # unit only — safe, no credentials
npm run test:e2e  -w @auth0/auth0-nuxt   # e2e — Ask First (see below)
npx vitest run packages/auth0-nuxt/src/runtime/server/utils/url.spec.ts   # a single file
```

The default `test:unit` suite is unit-only and requires no credentials.

## e2e / live tier (Ask First)

`test:e2e` starts a Nuxt fixture and exercises real login/logout flows through Playwright. CI supplies these secrets (see `.github/workflows/test.yml`); running it locally requires the same:

- `NUXT_AUTH0_DOMAIN`
- `NUXT_AUTH0_CLIENT_ID`
- `NUXT_AUTH0_CLIENT_SECRET`
- `NUXT_AUTH0_TEST_USERNAME`
- `NUXT_AUTH0_TEST_PASSWORD`

It is slower and authenticates against a live tenant — ask the maintainer before running it (see Boundaries → Ask First).

## Conventions (from existing specs)

- Structure with `describe` / `it`; `beforeEach(() => vi.clearAllMocks())`; assert with `expect(...)`.
- Mock `h3` helpers and the `useAuth0` composable with `vi.mock` + `vi.hoisted` for hoisted mock fns (see `login.get.spec.ts`).
- Assert on handler behavior via the mocked collaborators (e.g. `startInteractiveLogin` called with the sanitized `returnTo`, `sendRedirect` called with the resulting URL) rather than hitting the network.
