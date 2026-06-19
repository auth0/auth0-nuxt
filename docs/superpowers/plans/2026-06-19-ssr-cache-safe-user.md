# Cache-safe SSR user hydration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the global SSR auth middleware from baking the authenticated user into the `__NUXT__` payload on shared-cacheable routes, while keeping logged-in UX via client-side hydration from a new `no-store` session endpoint.

**Architecture:** Add a cache-aware guard to the SSR middleware (skip the payload write on shared-cacheable routes, fail closed). Add a `no-store` `/auth/profile` endpoint returning `UserClaims | null`. Add a `.client` plugin that hydrates `useUser()` from that endpoint after hydration when SSR left it empty. No new module options; no `loadStrategy` knob.

**Tech Stack:** Nuxt 3 module (`@nuxt/kit`), Nitro/h3, TypeScript, Vitest. Repo: `packages/auth0-nuxt`. All paths below are relative to `packages/auth0-nuxt/`.

**Spec:** `docs/superpowers/specs/2026-06-19-ssr-cache-safe-user-design.md`

**Note:** Do not push. Commit locally only.

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `src/runtime/server/utils/is-shared-cacheable.ts` | Pure predicate: are these route rules shared-cacheable? | Create |
| `src/runtime/server/utils/is-shared-cacheable.spec.ts` | Unit tests for the predicate | Create |
| `src/runtime/helpers/import-meta.ts` | Add `importMetaDev` for test-mockability | Modify |
| `src/runtime/middleware/auth.server.ts` | Gate the SSR user write behind the cacheability guard + dev warning | Modify |
| `src/runtime/server/api/auth/profile.get.ts` | `no-store` endpoint returning `UserClaims \| null` | Create |
| `src/runtime/server/api/auth/profile.get.spec.ts` | Unit tests for the endpoint | Create |
| `src/runtime/plugins/auth.client.ts` | Client hydration plugin | Create |
| `src/types.ts` | Add `profile` to `RouteConfig` | Modify |
| `src/module.ts` | Default `profile` route, mount handler, register client plugin | Modify |
| `src/module.spec.ts` | Update handler-count + routes assertions; assert plugin + profile handler | Modify |
| `README.md` / `EXAMPLES.md` | Document SSR caching behavior | Modify |

---

## Task 1: `isSharedCacheable` predicate (pure, TDD)

**Files:**
- Create: `src/runtime/server/utils/is-shared-cacheable.ts`
- Test: `src/runtime/server/utils/is-shared-cacheable.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/runtime/server/utils/is-shared-cacheable.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isSharedCacheable } from './is-shared-cacheable';

describe('isSharedCacheable', () => {
  it('returns true when route rules are undefined (fail closed)', () => {
    expect(isSharedCacheable(undefined)).toBe(true);
  });

  it('returns true when cache route rule is set', () => {
    expect(isSharedCacheable({ cache: { maxAge: 60 } } as never)).toBe(true);
  });

  it('returns true when swr route rule is set', () => {
    expect(isSharedCacheable({ swr: true } as never)).toBe(true);
  });

  it('returns true when isr route rule is set', () => {
    expect(isSharedCacheable({ isr: true } as never)).toBe(true);
  });

  it('returns true for Cache-Control: public header', () => {
    expect(isSharedCacheable({ headers: { 'Cache-Control': 'public, max-age=600' } } as never)).toBe(true);
  });

  it('returns true for s-maxage header', () => {
    expect(isSharedCacheable({ headers: { 'cache-control': 'max-age=0, s-maxage=900' } } as never)).toBe(true);
  });

  it('matches the header key case-insensitively', () => {
    expect(isSharedCacheable({ headers: { 'CACHE-CONTROL': 'public' } } as never)).toBe(true);
  });

  it('returns false for private max-age only', () => {
    expect(isSharedCacheable({ headers: { 'Cache-Control': 'max-age=600' } } as never)).toBe(false);
  });

  it('returns false for no-store', () => {
    expect(isSharedCacheable({ headers: { 'Cache-Control': 'no-store' } } as never)).toBe(false);
  });

  it('returns false for empty route rules', () => {
    expect(isSharedCacheable({} as never)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/auth0-nuxt && npx vitest run src/runtime/server/utils/is-shared-cacheable.spec.ts`
Expected: FAIL — cannot resolve `./is-shared-cacheable`.

- [ ] **Step 3: Write minimal implementation**

Create `src/runtime/server/utils/is-shared-cacheable.ts`:

```ts
import type { NitroRouteRules } from 'nitropack';

/**
 * Determines whether a route's resolved Nitro route rules make its response
 * shareable across users by a downstream shared cache / CDN.
 *
 * Returns `true` (treat as cacheable) when route rules are unavailable, so callers
 * fail closed: when in doubt, keep the SSR payload anonymous and hydrate on the client.
 *
 * Detects both Nitro's in-process cache rules (`cache` / `swr` / `isr`) and a bare
 * `Cache-Control` header route rule containing `public` or `s-maxage` — the latter is
 * forwarded to the downstream CDN and is NOT reflected by Nitro's own cache signals.
 */
export function isSharedCacheable(routeRules: NitroRouteRules | undefined): boolean {
  if (!routeRules) return true;
  if (routeRules.cache || routeRules.swr || routeRules.isr) return true;

  const headers = routeRules.headers ?? {};
  let cacheControl = '';
  for (const key in headers) {
    if (key.toLowerCase() === 'cache-control') {
      cacheControl = headers[key] ?? '';
      break;
    }
  }

  return /(^|[\s,])(public|s-maxage)(\b|=)/i.test(cacheControl);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/auth0-nuxt && npx vitest run src/runtime/server/utils/is-shared-cacheable.spec.ts`
Expected: PASS (10 tests).

> If `nitropack` types are not resolvable in this package, replace the import with a local structural type:
> ```ts
> type NitroRouteRules = { cache?: unknown; swr?: unknown; isr?: unknown; headers?: Record<string, string> };
> ```
> and drop the import. Verify with `npx tsc --noEmit` (or the repo's typecheck script).

- [ ] **Step 5: Commit**

```bash
git add src/runtime/server/utils/is-shared-cacheable.ts src/runtime/server/utils/is-shared-cacheable.spec.ts
git commit -m "feat: add isSharedCacheable route-rule predicate (#52)"
```

---

## Task 2: Add `importMetaDev` helper

**Files:**
- Modify: `src/runtime/helpers/import-meta.ts`

- [ ] **Step 1: Add the export**

The file currently ends at line 8. Add a third line so it reads:

```ts
/**
 * There seem to be no way to mock `import.meta` in Vitest, so we create a proxy here
 * that can be used in tests to determine if the code is running on the server or client.
 *
 * @see https://github.com/nuxt/test-utils/discussions/884
 */
export const importMetaServer = import.meta.server;
export const importMetaClient = import.meta.client;
export const importMetaDev = import.meta.dev;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/auth0-nuxt && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/runtime/helpers/import-meta.ts
git commit -m "feat: expose importMetaDev helper (#52)"
```

---

## Task 3: Gate the SSR user write behind the cache guard

**Files:**
- Modify: `src/runtime/middleware/auth.server.ts`

- [ ] **Step 1: Replace the middleware body**

Replace the entire contents of `src/runtime/middleware/auth.server.ts` with:

```ts
import { defineNuxtRouteMiddleware, useNuxtApp } from '#imports';
import { getRouteRules } from '#imports';
import { useUser } from '../composables/use-user';
import { importMetaServer, importMetaDev } from '../helpers/import-meta';
import { isSharedCacheable } from '../server/utils/is-shared-cacheable';

const warnedPaths = new Set<string>();

/**
 * Middleware that ensures the useUser composable is populated with the current user
 * during server-side rendering.
 *
 * On shared-cacheable routes the user is NOT written into the SSR payload (which Nuxt
 * serializes into the `__NUXT__` HTML), so cached HTML stays anonymous. The user is
 * hydrated client-side instead by the `auth.client` plugin. Fails closed: if route
 * rules are unavailable, the SSR write is skipped and the client hydrates.
 */
export default defineNuxtRouteMiddleware(async () => {
  if (importMetaServer) {
    const app = useNuxtApp();
    const h3Event = app.ssrContext!.event;

    const routeRules = getRouteRules(h3Event);
    if (isSharedCacheable(routeRules)) {
      if (importMetaDev && !warnedPaths.has(h3Event.path)) {
        warnedPaths.add(h3Event.path);
        // eslint-disable-next-line no-console
        console.warn(
          `[auth0-nuxt] Route "${h3Event.path}" is shared-cacheable; skipping the SSR user write to keep cached HTML anonymous. ` +
            `The user will be hydrated client-side from the profile endpoint.`
        );
      }
      return;
    }

    // As we can only import this composable on the server, we need to dynamically import it.
    const { useAuth0 } = await import('../server/composables/use-auth0');
    const auth0Client = useAuth0(h3Event);

    const user = await auth0Client.getUser();

    useUser().value = user;
  }
});
```

> `getRouteRules` is exported from Nitro and surfaced through Nuxt's `#imports`. If `#imports` does not resolve it during typecheck, import from `nitropack/runtime` instead: `import { getRouteRules } from 'nitropack/runtime';` — keep the `#imports` line for the Nuxt-provided functions.

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/auth0-nuxt && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Run the existing middleware integration test**

Run: `cd packages/auth0-nuxt && npx vitest run test/middleware.test.ts`
Expected: PASS — the existing fixture route `/` has no cache route rules, so the user is still server-rendered and the logout link is visible. (If the runner needs a build step, use the repo's configured test command from `package.json`.)

- [ ] **Step 4: Commit**

```bash
git add src/runtime/middleware/auth.server.ts
git commit -m "feat: skip SSR user write on shared-cacheable routes (#52)"
```

---

## Task 4: Unit test — middleware guard skips the user write on cacheable routes

> **Revised during execution.** The original plan used an `@nuxt/test-utils` e2e fixture asserting against rendered SSR HTML. That harness (`test/middleware.test.ts`) requires **live Auth0 secrets** (`NUXT_AUTH0_*`, injected from GitHub secrets in CI per `.github/workflows/test.yml`); locally the fixture's `<domain>` placeholder is an invalid URL so no session loads and the test fails regardless of code. An e2e "user absent from cached HTML" assertion would therefore pass **vacuously** locally (user absent because the session never loaded, not because the guard fired), and the anti-vacuity sanity check can't be run without secrets. Instead, test the guard deterministically as a **unit test** that mocks `#imports` / `useAuth0` / `useUser`, matching the repo's existing `vi.mock` unit-test style (see `logout.get.spec.ts`). No secrets, no browser, non-vacuous.

**Files:**
- Create: `src/runtime/middleware/auth.server.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/runtime/middleware/auth.server.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { defineMiddlewareMock, useNuxtAppMock, getRouteRulesMock, useUserMock, getUserMock } = vi.hoisted(() => ({
  // defineNuxtRouteMiddleware just returns the handler so we can invoke it directly.
  defineMiddlewareMock: vi.fn((fn) => fn),
  useNuxtAppMock: vi.fn(),
  getRouteRulesMock: vi.fn(),
  useUserMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock('#imports', () => ({
  defineNuxtRouteMiddleware: defineMiddlewareMock,
  useNuxtApp: useNuxtAppMock,
  getRouteRules: getRouteRulesMock,
}));

// Force the server branch of the middleware.
vi.mock('../helpers/import-meta', () => ({
  importMetaServer: true,
  importMetaDev: false,
}));

vi.mock('../composables/use-user', () => ({
  useUser: useUserMock,
}));

// The middleware dynamically imports this; the mock path must match the dynamic specifier.
vi.mock('../server/composables/use-auth0', () => ({
  useAuth0: vi.fn(() => ({ getUser: getUserMock })),
}));

import middleware from './auth.server';

const userState: { value: unknown } = { value: undefined };

beforeEach(() => {
  vi.clearAllMocks();
  userState.value = undefined;
  useUserMock.mockReturnValue(userState);
  useNuxtAppMock.mockReturnValue({ ssrContext: { event: { path: '/some-path' } } });
  getUserMock.mockResolvedValue({ sub: 'user-1' });
});

describe('auth.server middleware', () => {
  it('writes the user when the route is NOT shared-cacheable', async () => {
    getRouteRulesMock.mockReturnValue({}); // no cache rules -> not shared-cacheable
    await (middleware as unknown as () => Promise<void>)();
    expect(getUserMock).toHaveBeenCalledOnce();
    expect(userState.value).toEqual({ sub: 'user-1' });
  });

  it('skips the user write on a shared-cacheable route (public/s-maxage header)', async () => {
    getRouteRulesMock.mockReturnValue({ headers: { 'Cache-Control': 'public, s-maxage=900' } });
    await (middleware as unknown as () => Promise<void>)();
    expect(getUserMock).not.toHaveBeenCalled();
    expect(userState.value).toBeUndefined();
  });

  it('skips the user write on a cache route rule', async () => {
    getRouteRulesMock.mockReturnValue({ cache: { maxAge: 60 } });
    await (middleware as unknown as () => Promise<void>)();
    expect(getUserMock).not.toHaveBeenCalled();
    expect(userState.value).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd packages/auth0-nuxt && npx vitest run src/runtime/middleware/auth.server.spec.ts`
Expected: PASS (3 tests). The middleware code from Task 3 already implements the guard, so the test should pass immediately. This is intentional — Task 3 wrote the implementation; this task locks in its behavior with a deterministic, secret-free test.

> If the dynamic-import mock does not intercept (i.e. `getUserMock` is unexpectedly not called in the non-cacheable case, or a real module loads), adjust the `vi.mock` specifier for `use-auth0` to exactly match the dynamic `import('../server/composables/use-auth0')` path used in `auth.server.ts`. Vitest matches `vi.mock` paths against the literal import specifier.

> Non-vacuity is structural here: the cacheable tests assert `getUser` was **not** called AND state stayed `undefined`, while the non-cacheable test asserts the opposite. If the guard were removed, the cacheable tests would fail (getUser would be called) — so the test genuinely exercises the guard.

- [ ] **Step 3: Commit**

```bash
git add src/runtime/middleware/auth.server.spec.ts
git commit -m "test: cover SSR middleware cache guard (#52)"
```

> Note: the pre-existing e2e test `test/middleware.test.ts` is left unchanged. It only passes in CI with live `NUXT_AUTH0_*` secrets; that is an existing condition, not introduced or fixed by this work.

---

## Task 5: `/auth/profile` no-store endpoint (TDD)

**Files:**
- Create: `src/runtime/server/api/auth/profile.get.ts`
- Test: `src/runtime/server/api/auth/profile.get.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/runtime/server/api/auth/profile.get.spec.ts` (mirrors the `logout.get.spec.ts` mocking style):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import profileHandler from './profile.get';
import type { H3Event } from 'h3';

const { setHeaderMock } = vi.hoisted(() => ({ setHeaderMock: vi.fn() }));

vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  setHeader: setHeaderMock,
}));

const mockAuth0Client = {
  getUser: vi.fn(),
};

vi.mock('../../composables/use-auth0', () => ({
  useAuth0: vi.fn(() => mockAuth0Client),
}));

describe('profile.get handler', () => {
  const mockEvent = { context: {} } as unknown as H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets Cache-Control: no-store', async () => {
    mockAuth0Client.getUser.mockResolvedValue({ sub: 'user-1' });
    await profileHandler(mockEvent);
    expect(setHeaderMock).toHaveBeenCalledWith(mockEvent, 'Cache-Control', 'no-store');
  });

  it('returns the user claims when authenticated', async () => {
    mockAuth0Client.getUser.mockResolvedValue({ sub: 'user-1', email: 'a@example.com' });
    const result = await profileHandler(mockEvent);
    expect(result).toEqual({ sub: 'user-1', email: 'a@example.com' });
  });

  it('returns null when anonymous', async () => {
    mockAuth0Client.getUser.mockResolvedValue(undefined);
    const result = await profileHandler(mockEvent);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/auth0-nuxt && npx vitest run src/runtime/server/api/auth/profile.get.spec.ts`
Expected: FAIL — cannot resolve `./profile.get`.

- [ ] **Step 3: Write minimal implementation**

Create `src/runtime/server/api/auth/profile.get.ts`:

```ts
import { useAuth0 } from '../../composables/use-auth0';
import { defineEventHandler, setHeader } from 'h3';

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store');

  const auth0Client = useAuth0(event);
  const user = await auth0Client.getUser();

  return user ?? null;
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/auth0-nuxt && npx vitest run src/runtime/server/api/auth/profile.get.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/runtime/server/api/auth/profile.get.ts src/runtime/server/api/auth/profile.get.spec.ts
git commit -m "feat: add no-store /auth/profile session endpoint (#52)"
```

---

## Task 6: Client hydration plugin (TDD)

**Files:**
- Create: `src/runtime/plugins/auth.client.ts`
- Test: `src/runtime/plugins/auth.client.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/runtime/plugins/auth.client.spec.ts`. The plugin reads `useUser()`, `useRuntimeConfig()`, and `$fetch`, and registers an `app:suspense:resolve` hook on the Nuxt app. Test by invoking the plugin with a mock `nuxtApp`, capturing the hook callback, and running it.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { useUserMock, useRuntimeConfigMock, fetchMock, definePluginMock } = vi.hoisted(() => ({
  useUserMock: vi.fn(),
  useRuntimeConfigMock: vi.fn(),
  fetchMock: vi.fn(),
  definePluginMock: vi.fn((fn) => fn),
}));

vi.mock('#imports', () => ({
  defineNuxtPlugin: definePluginMock,
  useRuntimeConfig: useRuntimeConfigMock,
  useUser: useUserMock,
  $fetch: fetchMock,
}));

// $fetch is a global in Nuxt; expose the mock globally too.
vi.stubGlobal('$fetch', fetchMock);

import plugin from './auth.client';

function makeNuxtApp() {
  const hooks: Record<string, () => Promise<void>> = {};
  return {
    hook: vi.fn((name: string, cb: () => Promise<void>) => {
      hooks[name] = cb;
    }),
    runHook: (name: string) => hooks[name]?.(),
  };
}

describe('auth.client plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeConfigMock.mockReturnValue({ public: { auth0: { routes: { profile: '/auth/profile' } } } });
  });

  it('does not fetch when the user is already populated', async () => {
    useUserMock.mockReturnValue({ value: { sub: 'existing' } });
    const nuxtApp = makeNuxtApp();
    await plugin(nuxtApp as never);
    expect(nuxtApp.hook).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches the profile and assigns the user after suspense resolves', async () => {
    const user = { value: undefined as unknown };
    useUserMock.mockReturnValue(user);
    fetchMock.mockResolvedValue({ sub: 'hydrated' });

    const nuxtApp = makeNuxtApp();
    await plugin(nuxtApp as never);

    expect(nuxtApp.hook).toHaveBeenCalledWith('app:suspense:resolve', expect.any(Function));
    await nuxtApp.runHook('app:suspense:resolve');

    expect(fetchMock).toHaveBeenCalledWith('/auth/profile', expect.objectContaining({ retry: false }));
    expect(user.value).toEqual({ sub: 'hydrated' });
  });

  it('stays anonymous when the fetch fails', async () => {
    const user = { value: undefined as unknown };
    useUserMock.mockReturnValue(user);
    fetchMock.mockRejectedValue(new Error('network'));

    const nuxtApp = makeNuxtApp();
    await plugin(nuxtApp as never);
    await nuxtApp.runHook('app:suspense:resolve');

    expect(user.value).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/auth0-nuxt && npx vitest run src/runtime/plugins/auth.client.spec.ts`
Expected: FAIL — cannot resolve `./auth.client`.

- [ ] **Step 3: Write minimal implementation**

Create `src/runtime/plugins/auth.client.ts`:

```ts
import { defineNuxtPlugin, useRuntimeConfig } from '#imports';
import { useUser } from '../composables/use-user';
import type { RouteConfig } from '../../types';

/**
 * Client-side hydration of the authenticated user.
 *
 * When SSR did not populate `useUser()` — because the route is shared-cacheable
 * (the server middleware skipped the write) or because the route is client-rendered
 * (`ssr: false`) — fetch the user from the `no-store` profile endpoint after the app
 * suspense resolves. Deferring to `app:suspense:resolve` avoids a hydration mismatch.
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  const user = useUser();

  if (user.value) {
    return;
  }

  const routes = (useRuntimeConfig().public.auth0 as { routes: Required<RouteConfig> }).routes;

  nuxtApp.hook('app:suspense:resolve', async () => {
    try {
      const fetched = await $fetch(routes.profile, {
        headers: { accept: 'application/json' },
        retry: false,
      });
      user.value = fetched ?? undefined;
    } catch {
      // Stay anonymous on failure; auth-dependent UI simply renders logged-out.
    }
  });
});
```

> `$fetch` is a Nuxt auto-imported global; no import line is needed in the runtime file. The test stubs it via `vi.stubGlobal`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/auth0-nuxt && npx vitest run src/runtime/plugins/auth.client.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/runtime/plugins/auth.client.ts src/runtime/plugins/auth.client.spec.ts
git commit -m "feat: hydrate user client-side from profile endpoint (#52)"
```

---

## Task 7: Add `profile` to `RouteConfig`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add the field**

In `src/types.ts`, inside the `RouteConfig` interface, after the `backchannelLogout` field (currently ending at line 149), add:

```ts
  /**
   * The URL for the user profile (session) route.
   * Served `no-store` and fetched client-side to hydrate the user on shared-cacheable
   * or client-rendered pages.
   * @example '/auth/profile'
   */
  profile?: string;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/auth0-nuxt && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add profile route to RouteConfig (#52)"
```

---

## Task 8: Wire the route + plugin in the module

**Files:**
- Modify: `src/module.ts`

- [ ] **Step 1: Import `addPlugin`**

In the import block from `@nuxt/kit` (lines 1-10), add `addPlugin`:

```ts
import {
  defineNuxtModule,
  createResolver,
  addServerHandler,
  addServerPlugin,
  addPlugin,
  addRouteMiddleware,
  addImportsDir,
  addServerImportsDir,
  resolvePath,
} from '@nuxt/kit';
```

- [ ] **Step 2: Add the default profile route**

In `defaultRoutes` (currently lines 64-69), add the `profile` entry:

```ts
    const defaultRoutes = {
      login: '/auth/login',
      callback: '/auth/callback',
      logout: '/auth/logout',
      backchannelLogout: '/auth/backchannel-logout',
      profile: '/auth/profile',
    };
```

- [ ] **Step 3: Register the client plugin**

Immediately after the `addRouteMiddleware({ ... })` call (currently line 83), add:

```ts
    addPlugin(resolver.resolve('./runtime/plugins/auth.client'));
```

- [ ] **Step 4: Mount the profile handler**

Inside the `if (options?.mountRoutes !== false) { ... }` block, after the backchannel-logout handler (currently lines 104-108), add:

```ts
      addServerHandler({
        handler: resolver.resolve('./runtime/server/api/auth/profile.get'),
        route: routes.profile,
        method: 'get',
      });
```

- [ ] **Step 5: Verify it compiles**

Run: `cd packages/auth0-nuxt && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/module.ts
git commit -m "feat: mount profile route and register client plugin (#52)"
```

---

## Task 9: Update module tests for the new route + plugin

**Files:**
- Modify: `src/module.spec.ts`

- [ ] **Step 1: Update the `@nuxt/kit` mock to include `addPlugin`**

In the `vi.mock('@nuxt/kit', ...)` factory (lines 14-29), add `addPlugin: vi.fn(),` and add `addPlugin` to the top-level import (lines 2-9) so it can be asserted on.

```ts
import {
  addServerHandler,
  addServerPlugin,
  addPlugin,
  addRouteMiddleware,
  addImportsDir,
  addServerImportsDir,
  resolvePath,
} from '@nuxt/kit';
```

```ts
    addServerHandler: vi.fn(),
    addServerPlugin: vi.fn(),
    addPlugin: vi.fn(),
    addRouteMiddleware: vi.fn(),
```

- [ ] **Step 2: Assert the client plugin is registered**

In the `'should register server plugin, middleware and composables'` test (lines 52-64), add:

```ts
    expect(addPlugin).toHaveBeenCalledWith('resolved/runtime/plugins/auth.client');
```

- [ ] **Step 3: Update handler count + add profile assertion (default routes test)**

In `'should mount default routes when mountRoutes is undefined'` (lines 73-98), change the count from 4 to 5 and add the profile handler assertion:

```ts
    expect(addServerHandler).toHaveBeenCalledTimes(5);
```

```ts
    expect(addServerHandler).toHaveBeenCalledWith({
      handler: 'resolved/runtime/server/api/auth/profile.get',
      route: '/auth/profile',
      method: 'get',
    });
```

- [ ] **Step 4: Update the custom-routes count**

In `'should mount custom routes when provided and mountRoutes is true'` (lines 100-116), change `toHaveBeenCalledTimes(4)` to `toHaveBeenCalledTimes(5)`. (The custom `routes` object omits `profile`, so it falls back to the default `/auth/profile` — no extra assertion required, but the count must be 5.)

- [ ] **Step 5: Update the public-runtime-config expectation**

In `'should expose routes in public runtime config'` (lines 118-135), add `profile` to `expectedRoutes`:

```ts
    const expectedRoutes = {
      login: '/custom-login',
      callback: '/auth/callback',
      logout: '/auth/logout',
      backchannelLogout: '/auth/backchannel-logout',
      profile: '/auth/profile',
    };
```

- [ ] **Step 6: Run the module tests**

Run: `cd packages/auth0-nuxt && npx vitest run src/module.spec.ts`
Expected: PASS (all tests).

- [ ] **Step 7: Commit**

```bash
git add src/module.spec.ts
git commit -m "test: cover profile route and client plugin registration (#52)"
```

---

## Task 10: Documentation

**Files:**
- Modify: `README.md`
- Modify: `EXAMPLES.md`

- [ ] **Step 1: Add a caching section to `EXAMPLES.md`**

After the "Protecting Routes" section, add:

```markdown
## SSR caching & the authenticated user

By default the module fetches the authenticated user during SSR and exposes it via `useUser()`. Nuxt serializes `useState` (which backs `useUser()`) into the `__NUXT__` payload embedded in the SSR HTML.

To keep that HTML safe to share, the module **skips the SSR user write on shared-cacheable routes** and hydrates the user client-side instead, from the `no-store` profile endpoint (`/auth/profile` by default). A route is considered shared-cacheable when its Nitro route rules set `cache`, `swr`, or `isr`, **or** emit a `Cache-Control` header containing `public` or `s-maxage`:

```ts
// nuxt.config.ts — this makes '/**' shared-cacheable
routeRules: {
  '/**': {
    headers: { 'Cache-Control': 'public, s-maxage=900' },
  },
}
```

On such routes the SSR HTML stays anonymous (no user claims in the payload) and the user is restored on the client after hydration, so auth-dependent UI still works. On non-cacheable routes (e.g. `no-store`) the user is server-rendered as before.

> **Why this matters:** a bare `Cache-Control: public, s-maxage` header is forwarded to your downstream CDN but is not part of Nitro's in-process cache. Without this guard, a shared cache keyed on path could serve one user's claims to another. The module fails closed — if route rules are unavailable, it keeps the SSR payload anonymous and hydrates on the client.

If you disable route mounting (`mountRoutes: false`), mount the profile handler yourself at the configured `routes.profile` path so client-side hydration works.
```

- [ ] **Step 2: Mirror a short version into `README.md`**

After the "Protecting Routes" section in `README.md`, add the same section (or a condensed version linking to `EXAMPLES.md`).

- [ ] **Step 3: Commit**

```bash
git add README.md EXAMPLES.md
git commit -m "docs: document SSR caching behavior and profile endpoint (#52)"
```

---

## Task 11: Full verification

- [ ] **Step 1: Run the full test suite**

Run: `cd packages/auth0-nuxt && npm test` (or the repo's configured test script).
Expected: all tests PASS.

- [ ] **Step 2: Typecheck and lint**

Run: `cd packages/auth0-nuxt && npx tsc --noEmit && npm run lint` (use whichever scripts exist in `package.json`).
Expected: clean.

- [ ] **Step 3: Build the module**

Run: `cd packages/auth0-nuxt && npm run build` (or `prepack`).
Expected: build succeeds; `dist/runtime/plugins/auth.client.*`, `dist/runtime/server/api/auth/profile.get.*`, and `dist/runtime/server/utils/is-shared-cacheable.*` are emitted.

- [ ] **Step 4: Manual verification (optional, from the spec)**

Behind a path-keyed caching proxy honouring `s-maxage` (not keyed on the auth cookie), inspecting **raw server HTML** (View Source / Network → document → Response, NOT `window.__NUXT__`):
1. Cacheable route, logged in → no `email`/`sub`/`auth0_user` in raw HTML; auth UI shows logged-in after hydration.
2. Non-cacheable (`no-store`) authenticated route → user content present in raw HTML.
3. Anonymous incognito on cacheable route → clean logged-out UI, no errors.
4. A → anonymous-B sequence → B never sees A's claims in raw HTML.

- [ ] **Step 5: Final commit (if any cleanup)**

```bash
git add -A
git commit -m "chore: finalize cache-safe SSR user hydration (#52)"
```
