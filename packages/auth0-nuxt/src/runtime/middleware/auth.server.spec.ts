// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getUserMock, getRouteRulesMock, eventRef } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getRouteRulesMock: vi.fn(),
  eventRef: { path: '/some-path' },
}));

vi.mock('#app/nuxt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#app/nuxt')>();
  return {
    ...actual,
    useNuxtApp: vi.fn(() => ({ ssrContext: { event: eventRef } })),
  };
});

// The middleware reads the route rules Nitro resolved for the request through Nitro's
// supported `getRouteRules` server util, imported dynamically from `nitropack/runtime`.
// It is called once for the request path and once for a lowercased synthetic event, to
// harden against the case-sensitivity matcher bypass (CVE-2026-53721); the mock dispatches
// on the event's `path` so tests can return different rules per casing.
vi.mock('nitropack/runtime', () => ({
  getRouteRules: getRouteRulesMock,
}));

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

beforeEach(() => {
  vi.clearAllMocks();
  userState.value = undefined;
  eventRef.path = '/some-path';
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

  it('skips the user write (fails closed) when route rules are unavailable', async () => {
    getRouteRulesMock.mockReturnValue(undefined);
    await (middleware as unknown as () => Promise<void>)();
    expect(getUserMock).not.toHaveBeenCalled();
    expect(userState.value).toBeUndefined();
  });

  it('skips the user write when only the lowercased path is shared-cacheable (CVE-2026-53721)', async () => {
    // Simulate the case-sensitivity bypass: the route is requested with mixed casing.
    // Nitro's matcher is case-sensitive, so the exact-path lookup finds no rule, but the
    // page still renders (vue-router is case-insensitive). The guard must also consult the
    // lowercased path so the shared-cacheable rule is not bypassed.
    eventRef.path = '/Cacheable';
    getRouteRulesMock.mockImplementation((event: { path: string }) =>
      event.path === '/cacheable' ? { headers: { 'Cache-Control': 'public, s-maxage=900' } } : {}
    );

    await (middleware as unknown as () => Promise<void>)();

    expect(getUserMock).not.toHaveBeenCalled();
    expect(userState.value).toBeUndefined();
  });
});
