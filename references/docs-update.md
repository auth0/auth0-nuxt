# Docs Update Rules

Treat docs as a first-class deliverable: a PR that changes public API, configuration, or integration patterns is not complete until the tracked docs are updated in the **same PR**.

## Tracked docs

| Doc | Covers | Status |
|-----|--------|--------|
| `README.md` (root) | Monorepo overview, package list, running the examples | present |
| `packages/auth0-nuxt/README.md` | Install, module registration, routes, login/logout, protecting routes, access tokens | present |
| `packages/auth0-nuxt/EXAMPLES.md` | Advanced config, mounted-route customization, stateful sessions, custom state/transaction identifiers, protecting routes, access tokens | present |
| `examples/example-nuxt-web` | Runnable Nuxt 3 demo app | present |
| `examples/example-nuxt-4-web` | Runnable Nuxt 4 demo app | present |

## When you change code, update these docs

This is a library/SDK — the public surface is `module.ts` (`ModuleOptions`) and `types.ts` (`Auth0ClientOptions`, `RouteConfig`, `SessionStore`) plus the mounted routes.

| When this changes | Update these docs |
|-------------------|-------------------|
| Public API surface (`ModuleOptions`, exported types/composables, `useAuth0`/`useUser` methods) | `packages/auth0-nuxt/README.md` (usage), `EXAMPLES.md` (affected samples), any `examples/` app that uses it |
| Configuration options (`runtimeConfig.auth0` schema, `NUXT_AUTH0_*` env vars, `Auth0ClientOptions`) | `packages/auth0-nuxt/README.md` (configuration), `EXAMPLES.md` |
| Authentication flow (login / callback / logout / back-channel logout / access-token retrieval) | `packages/auth0-nuxt/README.md` (getting started), `EXAMPLES.md` (auth examples) |
| Mounted routes added/removed/renamed or their defaults | `packages/auth0-nuxt/README.md` (Routes section), affected `examples/` apps |
| Install / package name / minimum Node version | `README.md` (root, running examples), `packages/auth0-nuxt/README.md` (installation) |
| A new public composable/method or exported type added | `EXAMPLES.md` (add a usage sample) |
| A public composable/method or exported type removed or renamed | `packages/auth0-nuxt/README.md` + `EXAMPLES.md` (remove/update references) |
| A new integration pattern supported (e.g. a new session-store shape) | `EXAMPLES.md` (add an integration example) |

When you touch code that maps to a doc above, update that doc in the same PR — do not defer.
