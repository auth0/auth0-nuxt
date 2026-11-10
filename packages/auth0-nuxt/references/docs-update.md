# Docs Update Rules

A PR that adds or changes public API, configuration, or integration patterns is **not complete** until the relevant docs are updated in the same PR.

## Tracked docs

| Doc | Covers | Exists |
|-----|--------|--------|
| `packages/auth0-nuxt/README.md` | Install, module registration and options, login/logout, protecting routes, SSR user, access tokens, passkeys intro | present |
| `packages/auth0-nuxt/EXAMPLES.md` | Recipes: configuration, mounted routes, stateful sessions, state/transaction identifiers, protecting routes, SSR user, access tokens, passkeys | present |
| `examples/` | Runnable sample apps (see their own READMEs) | present |
| `README.md` (repo root) | Monorepo overview and the list of examples | present |
| `docs/` | TypeDoc output from `src/module.ts` — generated, never hand-edit (`npm run docs`) | present |

## When you change code, update these docs

| When this changes | Update |
|-------------------|--------|
| Public API (exports of `src/module.ts` / `src/types.ts`, `useUser()`, `useAuth0()`) | `README.md`, `EXAMPLES.md` (all affected samples), `examples/` apps that use it, JSDoc (feeds `docs/`) |
| Module options or `runtimeConfig` keys | `README.md` (registration/configuration), `EXAMPLES.md` (configuration recipes) |
| Routes (login, callback, logout, backchannel-logout, profile) | `README.md`, `EXAMPLES.md` ("Configuring the mounted routes") |
| Authentication or session behavior (SSR user, hydration, protecting routes) | `README.md` and the matching `EXAMPLES.md` section |
| Session store contract | `EXAMPLES.md` — the stateful-session recipe appears twice ("Configuring Stateful Sessions" and "Stateful Sessions"); keep both consistent |
| Passkey flow | `README.md` (Passkeys), `EXAMPLES.md` (passkeys section), `examples/example-nuxt-passkeys`; `test/passkeys-docs.test.ts` fails if the code in `EXAMPLES.md` differs from the example |
| New integration pattern | `EXAMPLES.md` (add a recipe) |
| Example app list changes | root `README.md` |
