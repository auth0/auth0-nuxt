# Testing

## Tiers

| Tier | Where | Command | Needs |
|------|-------|---------|-------|
| Unit | `src/**/*.spec.ts`, co-located | `npm run test:unit -w @auth0/auth0-nuxt` | nothing (no network, no credentials) |
| E2E with fakes | `test/*.test.ts` + `test/fixtures/*` | `npx vitest run test/<file>` (from the package dir) | Node; some files need Playwright browsers |
| Live tenant | `test/rendering.test.ts` | part of `npm run test:e2e` | `NUXT_AUTH0_DOMAIN`, `NUXT_AUTH0_CLIENT_ID`, `NUXT_AUTH0_CLIENT_SECRET`, `NUXT_AUTH0_TEST_USERNAME`, `NUXT_AUTH0_TEST_PASSWORD` (CI passes them as secrets) |

Ask before running the live-tenant test. Without the variables it fails — expected locally; don't edit or mock it, run the other files instead.

## Config

- `vitest.config.ts` uses `defineVitestConfig` from `@nuxt/test-utils/config` with `environment: 'nuxt'`. It strips the `import` SSR resolve condition (a workaround for a Nuxt CJS/ESM interop issue, linked in the file) and defines `import.meta.dev` as `true` so dev-only warnings are covered.
- `test/global-setup.ts` writes `.nuxt/tsconfig.json` for `examples/example-nuxt-passkeys` on a fresh checkout, because Vite reads that example's tsconfig when the passkeys fixture builds it.
- Coverage: `@vitest/coverage-v8` via `test:ci`; no threshold is configured.

## Unit test conventions

- `describe` / `it` from `vitest`; mock with `vi.mock(...)` and `vi.hoisted(...)` for mocks used inside the factory.
- Handler specs mock `h3` (`sendRedirect`, `getQuery`, …) with `importOriginal` and mock `useAuth0`, then call the handler with a hand-built `H3Event` (`as unknown as H3Event`). See `src/runtime/server/api/auth/login.get.spec.ts`.
- Pure utilities are tested directly, e.g. `src/runtime/server/utils/url.spec.ts` for `toSafeRedirect`.
- Cover failure and attack paths, not only the happy path.

## E2E fixtures

`test/fixtures/*` are small Nuxt apps (`basic`, `ssr-user`, `ssr-user-global`, `cached-profile`, `unmounted-profile`, `passkeys`). Tests build one with `setup({ rootDir })` from `@nuxt/test-utils` and request it over HTTP; browser assertions use `createPage` (Playwright).

- `test/encryption.ts` encrypts a session the way the SDK does, to hand a test a valid session cookie.
- The `passkeys` fixture runs the app and server code of `examples/example-nuxt-passkeys` against the module **source** with a fake Auth0 (`fixtures/passkeys/fakes/`). Shared helpers are in `test/passkeys.shared.ts`.
- `NUXT_AUTH0_*` / `NUXT_PASSKEY_*` environment variables override `runtimeConfig` when the server starts. CI exports real tenant values, so fixtures that use a fake call `ignoreNuxtEnv()` (from `test/passkeys.shared.ts`) before `setup()`.
- `test/passkeys-docs.test.ts` keeps the passkeys docs true: the code in `EXAMPLES.md` must equal the example's code, and links must resolve. Changing the passkeys example or its docs means running it.
