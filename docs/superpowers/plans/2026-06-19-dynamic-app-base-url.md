# Dynamic Application Base URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a single `@auth0/auth0-nuxt` app serve multiple origins by resolving the application base URL per request (static / allow-list / dynamic modes), mirroring auth0-express PR #4.

**Architecture:** A new request-time resolver (`app-base-url.ts`) infers the origin from the h3 event (honoring `x-forwarded-*`). Startup parsing/validation/secure-cookie enforcement live in the existing nitro plugin (`auth.server.ts`). Login supplies `redirect_uri` per request; callback/logout resolve from their own event; `use-auth0.ts` only bakes a static `redirect_uri`.

**Tech Stack:** TypeScript, Nuxt module + Nitro, h3, `@auth0/auth0-server-js`, Vitest.

**Working directory:** `packages/auth0-nuxt`. Run all `npm`/`vitest` commands from there. Branch: `feat/dynamic-app-base-url` (already created; the design spec is already committed).

---

## File Structure

- **Create** `packages/auth0-nuxt/src/runtime/server/utils/app-base-url.ts` — `isUrl`, `inferBaseUrlFromRequest`, `resolveAppBaseUrl`.
- **Create** `packages/auth0-nuxt/src/runtime/server/utils/app-base-url.spec.ts` — unit tests for the resolver.
- **Modify** `packages/auth0-nuxt/src/types.ts` — `appBaseUrl: string | string[]` (optional) + JSDoc.
- **Modify** `packages/auth0-nuxt/src/module.ts` — re-export `InvalidConfigurationError`.
- **Modify** `packages/auth0-nuxt/src/runtime/server/plugins/auth.server.ts` — parse/validate appBaseUrl, enforce secure cookies, drop the hard required-check.
- **Create** `packages/auth0-nuxt/src/runtime/server/plugins/auth.server.spec.ts` — config parsing/validation/secure-cookie tests.
- **Modify** `packages/auth0-nuxt/src/runtime/server/composables/use-auth0.ts` — only bake `redirect_uri` in static mode.
- **Modify** `packages/auth0-nuxt/src/runtime/server/api/auth/login.get.ts` (+ `.spec.ts`) — resolve base URL, pass `redirect_uri`.
- **Modify** `packages/auth0-nuxt/src/runtime/server/api/auth/callback.get.ts` (+ `.spec.ts`) — resolve base URL per request.
- **Modify** `packages/auth0-nuxt/src/runtime/server/api/auth/logout.get.ts` (+ `.spec.ts`) — resolve base URL per request.
- **Create** `examples/example-nuxt-web-dynamic-app-base-url/*` — multi-host example app.
- **Modify** `packages/auth0-nuxt/README.md` and `packages/auth0-nuxt/EXAMPLES.md` — document modes.

> **Note on `InvalidConfigurationError`:** it is imported from `@auth0/auth0-server-js`. Before Task 1, verify it is exported there:
> Run: `node -e "import('@auth0/auth0-server-js').then(m => console.log(typeof m.InvalidConfigurationError))"` from `packages/auth0-nuxt`.
> Expected: `function`. If it prints `undefined`, stop and report — the express PR depends on this export; the Nuxt port needs the same `@auth0/auth0-server-js` version. (Express used `^1.2.0`+; bump the dependency if needed.)

---

## Task 1: Base URL resolver utility

**Files:**
- Create: `packages/auth0-nuxt/src/runtime/server/utils/app-base-url.ts`
- Test: `packages/auth0-nuxt/src/runtime/server/utils/app-base-url.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/auth0-nuxt/src/runtime/server/utils/app-base-url.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { H3Event } from 'h3';
import { isUrl, inferBaseUrlFromRequest, resolveAppBaseUrl } from './app-base-url';

// Build a minimal event whose headers drive h3's getRequestHost/getRequestProtocol.
function makeEvent(headers: Record<string, string>): H3Event {
  return {
    node: {
      req: { headers, socket: {} },
    },
  } as unknown as H3Event;
}

describe('isUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isUrl('http://a.com')).toBe(true);
    expect(isUrl('https://a.com:3000')).toBe(true);
  });

  it('rejects non-http(s) and invalid values', () => {
    expect(isUrl('not-a-url')).toBe(false);
    expect(isUrl('ftp://a.com')).toBe(false);
    expect(isUrl('')).toBe(false);
  });
});

describe('inferBaseUrlFromRequest', () => {
  it('infers from host header', () => {
    const event = makeEvent({ host: 'app1.localhost:3000' });
    expect(inferBaseUrlFromRequest(event)).toBe('http://app1.localhost:3000');
  });

  it('prefers x-forwarded-host and x-forwarded-proto', () => {
    const event = makeEvent({
      host: 'internal:8080',
      'x-forwarded-host': 'app.example.com',
      'x-forwarded-proto': 'https',
    });
    expect(inferBaseUrlFromRequest(event)).toBe('https://app.example.com');
  });

  it('returns null when no host can be determined', () => {
    const event = makeEvent({});
    expect(inferBaseUrlFromRequest(event)).toBeNull();
  });
});

describe('resolveAppBaseUrl', () => {
  it('returns a static string as-is without an event', () => {
    expect(resolveAppBaseUrl('https://app.example.com')).toBe('https://app.example.com');
  });

  it('throws when dynamic and no event is provided', () => {
    expect(() => resolveAppBaseUrl(undefined)).toThrow();
  });

  it('infers the origin in dynamic mode', () => {
    const event = makeEvent({ host: 'app1.localhost:3000' });
    expect(resolveAppBaseUrl(undefined, event)).toBe('http://app1.localhost:3000');
  });

  it('returns the matching allow-list entry', () => {
    const event = makeEvent({ host: 'app2.localhost:3000' });
    const result = resolveAppBaseUrl(
      ['http://app1.localhost:3000', 'http://app2.localhost:3000'],
      event
    );
    expect(result).toBe('http://app2.localhost:3000');
  });

  it('throws when the request origin is not in the allow-list', () => {
    const event = makeEvent({ host: 'evil.localhost:3000' });
    expect(() =>
      resolveAppBaseUrl(['http://app1.localhost:3000'], event)
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/runtime/server/utils/app-base-url.spec.ts`
Expected: FAIL — cannot resolve `./app-base-url`.

- [ ] **Step 3: Write the implementation**

Create `packages/auth0-nuxt/src/runtime/server/utils/app-base-url.ts`:

```ts
import { getRequestHost, getRequestProtocol, type H3Event } from 'h3';
import { InvalidConfigurationError } from '@auth0/auth0-server-js';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Checks if a string is a valid HTTP or HTTPS URL.
 */
export function isUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return HTTP_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Infers the application base URL (origin) from the incoming request.
 *
 * Honors `x-forwarded-host` / `x-forwarded-proto` (set by proxies/CDNs),
 * falling back to the raw `Host` header and request protocol. Returns null
 * when a valid origin cannot be built.
 */
export function inferBaseUrlFromRequest(event: H3Event): string | null {
  const host = getRequestHost(event, { xForwardedHost: true });
  const proto = getRequestProtocol(event, { xForwardedProto: true });

  if (!host || !proto) {
    return null;
  }

  const candidate = `${proto}://${host}`;
  return isUrl(candidate) ? candidate : null;
}

/**
 * Resolves the application base URL for the current request.
 *
 * - `string`: used as-is (static configuration).
 * - `undefined`: inferred from the request host (dynamic mode).
 * - `string[]`: the request origin is matched against the allow-list; the
 *   matching configured entry is returned, otherwise an error is thrown.
 *
 * @throws {InvalidConfigurationError} When the base URL cannot be resolved.
 */
export function resolveAppBaseUrl(
  appBaseUrl: string | string[] | undefined,
  event?: H3Event
): string {
  if (typeof appBaseUrl === 'string') {
    return appBaseUrl;
  }

  if (!event) {
    throw new InvalidConfigurationError(
      'appBaseUrl is not configured as a static string, and a request context is not available.'
    );
  }

  const inferred = inferBaseUrlFromRequest(event);
  if (!inferred) {
    throw new InvalidConfigurationError(
      'appBaseUrl is not configured as a static string, and the request origin could not be determined from the request context.'
    );
  }

  if (!appBaseUrl) {
    // undefined → pure dynamic mode
    return inferred;
  }

  const requestOrigin = new URL(inferred).origin;
  const matchedEntry = appBaseUrl.find((allowedUrl) => {
    try {
      return new URL(allowedUrl).origin === requestOrigin;
    } catch {
      return false;
    }
  });

  if (matchedEntry !== undefined) {
    return matchedEntry;
  }

  throw new InvalidConfigurationError(
    'appBaseUrl is configured as an allow-list, but it does not contain a match for the current request origin.'
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/runtime/server/utils/app-base-url.spec.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add packages/auth0-nuxt/src/runtime/server/utils/app-base-url.ts packages/auth0-nuxt/src/runtime/server/utils/app-base-url.spec.ts
git commit -m "feat: add per-request app base url resolver"
```

---

## Task 2: Update types

**Files:**
- Modify: `packages/auth0-nuxt/src/types.ts:80-86`

- [ ] **Step 1: Change the `appBaseUrl` type and JSDoc**

In `packages/auth0-nuxt/src/types.ts`, replace the existing `appBaseUrl` block:

```ts
  /**
   * The base URL of your application.
   * This is the URL where your application is hosted.
   * It is used to construct redirect URIs for authentication flows.
   * @example 'http://localhost:3000'
   */
  appBaseUrl: string;
```

with:

```ts
  /**
   * The base URL of your application, used to construct redirect URIs for
   * authentication flows. Supports three modes:
   *
   * - A single URL string (static): `'https://app.example.com'`.
   * - An array of URLs (allow-list): the request origin is matched against the
   *   list. Recommended when serving multiple origins from one Auth0 app.
   * - Omitted (dynamic): the base URL is inferred from the incoming request
   *   host on each request.
   *
   * A comma-separated string (e.g. via `NUXT_AUTH0_APP_BASE_URL`) is parsed into
   * an allow-list array.
   * @example 'http://localhost:3000'
   */
  appBaseUrl?: string | string[];
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx vitest run src/runtime/server/utils/app-base-url.spec.ts`
Expected: PASS (no type regressions in the resolver, which already expects `string | string[] | undefined`).

- [ ] **Step 3: Commit**

```bash
git add packages/auth0-nuxt/src/types.ts
git commit -m "feat: allow appBaseUrl to be an array or omitted"
```

---

## Task 3: Re-export InvalidConfigurationError

**Files:**
- Modify: `packages/auth0-nuxt/src/module.ts:13-14`

- [ ] **Step 1: Add the re-export**

In `packages/auth0-nuxt/src/module.ts`, after the existing `export type { ... }` line (currently line 14), add:

```ts
export { InvalidConfigurationError } from '@auth0/auth0-server-js';
```

- [ ] **Step 2: Verify the module spec still passes**

Run: `npx vitest run src/module.spec.ts`
Expected: PASS (unchanged behavior).

- [ ] **Step 3: Commit**

```bash
git add packages/auth0-nuxt/src/module.ts
git commit -m "feat: re-export InvalidConfigurationError"
```

---

## Task 4: Config parsing, validation & secure-cookie enforcement (plugin)

**Files:**
- Modify: `packages/auth0-nuxt/src/runtime/server/plugins/auth.server.ts`
- Test: `packages/auth0-nuxt/src/runtime/server/plugins/auth.server.spec.ts`

This task extracts the parse/validate/enforce logic into exported pure functions so they can be unit-tested without a running Nitro app, then wires them into the plugin.

- [ ] **Step 1: Write the failing test**

Create `packages/auth0-nuxt/src/runtime/server/plugins/auth.server.spec.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { InvalidConfigurationError } from '@auth0/auth0-server-js';
import { parseAppBaseUrl, validateAppBaseUrl, enforceSecureCookies } from './auth.server';

describe('parseAppBaseUrl', () => {
  it('returns undefined for falsy input', () => {
    expect(parseAppBaseUrl(undefined)).toBeUndefined();
    expect(parseAppBaseUrl('')).toBeUndefined();
  });

  it('keeps a single URL as a string', () => {
    expect(parseAppBaseUrl('https://app.example.com')).toBe('https://app.example.com');
  });

  it('splits a comma-separated value into an array', () => {
    expect(parseAppBaseUrl('https://a.com, https://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('collapses a trailing-comma value to a string', () => {
    expect(parseAppBaseUrl('https://a.com,')).toBe('https://a.com');
  });
});

describe('validateAppBaseUrl', () => {
  it('allows undefined (dynamic mode)', () => {
    expect(() => validateAppBaseUrl(undefined)).not.toThrow();
  });

  it('throws on an invalid static URL', () => {
    expect(() => validateAppBaseUrl('not-a-url')).toThrow(InvalidConfigurationError);
  });

  it('throws on an empty array', () => {
    expect(() => validateAppBaseUrl([])).toThrow(InvalidConfigurationError);
  });

  it('throws when an array contains an invalid URL, naming the entry', () => {
    expect(() => validateAppBaseUrl(['https://a.com', 'nope'])).toThrow(/nope/);
  });

  it('passes for a valid array', () => {
    expect(() => validateAppBaseUrl(['https://a.com', 'https://b.com'])).not.toThrow();
  });
});

describe('enforceSecureCookies', () => {
  it('forces secure=true in production dynamic mode', () => {
    const options: any = { appBaseUrl: undefined };
    enforceSecureCookies(options, true);
    expect(options.sessionConfiguration.cookie.secure).toBe(true);
  });

  it('forces secure=true in production allow-list mode', () => {
    const options: any = { appBaseUrl: ['https://a.com'] };
    enforceSecureCookies(options, true);
    expect(options.sessionConfiguration.cookie.secure).toBe(true);
  });

  it('throws when secure is explicitly false in production dynamic mode', () => {
    const options: any = {
      appBaseUrl: undefined,
      sessionConfiguration: { cookie: { secure: false } },
    };
    expect(() => enforceSecureCookies(options, true)).toThrow(InvalidConfigurationError);
  });

  it('does not touch secure for a static appBaseUrl in production', () => {
    const options: any = { appBaseUrl: 'https://app.example.com' };
    enforceSecureCookies(options, true);
    expect(options.sessionConfiguration?.cookie?.secure).toBeUndefined();
  });

  it('does not touch secure outside production', () => {
    const options: any = { appBaseUrl: undefined };
    enforceSecureCookies(options, false);
    expect(options.sessionConfiguration?.cookie?.secure).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/runtime/server/plugins/auth.server.spec.ts`
Expected: FAIL — `parseAppBaseUrl`/`validateAppBaseUrl`/`enforceSecureCookies` not exported.

- [ ] **Step 3: Write the implementation**

Replace the contents of `packages/auth0-nuxt/src/runtime/server/plugins/auth.server.ts` with:

```ts
import { useRuntimeConfig } from '#imports';
import { ServerClient, InvalidConfigurationError, type SessionStore } from '@auth0/auth0-server-js';
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin';
import type { Auth0ClientOptions, StoreOptions } from '~/src/types';
import { isUrl } from '../utils/app-base-url';

declare module 'h3' {
  interface H3EventContext {
    auth0Client: ServerClient<{ event: H3Event }>;
  }
}

/**
 * Parses an appBaseUrl value coming from config or the environment.
 * A comma-separated string becomes an allow-list array; a single value
 * (or trailing-comma value) stays a string; falsy input becomes undefined.
 */
export function parseAppBaseUrl(value: string | undefined): string | string[] | undefined {
  if (!value) {
    return undefined;
  }
  if (value.includes(',')) {
    const entries = value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    return entries.length === 1 ? entries[0] : entries;
  }
  return value;
}

/**
 * Validates a (possibly parsed) appBaseUrl. `undefined` is valid (dynamic mode).
 * @throws {InvalidConfigurationError}
 */
export function validateAppBaseUrl(appBaseUrl: string | string[] | undefined): void {
  if (appBaseUrl === undefined) {
    return;
  }

  if (Array.isArray(appBaseUrl)) {
    if (appBaseUrl.length === 0) {
      throw new InvalidConfigurationError('appBaseUrl array configuration cannot be empty.');
    }
    const invalid = appBaseUrl.filter((url) => !isUrl(url));
    if (invalid.length > 0) {
      throw new InvalidConfigurationError(`appBaseUrl array contains invalid URLs: ${invalid.join(', ')}`);
    }
    return;
  }

  if (!isUrl(appBaseUrl)) {
    throw new InvalidConfigurationError(`appBaseUrl must be a valid http(s) URL: ${appBaseUrl}`);
  }
}

/**
 * In production dynamic/allow-list mode, secure session cookies are required.
 * Forces `sessionConfiguration.cookie.secure = true`, or throws if it was
 * explicitly set to `false`.
 * @throws {InvalidConfigurationError}
 */
export function enforceSecureCookies(options: Auth0ClientOptions, isProduction: boolean): void {
  const isDynamic = typeof options.appBaseUrl !== 'string';

  if (!isProduction || !isDynamic) {
    return;
  }

  if (options.sessionConfiguration?.cookie?.secure === false) {
    throw new InvalidConfigurationError(
      'Secure cookies are required when relying on dynamic base URLs in production. ' +
        'Remove the explicit `sessionConfiguration.cookie.secure = false` or set a static appBaseUrl.'
    );
  }

  options.sessionConfiguration = {
    ...options.sessionConfiguration,
    cookie: {
      ...options.sessionConfiguration?.cookie,
      secure: true,
    },
  };
}

async function tryLoadSessionStore(): Promise<SessionStore<StoreOptions> | undefined> {
  try {
    const factoryModule = await import('#auth0-session-store');
    return factoryModule.default();
  } catch {
    return undefined;
  }
}

export default defineNitroPlugin(async (nitroApp) => {
  const config = useRuntimeConfig();
  const options = config.auth0 as Auth0ClientOptions;

  if (!options.domain) throw new Error('Auth0 configuration error: Domain is required');
  if (!options.clientId) throw new Error('Auth0 configuration error: Client ID is required');
  if (!options.clientSecret) throw new Error('Auth0 configuration error: Client Secret is required');
  if (!options.sessionSecret) throw new Error('Auth0 configuration error: Session Secret is required');

  // Normalize a comma-separated appBaseUrl (from env or config) into an allow-list,
  // then validate and (in production dynamic mode) enforce secure cookies.
  if (typeof options.appBaseUrl === 'string') {
    options.appBaseUrl = parseAppBaseUrl(options.appBaseUrl);
  }
  validateAppBaseUrl(options.appBaseUrl);
  enforceSecureCookies(options, process.env.NODE_ENV === 'production');

  const sessionStoreInstance = await tryLoadSessionStore();

  nitroApp.hooks.hook('request', async (event) => {
    event.context.auth0ClientOptions = options;
    event.context.auth0SessionStore = sessionStoreInstance;
  });
});
```

> Note: the previous `if (!options.appBaseUrl) throw ...` check is intentionally removed — dynamic mode legitimately omits `appBaseUrl`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/runtime/server/plugins/auth.server.spec.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add packages/auth0-nuxt/src/runtime/server/plugins/auth.server.ts packages/auth0-nuxt/src/runtime/server/plugins/auth.server.spec.ts
git commit -m "feat: parse, validate and enforce secure cookies for appBaseUrl"
```

---

## Task 5: Only bake static redirect_uri in use-auth0

**Files:**
- Modify: `packages/auth0-nuxt/src/runtime/server/composables/use-auth0.ts:82-123`

- [ ] **Step 1: Update `createServerClientInstance`**

In `packages/auth0-nuxt/src/runtime/server/composables/use-auth0.ts`, replace the redirect-uri computation and the `authorizationParams` block. Replace:

```ts
  const callbackPath = publicConfig.routes?.callback ?? '/auth/callback';
  const redirectUri = createRouteUrl(callbackPath, options.appBaseUrl);

  return new ServerClient({
    domain: options.domain,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    authorizationParams: {
      audience: options.audience,
      redirect_uri: redirectUri.toString(),
    },
```

with:

```ts
  // The redirect_uri is only known statically when appBaseUrl is a single
  // string. In dynamic/allow-list mode the login handler supplies it per
  // request, and the callback builds its URL from the resolved base.
  const callbackPath = publicConfig.routes?.callback ?? '/auth/callback';
  const redirectUri =
    typeof options.appBaseUrl === 'string'
      ? createRouteUrl(callbackPath, options.appBaseUrl).toString()
      : undefined;

  return new ServerClient({
    domain: options.domain,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    authorizationParams: {
      audience: options.audience,
      redirect_uri: redirectUri,
    },
```

- [ ] **Step 2: Verify existing specs still pass**

Run: `npx vitest run src/runtime/server/composables/use-auth0.server.spec.ts`
Expected: PASS (static-mode behavior unchanged; `redirect_uri` still set for string `appBaseUrl`).

- [ ] **Step 3: Commit**

```bash
git add packages/auth0-nuxt/src/runtime/server/composables/use-auth0.ts
git commit -m "feat: only bake static redirect_uri into the server client"
```

---

## Task 6: Login handler resolves base URL and passes redirect_uri

**Files:**
- Modify: `packages/auth0-nuxt/src/runtime/server/api/auth/login.get.ts`
- Test: `packages/auth0-nuxt/src/runtime/server/api/auth/login.get.spec.ts`

- [ ] **Step 1: Update the login spec to expect redirect_uri**

Replace the body of `packages/auth0-nuxt/src/runtime/server/api/auth/login.get.spec.ts` with:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import loginHandler from './login.get';
import type { H3Event } from 'h3';

const { sendRedirectMock } = vi.hoisted(() => ({ sendRedirectMock: vi.fn() }));
const { getQueryMock } = vi.hoisted(() => ({ getQueryMock: vi.fn() }));
const { useRuntimeConfigMock } = vi.hoisted(() => ({
  useRuntimeConfigMock: vi.fn(() => ({ public: { auth0: { routes: { callback: '/auth/callback' } } } })),
}));

vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  sendRedirect: sendRedirectMock,
  getQuery: getQueryMock,
}));

vi.mock('#imports', () => ({ useRuntimeConfig: useRuntimeConfigMock }));

const mockAuth0Client = {
  startInteractiveLogin: vi.fn().mockResolvedValue({}),
};

vi.mock('../../composables/use-auth0', () => ({
  useAuth0: vi.fn(() => mockAuth0Client),
}));

describe('login.get handler', () => {
  const mockEvent = {
    context: {
      auth0ClientOptions: { appBaseUrl: 'http://localhost:3000' },
    },
    node: { req: { headers: { host: 'localhost:3000' }, socket: {} }, res: { setHeader: vi.fn() } },
  } as unknown as H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth0Client.startInteractiveLogin.mockResolvedValue(new URL('http://redirectTo'));
  });

  it('passes the resolved redirect_uri and a valid returnTo', async () => {
    getQueryMock.mockReturnValue({ returnTo: 'http://localhost:3000/foo' });

    await loginHandler(mockEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: 'http://localhost:3000/foo' },
      authorizationParams: { redirect_uri: 'http://localhost:3000/auth/callback' },
    });
  });

  it('drops an unsafe returnTo', async () => {
    getQueryMock.mockReturnValue({ returnTo: 'http://foo.bar:3000/foo' });

    await loginHandler(mockEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: undefined },
      authorizationParams: { redirect_uri: 'http://localhost:3000/auth/callback' },
    });
  });

  it('resolves redirect_uri dynamically from the request host', async () => {
    getQueryMock.mockReturnValue({});
    const dynamicEvent = {
      context: { auth0ClientOptions: { appBaseUrl: undefined } },
      node: { req: { headers: { host: 'app2.localhost:3000' }, socket: {} }, res: { setHeader: vi.fn() } },
    } as unknown as H3Event;

    await loginHandler(dynamicEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: 'http://app2.localhost:3000/' },
      authorizationParams: { redirect_uri: 'http://app2.localhost:3000/auth/callback' },
    });
  });

  it('calls sendRedirect with the returned url', async () => {
    getQueryMock.mockReturnValue({});
    mockAuth0Client.startInteractiveLogin.mockResolvedValue(new URL('http://localhost:3000/foo'));

    await loginHandler(mockEvent);

    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, 'http://localhost:3000/foo');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/runtime/server/api/auth/login.get.spec.ts`
Expected: FAIL — handler does not yet pass `authorizationParams.redirect_uri`.

- [ ] **Step 3: Update the login handler**

Replace the contents of `packages/auth0-nuxt/src/runtime/server/api/auth/login.get.ts` with:

```ts
import { useAuth0 } from '../../composables/use-auth0';
import { defineEventHandler, getQuery, sendRedirect } from 'h3';
import { useRuntimeConfig } from '#imports';
import { createRouteUrl, toSafeRedirect } from './../../utils/url';
import { resolveAppBaseUrl } from './../../utils/app-base-url';

interface LoginParams {
  returnTo?: string;
}

export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const auth0ClientOptions = event.context.auth0ClientOptions;
  const runtimeConfig = useRuntimeConfig();

  const appBaseUrl = resolveAppBaseUrl(auth0ClientOptions.appBaseUrl, event);
  const callbackPath = runtimeConfig.public.auth0?.routes?.callback ?? '/auth/callback';
  const redirectUri = createRouteUrl(callbackPath, appBaseUrl);

  const query = getQuery<LoginParams>(event);
  const dangerousReturnTo = query.returnTo ?? appBaseUrl;
  const sanitizedReturnTo = toSafeRedirect(dangerousReturnTo as string, appBaseUrl);

  const authorizationUrl = await auth0Client.startInteractiveLogin({
    appState: { returnTo: sanitizedReturnTo },
    authorizationParams: { redirect_uri: redirectUri.toString() },
  });

  sendRedirect(event, authorizationUrl.href);
});
```

> If `runtimeConfig.public.auth0` is not typed with `routes`, cast as needed: the existing `Auth0PublicConfig` interface in `use-auth0.ts` already models `routes?: RouteConfig`. Reuse that type if a cast is required.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/runtime/server/api/auth/login.get.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/auth0-nuxt/src/runtime/server/api/auth/login.get.ts packages/auth0-nuxt/src/runtime/server/api/auth/login.get.spec.ts
git commit -m "feat: resolve app base url and pass redirect_uri on login"
```

---

## Task 7: Callback handler resolves base URL per request

**Files:**
- Modify: `packages/auth0-nuxt/src/runtime/server/api/auth/callback.get.ts`
- Test: `packages/auth0-nuxt/src/runtime/server/api/auth/callback.get.spec.ts`

- [ ] **Step 1: Add a dynamic-mode test**

In `packages/auth0-nuxt/src/runtime/server/api/auth/callback.get.spec.ts`, update `mockEvent` so the request has a host header (needed for dynamic resolution to be exercisable), and add a dynamic test. Change the `mockEvent` `node.req` to:

```ts
    node: {
      req: {
        url: 'foo',
        headers: { host: 'localhost:3000' },
        socket: {},
      },
    },
```

Then append this test inside the `describe('callback.get handler', ...)` block:

```ts
  it('resolves the base url dynamically from the request host', async () => {
    const dynamicEvent = {
      context: { auth0ClientOptions: { appBaseUrl: undefined } },
      node: { req: { url: 'foo', headers: { host: 'app2.localhost:3000' }, socket: {} } },
    } as unknown as H3Event;
    mockAuth0Client.completeInteractiveLogin.mockResolvedValue({ appState: undefined });

    await callbackHandler(dynamicEvent);

    expect(mockAuth0Client.completeInteractiveLogin).toHaveBeenCalledWith(
      new URL('foo', 'http://app2.localhost:3000')
    );
    expect(sendRedirectMock).toHaveBeenCalledWith(dynamicEvent, 'http://app2.localhost:3000');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/runtime/server/api/auth/callback.get.spec.ts`
Expected: FAIL — the new dynamic test fails because the handler still reads `appBaseUrl` directly (it is `undefined`, producing an invalid URL).

- [ ] **Step 3: Update the callback handler**

Replace the contents of `packages/auth0-nuxt/src/runtime/server/api/auth/callback.get.ts` with:

```ts
import { defineEventHandler, sendRedirect } from 'h3';
import { useAuth0 } from '../../composables/use-auth0';
import { toSafeRedirect } from './../../utils/url';
import { resolveAppBaseUrl } from './../../utils/app-base-url';

export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const auth0ClientOptions = event.context.auth0ClientOptions;

  const appBaseUrl = resolveAppBaseUrl(auth0ClientOptions.appBaseUrl, event);

  const { appState } = await auth0Client.completeInteractiveLogin<{ returnTo: string } | undefined>(
    new URL(event.node.req.url as string, appBaseUrl)
  );

  const safeReturnTo = appState?.returnTo ? toSafeRedirect(appState.returnTo, appBaseUrl) : appBaseUrl;

  sendRedirect(event, safeReturnTo ?? appBaseUrl);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/runtime/server/api/auth/callback.get.spec.ts`
Expected: PASS (existing static tests + new dynamic test).

- [ ] **Step 5: Commit**

```bash
git add packages/auth0-nuxt/src/runtime/server/api/auth/callback.get.ts packages/auth0-nuxt/src/runtime/server/api/auth/callback.get.spec.ts
git commit -m "feat: resolve app base url per request on callback"
```

---

## Task 8: Logout handler resolves base URL per request

**Files:**
- Modify: `packages/auth0-nuxt/src/runtime/server/api/auth/logout.get.ts`
- Test: `packages/auth0-nuxt/src/runtime/server/api/auth/logout.get.spec.ts`

- [ ] **Step 1: Add a dynamic-mode test**

In `packages/auth0-nuxt/src/runtime/server/api/auth/logout.get.spec.ts`, update `mockEvent`'s context to also carry request headers, and add a dynamic test. Change `mockEvent` to:

```ts
  const mockEvent = {
    context: {
      auth0ClientOptions: { appBaseUrl: 'http://localhost:3000' },
    },
    node: { req: { headers: { host: 'localhost:3000' }, socket: {} } },
  } as unknown as H3Event;
```

Then append inside the `describe`:

```ts
  it('resolves returnTo dynamically from the request host', async () => {
    const dynamicEvent = {
      context: { auth0ClientOptions: { appBaseUrl: undefined } },
      node: { req: { headers: { host: 'app2.localhost:3000' }, socket: {} } },
    } as unknown as H3Event;

    await logoutHandler(dynamicEvent);

    expect(mockAuth0Client.logout).toHaveBeenCalledWith({ returnTo: 'http://app2.localhost:3000' });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/runtime/server/api/auth/logout.get.spec.ts`
Expected: FAIL — handler still passes `undefined` as `returnTo` in dynamic mode.

- [ ] **Step 3: Update the logout handler**

Replace the contents of `packages/auth0-nuxt/src/runtime/server/api/auth/logout.get.ts` with:

```ts
import { useAuth0 } from '../../composables/use-auth0';
import { defineEventHandler, sendRedirect } from 'h3';
import { resolveAppBaseUrl } from './../../utils/app-base-url';

export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const auth0ClientOptions = event.context.auth0ClientOptions;

  const returnTo = resolveAppBaseUrl(auth0ClientOptions.appBaseUrl, event);
  const logoutUrl = await auth0Client.logout({ returnTo });

  sendRedirect(event, logoutUrl.href);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/runtime/server/api/auth/logout.get.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/auth0-nuxt/src/runtime/server/api/auth/logout.get.ts packages/auth0-nuxt/src/runtime/server/api/auth/logout.get.spec.ts
git commit -m "feat: resolve app base url per request on logout"
```

---

## Task 9: Full unit suite green

**Files:** none (verification).

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS — all `src/**` specs green, including the new and updated ones.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. Fix any lint issues introduced (e.g. import ordering) and re-run.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "chore: lint fixups for dynamic app base url" || echo "nothing to commit"
```

---

## Task 10: Multi-host example app

**Files:**
- Create: `examples/example-nuxt-web-dynamic-app-base-url/` (based on `examples/example-nuxt-web`)

This example demonstrates allow-list mode serving two hosts from one Auth0 app.

- [ ] **Step 1: Scaffold from the existing example**

Run (from repo root):

```bash
cp -R examples/example-nuxt-web examples/example-nuxt-web-dynamic-app-base-url
rm -rf examples/example-nuxt-web-dynamic-app-base-url/node_modules examples/example-nuxt-web-dynamic-app-base-url/.nuxt examples/example-nuxt-web-dynamic-app-base-url/docker-compose.yml examples/example-nuxt-web-dynamic-app-base-url/server/utils/session-store-factory.ts
```

- [ ] **Step 2: Rename the package**

In `examples/example-nuxt-web-dynamic-app-base-url/package.json`, change the `name` field to:

```json
  "name": "example-nuxt-web-dynamic-app-base-url",
```

- [ ] **Step 3: Configure allow-list mode**

Replace `examples/example-nuxt-web-dynamic-app-base-url/nuxt.config.ts` with a minimal config that omits a static `appBaseUrl` and relies on `NUXT_AUTH0_APP_BASE_URL` (set as a comma-separated allow-list via env). Use:

```ts
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  modules: [['@auth0/auth0-nuxt', { mountRoutes: true }]],
  imports: { autoImport: true },
  runtimeConfig: {
    auth0: {
      domain: '', // NUXT_AUTH0_DOMAIN
      clientId: '', // NUXT_AUTH0_CLIENT_ID
      clientSecret: '', // NUXT_AUTH0_CLIENT_SECRET
      sessionSecret: '', // NUXT_AUTH0_SESSION_SECRET
      // appBaseUrl omitted here on purpose; provided as a comma-separated
      // allow-list via NUXT_AUTH0_APP_BASE_URL (see .env.example).
      audience: '', // NUXT_AUTH0_AUDIENCE
    },
  },
});
```

> Remove the bootstrap `app.head` / `nitro.storage.redis` blocks copied from the source config if present; they are not needed here. Keep `app.vue`, `pages/`, and `middleware/` as copied.

- [ ] **Step 4: Set the example env**

Replace `examples/example-nuxt-web-dynamic-app-base-url/.env.example` with:

```
NUXT_AUTH0_DOMAIN=
NUXT_AUTH0_CLIENT_ID=
NUXT_AUTH0_CLIENT_SECRET=
NUXT_AUTH0_SESSION_SECRET=
# Allow-list of origins this single app serves. Comma-separated.
NUXT_AUTH0_APP_BASE_URL=http://app1.localhost:3000,http://app2.localhost:3000
```

- [ ] **Step 5: Write the example README**

Create `examples/example-nuxt-web-dynamic-app-base-url/README.md`:

```markdown
# Dynamic App Base URL (Nuxt) Example

Serves one Auth0 application across multiple origins. `NUXT_AUTH0_APP_BASE_URL`
is a comma-separated allow-list; the SDK resolves the base URL from each
request's origin.

## Setup

1. Add both hosts to your `/etc/hosts`:

   ```
   127.0.0.1 app1.localhost app2.localhost
   ```

   (Many systems already resolve `*.localhost` to `127.0.0.1`.)

2. In your Auth0 application, add **both** origins to Allowed Callback URLs and
   Allowed Logout URLs:

   - `http://app1.localhost:3000/auth/callback`, `http://app2.localhost:3000/auth/callback`
   - `http://app1.localhost:3000`, `http://app2.localhost:3000`

3. Copy `.env.example` to `.env` and fill in your tenant values.

4. Run the app:

   ```bash
   npm run dev
   ```

5. Visit `http://app1.localhost:3000` and `http://app2.localhost:3000` — logging
   in from either origin redirects back to that same origin.
```

- [ ] **Step 6: Verify the example builds**

Run (from repo root): `npm install && npm run build`
Expected: the workspace builds, including the new example (Nuxt prepares it). If the example fails only because real Auth0 env vars are absent at *runtime*, that is acceptable — the build/prepare step should still pass.

- [ ] **Step 7: Commit**

```bash
git add examples/example-nuxt-web-dynamic-app-base-url
git commit -m "docs: add dynamic app base url nuxt example"
```

---

## Task 11: Documentation

**Files:**
- Modify: `packages/auth0-nuxt/README.md`
- Modify: `packages/auth0-nuxt/EXAMPLES.md`

- [ ] **Step 1: Document the modes in EXAMPLES.md**

Add a new section to `packages/auth0-nuxt/EXAMPLES.md` (place it after the configuration/getting-started section; match the surrounding heading style):

```markdown
## Dynamic Application Base URL

`appBaseUrl` supports serving multiple origins from a single Auth0 application:

- **Static** — a single URL string (default):

  ```
  NUXT_AUTH0_APP_BASE_URL=https://app.example.com
  ```

- **Allow-list** — a comma-separated list of origins. The SDK matches the
  incoming request origin against the list and uses the matching entry.
  Recommended for production multi-origin setups:

  ```
  NUXT_AUTH0_APP_BASE_URL=https://app1.example.com,https://app2.example.com
  ```

- **Dynamic** — omit `appBaseUrl` entirely. The base URL is inferred from each
  request's host (honoring `x-forwarded-host` / `x-forwarded-proto`).

Add every origin to your Auth0 application's **Allowed Callback URLs** and
**Allowed Logout URLs** — this remains the primary safeguard.

> **Production note:** In dynamic and allow-list modes, secure session cookies
> are enforced when `NODE_ENV=production`. Setting
> `sessionConfiguration.cookie.secure = false` in that mode throws an
> `InvalidConfigurationError`.

See the [`example-nuxt-web-dynamic-app-base-url`](../../examples/example-nuxt-web-dynamic-app-base-url)
example for a runnable two-host setup.
```

- [ ] **Step 2: Cross-link from README.md**

In `packages/auth0-nuxt/README.md`, in the section that documents configuration options (where `appBaseUrl` / `NUXT_AUTH0_APP_BASE_URL` is described), add a sentence:

```markdown
`appBaseUrl` may be a single URL, a comma-separated allow-list of origins, or
omitted to infer the origin per request. See
[Dynamic Application Base URL](./EXAMPLES.md#dynamic-application-base-url).
```

> If the README does not yet describe `appBaseUrl`, add the sentence under the configuration/options heading near the other env vars.

- [ ] **Step 3: Commit**

```bash
git add packages/auth0-nuxt/README.md packages/auth0-nuxt/EXAMPLES.md
git commit -m "docs: document dynamic application base url modes"
```

---

## Task 12: Final verification

**Files:** none (verification).

- [ ] **Step 1: Run the full unit suite once more**

Run (from `packages/auth0-nuxt`): `npm run test:unit`
Expected: PASS.

- [ ] **Step 2: Lint the package**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Type-check via build**

Run: `npm run build`
Expected: builds cleanly (the module-builder runs `nuxt-module-build`, which type-checks the runtime).

- [ ] **Step 4: Review the diff against the spec**

Manually confirm every spec section is covered: types, resolver, plugin validation/enforcement, handler wiring, example app, docs. Note anything missing.

- [ ] **Step 5: Final commit if needed**

```bash
git add -A
git commit -m "chore: finalize dynamic app base url" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** types (T2), `InvalidConfigurationError` export (T3), resolver `isUrl`/`inferBaseUrlFromRequest`/`resolveAppBaseUrl` (T1), plugin parse/validate/enforce (T4), static-only baked redirect_uri (T5), login/callback/logout wiring (T6–T8), example app (T10), docs (T11). All spec sections map to a task.
- **Forwarded headers:** honored by default via h3 getters (T1) — matches the approved design.
- **Type consistency:** `resolveAppBaseUrl(appBaseUrl, event?)`, `parseAppBaseUrl`, `validateAppBaseUrl`, `enforceSecureCookies(options, isProduction)` signatures are used identically across tasks and tests.
- **Risk flagged:** the `@auth0/auth0-server-js` `InvalidConfigurationError` export is verified up front (pre-Task-1 note); bump the dependency if missing.
```
