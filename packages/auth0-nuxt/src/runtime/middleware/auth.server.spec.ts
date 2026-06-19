// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getUserMock } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  return { getUserMock };
});

// The middleware reads the SSR event from `useNuxtApp().ssrContext.event`. We override
// `useNuxtApp` per-test (via `currentEvent`) so each test can supply the Nitro route
// rules resolved for the request through `event.context._nitro.routeRules`.
let currentEvent: { path: string; context: { _nitro?: { routeRules?: unknown } } };

vi.mock('#app/nuxt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#app/nuxt')>();
  return {
    ...actual,
    useNuxtApp: vi.fn(() => ({ ssrContext: { event: currentEvent } })),
  };
});

vi.mock('../helpers/import-meta', () => ({
  importMetaServer: true,
  importMetaDev: false,
}));

const userState: { value: unknown } = { value: undefined };
vi.mock('../composables/use-user', () => ({
  useUser: vi.fn(() => userState),
}));

vi.mock('../server/composables/use-auth0', async () => ({
  useAuth0: vi.fn(() => ({ getUser: getUserMock })),
}));

import middleware from './auth.server';

function eventWithRouteRules(routeRules: unknown) {
  return { path: '/some-path', context: { _nitro: { routeRules } } };
}

beforeEach(() => {
  vi.clearAllMocks();
  userState.value = undefined;
  getUserMock.mockResolvedValue({ sub: 'user-1' });
});

describe('auth.server middleware', () => {
  it('writes the user when the route is NOT shared-cacheable', async () => {
    currentEvent = eventWithRouteRules({}); // no cache rules -> not shared-cacheable
    await (middleware as unknown as () => Promise<void>)();
    expect(getUserMock).toHaveBeenCalledOnce();
    expect(userState.value).toEqual({ sub: 'user-1' });
  });

  it('skips the user write on a shared-cacheable route (public/s-maxage header)', async () => {
    currentEvent = eventWithRouteRules({ headers: { 'Cache-Control': 'public, s-maxage=900' } });
    await (middleware as unknown as () => Promise<void>)();
    expect(getUserMock).not.toHaveBeenCalled();
    expect(userState.value).toBeUndefined();
  });

  it('skips the user write on a cache route rule', async () => {
    currentEvent = eventWithRouteRules({ cache: { maxAge: 60 } });
    await (middleware as unknown as () => Promise<void>)();
    expect(getUserMock).not.toHaveBeenCalled();
    expect(userState.value).toBeUndefined();
  });

  it('skips the user write (fails closed) when route rules are unavailable', async () => {
    currentEvent = { path: '/some-path', context: {} }; // no _nitro context
    await (middleware as unknown as () => Promise<void>)();
    expect(getUserMock).not.toHaveBeenCalled();
    expect(userState.value).toBeUndefined();
  });
});
