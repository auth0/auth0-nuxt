# Code Style

## Enforced tooling

- **ESLint 9** flat config (`packages/auth0-nuxt/eslint.config.mjs`): `@eslint/js` recommended + `typescript-eslint` recommended. `dist/*` and `.nuxt/*` are ignored. Run `npm run lint -w @auth0/auth0-nuxt`.
- **TypeScript ~5.9.3**, strict ESM (`"type": "module"`). Public types carry TSDoc comments.

## Naming

- **Files:** kebab-case with a role suffix — `use-auth0.ts`, `auth.server.ts`, `callback.get.ts`, `cookie-handler.ts`. Nuxt/Nitro conventions drive the suffixes (`.get`/`.post` for method-scoped H3 handlers, `.server` for server-only runtime files).
- **Values:** `camelCase`. **Types/interfaces:** `PascalCase` (`Auth0ClientOptions`, `RouteConfig`, `Auth0Client`).
- **Tests:** `<name>.spec.ts` beside the source.

## Good vs. bad

**✅ Good** — server composable wrapping the underlying client, guarding for a valid event, documented with TSDoc:

```ts
/**
 * Provides the Auth0 client in a Nuxt server context.
 * @param event The H3 event instance to use for the Auth0 client.
 * @throws Error if the event instance is not provided.
 */
export const useAuth0 = (event: H3Event) => {
  if (importMetaClient) {
    throw new Error('The `useAuth0` composable should only be used on the server.');
  }
  if (!event) {
    throw new Error('useAuth0() can not be called without passing an H3Event instance.');
  }
  // ... build/cache the client on the event context, return the Nuxt wrapper
};
```

**❌ Bad** — untyped, no server/event guard, reaches for cookies directly instead of the shared handler, swallows the misuse:

```ts
export const useAuth0 = (event) => {          // no H3Event type, no guard
  const value = event.node.req.headers.cookie; // bypasses NuxtCookieHandler
  return new ServerClient({ /* ... */ });       // rebuilds every call, no caching
};
```

## Dominant patterns

- **Server composable wrapper** — `useAuth0(event)` wraps `ServerClient<{ event }>` so callers don't thread the H3 event through every method (`toNuxtInstance`).
- **H3 event handlers** — each mounted route is a `defineEventHandler` in `runtime/server/api/auth/`.
- **Injected cookie handler** — all cookie access goes through `NuxtCookieHandler` (implements `CookieHandler` from `@auth0/auth0-server-js`), keeping secure/httpOnly options consistent.
- **Config validation at boot** — the Nitro plugin (`auth.server.ts`) throws descriptive `Error`s for missing config before any request is handled.
- **Safe redirects** — user-supplied `returnTo` always passes through `toSafeRedirect()`.
