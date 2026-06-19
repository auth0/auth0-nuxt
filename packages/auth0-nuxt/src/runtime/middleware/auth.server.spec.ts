// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getUserMock } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  return { getUserMock };
});

vi.mock('#app/nuxt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#app/nuxt')>();
  return {
    ...actual,
    useNuxtApp: vi.fn(() => ({ ssrContext: { event: { path: '/some-path' } } })),
  };
});

vi.mock('#app/composables/manifest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#app/composables/manifest')>();
  return {
    ...actual,
    getRouteRules: vi.fn(),
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

let useNuxtAppMock: ReturnType<typeof vi.fn>;
let getRouteRulesMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  userState.value = undefined;

  const { useNuxtApp } = await import('#app/nuxt');
  const { getRouteRules } = await import('#app/composables/manifest');

  useNuxtAppMock = vi.mocked(useNuxtApp);
  getRouteRulesMock = vi.mocked(getRouteRules);

  useNuxtAppMock.mockReturnValue({ ssrContext: { event: { path: '/some-path' } } });
  getRouteRulesMock.mockReturnValue({});
  getUserMock.mockResolvedValue({ sub: 'user-1' });
});

describe('auth.server middleware', () => {
  it('writes the user when the route is NOT shared-cacheable', async () => {
    getRouteRulesMock.mockReturnValue({});
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
