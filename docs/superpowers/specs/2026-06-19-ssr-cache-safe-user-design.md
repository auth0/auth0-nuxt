# Cache-safe SSR user hydration — Design

**Issue:** [auth0/auth0-nuxt#52](https://github.com/auth0/auth0-nuxt/issues/52) — Global SSR auth middleware has no cache-awareness or opt-out; bakes the user into the `__NUXT__` payload on every SSR route.

**Date:** 2026-06-19
**Status:** Approved design, pending implementation plan.

## Problem

The global `auth0` SSR route middleware (`runtime/middleware/auth.server.ts`) unconditionally calls `getUser()` and writes the result into `useUser()` (a `useState('auth0_user')`) on every SSR render. Nuxt serializes `useState` into the `__NUXT__` payload embedded in the SSR HTML.

When a consumer marks an SSR route publicly cacheable (`Cache-Control: public, s-maxage=…`) behind a shared cache / CDN that keys on path (not on the auth cookie), the authenticated payload is stored and served to other visitors: logged-in user A's identity claims are served to anonymous user B in the raw server HTML.

### Scope of what leaks

Only **user identity claims** (`UserClaims` from `getUser()` — `sub`, `email`, `name`, any custom/namespaced claims) are written to client state and serialized. **Access tokens, refresh tokens, and full session data are never written to client state** — they are exposed only through the server-only `useAuth0(event)` composable (which throws on the client) and live in the encrypted session cookie. This is therefore a **PII / identity-claim disclosure** issue, not a credential/token compromise. Severity scales with what claims the consumer's ID token carries.

### Why the framework's own signals don't catch it

`nuxt-auth-utils` (the ecosystem reference) guards its SSR session fetch on `nuxtApp.payload.isCached` / `prerenderedAt`. But in Nuxt/Nitro, those are driven by **Nitro response-cache route rules** (`cache` / `swr` / `isr`) and prerendering — see `nuxt/nuxt` `packages/nitro-server/src/runtime/handlers/renderer.ts` (`_PAYLOAD_EXTRACTION` keys on `routeOptions.isr || routeOptions.cache`) and `renderer/app.ts` (`prerenderedAt` set only during prerender). A bare `Cache-Control` **header** route rule is **not** consumed by Nitro's in-process cache — Nitro's route-rules handler just calls `setHeaders(event, routeRules.headers)` and stores nothing; the header is purely a directive forwarded to the downstream CDN. So `isCached` would **not** reliably fire in the reported header-only CDN setup, and a naive port of the ecosystem guard would still leak.

## Goals

1. Shared-cacheable SSR output stays anonymous (leak closed), **including the header-only CDN case**.
2. Logged-in UX intact on cacheable pages — the user is hydrated client-side after load.
3. Private / `no-store` SSR routes still server-render the user exactly as today.
4. `ssr: false` (CSR) routes also get the user hydrated.
5. No breaking changes; no required config edits for existing apps.

## Non-goals

- No `loadStrategy`-style config knob (the chosen scope is automatic behavior only; a knob can be added later if requested).
- No change to token/session handling — already server-side and safe.

## Architecture & data flow

The user reaches client state via one of two paths, chosen automatically per-route:

```
                         ┌─ route NOT shared-cacheable (private SSR) ─┐
  SSR middleware ────────┤                                            ├─► useUser() filled at render (gated)
  (auth.server.ts)       │                                            │
                         └─ route IS shared-cacheable ─► SKIP write ──┘   payload stays anonymous
                                                              │
                                                              ▼
  client plugin ─► if useUser() empty after hydration ─► GET <profile route> (no-store) ─► fills useUser()
  (auth.client.ts)                                                                         on the client only
```

- **Private / `no-store` SSR routes** → user rendered server-side (current behavior, now gated).
- **Shared-cacheable routes** → cached HTML is anonymous; logged-in user restored client-side after load.
- **`ssr: false` routes** → SSR never ran; client plugin hydrates.

### Cacheability predicate

A route is treated as shared-cacheable (→ skip SSR write) when route rules (read via the supported Nitro accessor `getRouteRules(event)`) satisfy **any** of:

- `routeRules.cache`, `routeRules.swr`, or `routeRules.isr` is set, **or**
- the `Cache-Control` **header** route rule contains `public` or `s-maxage` (case-insensitive regex).

**Fails closed:** if route rules are unavailable, treat as cacheable (skip the SSR write, let the client hydrate).

## Components

### New: `runtime/server/utils/is-shared-cacheable.ts`
Pure, unit-testable predicate.

```ts
export function isSharedCacheable(routeRules: NitroRouteRules | undefined): boolean {
  if (!routeRules) return true;                 // fail closed
  if (routeRules.cache || routeRules.swr || routeRules.isr) return true;
  const headers = routeRules.headers ?? {};
  let cacheControl = '';
  for (const key in headers) {
    if (key.toLowerCase() === 'cache-control') { cacheControl = headers[key] ?? ''; break; }
  }
  return /(^|[\s,])(public|s-maxage)(\b|=)/i.test(cacheControl);
}
```

### Changed: `runtime/middleware/auth.server.ts`
Add the guard before `getUser()`, using the supported `getRouteRules(event)` accessor and a one-time dev warning.

```ts
// inside the importMetaServer branch, before getUser():
const routeRules = getRouteRules(h3Event);
if (isSharedCacheable(routeRules)) {
  if (importMetaDev) warnOnce(h3Event.path);   // dev-only, deduped
  return;                                       // payload stays anonymous
}
const user = await auth0Client.getUser();
useUser().value = user;
```

The dev warning is gated on `importMetaDev` and deduped (per-path `Set`) so it fires once, not per render.

### New: `runtime/server/api/auth/profile.get.ts`
The `no-store` session endpoint the client hydrates from.

```ts
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store');
  const user = await useAuth0(event).getUser();
  return user ?? null;                          // 200 + (UserClaims | null)
});
```

Returns the bare `UserClaims | null` (same shape `useUser()` holds). Anonymous → 200 with `null` (no console-error noise; client sets user to undefined).

### New: `runtime/plugins/auth.client.ts`
Client hydration plugin.

```ts
export default defineNuxtPlugin(async (nuxtApp) => {
  const user = useUser();
  if (user.value) return;                       // SSR already filled it (private route)
  const { routes } = useRuntimeConfig().public.auth0;
  nuxtApp.hook('app:suspense:resolve', async () => {   // avoid hydration mismatch
    try {
      user.value = (await $fetch(routes.profile, {
        headers: { accept: 'application/json' },
        retry: false,
      })) ?? undefined;
    } catch {
      // stay anonymous on failure
    }
  });
});
```

### Changed: `module.ts`
- `defaultRoutes` gains `profile: '/auth/profile'`. Because `profile` is part of the `Required<RouteConfig>` merge already exposed at `runtimeConfig.public.auth0.routes` (`module.ts:71-79`), the client plugin can read `routes.profile` at runtime on both server and client — no extra wiring needed.
- Register the `routes.profile` GET server handler inside the existing `if (options?.mountRoutes !== false)` block.
- Register the client plugin via `addPlugin(resolver.resolve('./runtime/plugins/auth.client'))`.

### Changed: `types.ts`
`RouteConfig` gains an optional `profile?: string` field with doc comment and `@example '/auth/profile'`.

### Changed: `runtime/helpers/import-meta.ts`
Add `export const importMetaDev = import.meta.dev;` for test-mockability, consistent with the existing `importMetaServer` / `importMetaClient` pattern.

## Config / compatibility

- Only new public surface is the `profile` route, configured exactly like the other routes and mounted under the same `mountRoutes` guard.
- No new `ModuleOptions`. No `loadStrategy` knob.
- **No breaking changes**: existing apps get the new endpoint + safer behavior with zero config edits; private SSR routes render identically to today.

## Testing plan

| Test file | Covers |
|---|---|
| `is-shared-cacheable.spec.ts` (new) | `cache`/`swr`/`isr` → true; `Cache-Control: public` → true; `s-maxage=60` → true; `max-age=60` only → false; `no-store` → false; mixed-case header key → true; `undefined` rules → true (fail closed) |
| `auth.server.spec.ts` / `middleware.test.ts` (extend) | Guard skips `getUser`/write on cacheable route; still writes on private route; fail-closed on missing rules; dev warning fires once |
| `profile.get.spec.ts` (new) | Returns `UserClaims` when authed; `null` + 200 when anonymous; sets `Cache-Control: no-store` |
| `auth.client.spec.ts` (new) | No fetch when `useUser()` already set; fetches `routes.profile` + assigns when empty; swallows fetch failure |
| `module.spec.ts` (extend) | `profile` handler registered under `mountRoutes`; not registered when `mountRoutes:false`; client plugin registered |

## Docs

A "SSR caching & the authenticated user" section in `README.md` and `EXAMPLES.md`:
- The two hydration paths and that shared-cacheable SSR stays anonymous by design.
- The user hydrates client-side on cacheable / CSR pages.
- Explicit callout of the header-only CDN case (`Cache-Control: public, s-maxage`), since the framework's own cache signals don't catch it.

## Verification (manual, from the issue)

Behind a path-keyed caching proxy honouring `s-maxage` (not keyed on the auth cookie), inspecting **raw server HTML** (not `window.__NUXT__`):

1. Cacheable route, logged in → no `email`/`sub`/`auth0_user` in raw HTML; auth UI still shows logged-in after hydration.
2. Non-cacheable (`no-store`) authenticated route → user content present in raw HTML.
3. Anonymous incognito on cacheable route → clean logged-out UI, no errors.
4. Real A → anonymous-B sequence → B never sees A's claims in raw HTML.
