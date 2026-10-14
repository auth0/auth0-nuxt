# Commands

All commands run from the repo root unless noted. The repo is an npm-workspaces monorepo orchestrated by Turborepo; root scripts (`build`, `test`, `lint`, `clean`) fan out to every workspace via `turbo run <task>`.

## Root (all workspaces)

```bash
npm install          # install all workspaces
npm run build        # turbo run build
npm test             # turbo run test
npm run lint         # turbo run lint
npm run clean        # turbo run clean (removes dist/)
npm run docs         # generate TypeDoc into docs/
```

## Package: @auth0/auth0-nuxt

```bash
# Build (nuxt-module-build; prebuild runs `nuxt-module-build prepare`)
npm run build -w @auth0/auth0-nuxt
npm run build:watch -w @auth0/auth0-nuxt        # tsup --watch

# Tests
npm run test -w @auth0/auth0-nuxt               # unit + e2e
npm run test:unit -w @auth0/auth0-nuxt          # vitest run ./src/**   (safe, no creds)
npm run test:e2e -w @auth0/auth0-nuxt           # vitest run ./test/**  (Playwright; needs NUXT_AUTH0_* — Ask First)
npm run test:ci -w @auth0/auth0-nuxt            # vitest --watch false --coverage  (used in CI)

# Lint
npm run lint -w @auth0/auth0-nuxt               # eslint "./**/*.ts*"

# Clean
npm run clean -w @auth0/auth0-nuxt              # rm -rf ./dist
```

> `pretest` / `pretest:ci` run `npx playwright install` automatically before the test scripts.

## Examples

```bash
npx turbo run build --filter="{./examples/*}"   # build both example apps (as CI does)
```

## What CI runs

- **Build and Test** (`.github/workflows/test.yml`): `npm run build`, then `npm run test:ci -w @auth0/auth0-nuxt`, and a separate lint job (`npm run lint -w @auth0/auth0-nuxt`). Matrix: Node 22 and 24.
- **Build Examples** (`.github/workflows/build-examples.yml`): `npx turbo run build --filter="{./examples/*}"`. Matrix: Node 22 and 24.
- **Lint PR Title / Lint Commit Message**: commitlint-based checks.
- **sca_scan**: software-composition-analysis scan.
