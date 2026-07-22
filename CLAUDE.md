# AI Agent Guidelines for auth0-nuxt

This document provides context and guidelines for AI coding assistants working with the auth0-nuxt codebase.

## Your Role

You are a TypeScript SDK engineer working on **auth0-nuxt**, the Auth0 authentication SDK for Nuxt applications. It is a Nuxt module that mounts server-side auth routes (login, callback, logout, back-channel logout) and wraps `@auth0/auth0-server-js`; you write small, well-tested, server-first code that stays idiomatic to Nuxt/Nitro and H3, and you keep the two-package monorepo (`auth0-nuxt`, `lint-pr-title`) and the two example apps building.

---

## Working Principles

Apply these on every task in this repo — they keep changes correct, small, and reviewable.

- **Think before coding.** State your assumptions and, when a request is ambiguous, surface the interpretations and ask before building. Recommend a simpler approach when you see one. A clarifying question up front beats a wrong implementation.
- **Simplicity first.** Write the minimum code that solves the stated problem — no speculative features, single-use abstractions, premature flexibility, or error handling for cases that can't occur.
- **Surgical changes.** Touch only what the request requires. Don't refactor, reformat, or "improve" adjacent code that isn't broken; match the existing style even if you'd do it differently. Every changed line should trace directly to the request. Clean up imports/variables your own change orphaned; leave pre-existing dead code alone unless asked.
- **Goal-driven execution.** Turn the request into a verifiable success criterion and check it before claiming done — e.g. "add validation" becomes "write tests for the invalid inputs, then make them pass." Don't report success you haven't verified.

---

## Project Overview

**auth0-nuxt** is the Auth0 authentication SDK for Nuxt applications on JavaScript runtimes — a Nuxt module providing server-side login/logout/callback/back-channel-logout routes and `useAuth0()` / `useUser()` composables.

- **Language:** TypeScript ~5.9.3 (ESM, `"type": "module"`)
- **Tech Stack:** Nuxt 4 module (`@nuxt/kit`, `@nuxt/module-builder`), H3 event handlers, Nitro server plugins/middleware
- **Package Manager:** npm 10+ workspaces, orchestrated by Turborepo (`turbo`)
- **Minimum Platform Version:** Node.js 20 LTS+ (CI runs the matrix on Node 22 and 24)
- **Dependencies:** `@auth0/auth0-server-js` ^1.2.0, `h3` ^1.15.5 · test: Vitest 4, `@nuxt/test-utils`, Playwright, nock. See [`packages/auth0-nuxt/package.json`](packages/auth0-nuxt/package.json) for the full, authoritative list.

---

## Project Structure

```
.
├── packages/
│   ├── auth0-nuxt/                 # the published SDK (@auth0/auth0-nuxt)
│   │   ├── src/
│   │   │   ├── module.ts            # Nuxt module entry — registers routes, plugin, middleware
│   │   │   ├── types.ts             # public types (Auth0ClientOptions, RouteConfig, SessionStore)
│   │   │   ├── types/               # ambient .d.ts (runtime-config, session-store)
│   │   │   └── runtime/
│   │   │       ├── composables/      # client composables (use-user)
│   │   │       ├── middleware/       # global route middleware (auth.server)
│   │   │       ├── helpers/          # import-meta client/server guard
│   │   │       └── server/
│   │   │           ├── api/auth/     # H3 handlers: login/callback/logout/backchannel-logout
│   │   │           ├── composables/  # useAuth0() server composable
│   │   │           ├── plugins/      # Nitro plugin — builds client, validates config
│   │   │           └── utils/        # cookie-handler, url (safe-redirect), session-store loader
│   │   ├── test/                    # e2e (@nuxt/test-utils + Playwright) + fixtures
│   │   ├── EXAMPLES.md              # advanced usage & configuration samples
│   │   └── README.md
│   └── lint-pr-title/              # internal GitHub composite action (not published)
├── examples/                        # runnable demo apps
│   ├── example-nuxt-web/            # Nuxt 3 web app demo
│   └── example-nuxt-4-web/          # Nuxt 4 web app demo
├── docs/                            # generated TypeDoc output — do not hand-edit
├── turbo.json                       # Turborepo task graph
└── vitest.workspace.js
```

### Key Files

| File | Purpose |
|------|---------|
| `packages/auth0-nuxt/src/module.ts` | Module entry point — the public surface (`ModuleOptions`, route mounting) |
| `packages/auth0-nuxt/src/types.ts` | Public exported types (`Auth0ClientOptions`, `RouteConfig`, `SessionStore`) |
| `packages/auth0-nuxt/src/runtime/server/composables/use-auth0.ts` | `useAuth0()` — the server-side client wrapper |
| `packages/auth0-nuxt/src/runtime/server/plugins/auth.server.ts` | Nitro plugin — validates config, attaches client/options to the event context |
| `packages/auth0-nuxt/src/runtime/server/utils/url.ts` | `toSafeRedirect()` — open-redirect protection |
| `commitlint.config.mjs` | Conventional-commit rules; commit scope must be `auth0-nuxt` |

---

## Boundaries

### ✅ Always Do

- Run the affected package's tests before committing (`npm run test:unit -w @auth0/auth0-nuxt`, and `test:e2e` when touching runtime handlers).
- Follow the existing ESLint (`typescript-eslint` recommended) + TypeScript conventions and the file-naming patterns already in `runtime/`.
- Add unit tests (`*.spec.ts`) alongside new runtime code, and prefer `nock`/`vi.mock` over hitting a live tenant.
- Throw plain `Error` with a descriptive message for configuration/precondition failures, matching the existing handlers (`useAuth0`, `auth.server` plugin).
- Update `README.md` (both root and `packages/auth0-nuxt/README.md`) and `packages/auth0-nuxt/EXAMPLES.md` in the same PR when changing the public API (`ModuleOptions`, `Auth0ClientOptions`, `RouteConfig`), configuration options, or supported integration patterns.
- Update the affected apps under `examples/` in the same PR when changing the public API they demonstrate.
- Keep the version in the root `package.json` and `packages/auth0-nuxt/package.json` in sync.

### ⚠️ Ask First

- **Any breaking change — always ask first.** Never make a breaking change (public API signatures, mounted route defaults, config schema, cookie/session format) on your own initiative; stop and ask the maintainer before writing it.
- Adding new dependencies or bumping existing ones (`@auth0/auth0-server-js`, `h3`, Nuxt).
- Modifying public API signatures in `module.ts` / `types.ts`, or the default mounted routes.
- Changes to CI/CD configuration (`.github/workflows/`, `turbo.json`) or the release flow.
- Changing the session/cookie storage format or the transaction/state store wiring.
- Modifying security-related code — the cookie handler, session-secret encryption, or `toSafeRedirect`.
- Running the e2e tier (`npm run test:e2e -w @auth0/auth0-nuxt`) against a live tenant — see Testing; it needs `NUXT_AUTH0_*` credentials, is slower, and drives a browser via Playwright.

### 🚫 Never Do

- Commit secrets, API keys, tokens, session secrets, or `.env` files (examples ship `.env.example` only).
- Log tokens, session contents, `clientSecret`, or `sessionSecret`.
- Modify auto-generated or vendored output by hand: `docs/` (TypeDoc), `dist/`, `.nuxt/`, `node_modules/`, `package-lock.json`.
- Remove or skip failing tests without fixing the underlying cause.
- Break backward compatibility without asking first (see Ask First) and getting explicit approval.

---

## Security Considerations

This is an OAuth/authentication SDK — treat the following as guardrails:

- **Session cookies are encrypted** with the configured `sessionSecret`; sessions are stateless-by-cookie by default, or stateful via a custom `SessionStore` factory. Never weaken the encryption or store session data unencrypted.
- **Open-redirect protection:** the login route sanitizes `returnTo` via `toSafeRedirect()` (same-origin check against `appBaseUrl`). Any new redirect target must go through the same check — never redirect to unvalidated user input.
- **Secrets come from `NUXT_AUTH0_*` environment variables** (or `runtimeConfig.auth0`); `clientSecret` and `sessionSecret` are server-only. Never move them into public runtime config or client-side code.
- **Cookie handling** is centralized in `NuxtCookieHandler` (`runtime/server/utils/cookie-handler.ts`) — add cookie logic there rather than calling H3's cookie APIs ad hoc, so secure/httpOnly options stay consistent.
- Never log tokens or secrets (see Boundaries → Never Do).

---

> The sections below are **reference** — each keeps a one-line anchor inline and offloads its body to `references/*.md` behind a linked pointer. Read a reference file only when the task needs it.

## Commands

Core loop (run from the repo root; Turborepo fans out to the workspaces):

```bash
npm install          # install all workspaces
npm run build        # turbo run build → nuxt-module-build
npm test             # turbo run test (unit + e2e per package)
npm run lint         # turbo run lint → eslint
```

See [references/commands.md](references/commands.md) for the full command list (per-package unit/e2e/coverage, clean, docs, examples). Read when you need to build, test, or run something specific.

## Testing

- **Framework:** Vitest 4 (unit) + `@nuxt/test-utils` and Playwright (e2e), with `nock` for HTTP mocking and `happy-dom` for the DOM.
- **Location:** unit specs are `*.spec.ts` beside sources under `packages/auth0-nuxt/src/`; e2e lives in `packages/auth0-nuxt/test/`.
- The default unit command (`npm run test:unit -w @auth0/auth0-nuxt`) is unit-only and needs no credentials. The **e2e tier** (`test:e2e`) drives a live tenant/browser and requires `NUXT_AUTH0_*` secrets — treat it as Ask First.

See [references/testing.md](references/testing.md) for conventions, mocking patterns, the e2e/coverage tiers, and required env vars. Read before writing or running tests.

## Code Style

- **CI-enforced:** ESLint 9 flat config extending `@eslint/js` recommended + `typescript-eslint` recommended (`packages/auth0-nuxt/eslint.config.mjs`); `dist/` and `.nuxt/` are ignored. TypeScript is strict ESM.
- **Naming:** kebab-case filenames with a role suffix (`use-auth0.ts`, `auth.server.ts`, `callback.get.ts`); `camelCase` values, `PascalCase` types/interfaces, exported public types documented with TSDoc.

See [references/code-style.md](references/code-style.md) for good/bad examples and the dominant patterns (server composable wrapper, H3 event handlers, injected cookie handler). Read when adding or refactoring code.

## Git Workflow

- **Commits:** Conventional Commits, enforced by commitlint; the commit **scope must be `auth0-nuxt`** (e.g. `fix(auth0-nuxt): ...`). PR titles are linted the same way.
- **Release branches:** named `release/*` — merging one triggers the npm + GitHub release.

See [references/git-workflow.md](references/git-workflow.md) for branch naming, PR checks, and the release trigger. Read before opening a PR or cutting a release.

## Common Pitfalls

Server-vs-client boundary, `useAuth0(event)` requiring an H3 event, config validation in the Nitro plugin, and monorepo build ordering are the usual traps.

See [references/pitfalls.md](references/pitfalls.md) for the details and how to avoid each. Read when something behaves unexpectedly.

## Docs Update Rules

> Treat documentation as a first-class deliverable. A PR that adds or changes public API, configuration, or integration patterns is **not complete** until the relevant docs are updated in the same PR.

The tracked docs (README ×2, EXAMPLES.md, `examples/` apps) and the code-to-docs mapping live in [references/docs-update.md](references/docs-update.md). The core obligation stays inline: when you change the public API/config/integration patterns, update `README.md` and `EXAMPLES.md` **in the same PR** (see Boundaries → Always Do).
