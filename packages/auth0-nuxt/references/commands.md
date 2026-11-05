# Commands

Run from the repo root with `-w @auth0/auth0-nuxt`, or from `packages/auth0-nuxt` without it. These are the scripts in `package.json` and the steps CI runs (`.github/workflows/test.yml`).

```bash
# Build (prebuild runs `nuxt-module-build prepare`, which writes .nuxt/tsconfig.json)
npm run build -w @auth0/auth0-nuxt

# Lint (ESLint flat config) — CI runs this on Node 24
npm run lint -w @auth0/auth0-nuxt

# Unit tests (src/**/*.spec.ts) — no credentials, no browser
npm run test:unit -w @auth0/auth0-nuxt

# E2E tests (test/*.test.ts) — builds Nuxt fixtures; includes the live-tenant rendering.test.ts (ask first)
npm run test:e2e -w @auth0/auth0-nuxt

# Unit + e2e (`pretest` runs `npx playwright install` first)
npm test -w @auth0/auth0-nuxt

# What CI runs: vitest with coverage (`pretest:ci` installs the Playwright browsers)
npm run test:ci -w @auth0/auth0-nuxt

# Remove dist/
npm run clean -w @auth0/auth0-nuxt
```

From `packages/auth0-nuxt`, run a single file with vitest directly:

```bash
npx vitest run src/runtime/server/utils/url.spec.ts   # a unit test
npx vitest run test/ssr-user.test.ts                   # an e2e test that needs no tenant
```

From the **repo root**:

```bash
npm run build                                      # Turborepo: the package, then the examples (what CI runs)
npx turbo run build --filter="{./examples/*}"      # only the examples (the Build Examples CI job)
npm run docs                                       # regenerate docs/ with TypeDoc (entry point: src/module.ts)
```

There is no `typecheck` or `format` script. `build:watch` is stale — see [pitfalls.md](pitfalls.md).
