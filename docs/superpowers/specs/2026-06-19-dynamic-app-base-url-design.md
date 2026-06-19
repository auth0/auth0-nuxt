# Dynamic Application Base URL — Design

**Date:** 2026-06-19
**Package:** `@auth0/auth0-nuxt`
**Reference:** [auth0-express PR #4](https://github.com/auth0/auth0-express/pull/4)

## Problem

Today `appBaseUrl` is a single static string, baked into the `ServerClient`'s
`redirect_uri` at construction. This forces a separate deployment per origin and
prevents serving multiple hostnames (multi-tenant, preview deployments) from one
Auth0 application.

This feature lets a single Nuxt app serve multiple origins by resolving the
application base URL **per request** instead of once at startup.

## Modes

`appBaseUrl` accepts three shapes, selecting a mode:

| `appBaseUrl` value | Mode | Behavior |
|---|---|---|
| `"https://app.example.com"` | **Static** | Used as-is. Current behavior, unchanged. |
| `["https://a.com", "https://b.com"]` or `"https://a.com, https://b.com"` | **Allow-list** | Request origin matched against the list; the matching configured entry is used. Recommended for production. |
| omitted / empty | **Dynamic** | Base URL inferred from the request host per request. |

Environment override remains `NUXT_AUTH0_APP_BASE_URL` (Nuxt runtime-config
convention). A comma-separated value is parsed into an allow-list array.

## Architecture

The Nuxt SDK differs from Express in three relevant ways, which shape the design:

1. **No `getConfig()`** — config comes from `runtimeConfig.auth0` and is validated
   at startup in the `auth.server.ts` nitro plugin. Parsing, validation, and
   secure-cookie enforcement live there (Nuxt's equivalent of Express's `getConfig`).
2. **`ServerClient` is created per-event** in `use-auth0.ts`, with `redirect_uri`
   baked from `appBaseUrl`. In dynamic/allow-list mode there is no static value to
   bake, so the login handler supplies `redirect_uri` per request.
3. **No Express `trust proxy fn`** — Nitro has no built-in trust policy. We honor
   `x-forwarded-host` / `x-forwarded-proto` by default via h3's request getters.
   Security rests on Auth0 Allowed Callback URLs and the allow-list mode, exactly
   as the Express PR documents.

### Components

#### `src/runtime/server/utils/app-base-url.ts` (new)

```ts
export function isUrl(value: string): boolean
//   new URL(value); protocol ∈ {http:, https:}

export function inferBaseUrlFromRequest(event: H3Event): string | null
//   host  = getRequestHost(event, { xForwardedHost: true })
//   proto = getRequestProtocol(event, { xForwardedProto: true })
//   const candidate = `${proto}://${host}`
//   return isUrl(candidate) ? candidate : null

export function resolveAppBaseUrl(
  appBaseUrl: string | string[] | undefined,
  event?: H3Event,
): string
```

`resolveAppBaseUrl` semantics (identical to the Express reference):

- `string` → returned as-is.
- no `event` → throw `InvalidConfigurationError`.
- infer origin from request; `null` → throw `InvalidConfigurationError`.
- `undefined` (pure dynamic) → return inferred origin.
- `string[]` (allow-list) → match inferred origin against each entry's
  `new URL(entry).origin`; return the **matching configured entry**, else throw
  `InvalidConfigurationError`.

h3's `getRequestHost`/`getRequestProtocol` fall back to the raw `Host` header when
the forwarded header is absent, so the no-proxy case works without configuration.

This lives alongside the existing `url.ts` (one clear purpose per file) rather than
being merged into it.

#### `src/runtime/server/plugins/auth.server.ts` (modified)

Startup validation gains three helpers (ported from Express `config.ts`):

- `parseAppBaseUrl(value)` — split comma-separated strings, trim, drop empties;
  collapse single-element results back to a string.
- `validateAppBaseUrl(appBaseUrl)` — allow `undefined`; reject empty arrays;
  reject any non-http(s) URL (naming the offending entry).
- `enforceSecureCookies(options)` — when `NODE_ENV === 'production'` **and** mode is
  dynamic/allow-list (`typeof appBaseUrl !== 'string'`): force
  `sessionConfiguration.cookie.secure = true`; throw `InvalidConfigurationError`
  if it was explicitly set to `false`.

The current hard check `if (!options.appBaseUrl) throw ...` is **removed** (dynamic
mode legitimately omits it). The other required-field checks (domain, clientId,
clientSecret, sessionSecret) stay.

#### `src/runtime/server/composables/use-auth0.ts` (modified)

`createServerClientInstance` bakes `redirect_uri` into the `ServerClient` **only when
`appBaseUrl` is a static string**. In dynamic/allow-list mode the baked `redirect_uri`
is omitted; the login handler always supplies it per request, and the callback builds
its URL from the resolved base. `getUser()` (global middleware, every page) and
backchannel logout construct the client too but never need `redirect_uri`, so omitting
it in dynamic mode is safe.

### Handlers

All three resolve the base URL from their own event.

**`login.get.ts`**
```ts
const appBaseUrl = resolveAppBaseUrl(auth0ClientOptions.appBaseUrl, event);
const callbackPath = runtimeConfig.public.auth0.routes?.callback ?? '/auth/callback';
const redirectUri = createRouteUrl(callbackPath, appBaseUrl);
const dangerousReturnTo = query.returnTo ?? appBaseUrl;
const sanitizedReturnTo = toSafeRedirect(dangerousReturnTo as string, appBaseUrl);
await auth0Client.startInteractiveLogin({
  appState: { returnTo: sanitizedReturnTo },
  authorizationParams: { redirect_uri: redirectUri.toString() },
});
```

**`callback.get.ts`** — resolve `appBaseUrl` from the event; use it for both
`completeInteractiveLogin(new URL(event.node.req.url, appBaseUrl))` and the fallback
redirect target.

**`logout.get.ts`** — `returnTo = resolveAppBaseUrl(auth0ClientOptions.appBaseUrl, event)`.

### Types

`Auth0ClientOptions.appBaseUrl: string` → `string | string[]` (optional). Updated
JSDoc describing the three modes. `InvalidConfigurationError` re-exported from the
module entry (`module.ts`), sourced from `@auth0/auth0-server-js`.

## Error handling

`InvalidConfigurationError` (from `@auth0/auth0-server-js`) is thrown when:

- a static `appBaseUrl` is not a valid http(s) URL (startup);
- an allow-list array is empty or contains an invalid URL (startup);
- `sessionConfiguration.cookie.secure` is explicitly `false` in production
  dynamic/allow-list mode (startup);
- at request time, the base URL cannot be resolved (no event, indeterminable
  origin, or no allow-list match).

## Testing

Vitest, following existing `.spec.ts` patterns.

- **`app-base-url.spec.ts`** (new) — `isUrl`; `inferBaseUrlFromRequest` with and
  without `x-forwarded-*`; `resolveAppBaseUrl` across static / dynamic / allow-list
  including allow-list miss → throw and missing-event → throw.
- **Plugin config tests** — comma-separated parsing, single-element collapse,
  trailing-comma collapse, empty-array reject, invalid-URL reject (names entry),
  omitted → dynamic, secure-cookie enforcement (force `true` in prod dynamic and
  allow-list; throw on explicit `false`; untouched for static and non-prod).
- **Handler spec updates** — `login.get.spec.ts` asserts `redirect_uri` passed in
  `authorizationParams`; `callback.get.spec.ts` / `logout.get.spec.ts` assert
  dynamic resolution; existing static-mode assertions updated to include the new
  `redirect_uri` argument.

## Example app

New `examples/example-nuxt-web-dynamic-app-base-url`, based on `example-nuxt-web`,
configured with an allow-list serving two hosts (`app1.localhost:3000` /
`app2.localhost:3000`) against one Auth0 application. README documents the
`/etc/hosts` setup and demonstrates that each request's origin resolves its own
callback and logout URLs.

## Docs

`README.md` and `EXAMPLES.md`: the three modes, the `NUXT_AUTH0_APP_BASE_URL`
comma-separated env form, the production secure-cookie requirement, and the
forwarded-header behavior.

## Out of scope

- A configurable `trustProxy` flag (forwarded headers are honored by default).
- Per-tenant client secrets / multiple Auth0 applications (one app, many origins).
