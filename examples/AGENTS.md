# AGENTS.md: examples

The [root AGENTS.md](../AGENTS.md) rules also apply. Each directory is a standalone, **private** Nuxt app that people
copy from, so it must model secure, idiomatic usage of `@auth0/auth0-nuxt`.

| Example | Nuxt | Demonstrates |
|---|---|---|
| `example-nuxt-web` | 3 | Login/logout, `useUser()`, route middleware, server middleware, custom session store |
| `example-nuxt-4-web` | 4 | Same as above on Nuxt 4 |
| `example-nuxt-passkeys` | 4 | Passkey login and signup (`app/` directory layout, server API routes, rate limiting) |

## Rules

- Depend on the package as `"@auth0/auth0-nuxt": "*"`; npm workspaces link it to `packages/auth0-nuxt`. The package
  must be **built** first (`npm run build` at the repo root), because the examples consume `dist/`.
- Never hardcode secrets. Configuration comes from environment variables (`NUXT_AUTH0_DOMAIN`,
  `NUXT_AUTH0_CLIENT_ID`, `NUXT_AUTH0_CLIENT_SECRET`, `NUXT_AUTH0_SESSION_SECRET`, `NUXT_AUTH0_APP_BASE_URL`) and
  documented in the example's `.env.example`. Keep `.env.example` in sync when you add a variable, and never commit
  `.env`.
- Keep the Nuxt 3 and Nuxt 4 examples equivalent in behavior; if you change one, check whether the other needs it.
  The two `*-web` examples use root-level `pages/` and `middleware/`; `example-nuxt-passkeys` uses the Nuxt 4 `app/`
  directory.
- Update the example's `README.md` when its setup or behavior changes, and the matching recipe in
  `packages/auth0-nuxt/EXAMPLES.md` when the pattern is shown there.
- `examples/example-nuxt-passkeys` is also built by package tests (`packages/auth0-nuxt/test/`); run the package e2e
  tests that reference it after changing it.

## Commands

```bash
npm run build                                  # root: package first, then every example
npx turbo run build --filter="{./examples/*}"  # what the Build Examples CI job runs
npm run dev -w example-nuxt-4-web              # run one example (needs a filled-in .env)
```
