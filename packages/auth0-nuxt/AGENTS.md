# AI Agent Guidelines for @auth0/auth0-nuxt

## Project Structure

```
packages/auth0-nuxt/
├── src/
│   ├── module.ts                      # defineNuxtModule: options, runtime config, registers handlers/plugin/middleware
│   ├── types.ts · types/*.d.ts        # Public types (RouteConfig, SessionStore, StoreOptions) + runtime-config/route-rules augmentation
│   └── runtime/                       # Ships into the user's Nuxt app — only active once module.ts registers it
│       ├── composables/use-user.ts    # useUser() (client + server)
│       ├── middleware/auth.server.ts  # Global route middleware `auth0` (SSR user)
│       ├── plugins/auth.client.ts     # Hydrates useUser() from the profile route
│       └── server/
│           ├── api/auth/              # login, callback, logout, backchannel-logout, profile handlers
│           ├── composables/           # use-auth0.ts (useAuth0(event)), passkey-errors.ts
│           ├── plugins/auth.server.ts # Nitro plugin: validates config, loads the session store, resolves SSR user
│           └── utils/                 # cookie-handler, url (toSafeRedirect), resolve-ssr-user, default session store
├── test/                              # Nuxt e2e tests (*.test.ts) + fixtures/ (small Nuxt apps built per test)
├── eslint.config.mjs · .prettierrc · vitest.config.ts
├── EXAMPLES.md · README.md            # User-facing docs
└── dist/                              # nuxt-module-build output (generated)
```

New runtime files are resolved through `createResolver` in `src/module.ts` (`addServerHandler`, `addPlugin`, `addImportsDir`, …) — they do nothing until registered there.

---

## Boundaries

### ✅ Always Do

- Run `npm run lint -w @auth0/auth0-nuxt` and `npm run test:unit -w @auth0/auth0-nuxt` before committing.
- Make surgical changes — touch only what the request requires; don't refactor or reformat adjacent code that isn't broken.
- Follow existing code style and naming (single quotes, `printWidth` 120, `arrowParens: always`, `trailingComma: es5`).
- Add unit tests for new functionality (co-located `*.spec.ts`), including failure and attack paths (missing/tampered tokens, open-redirect attempts), not only the happy path.
- Handle SDK errors with the classes the SDK already throws (re-exported by `runtime/server/composables/passkey-errors.ts` so `instanceof` works) — don't throw strings or swallow errors; await or explicitly handle every promise in handlers and middleware.
- Keep exported symbols explicitly typed with accurate JSDoc — TypeDoc generates `docs/` from `src/module.ts`.
- Update `README.md` and `EXAMPLES.md` in the same PR when changing the public API, configuration options, or supported integration patterns.
- Update the affected sample apps under `examples/` in the same PR when changing the public API they demonstrate.

### ⚠️ Ask First

- **Any breaking change — always ask first.** Never break backward compatibility on your own initiative. Public API is: exports of `src/module.ts` / `src/types.ts`, `ModuleOptions`, the default routes (`/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/backchannel-logout`, `/auth/profile`), the `runtimeConfig.auth0` keys, and the `useUser()` / `useAuth0()` surfaces.
- Modifying public API signatures.
- Adding or bumping dependencies (`package.json` is the source of truth for what is used).
- Modifying security-related code: redirect validation (`utils/url.ts`), cookie handling (`utils/cookie-handler.ts`), backchannel logout, session-store wiring, or the cache rule for the profile route in `module.ts`.
- Changes to CI (`.github/workflows`, `.github/actions`), `.shiprc`, or `commitlint.config.mjs`.
- Running `test/rendering.test.ts` (and therefore the full `test:e2e`): it signs in against a real Auth0 tenant.

### 🚫 Never Do

- Commit secrets, `.env` files, tokens, or tenant credentials (`NUXT_AUTH0_*`).
- Log or expose session/client secrets, tokens, or authorization codes, or place them in errors, responses, or `runtimeConfig.public`.
- Hand-edit generated or build output: `dist/`, `docs/` (TypeDoc — regenerate with `npm run docs` from the repo root), `.nuxt/`, `.output/`.
- Commit `package-lock.json` (the repo deliberately has none, to support private registries — #42) or the generated `.nuxtrc`.
- Hand-edit versions (`.version`, the `package.json` `version` fields) or `CHANGELOG.md` — releases are cut by the release tooling (`.shiprc`).
- Remove or skip failing tests without fixing them, or "fix" `rendering.test.ts` by mocking it.
- Redirect to a user-controlled `returnTo` without `toSafeRedirect`, override cookie security attributes, or serve `/auth/profile` from Nitro's cache.

---

## Security Considerations

This is a published authentication SDK; review your own changes with an attacker's mindset.

- **Secrets:** the session secret, client secret and tokens live in private `runtimeConfig.auth0`; `runtimeConfig.public` is sent to the browser and carries only non-secret settings (routes, flags).
- **Redirects:** `returnTo` goes through `toSafeRedirect(url, appBaseUrl)` in both `login` and `callback`; it returns `undefined` unless the target is same-origin with `appBaseUrl`, and `callback` then falls back to `appBaseUrl`.
- **Cookies:** session and transaction cookies are written by the `@auth0/auth0-server-js` stores through `NuxtCookieHandler`, which forwards the options to h3 unchanged. Never override or drop `httpOnly`/`secure`/`sameSite`; `maxAge` is in seconds.
- **PKCE:** the login redirect carries an S256 `code_challenge`; the code verifier lives in the transaction cookie that `callback` needs. The authorization request carries no `state`/`nonce` — don't assume they exist.
- **Backchannel logout:** `handleBackchannelLogout` verifies the logout token before the store deletes any session; failures answer 400.
- **Profile route:** `/auth/profile` answers `Cache-Control: no-store` + `Vary: Cookie`, and `module.ts` sets `cache: false` on its route rule (outside the `mountRoutes` guard) because Nitro's cache ignores cookies and would serve one user's claims to another. The handler has no try/catch on purpose: a session-read failure must 500, not look signed out.
- **Server-only code:** `runtime/server/**` and `useAuth0` must stay out of the client bundle (see the comment in `runtime/server/plugins/auth.server.ts` about `getRouteRules`).
- **Passkey routes:** the module does not mount them; `examples/example-nuxt-passkeys` shows the Origin check, rate limit and `no-store` the app must add — keep that example secure when editing it.

---

> The sections below are **reference** — each keeps a one-line anchor here and offloads its body to `references/*.md`, read on demand.

## Commands

Core commands (`-w @auth0/auth0-nuxt` from the repo root, or drop it inside this directory):

```bash
npm run build -w @auth0/auth0-nuxt      # nuxt-module-build (prebuild runs `nuxt-module-build prepare`)
npm run lint -w @auth0/auth0-nuxt       # eslint "./**/*.ts*"
npm run test:unit -w @auth0/auth0-nuxt  # vitest run ./src/** — unit tier
npm run test:ci -w @auth0/auth0-nuxt    # what CI runs: vitest with coverage
```

See [references/commands.md](references/commands.md) for the e2e tier, single-file runs, docs, and clean. Read when you need to run, build, or test something specific.

## Testing

- **Framework:** Vitest 4 with `@nuxt/test-utils` (`environment: 'nuxt'`), coverage via `@vitest/coverage-v8` (no threshold configured).
- **Location:** unit tests co-located as `src/**/*.spec.ts`; e2e tests in `test/*.test.ts` against `test/fixtures/*`.
- The default `test:unit` suite is unit-only — no credentials required. `test/rendering.test.ts` is a live-tenant test (see Boundaries).

See [references/testing.md](references/testing.md) for the tiers, fixtures and fakes, mocking patterns, and prerequisites. Read when writing or debugging tests.

## Code Style

- **CI-enforced:** ESLint flat config = `@eslint/js` recommended + `typescript-eslint` recommended (`npm run lint` fails CI). `.prettierrc` sets single quotes, `printWidth` 120, `arrowParens: always`, `trailingComma: es5` — Prettier has no script or dependency here, so match it by hand.
- **Dominant convention:** h3 handlers as `export default defineEventHandler(...)`, one per file under `server/api/auth/`; extensionless relative imports and `~/src/types` for shared types; JSDoc on exports; avoid `any`, unchecked `as` and `!` in `src/` (prefer `unknown` + narrowing).

See [references/code-style.md](references/code-style.md) for real good/bad examples. Read when writing non-trivial new code.

## Common Pitfalls

See [references/pitfalls.md](references/pitfalls.md) for build, tooling and test gotchas (the `.nuxt` prerequisite, stale `build:watch`, generated `.nuxtrc`, examples consuming `dist/`, `NUXT_*` env overrides). Read when a build or test fails unexpectedly.

## Docs Update Rules

> A PR that adds or changes public API, configuration, or integration patterns is **not complete** until the relevant docs are updated in the same PR.

See [references/docs-update.md](references/docs-update.md) for the tracked-docs inventory and the code-to-docs mapping. The "update README.md / EXAMPLES.md in the same PR" rule is in Boundaries → Always Do.
